const DATABASE_NAME = 'veildrive-vault';
const DATABASE_VERSION = 1;
const BLOBS = 'encrypted-blobs';
const KEYS = 'crypto-keys';

let databasePromise: Promise<IDBDatabase> | null = null;

const openDatabase = (): Promise<IDBDatabase> => {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Persistent browser storage is required for the encrypted vault.'));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => { databasePromise = null; reject(request.error ?? new Error('Unable to open encrypted vault.')); };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
      if (!db.objectStoreNames.contains(KEYS)) db.createObjectStore(KEYS);
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); databasePromise = null; };
      resolve(request.result);
    };
  });
  return databasePromise;
};

const hasIndexedDb = () => typeof indexedDB !== 'undefined';

export const putEncryptedBlob = async (key: string, value: ArrayBuffer): Promise<void> => {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(BLOBS, 'readwrite');
    transaction.objectStore(BLOBS).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error('Unable to store encrypted blob.'));
  });
};

export const getEncryptedBlob = async (key: string): Promise<ArrayBuffer | undefined> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(BLOBS).objectStore(BLOBS).get(key);
    request.onsuccess = () => resolve(request.result as ArrayBuffer | undefined);
    request.onerror = () => reject(request.error ?? new Error('Unable to read encrypted blob.'));
  });
};

export const countEncryptedBlobs = async (): Promise<number> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(BLOBS).objectStore(BLOBS).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to inspect encrypted blobs.'));
  });
};

export const deleteEncryptedBlob = async (key: string): Promise<void> => {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(BLOBS, 'readwrite');
    transaction.objectStore(BLOBS).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error('Unable to delete encrypted blob.'));
  });
};

export const getVaultKey = async (key: string): Promise<CryptoKey | undefined> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(KEYS).objectStore(KEYS).get(key);
    request.onsuccess = () => resolve(request.result as CryptoKey | undefined);
    request.onerror = () => reject(request.error ?? new Error('Unable to read vault key.'));
  });
};

export const putVaultKey = async (key: string, value: CryptoKey): Promise<void> => {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(KEYS, 'readwrite');
    transaction.objectStore(KEYS).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error('Unable to persist vault key.'));
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

export const clearVaultDatabase = async (): Promise<void> => {
  if (!hasIndexedDb()) throw new Error('Persistent browser storage is unavailable.');
  if (databasePromise) {
    const database = await databasePromise.catch(() => null);
    database?.close();
    databasePromise = null;
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Unable to clear the encrypted vault.'));
    request.onblocked = () => reject(new Error('Close other VeilDrive tabs before clearing this encrypted vault.'));
  });
};
