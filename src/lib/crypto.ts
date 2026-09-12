import type { DriveItem, EncryptedVersion, UploadResult } from '../types';
import { demoContents } from '../store/fixtures';
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

export const encryptBlob = async (
  blob: Blob,
  fileId: string,
  versionNumber: number,
  createdBy: string,
  metadata: Record<string, unknown>,
): Promise<EncryptedVersion> => {
  const plaintext = await blob.arrayBuffer();
  const commitment = await sha256(plaintext);
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

export const initializeDemoFiles = async (items: DriveItem[], versions: EncryptedVersion[]): Promise<UploadResult[]> => {
  const existing = new Set(versions.map((version) => version.fileId));
  const pending = items.filter((item) => item.kind === 'file' && !existing.has(item.id));
  return Promise.all(
    pending.map(async (item) => {
      const content = demoContents[item.id] ?? `Encrypted demo content for ${item.name}.`;
      const blob = new Blob([content], { type: item.mimeType });
      const version = await encryptBlob(blob, item.id, 1, item.ownerId, {
        name: item.name,
        type: item.mimeType,
        size: item.size,
      });
      return {
        item: { ...item, versionIds: [version.id], currentVersionId: version.id },
        version,
      };
    }),
  );
};

export const verifyBlobAgainstCommitment = async (blob: Blob, commitment: string): Promise<boolean> =>
  (await hashBlob(blob)) === commitment;
