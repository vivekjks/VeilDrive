import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type {
  AccessGrant,
  ApiKey,
  AppState,
  AuditEvent,
  Comment,
  Credential,
  DataRoom,
  DriveItem,
  EncryptedVersion,
  Guardian,
  Member,
  Notification,
  PrivacyLevel,
  ProofRequest,
  Session,
  ShareDraft,
  UploadResult,
  Workspace,
} from '../types';
import { createInitialState } from './fixtures';
import { decryptVersion, encryptBlob, encryptUpload, sha256 } from '../lib/crypto';
import { deleteEncryptedBlob } from '../lib/indexed-db';
import { randomId } from '../lib/encoding';
import { clearEncryptedAppState, loadEncryptedAppState, saveEncryptedAppState } from '../lib/state-vault';

const loadMidnightContract = () => import('../lib/midnight-contract');

const commitRecord = async (recordType: string, recordId: string, payload: unknown): Promise<string> => {
  const { commitPrivateRecordOnMidnight } = await loadMidnightContract();
  return commitPrivateRecordOnMidnight(recordId, recordType, JSON.stringify(payload));
};

const credentialClaimsPayload = (claims: { organization: string; department: string; role: string }) => JSON.stringify({
  organization: claims.organization.trim(),
  department: claims.department.trim(),
  role: claims.role.trim(),
});

type Update = (state: AppState) => AppState;

const auditEvent = (
  action: AuditEvent['action'],
  target: string,
  fileId?: string,
  options: Partial<AuditEvent> = {},
): AuditEvent => ({
  id: randomId('audit'),
  action,
  actor: 'Vault owner',
  target,
  fileId,
  createdAt: new Date().toISOString(),
  authorized: true,
  private: true,
  ...options,
});

interface AppActions {
  connect: (session: Partial<Session>) => void;
  disconnect: () => void;
  upload: (files: File[], parentId: string | null, privacy: PrivacyLevel) => Promise<UploadResult[]>;
  createFolder: (name: string, parentId: string | null, privacy?: PrivacyLevel) => Promise<DriveItem>;
  addVersion: (fileId: string, file: File) => Promise<EncryptedVersion>;
  download: (fileId: string) => Promise<Blob>;
  toggleFavorite: (fileId: string) => Promise<void>;
  moveToTrash: (fileId: string) => Promise<void>;
  restore: (fileId: string) => Promise<void>;
  deleteForever: (fileId: string) => Promise<void>;
  rename: (fileId: string, name: string) => Promise<void>;
  addTags: (fileId: string, tags: string[]) => Promise<void>;
  share: (fileId: string, draft: ShareDraft) => Promise<AccessGrant>;
  revokeGrant: (grantId: string) => Promise<void>;
  proveGrant: (grantId: string) => Promise<string>;
  consumeGrant: (grantId: string) => Promise<void>;
  addComment: (fileId: string, body: string) => Promise<void>;
  resolveAccessRequest: (requestId: string, result: 'granted' | 'rejected') => Promise<void>;
  createAccessRequest: (fileId: string, permission: AccessGrant['permissions'][number], message: string) => Promise<void>;
  addWorkspace: (name: string, description: string) => Promise<Workspace>;
  createDataRoom: (name: string, description: string, expiresAt: string, credentialRequirement: string) => Promise<DataRoom>;
  inviteToDataRoom: (roomId: string, memberId: string) => Promise<void>;
  updateMember: (memberId: string, patch: Partial<Member>) => Promise<void>;
  addMember: (member: Omit<Member, 'id' | 'joinedAt'>, workspaceId?: string) => Promise<Member>;
  issueCredential: (credential: Omit<Credential, 'id' | 'commitment'>) => Promise<Credential>;
  revokeCredential: (credentialId: string) => Promise<void>;
  createProofRequest: (title: string, condition: string, hiddenFields: string[]) => Promise<ProofRequest>;
  generateProof: (requestId: string, requestOverride?: ProofRequest) => Promise<string>;
  addGuardian: (guardian: Omit<Guardian, 'id' | 'approved'>) => Promise<Guardian>;
  toggleGuardian: (guardianId: string) => Promise<void>;
  setRecoveryThreshold: (threshold: number) => Promise<void>;
  createApiKey: (label: string) => Promise<{ key: ApiKey; secret: string }>;
  revokeApiKey: (keyId: string) => Promise<void>;
  markNotificationsRead: () => void;
  setStorageProvider: (provider: AppState['storageProvider']) => void;
  toggleSidebar: () => void;
  resetVault: () => Promise<void>;
}

