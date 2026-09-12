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

  call<K extends keyof typeof this.contract.impureCircuits>(
    circuit: K,
    ...args: Parameters<(typeof this.contract.impureCircuits)[K]> extends [unknown, ...infer A] ? A : never
  ): ReturnType<(typeof this.contract.impureCircuits)[K]> extends { result: infer R } ? R : never {
    const output = (this.contract.impureCircuits[circuit] as (...values: unknown[]) => {
      context: CircuitContext<VeilDrivePrivateState>;
      result: unknown;
    })(this.context, ...args);
    this.context = output.context;
    return output.result as ReturnType<(typeof this.contract.impureCircuits)[K]> extends { result: infer R } ? R : never;
  }
}
