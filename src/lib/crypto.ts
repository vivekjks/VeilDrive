import type { DriveItem, EncryptedVersion, UploadResult } from '../types';
import { base64ToBytes, bytesToBase64, bytesToHex, randomId } from './encoding';
import { getEncryptedBlob, getVaultKey, putEncryptedBlob, putVaultKey } from './indexed-db';

const MASTER_KEY_ID = 'veildrive-master-wrapping-key-v1';
const encoder = new TextEncoder();

const masterWrappingKey = async (): Promise<CryptoKey> => {
  const existing = await getVaultKey(MASTER_KEY_ID);
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-KW', length: 256 }, false, ['wrapKey', 'unwrapKey']);
  await putVaultKey(MASTER_KEY_ID, key);
  return key;
};

export const sha256 = async (data: ArrayBuffer | Uint8Array | string): Promise<string> => {
  const source = typeof data === 'string'
    ? encoder.encode(data).buffer
    : data instanceof Uint8Array
      ? data.slice().buffer
      : data;
  const digest = await crypto.subtle.digest('SHA-256', source);
  return bytesToHex(digest);
};

export const hashBlob = async (blob: Blob): Promise<string> => sha256(await blob.arrayBuffer());

export const commitmentForBlob = async (blob: Blob, saltBase64: string): Promise<string> => {
  const salt = base64ToBytes(saltBase64);
  const plaintext = new Uint8Array(await blob.arrayBuffer());
  const salted = new Uint8Array(salt.length + plaintext.length);
  salted.set(salt);
  salted.set(plaintext, salt.length);
  return sha256(salted);
};

export const encryptBlob = async (
  blob: Blob,
  fileId: string,
  versionNumber: number,
  createdBy: string,
  metadata: Record<string, unknown>,
): Promise<EncryptedVersion> => {
  const plaintext = await blob.arrayBuffer();
  const commitmentSalt = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  const commitment = await commitmentForBlob(blob, commitmentSalt);
  const fileKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const wrappingKey = await masterWrappingKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const metadataIv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, fileKey, plaintext);
  const metadataCipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: metadataIv },
    fileKey,
    encoder.encode(JSON.stringify(metadata)),
  );
  const wrappedKey = await crypto.subtle.wrapKey('raw', fileKey, wrappingKey, 'AES-KW');
  const blobKey = randomId('blob');
  await putEncryptedBlob(blobKey, encrypted);
  return {
    id: randomId('version'),
    fileId,
    version: versionNumber,
    blobKey,
    iv: bytesToBase64(iv),
    wrappedKey: bytesToBase64(wrappedKey),
    metadataIv: bytesToBase64(metadataIv),
    metadataCipher: bytesToBase64(metadataCipher),
    commitment,
    commitmentSalt,
    size: blob.size,
    createdAt: new Date().toISOString(),
    createdBy,
    transactionId: await sha256(`${commitment}:${versionNumber}:${Date.now()}`),
  };
};

const unwrapVersionKey = async (version: EncryptedVersion): Promise<CryptoKey> => {
  const wrappingKey = await masterWrappingKey();
  return crypto.subtle.unwrapKey(
    'raw',
    base64ToBytes(version.wrappedKey),
    wrappingKey,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
};

export const decryptVersion = async (version: EncryptedVersion): Promise<ArrayBuffer> => {
  const encrypted = await getEncryptedBlob(version.blobKey);
  if (!encrypted) throw new Error('The encrypted blob is missing from this device.');
  const key = await unwrapVersionKey(version);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(version.iv) }, key, encrypted);
};

export const decryptVersionMetadata = async <T>(version: EncryptedVersion): Promise<T> => {
  const key = await unwrapVersionKey(version);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(version.metadataIv) },
    key,
    base64ToBytes(version.metadataCipher),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
};

export const encryptUpload = async (
  upload: File,
  parentId: string | null,
  ownerId: string,
  privacy: DriveItem['privacy'],
): Promise<UploadResult> => {
  const id = randomId('file');
  const version = await encryptBlob(upload, id, 1, ownerId, {
    name: upload.name,
    type: upload.type || 'application/octet-stream',
    size: upload.size,
  });
  const timestamp = new Date().toISOString();
  return {
    item: {
      id,
      kind: 'file',
      name: upload.name,
      encryptedName: `f_${id.slice(-10)}.enc`,
      mimeType: upload.type || 'application/octet-stream',
      size: upload.size,
      parentId,
      ownerId,
      privacy,
      createdAt: timestamp,
      modifiedAt: timestamp,
      favorite: false,
      trashed: false,
      versionIds: [version.id],
      currentVersionId: version.id,
      tags: [],
    },
    version,
  };
};

export const verifyBlobAgainstCommitment = async (blob: Blob, commitment: string, saltBase64?: string): Promise<boolean> =>
  (saltBase64 ? await commitmentForBlob(blob, saltBase64) : await hashBlob(blob)) === commitment;