interface AppStoreValue {
  state: AppState;
  actions: AppActions;
  ready: boolean;
}

const AppStore = createContext<AppStoreValue | null>(null);

export const AppStoreProvider = ({ children }: PropsWithChildren) => {
  const [state, dispatch] = useReducer((current: AppState, update: Update) => update(current), undefined, createInitialState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadEncryptedAppState()
      .then((stored) => {
        if (!active) return;
        if (stored) dispatch(() => ({ ...createInitialState(), ...stored, storageProvider: 'indexeddb', session: { ...createInitialState().session, ...stored.session } }));
      })
      .finally(() => active && setReady(true));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (ready) saveEncryptedAppState(state).catch(() => undefined);
  }, [ready, state]);

  const connect = useCallback((session: Partial<Session>) => {
    dispatch((current) => {
      const nextSession = { ...current.session, connected: true, ...session, network: 'preprod' as const };
      if (!session.veilId) return { ...current, session: nextSession };
      const owner: Member = {
        id: 'owner', name: nextSession.displayName, wallet: nextSession.walletAddress, veilId: session.veilId,
        role: 'owner', department: 'Owner', status: 'active', joinedAt: new Date().toISOString(),
      };
      return {
        ...current,
        session: nextSession,
        members: current.members.some((member) => member.id === 'owner')
          ? current.members.map((member) => member.id === 'owner' ? { ...member, ...owner } : member)
          : [owner, ...current.members],
      };
    });
  }, []);

  const disconnect = useCallback(() => {
    dispatch((current) => ({ ...current, session: { ...current.session, connected: false } }));
  }, []);

  const upload = useCallback(async (files: File[], parentId: string | null, privacy: PrivacyLevel) => {
    const results: UploadResult[] = [];
    for (const file of files) results.push(await encryptUpload(file, parentId, 'owner', privacy));
    const parent = state.items.find((item) => item.id === parentId);
    if (parent) {
      for (const result of results) {
        result.item.workspaceId = parent.workspaceId;
        result.item.dataRoomId = parent.dataRoomId;
      }
    }
    if (state.session.mode === 'preprod') {
      try {
        const { registerFileOnMidnight } = await loadMidnightContract();
        for (const result of results) {
          result.version.transactionId = await registerFileOnMidnight(
            result.item.id,
            result.version.commitment,
            await sha256(result.version.metadataCipher),
          );
        }
      } catch (error) {
        await Promise.all(results.map((result) => deleteEncryptedBlob(result.version.blobKey)));
        throw error;
      }
    }
    dispatch((current) => ({
      ...current,
      items: [...results.map((result) => result.item), ...current.items],
      versions: [...current.versions, ...results.map((result) => result.version)],
      audit: [
        ...results.map((result) => auditEvent('upload', result.item.name, result.item.id, { transactionId: result.version.transactionId })),
        ...current.audit,
      ],
      notifications: [
        { id: randomId('notice'), title: 'Upload protected', body: `${results.length} item${results.length === 1 ? '' : 's'} encrypted and committed.`, createdAt: new Date().toISOString(), read: false, type: 'security' },
        ...current.notifications,
      ],
    }));
    return results;
  }, [state.items, state.session.mode]);

  const createFolder = useCallback(async (name: string, parentId: string | null, privacy: PrivacyLevel = 'private') => {
    const timestamp = new Date().toISOString();
    const parent = state.items.find((item) => item.id === parentId);
    const item: DriveItem = {
      id: randomId('folder'), kind: 'folder', name, encryptedName: `d_${crypto.randomUUID().slice(0, 10)}.enc`,
      mimeType: 'application/x-directory', size: 0, parentId, ownerId: 'owner', privacy,
      createdAt: timestamp, modifiedAt: timestamp, favorite: false, trashed: false, versionIds: [], tags: [],
      workspaceId: parent?.workspaceId,
      dataRoomId: parent?.dataRoomId,
    };
    await commitRecord('item-metadata', item.id, item);
    dispatch((current) => ({ ...current, items: [item, ...current.items] }));
    return item;
  }, [state.items]);

  const addVersion = useCallback(async (fileId: string, file: File) => {
    const target = state.items.find((item) => item.id === fileId);
    if (!target) throw new Error('File not found.');
    const nextVersion = target.versionIds.length + 1;
    const version = await encryptBlob(file, fileId, nextVersion, 'owner', { name: target.name, type: file.type, size: file.size });
    if (state.session.mode === 'preprod') {
      try {
        const { updateFileOnMidnight } = await loadMidnightContract();
        version.transactionId = await updateFileOnMidnight(
          fileId,
          version.commitment,
          await sha256(version.metadataCipher),
        );
      } catch (error) {
        await deleteEncryptedBlob(version.blobKey);
        throw error;
      }
    }
    dispatch((current) => ({
      ...current,
      items: current.items.map((item) => item.id === fileId ? { ...item, size: file.size, modifiedAt: version.createdAt, versionIds: [...item.versionIds, version.id], currentVersionId: version.id } : item),
      versions: [...current.versions, version],
      audit: [auditEvent('upload', `${target.name} · v${nextVersion}`, fileId, { transactionId: version.transactionId }), ...current.audit],
    }));
    return version;
  }, [state.items, state.session.mode]);

  const download = useCallback(async (fileId: string) => {
    const item = state.items.find((candidate) => candidate.id === fileId);
    const version = state.versions.find((candidate) => candidate.id === item?.currentVersionId);
    if (!item || !version) throw new Error('Encrypted version is unavailable.');
    const { generateAuditProofOnMidnight } = await loadMidnightContract();
    const receipt = await generateAuditProofOnMidnight(fileId, await sha256(`download:${fileId}:${version.commitment}:${Date.now()}`));
    const plaintext = await decryptVersion(version);
    dispatch((current) => ({ ...current, audit: [auditEvent('download', item.name, fileId, { actor: current.session.displayName, transactionId: receipt }), ...current.audit] }));
    return new Blob([plaintext], { type: item.mimeType });
  }, [state.items, state.versions]);

  const toggleFavorite = useCallback(async (fileId: string) => {
    const item = state.items.find((candidate) => candidate.id === fileId);
    if (!item) throw new Error('Item not found.');
    const updated = { ...item, favorite: !item.favorite };
    await commitRecord('item-metadata', fileId, updated);
    dispatch((current) => ({ ...current, items: current.items.map((candidate) => candidate.id === fileId ? updated : candidate) }));
  }, [state.items]);

  const moveToTrash = useCallback(async (fileId: string) => {
    const item = state.items.find((candidate) => candidate.id === fileId);
    if (!item) throw new Error('Item not found.');
    const updated = { ...item, trashed: true, modifiedAt: new Date().toISOString() };
    const transactionId = await commitRecord('item-metadata', fileId, updated);
    dispatch((current) => ({ ...current, items: current.items.map((candidate) => candidate.id === fileId ? updated : candidate), audit: [auditEvent('delete', item.name, fileId, { actor: current.session.displayName, transactionId }), ...current.audit] }));
  }, [state.items]);

  const restore = useCallback(async (fileId: string) => {
    const item = state.items.find((candidate) => candidate.id === fileId);
    if (!item) throw new Error('Item not found.');
    const updated = { ...item, trashed: false, modifiedAt: new Date().toISOString() };
    const transactionId = await commitRecord('item-metadata', fileId, updated);
    dispatch((current) => ({ ...current, items: current.items.map((candidate) => candidate.id === fileId ? updated : candidate), audit: [auditEvent('restore', item.name, fileId, { actor: current.session.displayName, transactionId }), ...current.audit] }));
  }, [state.items]);

  const deleteForever = useCallback(async (fileId: string) => {
    const item = state.items.find((candidate) => candidate.id === fileId);
    if (!item) throw new Error('Item not found.');
    const contract = await loadMidnightContract();
    if (item.kind === 'file') await contract.revokeFileOnMidnight(fileId);
    else await contract.revokePrivateRecordOnMidnight(fileId);
    const removedVersions = state.versions.filter((version) => version.fileId === fileId);
    await Promise.all(removedVersions.map((version) => deleteEncryptedBlob(version.blobKey)));
    dispatch((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== fileId && item.parentId !== fileId),
      versions: current.versions.filter((version) => version.fileId !== fileId),
      grants: current.grants.filter((grant) => grant.fileId !== fileId),
      comments: current.comments.filter((comment) => comment.fileId !== fileId),
    }));
  }, [state.items, state.versions]);

  const rename = useCallback(async (fileId: string, name: string) => {
    const item = state.items.find((candidate) => candidate.id === fileId);
    if (!item) throw new Error('Item not found.');
    const updated = { ...item, name, modifiedAt: new Date().toISOString() };
    await commitRecord('item-metadata', fileId, updated);
    dispatch((current) => ({ ...current, items: current.items.map((candidate) => candidate.id === fileId ? updated : candidate) }));
  }, [state.items]);

  const addTags = useCallback(async (fileId: string, tags: string[]) => {
    const item = state.items.find((candidate) => candidate.id === fileId);
    if (!item) throw new Error('Item not found.');
    const updated = { ...item, tags: Array.from(new Set([...item.tags, ...tags])) };
    await commitRecord('item-metadata', fileId, updated);
    dispatch((current) => ({ ...current, items: current.items.map((candidate) => candidate.id === fileId ? updated : candidate) }));
  }, [state.items]);

  const share = useCallback(async (fileId: string, draft: ShareDraft) => {
    const createdAt = new Date().toISOString();
    const id = randomId('grant');
    const token = draft.method === 'external' ? crypto.randomUUID().replaceAll('-', '') : undefined;
    let transactionId: string;
    {
      const { createPolicyOnMidnight, grantWalletAccessOnMidnight } = await loadMidnightContract();
      if (draft.method === 'policy') {
        const valueFor = (field: 'organization' | 'department' | 'role') => draft.conditions.find((condition) => condition.field === field && condition.operator === 'is')?.value.trim() ?? '';
        const policyClaims = { organization: valueFor('organization'), department: valueFor('department'), role: valueFor('role') };
        if (!policyClaims.organization || !policyClaims.department || !policyClaims.role) throw new Error('Policy access requires exact organization, department, and role claims.');
        transactionId = await createPolicyOnMidnight(
          id,
          fileId,
          credentialClaimsPayload(policyClaims),
          draft.permissions,
          draft.expiresAt,
          draft.oneTime,
        );
      } else if (draft.method === 'team') {
        throw new Error('Use an exact private credential rule for team access.');
      } else if (draft.method === 'wallet') {
        transactionId = await grantWalletAccessOnMidnight(
          fileId,
          draft.recipient,
          draft.permissions,
          draft.expiresAt,
          draft.oneTime,
        );
      } else {
        transactionId = await commitRecord('external-grant', id, { fileId, ...draft, token, createdAt });
      }
    }
    const grant: AccessGrant = {
      id, fileId, ...draft, createdAt, transactionId,
      consumedAt: null, revokedAt: null,
      token,
    };
    dispatch((current) => {
      const item = current.items.find((candidate) => candidate.id === fileId);
      return {
        ...current,
        grants: [grant, ...current.grants],
        audit: [auditEvent('share', item?.name ?? fileId, fileId, { transactionId }), ...current.audit],
        notifications: [{ id: randomId('notice'), title: 'Private access created', body: `${grant.recipientLabel} can now ${grant.permissions.join(', ')}.`, createdAt, read: false, type: 'access' }, ...current.notifications],
      };
    });
    return grant;
  }, []);

  const revokeGrant = useCallback(async (grantId: string) => {
    const grant = state.grants.find((candidate) => candidate.id === grantId);
    if (!grant) throw new Error('Access grant not found.');
    let receipt: string | undefined;
    {
      const { revokeGrantOnMidnight, revokePrivateRecordOnMidnight, revokePolicyOnMidnight } = await loadMidnightContract();
      receipt = grant.method === 'policy' || grant.method === 'team'
        ? await revokePolicyOnMidnight(grant.id)
        : grant.method === 'external'
          ? await revokePrivateRecordOnMidnight(grant.id)
          : await revokeGrantOnMidnight(grant.fileId, grant.recipient);
    }
    dispatch((current) => {
      const file = current.items.find((item) => item.id === grant.fileId);
      return {
        ...current,
        grants: current.grants.map((candidate) => candidate.id === grantId ? { ...candidate, revokedAt: new Date().toISOString() } : candidate),
        audit: [auditEvent('revoke', file?.name ?? grant.fileId, grant.fileId, { transactionId: receipt }), ...current.audit],
      };
    });
  }, [state.grants]);

  const consumeGrant = useCallback(async (grantId: string) => {
    const grant = state.grants.find((candidate) => candidate.id === grantId);
    if (!grant) throw new Error('Access grant not found.');
    const consumedAt = new Date().toISOString();
    if (grant.method === 'external') await commitRecord('external-grant', grant.id, { ...grant, consumedAt });
    else if (grant.method === 'wallet') {
      const { consumeWalletAccessOnMidnight } = await loadMidnightContract();
      await consumeWalletAccessOnMidnight(grant.fileId);
    } else {
      const credential = state.credentials.find((candidate) => candidate.status === 'active');
      if (!credential) throw new Error('An active credential is required to consume this policy grant.');
      const { consumePolicyAccessOnMidnight } = await loadMidnightContract();
      await consumePolicyAccessOnMidnight(grant.id, credential.id);
    }
    dispatch((current) => ({ ...current, grants: current.grants.map((candidate) => candidate.id === grantId ? { ...candidate, consumedAt } : candidate) }));
  }, [state.credentials, state.grants]);

  const proveGrant = useCallback(async (grantId: string) => {
    const grant = state.grants.find((candidate) => candidate.id === grantId);
    if (!grant) throw new Error('Access grant not found.');
    if (grant.revokedAt) throw new Error('This access grant has been revoked.');
    if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now()) throw new Error('This access grant has expired.');
    if (grant.oneTime && grant.consumedAt) throw new Error('This one-time access grant has already been consumed.');
    const contract = await loadMidnightContract();
    let receipt: string;
    if (grant.method === 'wallet') {
      receipt = await contract.proveWalletAccessOnMidnight(grant.fileId);
    } else if (grant.method === 'policy' || grant.method === 'team') {
      const credential = state.credentials.find((candidate) => candidate.status === 'active');
      if (!credential) throw new Error('An active credential is required to prove this policy.');
      receipt = await contract.provePolicyAccessOnMidnight(grant.id, credential.id);
    } else {
      receipt = await commitRecord('external-access-proof', `${grant.id}:proof:${Date.now()}`, {
        grantId: grant.id,
        fileId: grant.fileId,
        provedAt: new Date().toISOString(),
      });
    }
    const file = state.items.find((candidate) => candidate.id === grant.fileId);
    dispatch((current) => ({
      ...current,
      audit: [auditEvent('proof', file?.name ?? grant.fileId, grant.fileId, { actor: current.session.displayName, transactionId: receipt }), ...current.audit],
    }));
    return receipt;
  }, [state.credentials, state.grants, state.items]);

  const addComment = useCallback(async (fileId: string, body: string) => {
    const comment: Comment = { id: randomId('comment'), fileId, author: state.session.displayName, body, encrypted: true, createdAt: new Date().toISOString() };
    const transactionId = await commitRecord('encrypted-comment', comment.id, comment);
    const file = state.items.find((item) => item.id === fileId);
    dispatch((current) => ({ ...current, comments: [...current.comments, comment], audit: [auditEvent('comment', file?.name ?? fileId, fileId, { actor: current.session.displayName, transactionId }), ...current.audit] }));
  }, [state.items, state.session.displayName]);

  const resolveAccessRequest = useCallback(async (requestId: string, result: 'granted' | 'rejected') => {
    const request = state.accessRequests.find((candidate) => candidate.id === requestId);
    if (!request) throw new Error('Access request not found.');
    const updated = { ...request, status: result };
    await commitRecord('access-request', requestId, updated);
    dispatch((current) => ({ ...current, accessRequests: current.accessRequests.map((candidate) => candidate.id === requestId ? updated : candidate) }));
  }, [state.accessRequests]);

  const createAccessRequest = useCallback(async (fileId: string, permission: AccessGrant['permissions'][number], message: string) => {
    const request = { id: randomId('request'), fileId, requesterId: 'owner', requesterName: state.session.displayName, permission, message, status: 'pending' as const, createdAt: new Date().toISOString() };
    await commitRecord('access-request', request.id, request);
    dispatch((current) => ({ ...current, accessRequests: [request, ...current.accessRequests] }));
  }, [state.session.displayName]);

  const addWorkspace = useCallback(async (name: string, description: string) => {
    const root = await createFolder(name, null, 'confidential');
    const workspace: Workspace = { id: randomId('workspace'), name, description, memberIds: ['owner'], privacy: 'confidential', rootFolderId: root.id };
    await commitRecord('workspace', workspace.id, workspace);
    dispatch((current) => ({ ...current, workspaces: [...current.workspaces, workspace], items: current.items.map((item) => item.id === root.id ? { ...item, workspaceId: workspace.id } : item) }));
    return workspace;
  }, [createFolder]);

  const createDataRoom = useCallback(async (name: string, description: string, expiresAt: string, credentialRequirement: string) => {
    const root = await createFolder(name, null, 'maximum');
    const room: DataRoom = {
      id: randomId('room'), name, description, rootFolderId: root.id, participantIds: ['owner'],
      privacy: 'maximum', expiresAt, credentialRequirement,
    };
    await commitRecord('data-room', room.id, room);
    dispatch((current) => ({
      ...current,
      dataRooms: [room, ...current.dataRooms],
      items: current.items.map((item) => item.id === root.id ? { ...item, dataRoomId: room.id } : item),
    }));
    return room;
  }, [createFolder]);

  const inviteToDataRoom = useCallback(async (roomId: string, memberId: string) => {
    const room = state.dataRooms.find((candidate) => candidate.id === roomId);
    const member = state.members.find((candidate) => candidate.id === memberId);
    if (!room || !member) throw new Error('Data room or member not found.');
    const updatedRoom = { ...room, participantIds: Array.from(new Set([...room.participantIds, memberId])) };
    await commitRecord('data-room', roomId, updatedRoom);
    dispatch((current) => ({ ...current, dataRooms: current.dataRooms.map((candidate) => candidate.id === roomId ? updatedRoom : candidate), members: current.members.map((candidate) => candidate.id === memberId ? { ...candidate, status: 'invited' } : candidate), notifications: [{ id: randomId('notice'), title: 'Data room invitation sent', body: `${member.name} must prove the required credential before access.`, createdAt: new Date().toISOString(), read: false, type: 'workspace' }, ...current.notifications] }));
  }, [state.dataRooms, state.members]);

  const updateMember = useCallback(async (memberId: string, patch: Partial<Member>) => {
    const member = state.members.find((candidate) => candidate.id === memberId);
    if (!member) throw new Error('Member not found.');
    const updated = { ...member, ...patch };
    await commitRecord('member', memberId, updated);
    dispatch((current) => ({ ...current, members: current.members.map((candidate) => candidate.id === memberId ? updated : candidate) }));
  }, [state.members]);

  const addMember = useCallback(async (member: Omit<Member, 'id' | 'joinedAt'>, workspaceId?: string) => {
    const created: Member = { ...member, id: randomId('member'), joinedAt: new Date().toISOString() };
    const workspace = state.workspaces.find((candidate) => candidate.id === (workspaceId ?? state.workspaces[0]?.id));
    await commitRecord('member', created.id, created);
    if (workspace) await commitRecord('workspace', workspace.id, { ...workspace, memberIds: [...workspace.memberIds, created.id] });
    dispatch((current) => ({
      ...current,
      members: [...current.members, created],
      workspaces: current.workspaces.map((workspace) => workspace.id === (workspaceId ?? current.workspaces[0]?.id)
        ? { ...workspace, memberIds: [...workspace.memberIds, created.id] }
        : workspace),
    }));
    return created;
  }, [state.workspaces]);

  const issueCredential = useCallback(async (input: Omit<Credential, 'id' | 'commitment'>) => {
    const id = randomId('credential');
    const claims = credentialClaimsPayload(input);
    let commitment = await sha256(claims);
    if (state.session.mode === 'preprod') {
      const { issueCredentialOnMidnight, setLocalCredentialClaimsOnMidnight } = await loadMidnightContract();
      const member = state.members.find((candidate) => candidate.id === input.subjectId);
      const holderIdentity = input.subjectId === 'owner' ? state.session.veilId : member?.veilId;
      if (!holderIdentity || !/^[0-9a-f]{64}$/i.test(holderIdentity)) {
        throw new Error('This member needs a 64-character Veil ID before a credential can be issued on preprod.');
      }
      await issueCredentialOnMidnight(id, holderIdentity, claims, input.expiresAt);
      if (input.subjectId === 'owner') await setLocalCredentialClaimsOnMidnight(claims);
    }
    const credential: Credential = { ...input, id, commitment };
    dispatch((current) => ({ ...current, credentials: [...current.credentials, credential] }));
    return credential;
  }, [state.members, state.session.mode, state.session.veilId]);

  const revokeCredential = useCallback(async (credentialId: string) => {
    if (state.session.mode === 'preprod') {
      const { revokeCredentialOnMidnight } = await loadMidnightContract();
      await revokeCredentialOnMidnight(credentialId);
    }
    dispatch((current) => ({
      ...current,
      credentials: current.credentials.map((credential) => credential.id === credentialId ? { ...credential, status: 'revoked' } : credential),
    }));
  }, [state.session.mode]);

  const createProofRequest = useCallback(async (title: string, condition: string, hiddenFields: string[]) => {
    const request: ProofRequest = { id: randomId('proof'), title, condition, hiddenFields, status: 'draft', createdAt: new Date().toISOString() };
    await commitRecord('proof-request', request.id, request);
    dispatch((current) => ({ ...current, proofRequests: [request, ...current.proofRequests] }));
    return request;
  }, []);

  const generateProof = useCallback(async (requestId: string, requestOverride?: ProofRequest) => {
    const request = state.proofRequests.find((candidate) => candidate.id === requestId) ?? requestOverride;
    if (!request) throw new Error('Proof request not found.');
    const commitment = await sha256(`${request.title}:${request.condition}:${request.hiddenFields.join('|')}:${state.session.walletAddress}`);
    let receipt = commitment;
    if (state.session.mode === 'preprod') {
      const { generateAuditProofOnMidnight } = await loadMidnightContract();
      receipt = await generateAuditProofOnMidnight(request.id, commitment);
    }
    dispatch((current) => ({
      ...current,
      proofRequests: current.proofRequests.map((candidate) => candidate.id === requestId ? { ...candidate, status: 'generated', proofCommitment: commitment } : candidate),
      audit: [auditEvent('proof', request.title, undefined, { transactionId: receipt }), ...current.audit],
    }));
    return commitment;
  }, [state.proofRequests, state.session.mode, state.session.walletAddress]);

  const addGuardian = useCallback(async (guardian: Omit<Guardian, 'id' | 'approved'>) => {
    const created: Guardian = { ...guardian, id: randomId('guardian'), approved: false };
    await commitRecord('recovery-guardian', created.id, created);
    dispatch((current) => ({ ...current, guardians: [...current.guardians, created] }));
    return created;
  }, []);

  const toggleGuardian = useCallback(async (guardianId: string) => {
    const guardian = state.guardians.find((candidate) => candidate.id === guardianId);
    if (!guardian) throw new Error('Recovery guardian not found.');
    const updated = { ...guardian, approved: !guardian.approved };
    await commitRecord('recovery-guardian', guardianId, updated);
    dispatch((current) => ({ ...current, guardians: current.guardians.map((candidate) => candidate.id === guardianId ? updated : candidate) }));
  }, [state.guardians]);

  const setRecoveryThreshold = useCallback(async (threshold: number) => {
    await commitRecord('recovery-policy', 'recovery-threshold', { threshold, guardianIds: state.guardians.map((guardian) => guardian.id) });
    dispatch((current) => ({ ...current, recoveryThreshold: threshold }));
  }, [state.guardians]);

  const createApiKey = useCallback(async (label: string) => {
    const secret = `veil_live_${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
    const key: ApiKey = { id: randomId('api'), label, prefix: secret.slice(0, 18), createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: null };
    await commitRecord('developer-key', key.id, key);
    dispatch((current) => ({ ...current, apiKeys: [...current.apiKeys, key] }));
    return { key, secret };
  }, []);

  const revokeApiKey = useCallback(async (keyId: string) => {
    const key = state.apiKeys.find((candidate) => candidate.id === keyId);
    if (!key) throw new Error('Developer key not found.');
    const { revokePrivateRecordOnMidnight } = await loadMidnightContract();
    await revokePrivateRecordOnMidnight(keyId);
    dispatch((current) => ({ ...current, apiKeys: current.apiKeys.map((candidate) => candidate.id === keyId ? { ...candidate, revokedAt: new Date().toISOString() } : candidate) }));
  }, [state.apiKeys]);

  const markNotificationsRead = useCallback(() => dispatch((current) => ({ ...current, notifications: current.notifications.map((notice) => ({ ...notice, read: true })) })), []);
  const setStorageProvider = useCallback((provider: AppState['storageProvider']) => {
    if (provider !== 'indexeddb') return;
    dispatch((current) => ({ ...current, storageProvider: provider }));
  }, []);
  const toggleSidebar = useCallback(() => dispatch((current) => ({ ...current, sidebarCollapsed: !current.sidebarCollapsed })), []);
  const resetVault = useCallback(async () => {
    await Promise.all(state.versions.map((version) => deleteEncryptedBlob(version.blobKey)));
    clearEncryptedAppState();
    window.location.assign('/');
  }, [state.versions]);

  const actions = useMemo<AppActions>(() => ({
    connect, disconnect, upload, createFolder, addVersion, download, toggleFavorite, moveToTrash, restore,
    deleteForever, rename, addTags, share, revokeGrant, proveGrant, consumeGrant, addComment, resolveAccessRequest,
    createAccessRequest, addWorkspace, createDataRoom, inviteToDataRoom, updateMember, addMember, issueCredential, revokeCredential,
    createProofRequest, generateProof, addGuardian, toggleGuardian, setRecoveryThreshold, createApiKey,
    revokeApiKey, markNotificationsRead, setStorageProvider, toggleSidebar, resetVault,
  }), [
    addComment, addGuardian, addMember, addTags, addVersion, addWorkspace, connect, createAccessRequest,
    createApiKey, createDataRoom, createFolder, createProofRequest, deleteForever, disconnect, download, generateProof,
    inviteToDataRoom, issueCredential, markNotificationsRead, moveToTrash, rename, resetVault, resolveAccessRequest, restore,
    revokeApiKey, revokeCredential, revokeGrant, proveGrant, setRecoveryThreshold, setStorageProvider, share,
    toggleFavorite, toggleGuardian, toggleSidebar, updateMember, upload, consumeGrant,
  ]);

  return <AppStore.Provider value={{ state, actions, ready }}>{children}</AppStore.Provider>;
};

export const useAppStore = (): AppStoreValue => {
  const store = useContext(AppStore);
  if (!store) throw new Error('useAppStore must be used inside AppStoreProvider.');
  return store;
};

export const unreadNotifications = (notifications: Notification[]): number => notifications.filter((notice) => !notice.read).length;
