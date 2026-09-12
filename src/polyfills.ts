import { Buffer } from 'buffer';
import process from 'process';

const runtime = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
  process?: typeof process;
  global?: typeof globalThis;
};

runtime.Buffer ??= Buffer;
runtime.process ??= process;
runtime.global ??= globalThis;
