import { Check, Copy, EyeSlash, FileArrowUp, LockKey, Plus, ShieldCheck } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { shortHash } from '../lib/encoding';
import { hashBlob } from '../lib/crypto';
import { formatDate } from '../lib/format';
import { verifyFileOnMidnight } from '../lib/midnight-contract';
import { useAppStore } from '../store/AppStore';

interface Verification { fileName: string; commitment: string; match: boolean; version?: number; registered?: string; transactionId?: string; error?: string; }

export const ProofsPage = () => {
  const { state, actions } = useAppStore();
  const verifyInput = useRef<HTMLInputElement>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [checking, setChecking] = useState(false);
  const [title, setTitle] = useState('');
  const [condition, setCondition] = useState('');
  const [hiddenFields, setHiddenFields] = useState<string[]>([]);
  const [proofOpen, setProofOpen] = useState(false);
  const [proofCommitment, setProofCommitment] = useState('');
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState('');

  const verify = async (file: File) => {
    setChecking(true);
    try {
      const commitment = await hashBlob(file);
      const matchedVersion = state.versions.find((version) => version.commitment === commitment);
      if (!matchedVersion) {
        setVerification({ fileName: file.name, commitment, match: false });
        return;
      }
      const txn = await verifyFileOnMidnight(matchedVersion.fileId, commitment);
      setVerification({ fileName: file.name, commitment, match: true, version: matchedVersion.version, registered: matchedVersion.createdAt, transactionId: txn });
    } catch (reason) {
      setVerification({ fileName: file.name, commitment: '', match: false, error: reason instanceof Error ? reason.message : 'On-chain verification failed.' });
    } finally {
      setChecking(false);
    }
  };

  const generate = async () => {
    setProofBusy(true);
    setProofError('');
    try {
      const activeRequest = await actions.createProofRequest(title.trim(), condition.trim(), hiddenFields.filter(Boolean));
      const result = await actions.generateProof(activeRequest.id, activeRequest);
      setProofCommitment(result);
      setProofOpen(true);
    } catch (error) {
      setProofError(error instanceof Error ? error.message : 'Private proof generation failed.');
    } finally {
      setProofBusy(false);
    }
  };

  return (
    <section className="proofs-page page">
      <header className="proofs-heading"><span className="eyebrow">Document proof and verification center</span><h1>Prove more. Reveal less.</h1><p>Turn private files and credentials into verifiable facts. Share what is necessary. Keep the rest private.</p></header>
      <div className="proofs-split">
        <section className="verify-panel"><header><h2>Verify document</h2><p>Check integrity, version, and the registered commitment.</p></header><button className="verify-drop" onClick={() => verifyInput.current?.click()}><FileArrowUp size={34} weight="light" /><strong>{verification?.fileName ?? 'Drop or choose a document'}</strong><span>{checking ? 'Calculating SHA‑256 commitment…' : 'The file is hashed locally and never uploaded.'}</span></button><input ref={verifyInput} className="sr-only" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) verify(file); }} />
          {verification ? <div className={`verification-result ${verification.match ? 'is-valid' : 'is-invalid'}`}><div className="proof-orbit"><span>{verification.match ? <Check size={38} weight="bold" /> : '×'}</span></div><div><h3>{verification.match ? 'Verified on preprod' : 'Verification failed'}</h3><p>{verification.error ?? (verification.match ? 'The local hash matches the latest contract commitment.' : 'No registered version matches this file.')}</p>{verification.commitment && <dl><div><dt>File commitment</dt><dd>{shortHash(verification.commitment)}</dd></div><div><dt>Version</dt><dd>{verification.version ? `v${verification.version}` : 'Unknown'}</dd></div><div><dt>Registered</dt><dd>{verification.registered ? formatDate(verification.registered) : 'Not registered'}</dd></div></dl>}</div></div> : <div className="verification-placeholder"><ShieldCheck size={30} weight="thin" /><p>Select a file to compare its local hash with the Midnight commitment.</p></div>}
        </section>
        <section className="proof-request-panel"><header><h2>Create a proof request</h2><p>Define the fact to prove and everything that must stay hidden.</p></header><label className="field"><span>Request title</span><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field"><span>Condition to prove</span><input className="input" value={condition} onChange={(event) => setCondition(event.target.value)} /></label><div className="hidden-fields"><header><EyeSlash size={21} weight="light" /><span><strong>Hidden fields</strong><small>Never disclosed to the verifier</small></span></header>{hiddenFields.map((field, index) => <label key={`${field}-${index}`}><EyeSlash size={17} weight="light" /><input value={field} onChange={(event) => setHiddenFields((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><button onClick={() => setHiddenFields((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button></label>)}<button className="add-hidden" onClick={() => setHiddenFields((items) => [...items, ''])}><Plus size={15} /> Add hidden field</button></div>{proofError && <p className="form-error" role="alert">{proofError}</p>}<Button tone="primary" onClick={generate} disabled={proofBusy || !title.trim() || !condition.trim()}>{proofBusy ? 'Generating proof…' : 'Generate private proof'}</Button><p className="proof-safety"><LockKey size={14} weight="light" /> Only the proof commitment is shared. Source documents and claim values stay private.</p></section>
      </div>
      <footer className="ledger-receipt"><span><ShieldCheck size={22} weight="thin" /><strong>On-chain receipt</strong><small>Midnight preprod</small></span><span><small>Contract address</small><code>{state.session.contractAddress ? shortHash(state.session.contractAddress) : 'Deploy from Settings'}</code></span><span><small>Latest transaction</small><code>{shortHash(verification?.transactionId ?? proofCommitment)}</code></span><span><i className="status-dot" /> Commitment ready</span></footer>
      <Modal open={proofOpen} onClose={() => setProofOpen(false)} title="Private proof generated"><div className="proof-complete"><span><Check size={30} weight="bold" /></span><h3>Requirement satisfied</h3><p>The condition was proven. Exact values and hidden fields were not disclosed.</p><code>{proofCommitment}</code><Button tone="secondary" onClick={() => navigator.clipboard.writeText(proofCommitment)}><Copy size={15} /> Copy commitment</Button></div></Modal>
    </section>
  );
};
