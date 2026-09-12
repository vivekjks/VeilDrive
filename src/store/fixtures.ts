import type { AppState, DriveItem, EncryptedVersion } from '../types';

const now = '2026-09-12T09:30:00.000Z';
const tx = (suffix: string) => `0000${suffix.padStart(60, '0')}`;
const hash = (suffix: string) => `${suffix.padStart(64, '0')}`;

const folder = (
  id: string,
  name: string,
  parentId: string | null,
  options: Partial<DriveItem> = {},
): DriveItem => ({
  id,
  kind: 'folder',
  name,
  encryptedName: `d_${id.slice(-6)}.enc`,
  mimeType: 'application/x-directory',
  size: 0,
  parentId,
  ownerId: 'alice',
  privacy: 'private',
  createdAt: now,
  modifiedAt: now,
  favorite: false,
  trashed: false,
  versionIds: [],
  tags: [],
  ...options,
});

const file = (
  id: string,
  name: string,
  mimeType: string,
  size: number,
  parentId: string | null,
  privacy: DriveItem['privacy'],
  tags: string[],
): DriveItem => ({
  id,
  kind: 'file',
  name,
  encryptedName: `f_${id.slice(-6)}.enc`,
  mimeType,
  size,
  parentId,
  ownerId: 'alice',
  privacy,
  createdAt: now,
  modifiedAt: now,
  favorite: id === 'file-research',
  trashed: false,
  versionIds: [],
  tags,
});

