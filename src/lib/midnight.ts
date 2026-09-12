import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

export const PREPROD = {
  networkId: 'preprod',
  node: 'https://rpc.preprod.midnight.network',
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWs: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  proofServer: 'http://localhost:6300',
  explorer: 'https://preprod.midnightexplorer.com',
  faucet: 'https://midnight-tmnight-preprod.nethermind.dev/',
} as const;

declare global {
  interface Window {
    midnight?: Record<string, InitialAPI>;
  }
}

let connectedWallet: ConnectedAPI | null = null;
let walletConnection: WalletConnection | null = null;

export interface WalletConnection {
  api: ConnectedAPI;
  walletName: string;
  walletAddress: string;
  networkId: string;
  proofServerUri: string;
  indexerUri: string;
  indexerWsUri: string;
}

export const discoverMidnightWallets = (): InitialAPI[] =>
  Object.values(window.midnight ?? {}).filter(
    (wallet): wallet is InitialAPI =>
      Boolean(wallet) &&
      typeof wallet === 'object' &&
      'apiVersion' in wallet &&
      String(wallet.apiVersion).startsWith('4.'),
  );

export const connectMidnightWallet = async (): Promise<WalletConnection> => {
  const wallet = discoverMidnightWallets()[0];
  if (!wallet) throw new Error('No compatible Midnight Lace wallet was found. Install Lace 1.36+ and enable Midnight preprod.');
  const api = await wallet.connect(PREPROD.networkId);
  const status = await api.getConnectionStatus();
  if (status.status !== 'connected') throw new Error('Lace did not authorize this application.');
  if (status.networkId.toLowerCase() !== PREPROD.networkId) {
    throw new Error(`Lace is connected to ${status.networkId}. Switch the wallet to Midnight Preprod.`);
  }
  setNetworkId(PREPROD.networkId);
  const [configuration, addresses] = await Promise.all([
    api.getConfiguration(),
    api.getShieldedAddresses(),
  ]);
  connectedWallet = api;
  walletConnection = {
    api,
    walletName: wallet.name ?? 'Lace',
    walletAddress: addresses.shieldedCoinPublicKey,
    networkId: status.networkId,
    proofServerUri: configuration.proverServerUri ?? PREPROD.proofServer,
    indexerUri: configuration.indexerUri ?? PREPROD.indexer,
    indexerWsUri: configuration.indexerWsUri ?? PREPROD.indexerWs,
  };
  return walletConnection;
};

export const getConnectedWallet = (): ConnectedAPI | null => connectedWallet;
export const getWalletConnection = (): WalletConnection | null => walletConnection;

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
    healthFetch(`${PREPROD.proofServer}/health`),
    rpcHealth(),
  ]);
  return { indexer, proofServer, node, network: indexer && node };
};

export const explorerTransactionUrl = (transactionId: string): string =>
  `${PREPROD.explorer}/tx/${transactionId.replace(/^0x/, '')}`;

export const explorerContractUrl = (contractAddress: string): string =>
  `${PREPROD.explorer}/address/${contractAddress}`;
