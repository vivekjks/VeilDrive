import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { Blob as NodeBlob } from 'node:buffer';

// jsdom's legacy Blob omits arrayBuffer(); the production browsers targeted
// by VeilDrive implement the standard API. Use Node's standards-compliant Blob
// so encryption tests exercise the same path.
Object.defineProperty(globalThis, 'Blob', { configurable: true, value: NodeBlob });
