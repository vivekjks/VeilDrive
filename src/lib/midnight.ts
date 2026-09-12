import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

const configuredProofServer = import.meta.env.VITE_MIDNIGHT_PROOF_SERVER_URI?.trim();

export const PREPROD = {
  networkId: 'preprod',
  node: 'https://rpc.preprod.midnight.network',
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWs: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  proofServer: configuredProofServer || 'https://proof-server.preprod.midnight.network',
  explorer: 'https://explorer.1am.xyz',
  faucet: 'https://midnight-tmnight-preprod.nethermind.dev/',
  registry: '9c8e67b338d3b00af1855b1a7858ceb0a1e34faf4bacc3e89c5bc45f29508b6b',
} as const;

declare global {
  interface Window {
    midnight?: Record<string, InitialAPI>;
  }
}

let connectedWallet: ConnectedAPI | null = null;
let walletConnection: WalletConnection | null = null;

const WALLET_DISCOVERY_TIMEOUT_MS = 2_000;
const WALLET_DISCOVERY_POLL_MS = 100;
const WALLET_RATE_LIMIT_COOLDOWN_MS = 10_250;

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const errorMessage = (reason: unknown): string => {
  if (reason instanceof Error && reason.message) return reason.message;
  if (reason && typeof reason === 'object') {
    const record = reason as { message?: unknown; reason?: unknown };
    if (typeof record.message === 'string' && record.message) return record.message;
    if (typeof record.reason === 'string' && record.reason) return record.reason;
  }
  return String(reason);
};

const retryRateLimitedRead = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (reason) {
    if (!/rate limited/i.test(errorMessage(reason))) throw reason;
    await sleep(WALLET_RATE_LIMIT_COOLDOWN_MS);
    try {
      return await operation();
    } catch (retryReason) {
      if (/rate limited/i.test(errorMessage(retryReason))) {
        throw new Error('The wallet is still rate limiting requests. Wait 10 seconds, then select Connect once.');
      }
      throw retryReason;
    }
  }
};

export interface WalletConnection {
  api: ConnectedAPI;
  walletName: string;
  walletAddress: string;
  shieldedAddresses: Awaited<ReturnType<ConnectedAPI['getShieldedAddresses']>>;
  networkId: string;
  proofServerUri: string;
  indexerUri: string;
  indexerWsUri: string;
}

export interface MidnightWalletOption {
  id: string;
  name: string;
  apiVersion: string;
}

const discoverMidnightWalletEntries = (): Array<{ id: string; wallet: InitialAPI }> => {
  const registry = window.midnight ?? {};
  const entries = Object.entries(registry);
  const ordered = [
    ...entries.filter(([id]) => id === '1am'),
    ...entries.filter(([id]) => id === 'mnLace'),
    ...entries.filter(([id]) => id !== '1am' && id !== 'mnLace'),
  ];
  const seen = new Set<InitialAPI>();
  return ordered.filter((entry): entry is [string, InitialAPI] => {
    const wallet = entry[1];
    const compatible = wallet
      && typeof wallet === 'object'
      && 'apiVersion' in wallet
      && String(wallet.apiVersion).startsWith('4.');
    if (!compatible || seen.has(wallet)) return false;
    seen.add(wallet);
    return true;
  }).map(([id, wallet]) => ({ id, wallet }));
};

export const discoverMidnightWallets = (): MidnightWalletOption[] =>
  discoverMidnightWalletEntries().map(({ id, wallet }) => ({
    id,
    name: wallet.name ?? 'Midnight wallet',
    apiVersion: String(wallet.apiVersion),
  }));

const waitForMidnightWallet = async (walletId?: string): Promise<InitialAPI | null> => {
  const deadline = Date.now() + WALLET_DISCOVERY_TIMEOUT_MS;
  do {
    const entries = discoverMidnightWalletEntries();
    const wallet = walletId
      ? entries.find((entry) => entry.id === walletId)?.wallet
      : entries[0]?.wallet;
    if (wallet) return wallet;
    await sleep(WALLET_DISCOVERY_POLL_MS);
  } while (Date.now() < deadline);
  return null;
};

export const connectMidnightWallet = async (walletId?: string): Promise<WalletConnection> => {
  const wallet = await waitForMidnightWallet(walletId);
  if (!wallet) {
    throw new Error(`No compatible Midnight wallet is available on ${window.location.host}. Enable site access for Lace or 1AM, unlock it, select preprod, and reload this page.`);
  }
  const walletName = wallet.name ?? 'Midnight wallet';
  let api: ConnectedAPI;
  try {
    api = await wallet.connect(PREPROD.networkId);
  } catch (reason) {
    const message = errorMessage(reason);
    const detail = message !== 'Request failed' ? ` ${message}` : '';
    throw new Error(`${walletName} did not complete the connection. Unlock the wallet, select Midnight preprod, and try again.${detail}`);
  }
  const status = await retryRateLimitedRead(() => api.getConnectionStatus());
  if (status.status !== 'connected') throw new Error(`${walletName} did not authorize this application.`);
  if (status.networkId.toLowerCase() !== PREPROD.networkId) {
    throw new Error(`${walletName} is connected to ${status.networkId}. Switch it to Midnight preprod.`);
  }
  setNetworkId(PREPROD.networkId);
  const [configuration, addresses] = await Promise.all([
    retryRateLimitedRead(() => api.getConfiguration()),
    retryRateLimitedRead(() => api.getShieldedAddresses()),
  ]);
  connectedWallet = api;
  walletConnection = {
    api,
    walletName,
    walletAddress: addresses.shieldedCoinPublicKey,
    shieldedAddresses: addresses,
    networkId: status.networkId,
    proofServerUri: PREPROD.proofServer,
    indexerUri: configuration.indexerUri ?? PREPROD.indexer,
    indexerWsUri: configuration.indexerWsUri ?? PREPROD.indexerWs,
  };
  return walletConnection;
};

export const getConnectedWallet = (): ConnectedAPI | null => connectedWallet;
export const getWalletConnection = (): WalletConnection | null => walletConnection;

export const disconnectMidnightWallet = (): void => {
  connectedWallet = null;
  walletConnection = null;
};

const healthFetch = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    return response.ok;
  } catch {
    return false;
  }
};

const rpcHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(PREPROD.node, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'system_health', params: [] }),
      signal: AbortSignal.timeout(4_000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const checkPreprodHealth = async () => {
  const indexerReady = new URL('/ready', PREPROD.indexer).toString();
  const [indexer, proofServer, node] = await Promise.all([
    healthFetch(indexerReady),
    healthFetch(`${PREPROD.proofServer}/version`),
    rpcHealth(),
  ]);
  return { indexer, proofServer, node, network: indexer && node };
};

export const explorerTransactionUrl = (transactionId: string): string =>
  `${PREPROD.explorer}/tx/${transactionId.replace(/^0x/, '')}?network=${PREPROD.networkId}`;

export const explorerContractUrl = (contractAddress: string): string =>
  `${PREPROD.explorer}/contract/${contractAddress.replace(/^0x/, '')}?network=${PREPROD.networkId}`;

export const readableMidnightError = (error: unknown): string => {
  const message = errorMessage(error);
  if (/'(?:check|prove)' returned an error:.*Failed to fetch/i.test(message)) {
    return 'The preprod proof service is unavailable. Wait a moment, then try again.';
  }
  if (/rate limited/i.test(message)) {
    return 'The wallet is temporarily rate limiting requests. Wait 10 seconds, then select Connect once.';
  }
  return message;
};
