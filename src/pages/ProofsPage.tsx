import { Check, FileArrowUp, LockKey, ShieldCheck } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { Button } from '../components/Button';
import { commitmentForBlob, hashBlob } from '../lib/crypto';
import { shortHash } from '../lib/encoding';
import { formatDate } from '../lib/format';
import { verifyFileOnMidnight } from '../lib/midnight-contract';
import { useAppStore } from '../store/AppStore';

interface Verification { fileName: string; commitment: string; match: boolean; version?: number; registered?: string; transactionId?: string; error?: string; }

export const ProofsPage = () => {
  const { state, actions } = useAppStore();
  const verifyInput = useRef<HTMLInputElement>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [checking, setChecking] = useState(false);
  const [grantBusy, setGrantBusy] = useState('');
  const [grantReceipt, setGrantReceipt] = useState('');
  const [grantError, setGrantError] = useState('');
  const provableGrants = state.grants.filter((grant) => !grant.revokedAt && grant.method !== 'external');

  const verify = async (file: File) => {
    setChecking(true);
    try {
      let commitment = '';
      let matched: (typeof state.versions)[number] | undefined;
      for (const version of state.versions) {
        const candidate = version.commitmentSalt ? await commitmentForBlob(file, version.commitmentSalt) : await hashBlob(file);
        if (candidate === version.commitment) { commitment = candidate; matched = version; break; }
      }
      if (!matched) {
        setVerification({ fileName: file.name, commitment: await hashBlob(file), match: false });
        return;
      }
      const transactionId = await verifyFileOnMidnight(matched.fileId, commitment);
      setVerification({ fileName: file.name, commitment, match: true, version: matched.version, registered: matched.createdAt, transactionId });
    } catch (reason) {
      setVerification({ fileName: file.name, commitment: '', match: false, error: reason instanceof Error ? reason.message : 'On-chain verification failed.' });
    } finally { setChecking(false); }
  };

  const proveGrant = async (grantId: string) => {
    setGrantBusy(grantId); setGrantReceipt(''); setGrantError('');
    try { setGrantReceipt(await actions.proveGrant(grantId)); }
    catch (reason) { setGrantError(reason instanceof Error ? reason.message : 'Access proof failed.'); }
    finally { setGrantBusy(''); }
  };

  return (
    <section className="proofs-page page">
      <header className="proofs-heading"><span className="eyebrow">Verification</span><h1>Prove. Don’t reveal.</h1></header>
      <div className="proofs-split">
        <section className="verify-panel">
          <header><h2>Verify a file</h2></header>
          <button className="verify-drop" onClick={() => verifyInput.current?.click()}><FileArrowUp size={34} weight="light" /><strong>{verification?.fileName ?? 'Choose a document'}</strong><span>{checking ? 'Verifying on preprod…' : 'Hashed locally. Bytes never leave this device.'}</span></button>
          <input ref={verifyInput} className="sr-only" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) verify(file); }} />
          {verification ? <div className={`verification-result ${verification.match ? 'is-valid' : 'is-invalid'}`}><div className="proof-orbit"><span>{verification.match ? <Check size={38} weight="bold" /> : '×'}</span></div><div><h3>{verification.match ? 'Verified on preprod' : 'Verification failed'}</h3><p>{verification.error ?? (verification.match ? 'The local hash matches the latest contract commitment.' : 'No registered version matches this file.')}</p>{verification.commitment && <dl><div><dt>Commitment</dt><dd>{shortHash(verification.commitment)}</dd></div><div><dt>Version</dt><dd>{verification.version ? `v${verification.version}` : '—'}</dd></div><div><dt>Registered</dt><dd>{verification.registered ? formatDate(verification.registered) : '—'}</dd></div></dl>}</div></div> : <div className="verification-placeholder"><ShieldCheck size={30} weight="thin" /><p>No file selected.</p></div>}
        </section>

        <section className="proof-request-panel">
          <header><h2>Prove private access</h2></header>
          <div className="api-key-list">
            {provableGrants.map((grant) => <article key={grant.id}><span><LockKey size={20} weight="light" /></span><div><strong>{grant.recipientLabel}</strong><code>{grant.permissions.join(' · ')}</code></div><span>{grant.expiresAt ? formatDate(grant.expiresAt, true) : 'No expiry'}</span><Button tone="secondary" trailing={false} onClick={() => proveGrant(grant.id)} disabled={Boolean(grantBusy)}>{grantBusy === grant.id ? 'Proving…' : 'Prove'}</Button></article>)}
            {!provableGrants.length && <div className="empty-state"><LockKey size={36} weight="thin" /><h3>No access grants</h3><p>Create a Veil ID or credential grant from a file.</p></div>}
          </div>
          {grantReceipt && <p className="settings-message">Verified · {shortHash(grantReceipt)}</p>}
          {grantError && <p className="form-error" role="alert">{grantError}</p>}
        </section>
      </div>
      <footer className="ledger-receipt"><span><ShieldCheck size={22} weight="thin" /><strong>Midnight preprod</strong></span><span><small>Contract</small><code>{state.session.contractAddress ? shortHash(state.session.contractAddress) : 'Not deployed'}</code></span><span><small>Latest receipt</small><code>{shortHash(verification?.transactionId ?? grantReceipt)}</code></span></footer>
    </section>
  );
};
