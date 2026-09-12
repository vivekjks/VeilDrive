import { describe, expect, it } from 'vitest';
import { decryptVersion, decryptVersionMetadata, encryptBlob, hashBlob, verifyBlobAgainstCommitment } from './crypto';

describe('client-side encrypted vault', () => {
  it('round-trips file bytes and separately encrypted metadata', async () => {
    const source = new Blob(['board packet: strictly confidential'], { type: 'text/plain' });
    const version = await encryptBlob(source, 'file-test', 1, 'alice', {
      name: 'board-packet.txt',
      classification: 'maximum',
    });

    const plaintext = await decryptVersion(version);
    const metadata = await decryptVersionMetadata<{ name: string; classification: string }>(version);

    expect(new TextDecoder().decode(plaintext)).toBe('board packet: strictly confidential');
    expect(metadata).toEqual({ name: 'board-packet.txt', classification: 'maximum' });
    expect(version.iv).not.toBe(version.metadataIv);
    expect(version.wrappedKey).not.toContain('board packet');
  });

  it('detects a commitment mismatch', async () => {
    const original = new Blob(['approved version']);
    const modified = new Blob(['modified version']);
    const commitment = await hashBlob(original);

    expect(await verifyBlobAgainstCommitment(original, commitment)).toBe(true);
    expect(await verifyBlobAgainstCommitment(modified, commitment)).toBe(false);
  });
});
