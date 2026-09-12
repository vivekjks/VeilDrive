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
import { Button } from '../components/Button';
import { shortHash } from '../lib/encoding';
import {
  deployVeilDriveContract,
  getMidnightContractSession,
  joinVeilDriveContract,
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
  const [contractInput, setContractInput] = useState(state.session.contractAddress ?? '');
  const [message, setMessage] = useState('');
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
    actions.connect({ mode: 'preprod', walletAddress: wallet.walletAddress });
    return wallet;
  };

  const reconnect = async () => {
    setBusy('connect');
    setMessage('');
    try {
      const wallet = await connectMidnightWallet();
      actions.connect({ mode: 'preprod', walletAddress: wallet.walletAddress });
      setMessage(`${wallet.walletName} is connected to Midnight preprod.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not connect to a Midnight wallet.');
    } finally {
      setBusy(null);
    }
  };

  const deploy = async () => {
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
    setBusy('join');
    setMessage('Locating the contract and validating its verifier keys…');
    try {
      const wallet = await connect();
      const result = await joinVeilDriveContract(wallet, contractInput);
      actions.connect({ mode: 'preprod', walletAddress: wallet.walletAddress, contractAddress: result.contractAddress, veilId: result.identityCommitment });
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
          <p>Network, storage, wallet, and recovery configuration in one place.</p>
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
            <div><span><i className={health.proofServer ? 'is-online' : ''} />Local proof fallback</span><code>{PREPROD.proofServer}</code></div>
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
              <Wallet size={16} /> {busy === 'connect' ? 'Waiting for wallet…' : state.session.connected ? 'Reconnect wallet' : 'Connect wallet'}
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
              <Button tone="primary" onClick={deploy} disabled={busy !== null}>
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
          <Button tone="danger" onClick={actions.resetVault}>Clear local encrypted vault</Button>
        </section>
      </div>
    </section>
  );
};
