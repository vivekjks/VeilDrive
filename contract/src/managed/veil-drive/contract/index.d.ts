import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  localCredentialClaims(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  registerFile(context: __compactRuntime.CircuitContext<PS>,
               fileId_0: Uint8Array,
               commitment_0: Uint8Array,
               metadataCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateFile(context: __compactRuntime.CircuitContext<PS>,
             fileId_0: Uint8Array,
             commitment_0: Uint8Array,
             metadataCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeFile(context: __compactRuntime.CircuitContext<PS>, fileId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  verifyCommitment(context: __compactRuntime.CircuitContext<PS>,
                   fileId_0: Uint8Array,
                   expectedCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  grantAccess(context: __compactRuntime.CircuitContext<PS>,
              fileId_0: Uint8Array,
              recipient_0: Uint8Array,
              permissions_0: bigint,
              expiresAt_0: bigint,
              oneTime_0: boolean): __compactRuntime.CircuitResults<PS, Uint8Array>;
  revokeAccess(context: __compactRuntime.CircuitContext<PS>,
               fileId_0: Uint8Array,
               recipient_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveWalletAccess(context: __compactRuntime.CircuitContext<PS>,
                    fileId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  consumeWalletAccess(context: __compactRuntime.CircuitContext<PS>,
                      fileId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  credentialId_0: Uint8Array,
                  holder_0: Uint8Array,
                  requiredClaimsCommitment_0: Uint8Array,
                  expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   credentialId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  createAccessPolicy(context: __compactRuntime.CircuitContext<PS>,
                     policyId_0: Uint8Array,
                     fileId_0: Uint8Array,
                     requiredClaims_0: Uint8Array,
                     permissions_0: bigint,
                     expiresAt_0: bigint,
                     oneTime_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  revokeAccessPolicy(context: __compactRuntime.CircuitContext<PS>,
                     policyId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  provePolicyAccess(context: __compactRuntime.CircuitContext<PS>,
                    policyId_0: Uint8Array,
                    credentialId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  consumePolicyAccess(context: __compactRuntime.CircuitContext<PS>,
                      policyId_0: Uint8Array,
                      credentialId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  recordAuditEvent(context: __compactRuntime.CircuitContext<PS>,
                   fileId_0: Uint8Array,
                   eventCommitment_0: Uint8Array,
                   authorized_0: boolean): __compactRuntime.CircuitResults<PS, bigint>;
  verifyAuditEvent(context: __compactRuntime.CircuitContext<PS>,
                   eventId_0: bigint,
                   expectedCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  registerFile(context: __compactRuntime.CircuitContext<PS>,
               fileId_0: Uint8Array,
               commitment_0: Uint8Array,
               metadataCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateFile(context: __compactRuntime.CircuitContext<PS>,
             fileId_0: Uint8Array,
             commitment_0: Uint8Array,
             metadataCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeFile(context: __compactRuntime.CircuitContext<PS>, fileId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  verifyCommitment(context: __compactRuntime.CircuitContext<PS>,
                   fileId_0: Uint8Array,
                   expectedCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  grantAccess(context: __compactRuntime.CircuitContext<PS>,
              fileId_0: Uint8Array,
              recipient_0: Uint8Array,
              permissions_0: bigint,
              expiresAt_0: bigint,
              oneTime_0: boolean): __compactRuntime.CircuitResults<PS, Uint8Array>;
  revokeAccess(context: __compactRuntime.CircuitContext<PS>,
               fileId_0: Uint8Array,
               recipient_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveWalletAccess(context: __compactRuntime.CircuitContext<PS>,
                    fileId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  consumeWalletAccess(context: __compactRuntime.CircuitContext<PS>,
                      fileId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  credentialId_0: Uint8Array,
                  holder_0: Uint8Array,
                  requiredClaimsCommitment_0: Uint8Array,
                  expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   credentialId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  createAccessPolicy(context: __compactRuntime.CircuitContext<PS>,
                     policyId_0: Uint8Array,
                     fileId_0: Uint8Array,
                     requiredClaims_0: Uint8Array,
                     permissions_0: bigint,
                     expiresAt_0: bigint,
                     oneTime_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  revokeAccessPolicy(context: __compactRuntime.CircuitContext<PS>,
                     policyId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  provePolicyAccess(context: __compactRuntime.CircuitContext<PS>,
                    policyId_0: Uint8Array,
                    credentialId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  consumePolicyAccess(context: __compactRuntime.CircuitContext<PS>,
                      policyId_0: Uint8Array,
                      credentialId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  recordAuditEvent(context: __compactRuntime.CircuitContext<PS>,
                   fileId_0: Uint8Array,
                   eventCommitment_0: Uint8Array,
                   authorized_0: boolean): __compactRuntime.CircuitResults<PS, bigint>;
  verifyAuditEvent(context: __compactRuntime.CircuitContext<PS>,
                   eventId_0: bigint,
                   expectedCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  identityCommitment(secretKey_0: Uint8Array): Uint8Array;
  claimsCommitment(claims_0: Uint8Array): Uint8Array;
  accessGrantId(fileId_0: Uint8Array, recipient_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  identityCommitment(context: __compactRuntime.CircuitContext<PS>,
                     secretKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  claimsCommitment(context: __compactRuntime.CircuitContext<PS>,
                   claims_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  accessGrantId(context: __compactRuntime.CircuitContext<PS>,
                fileId_0: Uint8Array,
                recipient_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  registerFile(context: __compactRuntime.CircuitContext<PS>,
               fileId_0: Uint8Array,
               commitment_0: Uint8Array,
               metadataCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateFile(context: __compactRuntime.CircuitContext<PS>,
             fileId_0: Uint8Array,
             commitment_0: Uint8Array,
             metadataCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeFile(context: __compactRuntime.CircuitContext<PS>, fileId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  verifyCommitment(context: __compactRuntime.CircuitContext<PS>,
                   fileId_0: Uint8Array,
                   expectedCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  grantAccess(context: __compactRuntime.CircuitContext<PS>,
              fileId_0: Uint8Array,
              recipient_0: Uint8Array,
              permissions_0: bigint,
              expiresAt_0: bigint,
              oneTime_0: boolean): __compactRuntime.CircuitResults<PS, Uint8Array>;
  revokeAccess(context: __compactRuntime.CircuitContext<PS>,
               fileId_0: Uint8Array,
               recipient_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveWalletAccess(context: __compactRuntime.CircuitContext<PS>,
                    fileId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  consumeWalletAccess(context: __compactRuntime.CircuitContext<PS>,
                      fileId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  credentialId_0: Uint8Array,
                  holder_0: Uint8Array,
                  requiredClaimsCommitment_0: Uint8Array,
                  expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  revokeCredential(context: __compactRuntime.CircuitContext<PS>,
                   credentialId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  createAccessPolicy(context: __compactRuntime.CircuitContext<PS>,
                     policyId_0: Uint8Array,
                     fileId_0: Uint8Array,
                     requiredClaims_0: Uint8Array,
                     permissions_0: bigint,
                     expiresAt_0: bigint,
                     oneTime_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  revokeAccessPolicy(context: __compactRuntime.CircuitContext<PS>,
                     policyId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  provePolicyAccess(context: __compactRuntime.CircuitContext<PS>,
                    policyId_0: Uint8Array,
                    credentialId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  consumePolicyAccess(context: __compactRuntime.CircuitContext<PS>,
                      policyId_0: Uint8Array,
                      credentialId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  recordAuditEvent(context: __compactRuntime.CircuitContext<PS>,
                   fileId_0: Uint8Array,
                   eventCommitment_0: Uint8Array,
                   authorized_0: boolean): __compactRuntime.CircuitResults<PS, bigint>;
  verifyAuditEvent(context: __compactRuntime.CircuitContext<PS>,
                   eventId_0: bigint,
                   expectedCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly administrator: Uint8Array;
  issuers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  files: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { commitment: Uint8Array,
                                 metadataCommitment: Uint8Array,
                                 owner: Uint8Array,
                                 version: bigint,
                                 revoked: boolean
                               };
    [Symbol.iterator](): Iterator<[Uint8Array, { commitment: Uint8Array,
  metadataCommitment: Uint8Array,
  owner: Uint8Array,
  version: bigint,
  revoked: boolean
}]>
  };
  grants: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { fileId: Uint8Array,
                                 recipient: Uint8Array,
                                 permissions: bigint,
                                 expiresAt: bigint,
                                 oneTime: boolean,
                                 consumed: boolean,
                                 revoked: boolean
                               };
    [Symbol.iterator](): Iterator<[Uint8Array, { fileId: Uint8Array,
  recipient: Uint8Array,
  permissions: bigint,
  expiresAt: bigint,
  oneTime: boolean,
  consumed: boolean,
  revoked: boolean
}]>
  };
  credentials: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { holder: Uint8Array,
                                 claimsCommitment: Uint8Array,
                                 expiresAt: bigint,
                                 revoked: boolean
                               };
    [Symbol.iterator](): Iterator<[Uint8Array, { holder: Uint8Array,
  claimsCommitment: Uint8Array,
  expiresAt: bigint,
  revoked: boolean
}]>
  };
  policies: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { fileId: Uint8Array,
                                 requiredClaims: Uint8Array,
                                 permissions: bigint,
                                 expiresAt: bigint,
                                 oneTime: boolean,
                                 consumed: boolean,
                                 active: boolean
                               };
    [Symbol.iterator](): Iterator<[Uint8Array, { fileId: Uint8Array,
  requiredClaims: Uint8Array,
  permissions: bigint,
  expiresAt: bigint,
  oneTime: boolean,
  consumed: boolean,
  active: boolean
}]>
  };
  auditEvents: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): { fileId: Uint8Array,
                             eventCommitment: Uint8Array,
                             authorized: boolean
                           };
    [Symbol.iterator](): Iterator<[bigint, { fileId: Uint8Array, eventCommitment: Uint8Array, authorized: boolean }]>
  };
  readonly fileCount: bigint;
  readonly grantCount: bigint;
  readonly credentialCount: bigint;
  readonly policyCount: bigint;
  readonly auditCount: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
