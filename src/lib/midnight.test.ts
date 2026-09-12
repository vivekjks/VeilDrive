// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { explorerContractUrl, explorerTransactionUrl, readableMidnightError } from './midnight';

describe('Midnight explorer links', () => {
  it('opens preprod transactions in the 1AM explorer', () => {
    expect(explorerTransactionUrl('0xabc')).toBe('https://explorer.1am.xyz/tx/abc?network=preprod');
  });

  it('opens preprod contracts in the 1AM explorer', () => {
    expect(explorerContractUrl('0xdef')).toBe('https://explorer.1am.xyz/contract/def?network=preprod');
  });
});

describe('Midnight errors', () => {
  it('explains how to recover when the private proof service is unavailable', () => {
    const raw = new Error("Unexpected error submitting scoped transaction '<unnamed>': Error: 'check' returned an error: TypeError: Failed to fetch");
    expect(readableMidnightError(raw)).toBe(
      'The local proof service is offline. Start the VeilDrive proof service, then try again.',
    );
  });

  it('preserves unrelated wallet and transaction errors', () => {
    expect(readableMidnightError(new Error('User rejected the request.'))).toBe('User rejected the request.');
  });
});
