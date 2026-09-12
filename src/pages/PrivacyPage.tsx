import { Check, EyeSlash, Fingerprint, LockKey, Plus, UsersThree } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { shortHash } from '../lib/encoding';
import { useAppStore } from '../store/AppStore';
import type { Guardian } from '../types';

export const PrivacyPage = () => {
  const { state, actions } = useAppStore();
  const [guardianOpen, setGuardianOpen] = useState(false);
  const [name, setName] = useState('');
  const [wallet, setWallet] = useState('');
  const [type, setType] = useState<Guardian['type']>('wallet');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const protectedFiles = state.items.filter((item) => item.kind === 'file' && !item.trashed);
  const visibleItems = state.items.filter((item) => !item.trashed).slice(0, 3);
  const activeGrants = state.grants.filter((grant) => !grant.revokedAt).length;

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try { await task(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The preprod commitment failed.'); }
    finally { setBusy(false); }
  };

  return (
    <section className="page privacy-page">
      <header className="page-heading"><div><span className="eyebrow">Privacy</span><h1>Private by default.</h1></div></header>
      <div className="privacy-score">
        <div className="privacy-score__ring"><strong>ON</strong><small>local-first</small></div>
        <div><span className="overline">Protection</span><h2>Encryption and commitments are active.</h2></div>
        <div className="privacy-score__facts">
          <span><Check size={14} /> {protectedFiles.length} encrypted files</span>
          <span><Check size={14} /> {state.items.filter((item) => !item.trashed).length} protected metadata records</span>
          <span><Check size={14} /> {activeGrants} active grants</span>
        </div>
      </div>
      <div className="privacy-bento">
        <article className="privacy-bento__large">
          <span className="overline">Metadata</span><h2 className="serif">Readable here. Opaque in storage.</h2>
          {visibleItems.length ? <div className="metadata-compare">
            <div><small>On this device</small>{visibleItems.map((item) => <strong key={item.id}>{item.name}</strong>)}</div>
            <div><small>In encrypted storage</small>{visibleItems.map((item) => <code key={item.id}>{item.encryptedName}</code>)}</div>
          </div> : <div className="empty-state"><EyeSlash size={32} weight="thin" /><p>Upload a file to inspect its protected metadata.</p></div>}
        </article>
        <article><EyeSlash size={28} weight="thin" /><h3>Public ledger</h3><strong>Pseudonymous commitments</strong></article>
        <article><Fingerprint size={28} weight="thin" /><h3>Private state</h3><strong>Held on this device</strong></article>
        <article className="guardian-card">
          <header><UsersThree size={28} weight="thin" /><Button tone="secondary" onClick={() => setGuardianOpen(true)}><Plus size={14} /> Guardian</Button></header>
          <h3>Recovery contacts</h3><p>{state.guardians.length ? `${state.guardians.length} encrypted contact record(s). These do not recover wallet keys.` : 'No recovery contacts configured.'}</p>
          {state.guardians.map((guardian) => <div className="guardian-contact" key={guardian.id}><i /><span><strong>{guardian.name}</strong><small>{shortHash(guardian.wallet, 8, 5)}</small></span></div>)}
          {error && <p className="form-error" role="alert">{error}</p>}
        </article>
      </div>
      <Modal open={guardianOpen} onClose={() => !busy && setGuardianOpen(false)} title="Add recovery guardian">
        <form className="simple-form" onSubmit={async (event) => { event.preventDefault(); await run(async () => { await actions.addGuardian({ name: name.trim(), wallet: wallet.trim(), type }); setName(''); setWallet(''); setGuardianOpen(false); }); }}>
          <label className="field"><span>Label</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field"><span>Veil ID</span><input className="input" value={wallet} onChange={(event) => setWallet(event.target.value)} /></label>
          <label className="field"><span>Type</span><select className="select" value={type} onChange={(event) => setType(event.target.value as Guardian['type'])}><option value="wallet">Backup wallet</option><option value="admin">Organization admin</option><option value="service">Recovery service</option></select></label>
          <p><LockKey size={14} /> This saves a private contact commitment. It cannot reconstruct a lost wallet or vault key.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <footer className="modal-actions"><Button tone="primary" disabled={busy || !name.trim() || !wallet.trim()}>{busy ? 'Committing…' : 'Add guardian'}</Button></footer>
        </form>
      </Modal>
    </section>
  );
};
