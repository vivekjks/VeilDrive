import { describe, expect, it } from 'vitest';
import { pureCircuits } from '../managed/veil-drive/contract/index.js';
import { createVeilDrivePrivateState } from '../witnesses.js';
import { VeilDriveSimulator } from './veil-drive-simulator.js';

const bytes = (fill: number) => new Uint8Array(32).fill(fill);

describe('VeilDrive Compact contract', () => {
  it('initializes a private administrator without publishing the secret', () => {
    const admin = createVeilDrivePrivateState(bytes(1), bytes(2));
    const simulator = new VeilDriveSimulator(admin);
    const state = simulator.ledger();

    expect(state.administrator).toEqual(pureCircuits.identityCommitment(admin.secretKey));
    expect(state.administrator).not.toEqual(admin.secretKey);
    expect(state.issuers.member(state.administrator)).toBe(true);
    expect(state.fileCount).toBe(0n);
    expect(state.privateRecordCount).toBe(0n);
    expect(state.capabilityCount).toBe(0n);
  });

  it('registers, versions, verifies, and revokes a commitment', () => {
    const simulator = new VeilDriveSimulator(createVeilDrivePrivateState(bytes(3), bytes(4)));
    const fileId = bytes(10);
    const v1 = bytes(11);
    const v2 = bytes(12);
    const metadata = bytes(13);

    simulator.call('registerFile', fileId, v1, metadata);
    expect(simulator.ledger().files.lookup(fileId)).toMatchObject({ commitment: v1, version: 1n, revoked: false });
    expect(() => simulator.call('verifyCommitment', fileId, bytes(99))).toThrow('file commitment mismatch');

    simulator.call('updateFile', fileId, v2, metadata);
    expect(simulator.ledger().files.lookup(fileId)).toMatchObject({ commitment: v2, version: 2n });
    expect(() => simulator.call('verifyCommitment', fileId, v2)).not.toThrow();
    expect(() => simulator.call('verifyFileVersion', fileId, 1n, v1)).not.toThrow();
    expect(() => simulator.call('verifyFileVersion', fileId, 1n, v2)).toThrow('file commitment mismatch');

    simulator.call('revokeFile', fileId);
    expect(simulator.ledger().files.lookup(fileId).revoked).toBe(true);
    expect(() => simulator.call('verifyCommitment', fileId, v2)).toThrow('file registration revoked');
    expect(() => simulator.call('verifyFileVersion', fileId, 1n, v1)).not.toThrow();
  });

  it('rejects changes from anyone except the file owner', () => {
    const owner = createVeilDrivePrivateState(bytes(5), bytes(6));
    const attacker = createVeilDrivePrivateState(bytes(7), bytes(8));
    const simulator = new VeilDriveSimulator(owner);
    const fileId = bytes(20);
    simulator.call('registerFile', fileId, bytes(21), bytes(22));

    simulator.switchUser(attacker);
    expect(() => simulator.call('updateFile', fileId, bytes(23), bytes(24))).toThrow('file owner authorization required');
    expect(() => simulator.call('revokeFile', fileId)).toThrow('file owner authorization required');
  });

  it('enforces wallet grants, one-time consumption, and revocation', () => {
    const owner = createVeilDrivePrivateState(bytes(30), bytes(31));
    const recipient = createVeilDrivePrivateState(bytes(32), bytes(33));
    const simulator = new VeilDriveSimulator(owner);
    const fileId = bytes(34);
    const recipientId = pureCircuits.identityCommitment(recipient.secretKey);
    simulator.call('registerFile', fileId, bytes(35), bytes(36));
    simulator.call('grantAccess', fileId, recipientId, 3n, 0n, true);

    simulator.switchUser(recipient);
    expect(simulator.call('proveWalletAccess', fileId)).toBe(3n);
    expect(simulator.call('consumeWalletAccess', fileId)).toBe(3n);
    expect(() => simulator.call('proveWalletAccess', fileId)).toThrow('one-time access consumed');

    simulator.switchUser(owner);
    simulator.call('revokeAccess', fileId, recipientId);
    simulator.switchUser(recipient);
    expect(() => simulator.call('proveWalletAccess', fileId)).toThrow('access revoked');
  });

  it('proves credential policy access without disclosing claim bytes', () => {
    const rawClaims = bytes(44);
    const admin = createVeilDrivePrivateState(bytes(40), bytes(41));
    const holder = createVeilDrivePrivateState(bytes(42), rawClaims);
    const simulator = new VeilDriveSimulator(admin);
    const fileId = bytes(45);
    const credentialId = bytes(46);
    const policyId = bytes(47);
    const claimsCommitment = pureCircuits.claimsCommitment(rawClaims);
    simulator.call('registerFile', fileId, bytes(48), bytes(49));
    simulator.call('issueCredential', credentialId, pureCircuits.identityCommitment(holder.secretKey), claimsCommitment, 0n);
    simulator.call('createAccessPolicy', policyId, fileId, claimsCommitment, 1n, 0n, false);

    simulator.switchUser(holder);
    expect(simulator.call('provePolicyAccess', policyId, credentialId)).toBe(1n);
    expect(simulator.ledger().credentials.lookup(credentialId).claimsCommitment).toEqual(claimsCommitment);
  });

  it('anchors and verifies authorized private audit events', () => {
    const simulator = new VeilDriveSimulator(createVeilDrivePrivateState(bytes(50), bytes(51)));
    const fileId = bytes(52);
    simulator.call('registerFile', fileId, bytes(55), bytes(56));
    const eventId = simulator.call('recordAuditEvent', fileId, bytes(53), true);

    expect(eventId).toBe(1n);
    expect(() => simulator.call('verifyAuditEvent', eventId, bytes(53))).not.toThrow();
    expect(() => simulator.call('verifyAuditEvent', eventId, bytes(54))).toThrow('audit commitment mismatch');
  });

  it('enforces private external capability secrets, consumption, and owner revocation', () => {
    const owner = createVeilDrivePrivateState(bytes(70), bytes(71), bytes(72));
    const recipient = createVeilDrivePrivateState(bytes(73), bytes(74), bytes(75));
    const attacker = createVeilDrivePrivateState(bytes(76), bytes(77), bytes(78));
    const simulator = new VeilDriveSimulator(owner);
    const fileId = bytes(79);
    const capabilityId = bytes(80);
    simulator.call('registerFile', fileId, bytes(81), bytes(82));
    simulator.call('createCapabilityAccess', capabilityId, fileId, pureCircuits.capabilityCommitment(recipient.capabilitySecret), 3n, 0n, true);

    simulator.switchUser(attacker);
    expect(() => simulator.call('proveCapabilityAccess', capabilityId)).toThrow('invalid capability secret');

    simulator.switchUser(recipient);
    expect(simulator.call('proveCapabilityAccess', capabilityId)).toBe(3n);
    expect(simulator.call('consumeCapabilityAccess', capabilityId)).toBe(3n);
    expect(() => simulator.call('proveCapabilityAccess', capabilityId)).toThrow('one-time capability consumed');

    simulator.switchUser(owner);
    simulator.call('revokeCapabilityAccess', capabilityId);
    expect(simulator.ledger().capabilities.lookup(capabilityId).active).toBe(false);
  });

  it('versions and revokes owner-authorized private application records', () => {
    const owner = createVeilDrivePrivateState(bytes(60), bytes(61));
    const other = createVeilDrivePrivateState(bytes(62), bytes(63));
    const simulator = new VeilDriveSimulator(owner);
    const recordId = bytes(64);
    const recordType = bytes(65);

    expect(simulator.call('commitPrivateRecord', recordId, recordType, bytes(66))).toBe(1n);
    expect(simulator.call('commitPrivateRecord', recordId, recordType, bytes(67))).toBe(2n);
    expect(simulator.call('verifyPrivateRecord', recordId, bytes(67))).toBe(2n);
    expect(simulator.ledger().privateRecordCount).toBe(1n);

    simulator.switchUser(other);
    expect(() => simulator.call('commitPrivateRecord', recordId, recordType, bytes(68))).toThrow('private record owner authorization required');
    expect(() => simulator.call('revokePrivateRecord', recordId)).toThrow('private record owner authorization required');

    simulator.switchUser(owner);
    simulator.call('revokePrivateRecord', recordId);
    expect(() => simulator.call('verifyPrivateRecord', recordId, bytes(67))).toThrow('private record revoked');
  });

  it('file revocation invalidates wallet, credential, and capability access', () => {
    const owner = createVeilDrivePrivateState(bytes(90), bytes(91));
    const holder = createVeilDrivePrivateState(bytes(92), bytes(93), bytes(94));
    const simulator = new VeilDriveSimulator(owner);
    const fileId = bytes(95), policyId = bytes(96), credentialId = bytes(97), capabilityId = bytes(98);
    const claims = pureCircuits.claimsCommitment(holder.credentialClaims);
    simulator.call('registerFile', fileId, bytes(99), bytes(100));
    simulator.call('grantAccess', fileId, pureCircuits.identityCommitment(holder.secretKey), 3n, 0n, false);
    simulator.call('issueCredential', credentialId, pureCircuits.identityCommitment(holder.secretKey), claims, 0n);
    simulator.call('createAccessPolicy', policyId, fileId, claims, 3n, 0n, false);
    simulator.call('createCapabilityAccess', capabilityId, fileId, pureCircuits.capabilityCommitment(holder.capabilitySecret), 3n, 0n, false);
    simulator.call('revokeFile', fileId);
    simulator.switchUser(holder);
    expect(() => simulator.call('proveWalletAccess', fileId)).toThrow('file registration revoked');
    expect(() => simulator.call('provePolicyAccess', policyId, credentialId)).toThrow('file registration revoked');
    expect(() => simulator.call('proveCapabilityAccess', capabilityId)).toThrow('file registration revoked');
  });

  it('does not permit policy ID takeover by another file owner', () => {
    const owner = createVeilDrivePrivateState(bytes(110));
    const attacker = createVeilDrivePrivateState(bytes(111));
    const simulator = new VeilDriveSimulator(owner);
    simulator.call('registerFile', bytes(112), bytes(113), bytes(114));
    simulator.call('createAccessPolicy', bytes(115), bytes(112), bytes(116), 1n, 0n, false);
    simulator.switchUser(attacker);
    simulator.call('registerFile', bytes(117), bytes(118), bytes(119));
    expect(() => simulator.call('createAccessPolicy', bytes(115), bytes(117), bytes(120), 15n, 0n, false)).toThrow('policy already exists');
    expect(simulator.ledger().policies.lookup(bytes(115)).fileId).toEqual(bytes(112));
  });

  it('rejects invalid permission masks and preserves the grant count on reissue', () => {
    const owner = createVeilDrivePrivateState(bytes(121));
    const simulator = new VeilDriveSimulator(owner);
    simulator.call('registerFile', bytes(122), bytes(123), bytes(124));
    expect(() => simulator.call('grantAccess', bytes(122), bytes(125), 0n, 0n, false)).toThrow('invalid permissions');
    expect(() => simulator.call('grantAccess', bytes(122), bytes(125), 16n, 0n, false)).toThrow('invalid permissions');
    simulator.call('grantAccess', bytes(122), bytes(125), 1n, 0n, false);
    simulator.call('grantAccess', bytes(122), bytes(125), 3n, 0n, false);
    expect(simulator.ledger().grantCount).toBe(1n);
  });

  it('does not let an unrelated issuer revoke another issuer’s credential', () => {
    const owner = createVeilDrivePrivateState(bytes(126));
    const issuer = createVeilDrivePrivateState(bytes(127));
    const simulator = new VeilDriveSimulator(owner);
    simulator.call('registerIssuer', pureCircuits.identityCommitment(issuer.secretKey));
    simulator.call('issueCredential', bytes(128), bytes(129), bytes(130), 0n);
    simulator.switchUser(issuer);
    expect(() => simulator.call('revokeCredential', bytes(128))).toThrow('credential issuer authorization required');
  });
});
