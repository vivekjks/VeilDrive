import {
  CostModel,
  QueryContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitContext,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, type Ledger } from '../managed/veil-drive/contract/index.js';
import { witnesses, type VeilDrivePrivateState } from '../witnesses.js';

const ZERO_COIN_PUBLIC_KEY = '0'.repeat(64);

export class VeilDriveSimulator {
  readonly contract = new Contract<VeilDrivePrivateState>(witnesses);
  context: CircuitContext<VeilDrivePrivateState>;

  constructor(privateState: VeilDrivePrivateState) {
    const initialized = this.contract.initialState(createConstructorContext(privateState, ZERO_COIN_PUBLIC_KEY));
    this.context = {
      currentPrivateState: initialized.currentPrivateState,
      currentZswapLocalState: initialized.currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(initialized.currentContractState.data, sampleContractAddress()),
    };
  }

  switchUser(privateState: VeilDrivePrivateState) {
    this.context.currentPrivateState = privateState;
  }

  ledger(): Ledger {
    return ledger(this.context.currentQueryContext.state);
  }

  private invoke(circuit: keyof typeof this.contract.impureCircuits, ...args: unknown[]): unknown {
    const output = (this.contract.impureCircuits[circuit] as unknown as (...values: unknown[]) => {
      context: CircuitContext<VeilDrivePrivateState>;
      result: unknown;
    })(this.context, ...args);
    this.context = output.context;
    return output.result;
  }

  call(circuit: string, ...args: unknown[]): unknown {
    const empty = new Uint8Array(32);
    switch (circuit) {
      case 'registerFile': return this.invoke('fileOperation', 1n, ...args, 0n);
      case 'updateFile': return this.invoke('fileOperation', 2n, ...args, 0n);
      case 'verifyCommitment': return this.invoke('fileOperation', 3n, args[0], args[1], empty, 0n);
      case 'verifyFileVersion': return this.invoke('fileOperation', 4n, args[0], args[2], empty, args[1]);
      case 'revokeFile': return this.invoke('fileOperation', 5n, args[0], empty, empty, 0n);
      case 'grantAccess': return this.invoke('walletAccessOperation', 1n, ...args);
      case 'revokeAccess': return this.invoke('walletAccessOperation', 2n, ...args, 0n, 0n, false);
      case 'proveWalletAccess': return this.invoke('walletAccessOperation', 3n, args[0], empty, 0n, 0n, false);
      case 'consumeWalletAccess': return this.invoke('walletAccessOperation', 4n, args[0], empty, 0n, 0n, false);
      case 'registerIssuer': return this.invoke('credentialOperation', 1n, args[0], empty, empty, 0n);
      case 'issueCredential': return this.invoke('credentialOperation', 2n, ...args);
      case 'revokeCredential': return this.invoke('credentialOperation', 3n, args[0], empty, empty, 0n);
      case 'createAccessPolicy': return this.invoke('policyAccessOperation', 1n, args[0], empty, ...args.slice(1));
      case 'revokeAccessPolicy': return this.invoke('policyAccessOperation', 2n, args[0], empty, empty, empty, 0n, 0n, false);
      case 'provePolicyAccess': return this.invoke('policyAccessOperation', 3n, args[0], args[1], empty, empty, 0n, 0n, false);
      case 'consumePolicyAccess': return this.invoke('policyAccessOperation', 4n, args[0], args[1], empty, empty, 0n, 0n, false);
      case 'createCapabilityAccess': return this.invoke('capabilityAccessOperation', 1n, ...args);
      case 'proveCapabilityAccess': return this.invoke('capabilityAccessOperation', 2n, args[0], empty, empty, 0n, 0n, false);
      case 'consumeCapabilityAccess': return this.invoke('capabilityAccessOperation', 3n, args[0], empty, empty, 0n, 0n, false);
      case 'revokeCapabilityAccess': return this.invoke('capabilityAccessOperation', 4n, args[0], empty, empty, 0n, 0n, false);
      case 'recordAuditEvent': return this.invoke('auditOperation', 1n, 0n, ...args);
      case 'verifyAuditEvent': return this.invoke('auditOperation', 2n, args[0], empty, args[1], true);
      case 'commitPrivateRecord': return this.invoke('privateRecordOperation', 1n, ...args);
      case 'revokePrivateRecord': return this.invoke('privateRecordOperation', 2n, args[0], empty, empty);
      case 'verifyPrivateRecord': return this.invoke('privateRecordOperation', 3n, args[0], empty, args[1]);
      default: throw new Error(`Unknown VeilDrive operation: ${circuit}`);
    }
  }
}
