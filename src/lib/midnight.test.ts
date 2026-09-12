// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  connectMidnightWallet,
  disconnectMidnightWallet,
  discoverMidnightWallets,
  explorerContractUrl,
  explorerTransactionUrl,
  PREPROD,
  readableMidnightError,
} from './midnight';

afterEach(() => {
  disconnectMidnightWallet();
  window.midnight = undefined;
  vi.useRealTimers();
});

describe('Midnight preprod services', () => {
  it('uses the hosted HTTPS prover by default', () => {
    expect(PREPROD.proofServer).toBe('https://proof-server.preprod.midnight.network');
  });
});

describe('Midnight explorer links', () => {
  it('opens preprod transactions in the 1AM explorer', () => {
    expect(explorerTransactionUrl('0xabc')).toBe('https://explorer.1am.xyz/tx/abc?network=preprod');
  });

  it('opens preprod contracts in the 1AM explorer', () => {
    expect(explorerContractUrl('0xdef')).toBe('https://explorer.1am.xyz/contract/def?network=preprod');
  });
});

describe('Midnight errors', () => {
  it('explains how to recover when the preprod proof service is unavailable', () => {
    const raw = new Error("Unexpected error submitting scoped transaction '<unnamed>': Error: 'check' returned an error: TypeError: Failed to fetch");
    expect(readableMidnightError(raw)).toBe(
      'The preprod proof service is unavailable. Wait a moment, then try again.',
    );
  });

  it('preserves unrelated wallet and transaction errors', () => {
    expect(readableMidnightError(new Error('User rejected the request.'))).toBe('User rejected the request.');
  });

  it('explains the wallet rate-limit cooldown', () => {
    expect(readableMidnightError({ reason: 'Rate limited' })).toBe(
      'The wallet is temporarily rate limiting requests. Wait 10 seconds, then select Connect once.',
    );
  });
});

describe('Midnight wallet connection', () => {
  it('lists compatible wallets separately and prefers 1AM when both are present', () => {
    const oneAm = { name: '1AM', apiVersion: '4.0.1', connect: vi.fn() };
    const lace = { name: 'Lace', apiVersion: '4.0.0', connect: vi.fn() };
    window.midnight = {
      mnLace: lace as never,
      '1am': oneAm as never,
      duplicateLace: lace as never,
      legacy: { name: 'Old wallet', apiVersion: '3.0.0', connect: vi.fn() } as never,
    };

    expect(discoverMidnightWallets()).toEqual([
      { id: '1am', name: '1AM', apiVersion: '4.0.1' },
      { id: 'mnLace', name: 'Lace', apiVersion: '4.0.0' },
    ]);
  });

  it('waits through one 1AM read cooldown and reuses the returned shielded addresses', async () => {
    vi.useFakeTimers();
    const addresses = {
      shieldedAddress: 'mn_shield-addr_preprod1test',
      shieldedCoinPublicKey: 'mn_shield-cpk_preprod1test',
      shieldedEncryptionPublicKey: 'mn_shield-epk_preprod1test',
    };
    const connectedApi = {
      getConnectionStatus: vi.fn()
        .mockRejectedValueOnce(new Error('Rate limited'))
        .mockResolvedValue({ status: 'connected', networkId: 'preprod' }),
      getConfiguration: vi.fn().mockResolvedValue({
        indexerUri: 'https://api-preprod.1am.xyz/api/v4/graphql',
        indexerWsUri: 'wss://api-preprod.1am.xyz/api/v4/graphql/ws',
      }),
      getShieldedAddresses: vi.fn().mockResolvedValue(addresses),
    };
    window.midnight = {
      '1am': {
        name: '1AM',
        apiVersion: '4.0.1',
        connect: vi.fn().mockResolvedValue(connectedApi),
      } as never,
    };

    const connectionPromise = connectMidnightWallet('1am');
    await vi.advanceTimersByTimeAsync(10_250);
    const connection = await connectionPromise;

    expect(connectedApi.getConnectionStatus).toHaveBeenCalledTimes(2);
    expect(connectedApi.getShieldedAddresses).toHaveBeenCalledTimes(1);
    expect(connection.shieldedAddresses).toBe(addresses);
    expect(connection.indexerUri).toBe('https://api-preprod.1am.xyz/api/v4/graphql');
  });
});
