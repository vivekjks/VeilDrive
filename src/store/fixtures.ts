import type { AppState } from '../types';

export const createInitialState = (): AppState => ({
  session: {
    connected: false,
    mode: 'preprod',
    walletAddress: '',
    displayName: 'Vault owner',
    avatarInitials: 'VO',
    network: 'preprod',
  },
  items: [],
  versions: [],
  grants: [],
  comments: [],
  members: [],
  workspaces: [],
  credentials: [],
  accessRequests: [],
  audit: [],
  notifications: [],
  dataRooms: [],
  proofRequests: [],
  guardians: [],
  recoveryThreshold: 1,
  apiKeys: [],
  storageProvider: 'indexeddb',
  sidebarCollapsed: false,
});