const items: DriveItem[] = [
  folder('folder-company', 'Company', null),
  folder('folder-personal', 'Personal', null),
  folder('folder-strategy', 'Strategy', 'folder-company', { favorite: true }),
  folder('folder-engineering', 'Engineering', 'folder-company'),
  folder('folder-finance', 'Finance', 'folder-company', { privacy: 'confidential' }),
  folder('folder-legal', 'Legal', 'folder-company', { privacy: 'confidential' }),
  folder('folder-shared', 'Shared with me', null),
  folder('workspace-root', 'Northstar workspace', null, { workspaceId: 'workspace-northstar' }),
  folder('room-root', 'Series A', null, { dataRoomId: 'room-series-a', privacy: 'maximum' }),
  folder('room-financials', 'Financials', 'room-root', { dataRoomId: 'room-series-a', privacy: 'maximum' }),
  folder('room-legal', 'Legal', 'room-root', { dataRoomId: 'room-series-a', privacy: 'maximum' }),
  folder('room-product', 'Product', 'room-root', { dataRoomId: 'room-series-a', privacy: 'maximum' }),
  folder('room-cap-table', 'Cap table', 'room-root', { dataRoomId: 'room-series-a', privacy: 'maximum' }),
  folder('room-contracts', 'Contracts', 'room-root', { dataRoomId: 'room-series-a', privacy: 'maximum' }),
  file('file-acquisition', 'Acquisition plan.pdf', 'application/pdf', 4_800_000, 'folder-strategy', 'maximum', ['board', 'strategy']),
  file('file-product-archive', 'Product archive.zip', 'application/zip', 1_240_000_000, 'folder-engineering', 'confidential', ['backup']),
  file('file-board-notes', 'Board notes.md', 'text/markdown', 18_420, 'folder-strategy', 'confidential', ['board']),
  file('file-financial', 'Financial model.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 2_100_000, 'folder-finance', 'maximum', ['finance']),
  file('file-research', 'research-paper.pdf', 'application/pdf', 12_400_000, 'folder-personal', 'private', ['research', 'proof']),
  file('file-contract', 'Mutual NDA.txt', 'text/plain', 42_200, 'folder-legal', 'confidential', ['legal']),
];

const versions: EncryptedVersion[] = [];

export const createInitialState = (): AppState => ({
  session: {
    connected: false,
    mode: 'demo',
    walletAddress: '',
    displayName: 'Alice Chen',
    avatarInitials: 'AC',
    network: 'preprod',
  },
  items,
  versions,
  grants: [
    {
      id: 'grant-investor',
      fileId: 'file-financial',
      method: 'policy',
      recipient: 'verified-investor',
      recipientLabel: 'Verified investor credential',
      permissions: ['view', 'download'],
      conditions: [
        { id: 'c1', field: 'organization', operator: 'is', value: 'Northstar Capital' },
        { id: 'c2', field: 'credentialStatus', operator: 'is', value: 'Active' },
      ],
      logic: 'AND',
      expiresAt: '2026-09-18T18:00:00.000Z',
      oneTime: false,
      consumedAt: null,
      revokedAt: null,
      createdAt: now,
      transactionId: tx('11'),
    },
  ],
  comments: [
    { id: 'comment-1', fileId: 'file-acquisition', author: 'Marco Ruiz', body: 'Looks good. Let’s share with the wider team after legal review.', encrypted: true, createdAt: '2026-09-11T15:10:00.000Z' },
    { id: 'comment-2', fileId: 'file-acquisition', author: 'Sara Kim', body: 'Added the latest market assumptions to page twelve.', encrypted: true, createdAt: '2026-09-10T10:20:00.000Z' },
  ],
  members: [
    { id: 'alice', name: 'Alice Chen', wallet: 'mn_addr_preprod1alice7e2f', role: 'owner', department: 'Executive', status: 'active', joinedAt: '2026-01-08T00:00:00.000Z' },
    { id: 'marco', name: 'Marco Ruiz', wallet: 'mn_addr_preprod1marco991a', role: 'admin', department: 'Legal', status: 'active', joinedAt: '2026-02-12T00:00:00.000Z' },
    { id: 'sara', name: 'Sara Kim', wallet: 'mn_addr_preprod1sara51bc', role: 'manager', department: 'Finance', status: 'active', joinedAt: '2026-02-28T00:00:00.000Z' },
    { id: 'bob', name: 'Bob Okafor', wallet: 'mn_addr_preprod1bob48e1', role: 'member', department: 'Engineering', status: 'active', joinedAt: '2026-03-18T00:00:00.000Z' },
    { id: 'priya', name: 'Priya Shah', wallet: 'mn_addr_preprod1priya18aa', role: 'guest', department: 'Investor', status: 'active', joinedAt: '2026-08-30T00:00:00.000Z' },
    { id: 'david', name: 'David Kim', wallet: 'mn_addr_preprod1david39fa', role: 'guest', department: 'Investor', status: 'invited', joinedAt: '2026-09-10T00:00:00.000Z' },
  ],
  workspaces: [
    { id: 'workspace-northstar', name: 'Northstar Labs', description: 'Private collaboration for the whole company.', memberIds: ['alice', 'marco', 'sara', 'bob'], privacy: 'confidential', rootFolderId: 'workspace-root' },
  ],
  credentials: [
    { id: 'cred-alice', subjectId: 'alice', subjectName: 'Alice Chen', issuer: 'Northstar Labs', organization: 'Northstar Labs', department: 'Executive', role: 'Founder', status: 'active', expiresAt: '2027-01-01T00:00:00.000Z', commitment: hash('a11ce') },
    { id: 'cred-bob', subjectId: 'bob', subjectName: 'Bob Okafor', issuer: 'Northstar Labs', organization: 'Northstar Labs', department: 'Engineering', role: 'Developer', status: 'active', expiresAt: '2027-01-01T00:00:00.000Z', commitment: hash('b0b') },
    { id: 'cred-priya', subjectId: 'priya', subjectName: 'Priya Shah', issuer: 'North Ridge Capital', organization: 'North Ridge Capital', department: 'Investor', role: 'Partner', status: 'active', expiresAt: '2026-12-31T00:00:00.000Z', commitment: hash('719a') },
  ],
  accessRequests: [
    { id: 'request-1', fileId: 'file-acquisition', requesterId: 'bob', requesterName: 'Bob Okafor', permission: 'view', message: 'Preparing the architecture review for Monday.', status: 'pending', createdAt: '2026-09-12T08:35:00.000Z' },
  ],
  audit: [
    { id: 'audit-1', action: 'upload', actor: 'Alice Chen', target: 'Acquisition plan.pdf', fileId: 'file-acquisition', createdAt: '2026-09-12T07:20:00.000Z', authorized: true, private: true, transactionId: tx('21') },
    { id: 'audit-2', action: 'view', actor: 'Priya Shah', target: 'Financial model.xlsx', fileId: 'file-financial', createdAt: '2026-09-12T08:10:00.000Z', authorized: true, private: true, transactionId: tx('22') },
    { id: 'audit-3', action: 'proof', actor: 'Bob Okafor', target: 'Engineering employee proof', createdAt: '2026-09-12T08:42:00.000Z', authorized: true, private: true, transactionId: tx('23') },
    { id: 'audit-4', action: 'download', actor: 'Unknown requester', target: 'Financial model.xlsx', fileId: 'file-financial', createdAt: '2026-09-12T09:02:00.000Z', authorized: false, private: true },
  ],
  notifications: [
    { id: 'notice-1', title: 'Access requested', body: 'Bob requested view access to Acquisition plan.pdf', createdAt: '2026-09-12T08:35:00.000Z', read: false, type: 'access' },
    { id: 'notice-2', title: 'Private proof verified', body: 'Priya satisfied the investor access policy.', createdAt: '2026-09-12T08:10:00.000Z', read: false, type: 'proof' },
    { id: 'notice-3', title: 'Credential expires soon', body: 'One guest credential expires in 6 days.', createdAt: '2026-09-11T18:20:00.000Z', read: true, type: 'security' },
  ],
  dataRooms: [
    { id: 'room-series-a', name: 'Series A', description: 'Due diligence without over-disclosure.', rootFolderId: 'room-root', participantIds: ['alice', 'priya', 'david'], privacy: 'maximum', expiresAt: '2026-09-18T18:00:00.000Z', credentialRequirement: 'Verified investor credential required' },
  ],
  proofRequests: [
    { id: 'proof-financial', title: 'Financial eligibility', condition: 'Balance > ₹10,00,000', hiddenFields: ['Exact balance', 'Account number', 'Transaction history'], status: 'draft', createdAt: now },
  ],
  guardians: [
    { id: 'guardian-1', name: 'Alice backup wallet', wallet: 'mn_addr_preprod1backup7f', type: 'wallet', approved: true },
    { id: 'guardian-2', name: 'Northstar company admin', wallet: 'mn_addr_preprod1admin52', type: 'admin', approved: true },
    { id: 'guardian-3', name: 'Veil recovery service', wallet: 'service:veil-recovery', type: 'service', approved: false },
  ],
  recoveryThreshold: 2,
  apiKeys: [],
  storageProvider: 'indexeddb',
  sidebarCollapsed: false,
});

export const demoContents: Record<string, string> = {
  'file-acquisition': 'VEILDRIVE — ACQUISITION PLAN\n\nConfidential strategy document. This demo file was encrypted locally with AES-GCM before being stored.',
  'file-product-archive': 'Encrypted product archive placeholder.',
  'file-board-notes': '# Board notes\n\n- Finalize the data room\n- Verify investor credentials\n- Rotate external access keys',
  'file-financial': 'Financial model demo content. Private and encrypted.',
  'file-research': 'Research paper registered on 12 September 2026. This exact document can be verified against its SHA-256 commitment.',
  'file-contract': 'MUTUAL NON-DISCLOSURE AGREEMENT\n\nThis agreement and all comments are encrypted locally.',
};
