import {
  ArrowSquareOut,
  Check,
  Database,
  HardDrives,
  LockKey,
  Network,
  ShieldCheck,
  Wallet,
} from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { shortHash } from '../lib/encoding';
import {
  deployVeilDriveContract,
  getMidnightContractSession,
} from '../lib/midnight-contract';
import {
  checkPreprodHealth,
  connectMidnightWallet,
  explorerContractUrl,
  getWalletConnection,
  PREPROD,
  type WalletConnection,
} from '../lib/midnight';
import { useAppStore } from '../store/AppStore';

const initialHealth = { indexer: false, proofServer: false, node: false, network: false };

export const SettingsPage = () => {
  const { state, actions } = useAppStore();
  const [health, setHealth] = useState(initialHealth);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<'connect' | 'deploy' | 'join' | null>(null);
  const [contractInput, setContractInput] = useState(state.session.contractAddress ?? PREPROD.registry);
  const [message, setMessage] = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const runtimeSession = getMidnightContractSession();

  const refresh = async () => {
    setChecking(true);
    try {
      setHealth(await checkPreprodHealth());
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  const connect = async (): Promise<WalletConnection> => {
    const existing = getWalletConnection();
    if (existing) return existing;
    const wallet = await connectMidnightWallet();
    if (state.session.walletAddress && state.session.walletAddress !== wallet.walletAddress) {
      throw new Error('This local vault belongs to another wallet. Reconnect its original wallet or use a separate browser profile for the new account.');
    }
    return wallet;
  };

  const reconnect = async () => {
    setBusy('connect');
    setMessage('Connecting the wallet and opening your saved registry…');
    try {
      const result = await actions.openRegistry(state.session.contractAddress ?? contractInput);
      setContractInput(result.contractAddress);
      setMessage(`${result.walletName} is connected. The preprod registry is ready.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open the Midnight registry.');
    } finally {
      setBusy(null);
    }
  };

  const deploy = async () => {
    if (state.session.contractAddress) {
      setMessage('This encrypted vault already belongs to a registry. Join it, or use a separate browser profile for a new registry.');
      return;
    }
    setBusy('deploy');
    setMessage('Preparing the contract and requesting a zero-knowledge proof…');
    try {
      const wallet = await connect();
      const result = await deployVeilDriveContract(wallet);
      actions.connect({ mode: 'preprod', walletAddress: wallet.walletAddress, contractAddress: result.contractAddress, veilId: result.identityCommitment });
      setContractInput(result.contractAddress);
      setMessage(`Contract finalized on preprod. Your private Veil ID is ${shortHash(result.identityCommitment)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Contract deployment failed.');
    } finally {
      setBusy(null);
    }
  };

  const join = async () => {
    if (state.session.contractAddress && state.session.contractAddress !== contractInput.trim()) {
      setMessage('This encrypted vault is bound to another registry. Enter its saved address or use a separate browser profile.');
      return;
    }
    setBusy('join');
    setMessage('Locating the contract and validating its verifier keys…');
    try {
      const result = await actions.openRegistry(contractInput);
      setMessage(`Contract verified and joined. Your private Veil ID is ${shortHash(result.identityCommitment)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not join that contract.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="page settings-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Configuration</span>
          <h1>Settings</h1>
          <p>Network, encrypted storage, and wallet configuration.</p>
        </div>
      </header>

      <div className="settings-layout">
        <section>
          <header>
            <Network size={23} weight="thin" />
            <div>
              <h2>Midnight preprod</h2>
              <p>Network ID and endpoints are pinned together to prevent cross-network drift.</p>
            </div>
            <Button tone="secondary" onClick={refresh} disabled={checking}>
              {checking ? 'Checking…' : 'Run health check'}
            </Button>
          </header>
          <div className="endpoint-list">
            <div><span><i className={health.indexer ? 'is-online' : ''} />Indexer</span><code>{PREPROD.indexer}</code></div>
            <div><span><i className={health.proofServer ? 'is-online' : ''} />Local proof service</span><code>{PREPROD.proofServer}</code></div>
            <div><span><i className={health.node ? 'is-online' : ''} />Node RPC</span><code>{PREPROD.node}</code></div>
          </div>
          <div className="contract-config">
            <span>
              <ShieldCheck size={20} weight="light" />
              <span>
                <small>VeilDrive registry</small>
                <strong>{state.session.contractAddress ? shortHash(state.session.contractAddress) : 'No contract selected'}</strong>
              </span>
            </span>
            <Button tone="primary" onClick={reconnect} disabled={busy !== null}>
              <Wallet size={16} /> {busy === 'connect' ? 'Opening registry…' : runtimeSession ? 'Registry ready' : 'Connect & open registry'}
            </Button>
          </div>
          <div className="deployment-panel">
            <label className="field">
              <span>Existing contract address</span>
              <input
                className="input"
                value={contractInput}
                onChange={(event) => setContractInput(event.target.value)}
                placeholder="0200… Midnight contract address"
                spellCheck={false}
              />
            </label>
            <div>
              <Button tone="secondary" onClick={join} disabled={busy !== null || !contractInput.trim()} trailing={false}>
                {busy === 'join' ? 'Joining…' : 'Join registry'}
              </Button>
              <Button tone="primary" onClick={deploy} disabled={busy !== null || Boolean(state.session.contractAddress)}>
                {busy === 'deploy' ? 'Proving & deploying…' : 'Deploy new registry'}
              </Button>
            </div>
          </div>
          {runtimeSession && (
            <div className="veil-id-row">
              <span>Private Veil ID</span>
              <code>{runtimeSession.identityCommitment}</code>
              <button onClick={() => navigator.clipboard.writeText(runtimeSession.identityCommitment)}>Copy</button>
            </div>
          )}
          {state.session.contractAddress && (
            <a className="explorer-link" href={explorerContractUrl(state.session.contractAddress)} target="_blank" rel="noreferrer">
              View registry on the preprod explorer <ArrowSquareOut size={13} />
            </a>
          )}
          {message && <p className="settings-message" role="status">{message}</p>}
        </section>

        <section>
          <header>
            <Database size={23} weight="thin" />
            <div><h2>Encrypted storage provider</h2><p>Ciphertext uses the same interface across local and remote providers.</p></div>
          </header>
          <div className="provider-options">
            <button className="is-active" disabled><HardDrives size={22} weight="light" /><span><strong>Local encrypted vault</strong><small>IndexedDB on this device</small></span><Check size={16} weight="bold" /></button>
          </div>
          <p className="security-note"><LockKey size={14} /> Plaintext never leaves this browser.</p>
        </section>

        <section>
          <header>
            <ShieldCheck size={23} weight="thin" />
            <div><h2>Security boundaries</h2><p>Claims the product deliberately does and does not make.</p></div>
          </header>
          <ul className="boundary-list">
            <li><Check size={15} /> Files and metadata are encrypted before storage.</li>
            <li><Check size={15} /> On-chain proofs reject expired, consumed, or revoked grants.</li>
            <li><Check size={15} /> One-time access governs one VeilDrive retrieval session.</li>
            <li><span>×</span> Plaintext already seen by a recipient cannot be recalled or protected as DRM.</li>
            <li><span>×</span> Revocation cannot make a former recipient forget a key; robust offboarding rotates group keys.</li>
          </ul>
          <Button tone="danger" onClick={() => setClearOpen(true)}>Clear local encrypted vault</Button>
        </section>
      </div>
      <Modal open={clearOpen} onClose={() => setClearOpen(false)} title="Clear this encrypted vault?">
        <div className="confirm-delete"><LockKey size={30} weight="light" /><p>This permanently removes the local app state and all encrypted file blobs from this browser. On-chain commitments remain.</p><div className="modal-actions"><Button tone="quiet" trailing={false} onClick={() => setClearOpen(false)}>Cancel</Button><Button tone="danger" onClick={actions.resetVault}>Clear permanently</Button></div></div>
      </Modal>
    </section>
  );
};
