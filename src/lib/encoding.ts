export const bytesToBase64 = (bytes: ArrayBuffer | Uint8Array): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < view.length; index += chunk) {
    binary += String.fromCharCode(...view.subarray(index, Math.min(index + chunk, view.length)));
  }
  return btoa(binary);
};

export const base64ToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

export const bytesToHex = (bytes: ArrayBuffer | Uint8Array): string =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export const hexToBytes = (hex: string): Uint8Array<ArrayBuffer> => {
  const normalized = hex.replace(/^0x/, '').padStart(64, '0');
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return bytes;
};

export const shortHash = (value?: string, head = 8, tail = 6): string => {
  if (!value) return 'Pending';
  const clean = value.replace(/^0x/, '');
  return `0x${clean.slice(0, head)}…${clean.slice(-tail)}`;
};

export const randomId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;
