import type { WitnessContext } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import type { Ledger, Witnesses } from './managed/veil-drive/contract/index.js';

/**
 * Values that never enter the public ledger. Each browser session owns a
 * secret identity key and the private claim set used by credential proofs.
 */
export type VeilDrivePrivateState = {
  readonly secretKey: Uint8Array;
  readonly credentialClaims: Uint8Array;
};

export const createVeilDrivePrivateState = (
  secretKey: Uint8Array = crypto.getRandomValues(new Uint8Array(32)),
  credentialClaims: Uint8Array = new Uint8Array(32),
): VeilDrivePrivateState => ({ secretKey, credentialClaims });

export const witnesses: Witnesses<VeilDrivePrivateState> = {
  localSecretKey: ({ privateState }: WitnessContext<Ledger, VeilDrivePrivateState>) => [
    privateState,
    privateState.secretKey,
  ],
  localCredentialClaims: ({ privateState }: WitnessContext<Ledger, VeilDrivePrivateState>) => [
    privateState,
    privateState.credentialClaims,
  ],
};
