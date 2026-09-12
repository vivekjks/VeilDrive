const DATABASE_NAME = 'veildrive-vault';
const DATABASE_VERSION = 1;
const BLOBS = 'encrypted-blobs';
const KEYS = 'crypto-keys';

let databasePromise: Promise<IDBDatabase> | null = null;
const memoryBlobs = new Map<string, ArrayBuffer>();
const memoryKeys = new Map<string, CryptoKey>();

const openDatabase = (): Promise<IDBDatabase> => {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Unable to open encrypted vault.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
      if (!db.objectStoreNames.contains(KEYS)) db.createObjectStore(KEYS);
    };
    request.onsuccess = () => resolve(request.result);
  });
  return databasePromise;
};

const hasIndexedDb = () => typeof indexedDB !== 'undefined';

export const putEncryptedBlob = async (key: string, value: ArrayBuffer): Promise<void> => {
  if (!hasIndexedDb()) {
    memoryBlobs.set(key, value);
    return;
  }
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(BLOBS, 'readwrite').objectStore(BLOBS).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Unable to store encrypted blob.'));
  });
};

export const getEncryptedBlob = async (key: string): Promise<ArrayBuffer | undefined> => {
  if (!hasIndexedDb()) return memoryBlobs.get(key);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(BLOBS).objectStore(BLOBS).get(key);
    request.onsuccess = () => resolve(request.result as ArrayBuffer | undefined);
    request.onerror = () => reject(request.error ?? new Error('Unable to read encrypted blob.'));
  });
};

export const deleteEncryptedBlob = async (key: string): Promise<void> => {
  if (!hasIndexedDb()) {
    memoryBlobs.delete(key);
    return;
  }
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(BLOBS, 'readwrite').objectStore(BLOBS).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Unable to delete encrypted blob.'));
  });
};

export const getVaultKey = async (key: string): Promise<CryptoKey | undefined> => {
  if (!hasIndexedDb()) return memoryKeys.get(key);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(KEYS).objectStore(KEYS).get(key);
    request.onsuccess = () => resolve(request.result as CryptoKey | undefined);
    request.onerror = () => reject(request.error ?? new Error('Unable to read vault key.'));
  });
};

export const putVaultKey = async (key: string, value: CryptoKey): Promise<void> => {
  if (!hasIndexedDb()) {
    memoryKeys.set(key, value);
    return;
  }
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(KEYS, 'readwrite').objectStore(KEYS).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Unable to persist vault key.'));
  });
};

// An IndexedDB read/write transaction serializes creation across browser tabs.
// Concurrent first uploads must never end up wrapped by a discarded key.
export const getOrCreateVaultKey = async (keyId: string, create: () => Promise<CryptoKey>): Promise<CryptoKey> => {
  const existing = await getVaultKey(keyId);
  if (existing) return existing;
  const candidate = await create();
  if (!hasIndexedDb()) throw new Error('Persistent browser storage is required for this encrypted vault.');
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(KEYS, 'readwrite');
    const store = transaction.objectStore(KEYS);
    const request = store.get(keyId);
    let selected = candidate;
    request.onsuccess = () => {
      if (request.result) selected = request.result as CryptoKey;
      else store.put(candidate, keyId);
    };
    transaction.oncomplete = () => resolve(selected);
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to persist encryption key.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Encryption key transaction was aborted.'));
  });
};
