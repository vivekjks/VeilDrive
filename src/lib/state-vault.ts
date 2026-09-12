import type { AppState } from '../types';
import { base64ToBytes, bytesToBase64 } from './encoding';
import { countEncryptedBlobs, getEncryptedBlob, getOrCreateVaultKey, getVaultKey, putEncryptedBlob } from './indexed-db';

const STATE_KEY = 'veildrive-encrypted-app-state-v1';
const ORPHANED_STATE_KEY = 'veildrive-encrypted-app-state-v1-orphaned';
const STATE_CRYPTO_KEY = 'veildrive-app-state-key-v1';
const encoder = new TextEncoder();

const getStateKey = (): Promise<CryptoKey> => getOrCreateVaultKey(STATE_CRYPTO_KEY,
  () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']));
let pendingSave: Promise<void> = Promise.resolve();
let generation = 0;

export const loadEncryptedAppState = async (): Promise<AppState | null> => {
  const stored = localStorage.getItem(STATE_KEY);
  if (!stored) return null;
  try {
    const envelope = JSON.parse(stored) as { iv: string; ciphertext: string };
    const key = await getVaultKey(STATE_CRYPTO_KEY);
    if (!key) {
      // A legacy empty vault can retain its encrypted settings envelope after
      // browser storage has discarded the non-exportable CryptoKey. Preserve
      // that unusable envelope, but only self-repair when no ciphertext exists.
      if (await countEncryptedBlobs() !== 0) throw new Error('Encryption key unavailable.');
      if (!localStorage.getItem(ORPHANED_STATE_KEY)) localStorage.setItem(ORPHANED_STATE_KEY, stored);
      localStorage.removeItem(STATE_KEY);
      return null;
    }
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) },
      key,
      base64ToBytes(envelope.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as AppState;
  } catch {
    throw new Error('This encrypted vault could not be opened. Its stored data has been preserved. Reopen the original browser profile or restore a vault backup.');
  }
};

export const saveEncryptedAppState = (state: AppState): Promise<void> => {
  const snapshot = JSON.stringify(state);
  const currentGeneration = generation;
  // Save in invocation order, preventing a slow older encryption from replacing
  // a newer state after a transaction has finalized.
  const write = pendingSave.catch(() => undefined).then(async () => {
    if (currentGeneration !== generation) return;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getStateKey(), encoder.encode(snapshot));
    if (currentGeneration !== generation) return;
    localStorage.setItem(STATE_KEY, JSON.stringify({ iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) }));
  });
  pendingSave = write;
  return write;
};

export const clearEncryptedAppState = (): void => {
  generation += 1;
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(ORPHANED_STATE_KEY);
};

const walletUnlockCacheKey = async (networkId: string, walletAddress: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`veildrive:wallet-unlock:${networkId}:${walletAddress}`),
  );
  return `wallet-unlock:${bytesToBase64(new Uint8Array(digest))}`;
};

export const loadWalletUnlockSeed = async (networkId: string, walletAddress: string): Promise<string | null> => {
  const blobKey = await walletUnlockCacheKey(networkId, walletAddress);
  const envelope = await getEncryptedBlob(blobKey);
  const key = await getVaultKey(STATE_CRYPTO_KEY);
  if (!envelope || !key || envelope.byteLength <= 12) return null;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: envelope.slice(0, 12), additionalData: encoder.encode(blobKey) },
      key,
      envelope.slice(12),
    );
    const seed = new TextDecoder().decode(plaintext);
    return /^[0-9a-f]{64}$/i.test(seed) ? seed : null;
  } catch {
    return null;
  }
};

export const saveWalletUnlockSeed = async (networkId: string, walletAddress: string, seed: string): Promise<void> => {
  if (!/^[0-9a-f]{64}$/i.test(seed)) throw new Error('Wallet unlock seed must be 32 bytes.');
  const blobKey = await walletUnlockCacheKey(networkId, walletAddress);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(blobKey) },
    await getStateKey(),
    encoder.encode(seed),
  );
  const envelope = new Uint8Array(iv.length + ciphertext.byteLength);
  envelope.set(iv);
  envelope.set(new Uint8Array(ciphertext), iv.length);
  await putEncryptedBlob(blobKey, envelope.buffer);
};

export interface PrivateRecordOpening {
  recordId: string;
  recordType: string;
  payload: string;
  salt: string;
  commitment: string;
  transactionId?: string;
}

export const savePrivateRecordOpening = async (contractAddress: string, opening: PrivateRecordOpening): Promise<void> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getStateKey(), encoder.encode(JSON.stringify(opening)));
  const envelope = new Uint8Array(iv.length + ciphertext.byteLength);
  envelope.set(iv);
  envelope.set(new Uint8Array(ciphertext), iv.length);
  await putEncryptedBlob(`record:${contractAddress}:${opening.recordId}:${opening.commitment}`, envelope.buffer);
};

export const loadPrivateRecordOpening = async (contractAddress: string, recordId: string, commitment: string): Promise<PrivateRecordOpening> => {
  const envelope = await getEncryptedBlob(`record:${contractAddress}:${recordId}:${commitment}`);
  if (!envelope) throw new Error('The private record opening is unavailable on this device.');
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.slice(0, 12) }, await getStateKey(), envelope.slice(12));
  return JSON.parse(new TextDecoder().decode(plaintext)) as PrivateRecordOpening;
};
