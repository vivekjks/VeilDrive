import {
  ArrowDown,
  ArrowRight,
  Fingerprint,
  Key,
  LockKey,
  ShieldCheck,
  Wallet,
} from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { Modal } from '../components/Modal';
import { Reveal } from '../components/Reveal';
import { checkPreprodHealth, connectMidnightWallet, PREPROD } from '../lib/midnight';
import { useAppStore } from '../store/AppStore';
import './LandingPage.css';

export const LandingPage = () => {
  const { state, actions } = useAppStore();
  const [connectOpen, setConnectOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState({ indexer: false, proofServer: false, network: false });
  const navigate = useNavigate();

  useEffect(() => { checkPreprodHealth().then(setHealth).catch(() => undefined); }, []);

  const connectWallet = async () => {
    setConnecting(true);
    setError('');
    try {
      const connection = await connectMidnightWallet();
      actions.connect({
        mode: 'preprod',
        walletAddress: connection.walletAddress,
        displayName: 'Private member',
        avatarInitials: 'PM',
      });
      navigate('/settings');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not connect to the Midnight wallet.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="landing">
      <nav className="landing-nav">
        <Logo />
        <div className="landing-nav__links">
          <a href="#privacy">Privacy</a><a href="#product">Product</a><a href="#architecture">Architecture</a>
        </div>
        <div className="landing-nav__end">
          <span className="landing-network"><span className="status-dot" /> Preprod</span>
          {state.session.connected ? <Link className="nav-enter" to="/drive">Open drive <ArrowRight size={15} weight="light" /></Link> : <button className="nav-enter" onClick={() => setConnectOpen(true)}>Connect <ArrowRight size={15} weight="light" /></button>}
          <button className={`menu-toggle ${menuOpen ? 'is-open' : ''}`} onClick={() => setMenuOpen((open) => !open)} aria-label="Open navigation"><i /><i /></button>
        </div>
      </nav>

      <div className={`mobile-menu ${menuOpen ? 'is-open' : ''}`}>
        {['Privacy', 'Product', 'Architecture'].map((item, index) => <a key={item} style={{ transitionDelay: `${100 + index * 70}ms` }} href={`#${item.toLowerCase()}`} onClick={() => setMenuOpen(false)}>{item}</a>)}
      </div>

      <main>
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <Reveal><span className="eyebrow">Private cloud, proven on Midnight</span></Reveal>
            <Reveal delay={100}><h1>Keep the file.<br />Reveal the proof.</h1></Reveal>
            <Reveal delay={180}><p>Your files are encrypted on your device. Private authorization decides access—without collecting the identity data behind the proof.</p></Reveal>
            <Reveal delay={250} className="landing-hero__actions">
              <Button tone="primary" onClick={() => setConnectOpen(true)}>Enter your drive</Button>
              <a href="#privacy" className="quiet-link">See how privacy works <ArrowDown size={14} weight="light" /></a>
            </Reveal>
          </div>
          <Reveal delay={160} className="landing-hero__visual">
            <div className="hero-image-frame"><img src="/assets/veil-core.png" alt="A translucent obsidian veil protecting a luminous encrypted core" /></div>
          </Reveal>
          <div className="hero-footnote"><span>Privacy owns a brighter tomorrow.</span><span>Encrypt — control — share with confidence</span></div>
        </section>

        <section className="privacy-section" id="privacy">
          <Reveal className="privacy-section__headline"><span className="eyebrow">Prove, don’t reveal</span><h2>The authorization layer was the privacy leak.</h2></Reveal>
          <div className="privacy-principles">
            <Reveal delay={70}><article><Fingerprint size={30} weight="thin" /><span>01</span><h3>Selective disclosure</h3><p>Prove the role, credential, or threshold required for access. Keep the source facts private.</p></article></Reveal>
            <Reveal delay={140}><article><Key size={30} weight="thin" /><span>02</span><h3>Keys stay yours</h3><p>AES-GCM encryption happens before upload. Storage receives ciphertext, never the readable file.</p></article></Reveal>
            <Reveal delay={210}><article><LockKey size={30} weight="thin" /><span>03</span><h3>Verifiable control</h3><p>Commitments, grants, revocations, and proof receipts are anchored to Midnight preprod.</p></article></Reveal>
          </div>
        </section>

        <section className="product-section" id="product">
          <Reveal className="product-section__media"><img src="/assets/veil-core.png" alt="Encrypted VeilDrive data core" /></Reveal>
          <Reveal delay={120} className="product-section__copy"><span className="eyebrow">Familiar by design</span><h2 className="serif">A serious drive for sensitive work.</h2><p>Folders, versions, comments, credentials, integrity proofs, and revocable grants—built around encrypted content and private policy.</p><Button tone="primary" onClick={() => setConnectOpen(true)}>Explore the product</Button></Reveal>
        </section>

        <section className="architecture-section" id="architecture">
          <Reveal><span className="eyebrow">A deliberate split</span><h2>Storage holds ciphertext.<br />Midnight holds the rules.</h2></Reveal>
          <Reveal delay={120} className="architecture-flow">
            <div><span>01</span><strong>Your device</strong><p>Generate a key, encrypt the file and its metadata, calculate the commitment.</p></div>
            <ArrowRight size={30} weight="thin" />
            <div><span>02</span><strong>Encrypted storage</strong><p>Persist opaque blobs in the browser’s encrypted local vault.</p></div>
            <ArrowRight size={30} weight="thin" />
            <div><span>03</span><strong>Midnight preprod</strong><p>Register proofs, private ownership, policies, grants, use, and revocation.</p></div>
          </Reveal>
        </section>

        <section className="landing-cta">
          <Reveal><ShieldCheck size={42} weight="thin" /><h2>Private by default.<br />Useful by design.</h2><p>Connect a funded Midnight wallet to create your private on-chain vault.</p><Button tone="primary" onClick={() => setConnectOpen(true)}>Open VeilDrive</Button></Reveal>
        </section>
      </main>

      <footer className="landing-footer"><Logo /><p>Your files. Your keys. Your privacy.</p><span>Built for Midnight preprod · 2026</span></footer>

      <Modal open={connectOpen} onClose={() => setConnectOpen(false)} title="Enter your private drive">
        <div className="connect-panel">
          <p className="connect-intro">Connect a DApp Connector v4 wallet on Midnight preprod.</p>
          <button className="connect-option" onClick={connectWallet} disabled={connecting}>
            <span className="connect-option__icon"><Wallet size={26} weight="light" /></span>
            <span><strong>{connecting ? 'Waiting for wallet…' : 'Connect Lace or 1AM'}</strong><small>Authorize private state and preprod transactions.</small></span>
            <ArrowRight size={18} weight="light" />
          </button>
          {error && <div className="connect-error"><strong>Wallet connection needs attention</strong><p>{error}</p><div><a href="https://www.lace.io/" target="_blank" rel="noreferrer">Lace</a><a href="https://1am.xyz/" target="_blank" rel="noreferrer">1AM</a><a href={PREPROD.faucet} target="_blank" rel="noreferrer">Preprod faucet</a></div></div>}
          <div className="health-row">
            <span className={health.indexer ? 'is-online' : ''}><i /> Preprod indexer</span>
            <span className={health.proofServer ? 'is-online' : ''}><i /> Local proof server</span>
          </div>
          <p className="connect-note">Files stay encrypted on this device. Private witness data is used only for proof generation.</p>
        </div>
      </Modal>
    </div>
  );
};
