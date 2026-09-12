export type NetworkMode = 'preprod';
export type PrivacyLevel = 'standard' | 'private' | 'confidential' | 'maximum';
export type Permission = 'view' | 'download' | 'edit' | 'reshare';
export type FileKind = 'file' | 'folder';
export type AccessMethod = 'wallet' | 'team' | 'policy' | 'external';
export type MemberRole = 'owner' | 'admin' | 'manager' | 'member' | 'guest';

export interface Session {
  connected: boolean;
  mode: NetworkMode;
  walletAddress: string;
  displayName: string;
  avatarInitials: string;
  network: 'preprod';
  contractAddress?: string;
  veilId?: string;
}

export interface EncryptedVersion {
  id: string;
  fileId: string;
  version: number;
  blobKey: string;
  iv: string;
  wrappedKey: string;
  metadataIv: string;
  metadataCipher: string;
  commitment: string;
  size: number;
  createdAt: string;
  createdBy: string;
  transactionId: string;
}

export interface DriveItem {
  id: string;
  kind: FileKind;
  name: string;
  encryptedName: string;
  mimeType: string;
  size: number;
  parentId: string | null;
  workspaceId?: string;
  dataRoomId?: string;
  ownerId: string;
  privacy: PrivacyLevel;
  createdAt: string;
  modifiedAt: string;
  favorite: boolean;
  trashed: boolean;
  versionIds: string[];
  currentVersionId?: string;
  tags: string[];
  description?: string;
}

export interface PolicyCondition {
  id: string;
  field: 'organization' | 'department' | 'role' | 'credentialStatus' | 'age' | 'balance';
  operator: 'is' | 'isNot' | 'greaterThan' | 'lessThan';
  value: string;
}

export interface AccessGrant {
  id: string;
  fileId: string;
  method: AccessMethod;
  recipient: string;
  recipientLabel: string;
  permissions: Permission[];
  conditions: PolicyCondition[];
  logic: 'AND' | 'OR';
  expiresAt: string | null;
  oneTime: boolean;
  consumedAt: string | null;
  revokedAt: string | null;
  token?: string;
  createdAt: string;
  transactionId: string;
}

export interface Comment {
  id: string;
  fileId: string;
  author: string;
  body: string;
  encrypted: boolean;
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  wallet: string;
  veilId?: string;
  role: MemberRole;
  department: string;
  status: 'active' | 'invited' | 'revoked';
  joinedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  privacy: PrivacyLevel;
  rootFolderId: string;
}

export interface Credential {
  id: string;
  subjectId: string;
  subjectName: string;
  issuer: string;
  organization: string;
  department: string;
  role: string;
  status: 'active' | 'revoked' | 'expired';
  expiresAt: string;
  commitment: string;
}

export interface AccessRequest {
  id: string;
  fileId: string;
  requesterId: string;
  requesterName: string;
  permission: Permission;
  message: string;
  status: 'pending' | 'granted' | 'rejected';
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  action: 'upload' | 'view' | 'download' | 'share' | 'revoke' | 'verify' | 'proof' | 'comment' | 'delete' | 'restore';
  actor: string;
  target: string;
  fileId?: string;
  createdAt: string;
  authorized: boolean;
  private: boolean;
  transactionId?: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  type: 'access' | 'proof' | 'security' | 'workspace';
}

export interface DataRoom {
  id: string;
  name: string;
  description: string;
  rootFolderId: string;
  participantIds: string[];
  privacy: PrivacyLevel;
  expiresAt: string;
  credentialRequirement: string;
}

export interface ProofRequest {
  id: string;
  title: string;
  condition: string;
  hiddenFields: string[];
  status: 'draft' | 'generated' | 'verified';
  proofCommitment?: string;
  createdAt: string;
}

export interface Guardian {
  id: string;
  name: string;
  wallet: string;
  type: 'wallet' | 'admin' | 'service';
  approved: boolean;
}

export interface ApiKey {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface AppState {
  session: Session;
  items: DriveItem[];
  versions: EncryptedVersion[];
  grants: AccessGrant[];
  comments: Comment[];
  members: Member[];
  workspaces: Workspace[];
  credentials: Credential[];
  accessRequests: AccessRequest[];
  audit: AuditEvent[];
  notifications: Notification[];
  dataRooms: DataRoom[];
  proofRequests: ProofRequest[];
  guardians: Guardian[];
  recoveryThreshold: number;
  apiKeys: ApiKey[];
  storageProvider: 'indexeddb' | 'ipfs' | 's3';
  sidebarCollapsed: boolean;
}

export interface ShareDraft {
  method: AccessMethod;
  recipient: string;
  recipientLabel: string;
  permissions: Permission[];
  conditions: PolicyCondition[];
  logic: 'AND' | 'OR';
  expiresAt: string | null;
  oneTime: boolean;
}

export interface UploadResult {
  item: DriveItem;
  version: EncryptedVersion;
}
