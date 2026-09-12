// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../store/fixtures';
import { clearVaultDatabase } from './indexed-db';
import { clearEncryptedAppState, loadEncryptedAppState, saveEncryptedAppState } from './state-vault';

describe('encrypted application state', () => {
  beforeEach(async () => {
    clearEncryptedAppState();
    localStorage.clear();
    await clearVaultDatabase();
  });

  it('round-trips real state without storing readable metadata in localStorage', async () => {
    const state = createInitialState();
    state.session.displayName = 'Sensitive owner label';
    state.session.walletAddress = 'mn_shield-addr_test';

    await saveEncryptedAppState(state);

    const persisted = localStorage.getItem('veildrive-encrypted-app-state-v1');
    expect(persisted).toBeTruthy();
    expect(persisted).not.toContain('Sensitive owner label');
    await expect(loadEncryptedAppState()).resolves.toMatchObject({ session: state.session });
  });

  it('preserves a damaged envelope instead of silently replacing the vault', async () => {
    const state = createInitialState();
    await saveEncryptedAppState(state);
    const damaged = JSON.stringify({ iv: 'broken', ciphertext: 'still-preserved' });
    localStorage.setItem('veildrive-encrypted-app-state-v1', damaged);

    await expect(loadEncryptedAppState()).rejects.toThrow('stored data has been preserved');
    expect(localStorage.getItem('veildrive-encrypted-app-state-v1')).toBe(damaged);
  });
});
