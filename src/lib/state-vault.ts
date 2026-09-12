import type { AppState } from '../types';
import { base64ToBytes, bytesToBase64 } from './encoding';
import { getVaultKey, putVaultKey } from './indexed-db';

const STATE_KEY = 'veildrive-encrypted-app-state-v1';
const STATE_CRYPTO_KEY = 'veildrive-app-state-key-v1';
const encoder = new TextEncoder();

const getStateKey = async (): Promise<CryptoKey> => {
  const existing = await getVaultKey(STATE_CRYPTO_KEY);
  if (existing) return existing;
  const created = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await putVaultKey(STATE_CRYPTO_KEY, created);
  return created;
};

export const loadEncryptedAppState = async (): Promise<AppState | null> => {
  const stored = localStorage.getItem(STATE_KEY);
  if (!stored) return null;
  try {
    const envelope = JSON.parse(stored) as { iv: string; ciphertext: string };
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) },
      await getStateKey(),
      base64ToBytes(envelope.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as AppState;
  } catch {
    localStorage.removeItem(STATE_KEY);
    return null;
  }
};

export const saveEncryptedAppState = async (state: AppState): Promise<void> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await getStateKey(),
    encoder.encode(JSON.stringify(state)),
  );
  localStorage.setItem(STATE_KEY, JSON.stringify({ iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) }));
};

export const clearEncryptedAppState = (): void => localStorage.removeItem(STATE_KEY);
