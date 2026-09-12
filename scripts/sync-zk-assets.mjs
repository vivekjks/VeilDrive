import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('contract/src/managed/veil-drive');
const publicRoot = resolve('public');

for (const folder of ['keys', 'zkir', 'compiler']) {
  const target = resolve(publicRoot, folder);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(resolve(source, folder), target, { recursive: true });
}

console.log('Synced VeilDrive proving keys, verifier keys, ZKIR, and compiler metadata.');
