import {
  CompiledVeilDriveContract,
  createVeilDrivePrivateState,
  pureCircuits,
  type Contract,
  type VeilDrivePrivateState,
} from '@veildrive/contract';
import { deployContract, findDeployedContract, type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import {
  Binding,
  Proof,
  SignatureEnabled,
  Transaction,
  type FinalizedTransaction,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {
  createProofProvider,
  type MidnightProviders,
  type UnboundTransaction,
} from '@midnight-ntwrk/midnight-js-types';
import { fromHex, toHex, parseCoinPublicKeyToHex, parseEncPublicKeyToHex } from '@midnight-ntwrk/midnight-js-utils';
import type { Permission } from '../types';
import { bytesToHex, hexToBytes } from './encoding';
import { sha256 } from './crypto';
import { PREPROD, type WalletConnection } from './midnight';

export const VEIL_PRIVATE_STATE_ID = 'veilDrivePrivateState' as const;

type VeilContract = Contract<VeilDrivePrivateState>;
type CircuitKey = Exclude<keyof VeilContract['impureCircuits'], number | symbol>;
type VeilProviders = MidnightProviders<CircuitKey, typeof VEIL_PRIVATE_STATE_ID, VeilDrivePrivateState>;
type ActiveContract = FoundContract<VeilContract>;

export interface MidnightContractSession {
  contractAddress: string;
  identityCommitment: string;
  deploymentTransactionId?: string;
}

let activeContract: ActiveContract | null = null;
let activeProviders: VeilProviders | null = null;
let activeAddress: string | null = null;
let identityCommitment: string | null = null;

const deriveWalletSecrets = async (connection: WalletConnection) => {
  await connection.api.hintUsage([
    'signData',
    'getShieldedAddresses',
    'getConfiguration',
    'balanceUnsealedTransaction',
    'submitTransaction',
  ]).catch(() => undefined);
  const signed = await connection.api.signData(
    `VeilDrive private state unlock v1\nNetwork: ${PREPROD.networkId}`,
    { encoding: 'text', keyType: 'unshielded' },
  );
  const digest = await sha256(`${signed.verifyingKey}:${signed.signature}`);
  const claims = await sha256(`veildrive:claims:empty:${connection.walletAddress}`);
  return {
    password: `Vd!9-${digest}`,
    privateState: createVeilDrivePrivateState(hexToBytes(digest), hexToBytes(claims)),
  };
};

const initializeProviders = async (connection: WalletConnection): Promise<{
  providers: VeilProviders;
  privateState: VeilDrivePrivateState;
}> => {
  const { password, privateState } = await deriveWalletSecrets(connection);
  const zkConfigProvider = new FetchZkConfigProvider<CircuitKey>(window.location.origin, fetch.bind(window));
  let proofProvider;
  try {
    const delegatedProvider = await connection.api.getProvingProvider(zkConfigProvider);
    proofProvider = createProofProvider(delegatedProvider);
  } catch {
    proofProvider = httpClientProofProvider(connection.proofServerUri || PREPROD.proofServer, zkConfigProvider);
  }
  const addresses = await connection.api.getShieldedAddresses();
  const privateStateProvider = levelPrivateStateProvider<typeof VEIL_PRIVATE_STATE_ID, VeilDrivePrivateState>({
    midnightDbName: 'veildrive-midnight-v1',
    privateStateStoreName: 'veil-private-states',
    signingKeyStoreName: 'veil-signing-keys',
    accountId: connection.walletAddress,
    privateStoragePasswordProvider: () => Promise.resolve(password),
  });

  return {
    privateState,
    providers: {
      privateStateProvider,
      zkConfigProvider,
      proofProvider,
      publicDataProvider: indexerPublicDataProvider(
        connection.indexerUri,
        connection.indexerWsUri,
        globalThis.WebSocket as never,
      ),
      walletProvider: {
        getCoinPublicKey: () => parseCoinPublicKeyToHex(addresses.shieldedCoinPublicKey, PREPROD.networkId),
        getEncryptionPublicKey: () => parseEncPublicKeyToHex(addresses.shieldedEncryptionPublicKey, PREPROD.networkId),
        balanceTx: async (transaction: UnboundTransaction): Promise<FinalizedTransaction> => {
          const balanced = await connection.api.balanceUnsealedTransaction(toHex(transaction.serialize()));
          return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
            'signature',
            'proof',
            'binding',
            fromHex(balanced.tx),
          );
        },
      },
      midnightProvider: {
        submitTx: async (transaction: FinalizedTransaction) => {
          await connection.api.submitTransaction(toHex(transaction.serialize()));
          const [transactionId] = transaction.identifiers();
          if (!transactionId) throw new Error('Midnight returned a transaction without an identifier.');
          return transactionId;
        },
      },
    },
  };
};

const rememberSession = (contract: ActiveContract, privateState: VeilDrivePrivateState, providers: VeilProviders): MidnightContractSession => {
  activeContract = contract;
  activeAddress = contract.deployTxData.public.contractAddress;
  activeProviders = providers;
  providers.privateStateProvider.setContractAddress(activeAddress);
  identityCommitment = bytesToHex(pureCircuits.identityCommitment(privateState.secretKey));
  return { contractAddress: activeAddress, identityCommitment };
};

export const deployVeilDriveContract = async (connection: WalletConnection): Promise<MidnightContractSession> => {
  const { providers, privateState } = await initializeProviders(connection);
  const contract = await deployContract(providers, {
    compiledContract: CompiledVeilDriveContract,
    privateStateId: VEIL_PRIVATE_STATE_ID,
    initialPrivateState: privateState,
  });
  const session = rememberSession(contract, privateState, providers);
  return { ...session, deploymentTransactionId: contract.deployTxData.public.txId };
};

export const joinVeilDriveContract = async (
  connection: WalletConnection,
  contractAddress: string,
): Promise<MidnightContractSession> => {
  const address = contractAddress.trim();
  if (!address) throw new Error('Enter a deployed VeilDrive contract address.');
  const { providers, privateState } = await initializeProviders(connection);
  providers.privateStateProvider.setContractAddress(address);
  const existingPrivateState = await providers.privateStateProvider.get(VEIL_PRIVATE_STATE_ID);
  const contract = await findDeployedContract(providers, {
    contractAddress: address,
    compiledContract: CompiledVeilDriveContract,
    privateStateId: VEIL_PRIVATE_STATE_ID,
    ...(existingPrivateState ? {} : { initialPrivateState: privateState }),
  });
  return rememberSession(contract, existingPrivateState ?? privateState, providers);
};

export const getMidnightContractSession = (): MidnightContractSession | null =>
  activeAddress && identityCommitment
    ? { contractAddress: activeAddress, identityCommitment }
    : null;

export const hasActiveMidnightContract = (): boolean => activeContract !== null;

const requireContract = (): ActiveContract => {
  if (!activeContract) throw new Error('Connect Lace or 1AM and deploy or join the VeilDrive contract in Settings first.');
  return activeContract;
};

const fileIdBytes = async (fileId: string) => hexToBytes(await sha256(`veildrive:file:${fileId}`));
const bytes32 = async (value: string, domain: string) => {
  const clean = value.replace(/^0x/, '');
  return /^[0-9a-f]{64}$/i.test(clean) ? hexToBytes(clean) : hexToBytes(await sha256(`${domain}:${value}`));
};
const claimsCommitmentBytes = async (claims: string) =>
  pureCircuits.claimsCommitment(await bytes32(claims, 'veildrive:claims-payload'));
const transactionId = (result: { public: { txId: string } }) => result.public.txId;

export const registerFileOnMidnight = async (
  fileId: string,
  commitment: string,
  metadataCommitment: string,
) => transactionId(await requireContract().callTx.registerFile(
  await fileIdBytes(fileId),
  hexToBytes(commitment),
  hexToBytes(metadataCommitment),
));

export const updateFileOnMidnight = async (
  fileId: string,
  commitment: string,
  metadataCommitment: string,
) => transactionId(await requireContract().callTx.updateFile(
  await fileIdBytes(fileId),
  hexToBytes(commitment),
  hexToBytes(metadataCommitment),
));

export const revokeFileOnMidnight = async (fileId: string) =>
  transactionId(await requireContract().callTx.revokeFile(await fileIdBytes(fileId)));

export const verifyFileOnMidnight = async (fileId: string, commitment: string, version?: number) =>
  version === undefined
    ? transactionId(await requireContract().callTx.verifyCommitment(await fileIdBytes(fileId), hexToBytes(commitment)))
    : transactionId(await requireContract().callTx.verifyFileVersion(await fileIdBytes(fileId), BigInt(version), hexToBytes(commitment)));

const permissionMask = (permissions: Permission[]) => permissions.reduce((mask, permission) => {
  const bit = { view: 1, download: 2, edit: 4, reshare: 8 }[permission];
  return mask | bit;
}, 0);

const expirySeconds = (expiresAt: string | null) =>
  expiresAt ? BigInt(Math.floor(new Date(expiresAt).getTime() / 1000)) : 0n;

export const grantWalletAccessOnMidnight = async (
  fileId: string,
  recipientIdentity: string,
  permissions: Permission[],
  expiresAt: string | null,
  oneTime: boolean,
) => transactionId(await requireContract().callTx.grantAccess(
  await fileIdBytes(fileId),
  await bytes32(recipientIdentity, 'veildrive:recipient'),
  BigInt(permissionMask(permissions)),
  expirySeconds(expiresAt),
  oneTime,
));

export const createPolicyOnMidnight = async (
  grantId: string,
  fileId: string,
  claims: string,
  permissions: Permission[],
  expiresAt: string | null,
  oneTime: boolean,
) => transactionId(await requireContract().callTx.createAccessPolicy(
  await bytes32(grantId, 'veildrive:policy'),
  await fileIdBytes(fileId),
  await claimsCommitmentBytes(claims),
  BigInt(permissionMask(permissions)),
  expirySeconds(expiresAt),
  oneTime,
));

export const revokeGrantOnMidnight = async (fileId: string, recipientIdentity: string) =>
  transactionId(await requireContract().callTx.revokeAccess(
    await fileIdBytes(fileId),
    await bytes32(recipientIdentity, 'veildrive:recipient'),
  ));

export const proveWalletAccessOnMidnight = async (fileId: string) =>
  transactionId(await requireContract().callTx.proveWalletAccess(await fileIdBytes(fileId)));

export const consumeWalletAccessOnMidnight = async (fileId: string) =>
  transactionId(await requireContract().callTx.consumeWalletAccess(await fileIdBytes(fileId)));

export const revokePolicyOnMidnight = async (grantId: string) =>
  transactionId(await requireContract().callTx.revokeAccessPolicy(
    await bytes32(grantId, 'veildrive:policy'),
  ));

export const provePolicyAccessOnMidnight = async (grantId: string, credentialId: string) =>
  transactionId(await requireContract().callTx.provePolicyAccess(
    await bytes32(grantId, 'veildrive:policy'),
    await bytes32(credentialId, 'veildrive:credential'),
  ));

export const consumePolicyAccessOnMidnight = async (grantId: string, credentialId: string) =>
  transactionId(await requireContract().callTx.consumePolicyAccess(
    await bytes32(grantId, 'veildrive:policy'),
    await bytes32(credentialId, 'veildrive:credential'),
  ));

export const createCapabilityAccessOnMidnight = async (
  capabilityId: string,
  fileId: string,
  tokenSecret: string,
  permissions: Permission[],
  expiresAt: string | null,
  oneTime: boolean,
) => transactionId(await requireContract().callTx.createCapabilityAccess(
  await bytes32(capabilityId, 'veildrive:capability-id'),
  await fileIdBytes(fileId),
  pureCircuits.capabilityCommitment(await bytes32(tokenSecret, 'veildrive:capability-secret')),
  BigInt(permissionMask(permissions)),
  expirySeconds(expiresAt),
  oneTime,
));

const setLocalCapabilitySecret = async (tokenSecret: string) => {
  if (!activeProviders) throw new Error('Deploy or join the VeilDrive contract before using a private link.');
  const current = await activeProviders.privateStateProvider.get(VEIL_PRIVATE_STATE_ID);
  if (!current) throw new Error('The local private contract state is unavailable. Rejoin the registry.');
  await activeProviders.privateStateProvider.set(VEIL_PRIVATE_STATE_ID, {
    ...current,
    capabilitySecret: await bytes32(tokenSecret, 'veildrive:capability-secret'),
  });
};

export const proveCapabilityAccessOnMidnight = async (capabilityId: string, tokenSecret: string) => {
  await setLocalCapabilitySecret(tokenSecret);
  return transactionId(await requireContract().callTx.proveCapabilityAccess(
    await bytes32(capabilityId, 'veildrive:capability-id'),
  ));
};

export const consumeCapabilityAccessOnMidnight = async (capabilityId: string, tokenSecret: string) => {
  await setLocalCapabilitySecret(tokenSecret);
  return transactionId(await requireContract().callTx.consumeCapabilityAccess(
    await bytes32(capabilityId, 'veildrive:capability-id'),
  ));
};

export const revokeCapabilityAccessOnMidnight = async (capabilityId: string) =>
  transactionId(await requireContract().callTx.revokeCapabilityAccess(
    await bytes32(capabilityId, 'veildrive:capability-id'),
  ));

export const issueCredentialOnMidnight = async (
  credentialId: string,
  holderIdentity: string,
  claims: string,
  expiresAt: string,
) => transactionId(await requireContract().callTx.issueCredential(
  await bytes32(credentialId, 'veildrive:credential'),
  await bytes32(holderIdentity, 'veildrive:holder'),
  await claimsCommitmentBytes(claims),
  expirySeconds(expiresAt),
));

export const credentialClaimsCommitmentOnMidnight = async (claimsSecret: string) =>
  bytesToHex(await claimsCommitmentBytes(claimsSecret));

export const revokeCredentialOnMidnight = async (credentialId: string) =>
  transactionId(await requireContract().callTx.revokeCredential(
    await bytes32(credentialId, 'veildrive:credential'),
  ));

export const setLocalCredentialClaimsOnMidnight = async (claims: string) => {
  if (!activeProviders) throw new Error('Deploy or join the VeilDrive contract before loading private credential claims.');
  const current = await activeProviders.privateStateProvider.get(VEIL_PRIVATE_STATE_ID);
  if (!current) throw new Error('The local private contract state is unavailable. Rejoin the registry.');
  await activeProviders.privateStateProvider.set(VEIL_PRIVATE_STATE_ID, {
    ...current,
    credentialClaims: await bytes32(claims, 'veildrive:claims-payload'),
  });
};

export const generateAuditProofOnMidnight = async (fileId: string, commitment: string) =>
  transactionId(await requireContract().callTx.recordAuditEvent(
    await fileIdBytes(fileId),
    await bytes32(commitment, 'veildrive:audit'),
    true,
  ));

export const commitPrivateRecordOnMidnight = async (
  recordId: string,
  recordType: string,
  payload: string,
) => {
  // Public records receive fresh client-side entropy so low-cardinality values
  // cannot be guessed or correlated from their ledger commitment.
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const saltedPayload = `${bytesToHex(salt)}:${payload}`;
  return transactionId(await requireContract().callTx.commitPrivateRecord(
    await bytes32(recordId, 'veildrive:private-record-id'),
    await bytes32(recordType, 'veildrive:private-record-type'),
    await bytes32(await sha256(saltedPayload), 'veildrive:private-record-payload'),
  ));
};

export const revokePrivateRecordOnMidnight = async (recordId: string) =>
  transactionId(await requireContract().callTx.revokePrivateRecord(
    await bytes32(recordId, 'veildrive:private-record-id'),
  ));
