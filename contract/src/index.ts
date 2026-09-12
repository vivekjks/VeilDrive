import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import * as Generated from './managed/veil-drive/contract/index.js';
import * as Witnesses from './witnesses.js';

export * from './managed/veil-drive/contract/index.js';
export * from './witnesses.js';

export const CompiledVeilDriveContract = CompiledContract.make<
  Generated.Contract<Witnesses.VeilDrivePrivateState>
>('VeilDrive', Generated.Contract<Witnesses.VeilDrivePrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets('./managed/veil-drive'),
);
