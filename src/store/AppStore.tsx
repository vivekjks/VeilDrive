import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type {
  AccessGrant,
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
  PendingFileWrite,
  PrivacyLevel,
  Session,
  ShareDraft,
  UploadResult,
  Workspace,
} from '../types';
import { createInitialState } from './initial-state';
import { decryptVersion, encryptBlob, encryptUpload, sha256 } from '../lib/crypto';
import { clearVaultDatabase, deleteEncryptedBlob } from '../lib/indexed-db';
import { base64ToBytes, bytesToBase64, randomId } from '../lib/encoding';
import { clearEncryptedAppState, loadEncryptedAppState, saveEncryptedAppState } from '../lib/state-vault';
import { disconnectMidnightWallet } from '../lib/midnight';

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

const credentialForPolicy = (credentials: Credential[], grant: AccessGrant) => credentials.find((credential) => credential.status === 'active'
  && grant.conditions.every((condition) => condition.field === 'credentialStatus'
    || (condition.operator === 'is' && credential[condition.field as 'organization' | 'department' | 'role'] === condition.value)));

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
  disconnect: () => Promise<void>;
  upload: (files: File[], parentId: string | null, privacy: PrivacyLevel, onProgress?: (stage: 'encrypting' | 'registering') => void) => Promise<UploadResult[]>;
  retryPendingFileWrite: (fileId: string) => Promise<void>;
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
  issueCredential: (credential: Omit<Credential, 'id' | 'commitment' | 'claimsSecret' | 'transactionId'>) => Promise<Credential>;
  exportCredential: (credentialId: string) => string;
  importCredential: (encodedPackage: string) => Promise<Credential>;
  revokeCredential: (credentialId: string) => Promise<void>;
  addGuardian: (guardian: Omit<Guardian, 'id' | 'approved'>) => Promise<Guardian>;
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
  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    let active = true;
    loadEncryptedAppState()
      .then((stored) => {
        if (!active) return;
        if (stored) dispatch(() => ({ ...createInitialState(), ...stored, storageProvider: 'indexeddb', session: { ...createInitialState().session, ...stored.session, connected: false } }));
        setReady(true);
      })
      .catch((error: unknown) => { if (active) setStorageError(error instanceof Error ? error.message : 'Encrypted storage is unavailable.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (ready) saveEncryptedAppState(state).catch(() => setStorageError('The encrypted vault could not be saved. Keep this page open and free browser storage before retrying.'));
  }, [ready, state]);

  const connect = useCallback((session: Partial<Session>) => {
    if (state.session.walletAddress && session.walletAddress && state.session.walletAddress !== session.walletAddress) {
      disconnectMidnightWallet();
      throw new Error('This local vault belongs to another wallet. Reconnect its original wallet or use a separate browser profile for the new account.');
    }
    if (state.items.length && state.session.contractAddress && session.contractAddress && state.session.contractAddress !== session.contractAddress) {
      throw new Error('This vault contains files registered to another contract. Use a separate browser profile for a different registry.');
    }
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
  }, [state.items.length, state.session.contractAddress, state.session.walletAddress]);

  const disconnect = useCallback(async () => {
    disconnectMidnightWallet();
    const { clearMidnightContractSession } = await loadMidnightContract();
    clearMidnightContractSession();
    dispatch((current) => ({ ...current, session: { ...current.session, connected: false } }));
  }, []);

  const upload = useCallback(async (files: File[], parentId: string | null, privacy: PrivacyLevel, onProgress?: (stage: 'encrypting' | 'registering') => void) => {
    const results: UploadResult[] = [];
    const parent = state.items.find((item) => item.id === parentId);
    if (parentId && (!parent || parent.kind !== 'folder' || parent.trashed)) throw new Error('Choose an active destination folder.');
    const { registerFileOnMidnight, hasActiveMidnightContract } = await loadMidnightContract();
    if (!hasActiveMidnightContract()) throw new Error('Connect your wallet and open the registry in Settings before uploading.');
    for (const file of files) {
      onProgress?.('encrypting');
      const result = await encryptUpload(file, parentId, 'owner', privacy);
      result.item.workspaceId = parent?.workspaceId;
      result.item.dataRoomId = parent?.dataRoomId;
      try {
        onProgress?.('registering');
        result.version.transactionId = await registerFileOnMidnight(result.item.id, result.version.commitment, await sha256(result.version.metadataCipher));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Registration failed.';
        const pending: PendingFileWrite = { ...result, operation: 'register', error: message, createdAt: new Date().toISOString() };
        dispatch((current) => ({ ...current, pendingFileWrites: [pending, ...current.pendingFileWrites.filter((candidate) => candidate.item.id !== result.item.id)] }));
        throw new Error(results.length
          ? `${results.length} file(s) completed. ${file.name} was encrypted locally but its registration failed: ${message}`
          : `The file remains encrypted in this browser, but Midnight registration failed: ${message}`);
      }
      results.push(result);
      // Preserve each finalized upload immediately. A later file can fail
      // without deleting ciphertext already committed to the chain.
      dispatch((current) => ({
        ...current,
        items: [result.item, ...current.items],
        versions: [...current.versions, result.version],
        audit: [auditEvent('upload', result.item.name, result.item.id, { actor: current.session.displayName, transactionId: result.version.transactionId }), ...current.audit],
      }));
    }
    return results;
  }, [state.items]);

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
      const { updateFileOnMidnight } = await loadMidnightContract();
      try {
        version.transactionId = await updateFileOnMidnight(
          fileId,
          version.commitment,
          await sha256(version.metadataCipher),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Version registration failed.';
        const pending: PendingFileWrite = { item: target, version, operation: 'update', error: message, createdAt: new Date().toISOString() };
        dispatch((current) => ({ ...current, pendingFileWrites: [pending, ...current.pendingFileWrites.filter((candidate) => candidate.item.id !== fileId)] }));
        throw new Error(`The new version remains encrypted in this browser, but Midnight registration failed: ${message}`);
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

  const retryPendingFileWrite = useCallback(async (fileId: string) => {
    const pending = state.pendingFileWrites.find((candidate) => candidate.item.id === fileId);
    if (!pending) throw new Error('Pending encrypted write not found.');
    const contract = await loadMidnightContract();
    let receipt: string;
    try {
      try {
        // A previous submission may have finalized after its response timed out.
        // Verify that exact version before sending a second state transition.
        receipt = await contract.verifyFileOnMidnight(pending.item.id, pending.version.commitment, pending.version.version);
      } catch {
        receipt = pending.operation === 'register'
          ? await contract.registerFileOnMidnight(pending.item.id, pending.version.commitment, await sha256(pending.version.metadataCipher))
          : await contract.updateFileOnMidnight(pending.item.id, pending.version.commitment, await sha256(pending.version.metadataCipher));
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Registration failed.';
      dispatch((current) => ({ ...current, pendingFileWrites: current.pendingFileWrites.map((candidate) => candidate.item.id === fileId ? { ...candidate, error: message } : candidate) }));
      throw reason;
    }
    const completedVersion = { ...pending.version, transactionId: receipt };
    dispatch((current) => ({
      ...current,
      items: pending.operation === 'register'
        ? [pending.item, ...current.items.filter((item) => item.id !== fileId)]
        : current.items.map((item) => item.id === fileId ? { ...item, size: completedVersion.size, modifiedAt: completedVersion.createdAt, versionIds: [...item.versionIds, completedVersion.id], currentVersionId: completedVersion.id } : item),
      versions: [...current.versions.filter((version) => version.id !== completedVersion.id), completedVersion],
      pendingFileWrites: current.pendingFileWrites.filter((candidate) => candidate.item.id !== fileId),
      audit: [auditEvent('upload', pending.item.name, fileId, { transactionId: receipt }), ...current.audit],
    }));
  }, [state.pendingFileWrites]);

  const download = useCallback(async (fileId: string) => {
    const item = state.items.find((candidate) => candidate.id === fileId);
    const version = state.versions.find((candidate) => candidate.id === item?.currentVersionId);
    if (!item || !version) throw new Error('Encrypted version is unavailable.');
    // Confirm that this browser still has the ciphertext and can decrypt it
    // before recording a successful retrieval on the ledger.
    const plaintext = await decryptVersion(version);
    const { generateAuditProofOnMidnight } = await loadMidnightContract();
    const receipt = await generateAuditProofOnMidnight(fileId, await sha256(`download:${fileId}:${version.commitment}:${Date.now()}`));
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
    if (item.kind === 'folder' && state.items.some((candidate) => candidate.parentId === fileId)) {
      throw new Error('This folder still contains files. Restore it and remove its contents before deleting the folder permanently.');
    }
    const contract = await loadMidnightContract();
    if (item.kind === 'file') await contract.revokeFileOnMidnight(fileId);
    else await contract.revokePrivateRecordOnMidnight(fileId);
    const removedVersions = state.versions.filter((version) => version.fileId === fileId);
    await Promise.all(removedVersions.map((version) => deleteEncryptedBlob(version.blobKey)));
    dispatch((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== fileId),
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
    const token = draft.method === 'external' ? await sha256(`${crypto.randomUUID()}:${crypto.randomUUID()}`) : undefined;
    let transactionId: string;
    {
      const { createCapabilityAccessOnMidnight, createPolicyOnMidnight, grantWalletAccessOnMidnight } = await loadMidnightContract();
      if (draft.method === 'policy') {
        const valueFor = (field: 'organization' | 'department' | 'role') => draft.conditions.find((condition) => condition.field === field && condition.operator === 'is')?.value.trim() ?? '';
        const policyClaims = { organization: valueFor('organization'), department: valueFor('department'), role: valueFor('role') };
        if (!policyClaims.organization || !policyClaims.department || !policyClaims.role) throw new Error('Policy access requires exact organization, department, and role claims.');
        const credential = state.credentials.find((candidate) => candidate.status === 'active'
          && candidate.organization === policyClaims.organization
          && candidate.department === policyClaims.department
          && candidate.role === policyClaims.role);
        if (!credential) throw new Error('Issue a matching active credential before creating this policy.');
        transactionId = await createPolicyOnMidnight(
          id,
          fileId,
          credential.claimsSecret,
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
        if (!token) throw new Error('Could not create a private capability secret.');
        transactionId = await createCapabilityAccessOnMidnight(id, fileId, token, draft.permissions, draft.expiresAt, draft.oneTime);
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
  }, [state.credentials]);

  const revokeGrant = useCallback(async (grantId: string) => {
    const grant = state.grants.find((candidate) => candidate.id === grantId);
    if (!grant) throw new Error('Access grant not found.');
    let receipt: string | undefined;
    {
      const { revokeCapabilityAccessOnMidnight, revokeGrantOnMidnight, revokePolicyOnMidnight } = await loadMidnightContract();
      receipt = grant.method === 'policy' || grant.method === 'team'
        ? await revokePolicyOnMidnight(grant.id)
        : grant.method === 'external'
          ? await revokeCapabilityAccessOnMidnight(grant.id)
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
    if (grant.method === 'external') {
      if (!grant.token) throw new Error('The private capability secret is unavailable.');
      const { consumeCapabilityAccessOnMidnight } = await loadMidnightContract();
      await consumeCapabilityAccessOnMidnight(grant.id, grant.token);
    }
    else if (grant.method === 'wallet') {
      const { consumeWalletAccessOnMidnight } = await loadMidnightContract();
      await consumeWalletAccessOnMidnight(grant.fileId);
    } else {
      const credential = credentialForPolicy(state.credentials, grant);
      if (!credential) throw new Error('An active credential is required to consume this policy grant.');
      const holder = credential.subjectId === 'owner' ? state.session.veilId : state.members.find((member) => member.id === credential.subjectId)?.veilId;
      if (!holder || holder !== state.session.veilId) throw new Error('Connect the wallet that holds this credential.');
      const { consumePolicyAccessOnMidnight } = await loadMidnightContract();
      await consumePolicyAccessOnMidnight(grant.id, credential.id, credential.claimsSecret);
    }
    dispatch((current) => ({ ...current, grants: current.grants.map((candidate) => candidate.id === grantId ? { ...candidate, consumedAt } : candidate) }));
  }, [state.credentials, state.grants, state.members, state.session.veilId]);

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
      const credential = credentialForPolicy(state.credentials, grant);
      if (!credential) throw new Error('An active credential is required to prove this policy.');
      const holder = credential.subjectId === 'owner' ? state.session.veilId : state.members.find((member) => member.id === credential.subjectId)?.veilId;
      if (!holder || holder !== state.session.veilId) throw new Error('Connect the wallet that holds this credential.');
      receipt = await contract.provePolicyAccessOnMidnight(grant.id, credential.id, credential.claimsSecret);
    } else {
      if (!grant.token) throw new Error('The private capability secret is unavailable.');
      receipt = await contract.proveCapabilityAccessOnMidnight(grant.id, grant.token);
    }
    const file = state.items.find((candidate) => candidate.id === grant.fileId);
    dispatch((current) => ({
      ...current,
      audit: [auditEvent('proof', file?.name ?? grant.fileId, grant.fileId, { actor: current.session.displayName, transactionId: receipt }), ...current.audit],
    }));
    return receipt;
  }, [state.credentials, state.grants, state.items, state.members, state.session.veilId]);

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
    if (result === 'granted') {
      const requester = state.members.find((member) => member.id === request.requesterId);
      if (!requester?.veilId) throw new Error('The requester needs a Veil ID before access can be granted.');
      const { grantWalletAccessOnMidnight } = await loadMidnightContract();
      const transactionId = await grantWalletAccessOnMidnight(request.fileId, requester.veilId, [request.permission], null, false);
      const grant: AccessGrant = {
        id: randomId('grant'),
        fileId: request.fileId,
        method: 'wallet',
        recipient: requester.veilId,
        recipientLabel: requester.name,
        permissions: [request.permission],
        conditions: [],
        logic: 'AND',
        expiresAt: null,
        oneTime: false,
        consumedAt: null,
        revokedAt: null,
        createdAt: new Date().toISOString(),
        transactionId,
      };
      dispatch((current) => ({
        ...current,
        grants: [grant, ...current.grants.filter((candidate) => !(candidate.method === 'wallet' && candidate.fileId === grant.fileId && candidate.recipient === grant.recipient))],
        accessRequests: current.accessRequests.map((candidate) => candidate.id === requestId ? updated : candidate),
        audit: [auditEvent('share', request.requesterName, request.fileId, { transactionId }), ...current.audit],
      }));
      await commitRecord('access-request', requestId, updated);
      return;
    }
    await commitRecord('access-request', requestId, updated);
    dispatch((current) => ({ ...current, accessRequests: current.accessRequests.map((candidate) => candidate.id === requestId ? updated : candidate) }));
  }, [state.accessRequests, state.members]);

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

  const issueCredential = useCallback(async (input: Omit<Credential, 'id' | 'commitment' | 'claimsSecret' | 'transactionId'>) => {
    const id = randomId('credential');
    const claims = credentialClaimsPayload(input);
    const claimsSalt = crypto.randomUUID().replaceAll('-', '');
    const claimsSecret = await sha256(`${claims}:${claimsSalt}`);
    let commitment = await sha256(`veildrive:claims:${claimsSecret}`);
    let transactionId = '';
    if (state.session.mode === 'preprod') {
      const { credentialClaimsCommitmentOnMidnight, issueCredentialOnMidnight, setLocalCredentialClaimsOnMidnight } = await loadMidnightContract();
      const member = state.members.find((candidate) => candidate.id === input.subjectId);
      const holderIdentity = input.subjectId === 'owner' ? state.session.veilId : member?.veilId;
      if (!holderIdentity || !/^[0-9a-f]{64}$/i.test(holderIdentity)) {
        throw new Error('This member needs a 64-character Veil ID before a credential can be issued on preprod.');
      }
      transactionId = await issueCredentialOnMidnight(id, holderIdentity, claimsSecret, input.expiresAt);
      commitment = await credentialClaimsCommitmentOnMidnight(claimsSecret);
      if (input.subjectId === 'owner') await setLocalCredentialClaimsOnMidnight(claimsSecret);
    }
    const credential: Credential = { ...input, id, commitment, claimsSecret, transactionId };
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

  const exportCredential = useCallback((credentialId: string) => {
    const credential = state.credentials.find((candidate) => candidate.id === credentialId);
    if (!credential) throw new Error('Credential not found.');
    const subject = state.members.find((member) => member.id === credential.subjectId);
    const holderVeilId = credential.subjectId === 'owner' ? state.session.veilId : subject?.veilId;
    if (!holderVeilId || !state.session.contractAddress) throw new Error('Credential holder or contract identity is unavailable.');
    const payload = JSON.stringify({
      version: 1,
      contractAddress: state.session.contractAddress,
      holderVeilId,
      credential,
    });
    return `veilcred1.${bytesToBase64(new TextEncoder().encode(payload))}`;
  }, [state.credentials, state.members, state.session.contractAddress, state.session.veilId]);

  const importCredential = useCallback(async (encodedPackage: string) => {
    const encoded = encodedPackage.trim();
    if (!encoded.startsWith('veilcred1.')) throw new Error('This is not a VeilDrive credential package.');
    let parsed: { version: number; contractAddress: string; holderVeilId: string; credential: Credential };
    try {
      parsed = JSON.parse(new TextDecoder().decode(base64ToBytes(encoded.slice('veilcred1.'.length)))) as typeof parsed;
    } catch {
      throw new Error('The credential package is damaged or incomplete.');
    }
    if (parsed.version !== 1
      || !parsed.credential?.id
      || !/^[0-9a-f]{64}$/i.test(parsed.credential.claimsSecret)
      || !/^[0-9a-f]{64}$/i.test(parsed.credential.commitment)
      || !/^[0-9a-f]{64}$/i.test(parsed.holderVeilId)
      || !['organization', 'department', 'role', 'issuer', 'expiresAt'].every((field) => typeof parsed.credential[field as keyof Credential] === 'string')) {
      throw new Error('Unsupported credential package.');
    }
    if (parsed.contractAddress !== state.session.contractAddress) throw new Error('This credential belongs to a different VeilDrive registry.');
    if (parsed.holderVeilId !== state.session.veilId) throw new Error('This credential is bound to a different Veil ID.');
    if (new Date(parsed.credential.expiresAt).getTime() <= Date.now()) throw new Error('This credential has expired.');
    const { credentialClaimsCommitmentOnMidnight, setLocalCredentialClaimsOnMidnight } = await loadMidnightContract();
    const commitment = await credentialClaimsCommitmentOnMidnight(parsed.credential.claimsSecret);
    if (commitment !== parsed.credential.commitment) throw new Error('Credential claims do not match the registered commitment.');
    await setLocalCredentialClaimsOnMidnight(parsed.credential.claimsSecret);
    const credential: Credential = { ...parsed.credential, subjectId: 'owner', subjectName: state.session.displayName, status: 'active' };
    dispatch((current) => ({ ...current, credentials: [...current.credentials.filter((candidate) => candidate.id !== credential.id), credential] }));
    return credential;
  }, [state.session.contractAddress, state.session.displayName, state.session.veilId]);

  const addGuardian = useCallback(async (guardian: Omit<Guardian, 'id' | 'approved'>) => {
    const created: Guardian = { ...guardian, id: randomId('guardian'), approved: false };
    await commitRecord('recovery-guardian', created.id, created);
    dispatch((current) => ({ ...current, guardians: [...current.guardians, created] }));
    return created;
  }, []);

  const markNotificationsRead = useCallback(() => dispatch((current) => ({ ...current, notifications: current.notifications.map((notice) => ({ ...notice, read: true })) })), []);
  const setStorageProvider = useCallback((provider: AppState['storageProvider']) => {
    if (provider !== 'indexeddb') return;
    dispatch((current) => ({ ...current, storageProvider: provider }));
  }, []);
  const toggleSidebar = useCallback(() => dispatch((current) => ({ ...current, sidebarCollapsed: !current.sidebarCollapsed })), []);
  const resetVault = useCallback(async () => {
    clearEncryptedAppState();
    await clearVaultDatabase();
    window.location.assign('/');
  }, []);

  const actions = useMemo<AppActions>(() => ({
    connect, disconnect, upload, retryPendingFileWrite, createFolder, addVersion, download, toggleFavorite, moveToTrash, restore,
    deleteForever, rename, addTags, share, revokeGrant, proveGrant, consumeGrant, addComment, resolveAccessRequest,
    createAccessRequest, addWorkspace, createDataRoom, inviteToDataRoom, updateMember, addMember, issueCredential, exportCredential, importCredential, revokeCredential,
    addGuardian, markNotificationsRead, setStorageProvider, toggleSidebar, resetVault,
  }), [
    addComment, addGuardian, addMember, addTags, addVersion, addWorkspace, connect, createAccessRequest,
    createDataRoom, createFolder, deleteForever, disconnect, download,
    exportCredential, importCredential, inviteToDataRoom, issueCredential, markNotificationsRead, moveToTrash, rename, resetVault, resolveAccessRequest, restore,
    revokeCredential, revokeGrant, proveGrant, setStorageProvider, share,
    toggleFavorite, toggleSidebar, updateMember, upload, retryPendingFileWrite, consumeGrant,
  ]);

  if (storageError) return <main className="boot-screen"><h1>Vault storage needs attention</h1><p role="alert">{storageError}</p><button onClick={() => ready ? saveEncryptedAppState(state).then(() => setStorageError('')).catch(() => undefined) : window.location.reload()}>Retry</button></main>;
  return <AppStore.Provider value={{ state, actions, ready }}>{children}</AppStore.Provider>;
};

export const useAppStore = (): AppStoreValue => {
  const store = useContext(AppStore);
  if (!store) throw new Error('useAppStore must be used inside AppStoreProvider.');
  return store;
};

export const unreadNotifications = (notifications: Notification[]): number => notifications.filter((notice) => !notice.read).length;
