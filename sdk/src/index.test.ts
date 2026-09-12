import { describe, expect, it } from 'vitest';
import { VeilDriveClient } from './index';

describe('VeilDriveClient', () => {
  it('creates and verifies deterministic file commitments', async () => {
    const client = new VeilDriveClient();
    const file = new Blob(['private document']);
    const commitment = await client.files.commitment(file);
    await expect(client.files.verify(file, commitment)).resolves.toBe(true);
    await expect(client.files.verify(new Blob(['changed']), commitment)).resolves.toBe(false);
  });

  it('creates receipts for access grants', async () => {
    const client = new VeilDriveClient({ network: 'preprod' });
    const receipt = await client.access.grant('file-1', { permissions: ['view'], oneTime: true });
    expect(receipt.fileId).toBe('file-1');
    expect(receipt.network).toBe('preprod');
    expect(receipt.transactionId).toMatch(/^[a-f0-9]{64}$/);
  });
});
