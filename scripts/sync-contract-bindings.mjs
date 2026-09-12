import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../contract/src/managed/veil-drive/contract', import.meta.url));
const target = fileURLToPath(new URL('../contract/dist/managed/veil-drive/contract', import.meta.url));

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
