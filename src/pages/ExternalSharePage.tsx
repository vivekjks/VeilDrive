import { Check, Clock, DownloadSimple, EyeSlash, LockKey, ShieldCheck, Warning } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { FileIcon } from '../components/FileIcon';
import { Logo } from '../components/Logo';
import { Modal } from '../components/Modal';
import { shortHash } from '../lib/encoding';
import { formatBytes, formatDate } from '../lib/format';
import { useAppStore } from '../store/AppStore';

export const ExternalSharePage = () => {
  const { token: capabilityId } = useParams();
  const { state, actions } = useAppStore();
  const [proofStatus, setProofStatus] = useState<'idle' | 'generating' | 'valid'>('idle');
  const [opening, setOpening] = useState(false);
  const [proofCommitment, setProofCommitment] = useState('');
  const [preview, setPreview] = useState<{ url?: string; text?: string } | null>(null);
  const [error, setError] = useState('');
  const tokenSecret = window.location.hash.slice(1);
  const grant = state.grants.find((candidate) => candidate.id === capabilityId && candidate.token === tokenSecret);
  const file = state.items.find((candidate) => candidate.id === grant?.fileId);
  const invalidReason = useMemo(() => {
    if (!grant || !file) return 'This private link does not exist in this vault.';
    if (grant.revokedAt) return 'The owner revoked this access grant.';
    if (grant.expiresAt && new Date(grant.expiresAt) <= new Date()) return 'This private link has expired.';
    if (grant.oneTime && grant.consumedAt) return 'This one-time access grant has already been consumed.';
    return '';
  }, [file, grant]);

  const prove = async () => {
    if (!grant || !file) return;
    setProofStatus('generating');
    setError('');
    try {
      setProofCommitment(await actions.proveGrant(grant.id));
      setProofStatus('valid');
    } catch (reason) {
      setProofStatus('idle');
      setError(reason instanceof Error ? reason.message : 'The private access proof could not be generated.');
    }
  };
  const open = async (asDownload: boolean) => {
    if (!grant || !file) return;
    const previewable = file.mimeType.startsWith('text/') || file.mimeType.includes('markdown') || file.mimeType.startsWith('image/') || file.mimeType.includes('pdf');
    if (!asDownload && !previewable) {
      setError('This format cannot be previewed in the browser. Ask the owner to grant download permission.');
      return;
    }
    setOpening(true);
    setError('');
    try {
      const blob = await actions.download(file.id);
      if (grant.oneTime) await actions.consumeGrant(grant.id);
      if (asDownload) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.name; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1_000);
      } else if (file.mimeType.startsWith('text/') || file.mimeType.includes('markdown')) {
        setPreview({ text: await blob.text() });
      } else if (file.mimeType.startsWith('image/') || file.mimeType.includes('pdf')) {
        setPreview({ url: URL.createObjectURL(blob) });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The encrypted file could not be opened.');
    } finally {
      setOpening(false);
    }
  };

  return <div className="external-page"><header><Logo /><span><i className="status-dot" /> Midnight preprod</span></header><main>{invalidReason ? <section className="external-invalid"><Warning size={46} weight="thin" /><span className="eyebrow">Access unavailable</span><h1>{invalidReason}</h1><p>Ask the owner for a new encrypted grant. VeilDrive does not expose file metadata for invalid links.</p></section> : file && grant ? <><section className="external-access"><div className="external-file"><span className="file-glyph"><FileIcon item={file} size={26} /></span><span className="eyebrow">Private file invitation</span><h1>{file.name}</h1><p>{formatBytes(file.size)} · encrypted · owner identity hidden</p><div className="external-controls"><span><Clock size={18} weight="light" /><span><small>Access expires</small><strong>{grant.expiresAt ? formatDate(grant.expiresAt, true) : 'Never'}</strong></span></span><span><LockKey size={18} weight="light" /><span><small>Permission</small><strong>{grant.permissions.join(' · ')}</strong></span></span></div>{proofStatus === 'valid' ? <div className="external-approved"><span><Check size={28} weight="bold" /></span><div><strong>Access verified</strong><p>Capability verified. Private data disclosed: none.</p><code>{shortHash(proofCommitment)}</code></div></div> : <Button tone="primary" onClick={prove} disabled={proofStatus === 'generating'}>{proofStatus === 'generating' ? 'Generating private proof…' : 'Prove access privately'}</Button>}{proofStatus === 'valid' && grant.permissions.includes('view') && <Button tone="primary" onClick={() => open(false)} disabled={opening}><EyeSlash size={17} /> {opening ? 'Decrypting locally…' : 'Open privately'}</Button>}{proofStatus === 'valid' && grant.permissions.includes('download') && <Button tone="secondary" onClick={() => open(true)} disabled={opening}><DownloadSimple size={17} /> Download</Button>}{error && <p className="form-error" role="alert">{error}</p>}</div><aside className="external-inspector"><ShieldCheck size={32} weight="thin" /><h2 className="serif">Share the proof.<br />Keep the person private.</h2><div><h3>Required</h3>{grant.conditions.length ? grant.conditions.map((condition) => <p key={condition.id}><Check size={14} />{condition.field} {condition.operator} {condition.value}</p>) : <p><Check size={14} />Valid secure invitation</p>}</div><div><h3>Not disclosed</h3>{['Other files', 'Other recipients', 'Full credential', 'Wallet activity'].map((item) => <p key={item}><EyeSlash size={14} />{item}</p>)}</div></aside></section></> : null}</main><footer><span>VeilDrive</span><p>Your files. Your keys. Your privacy.</p><span>Prove, don’t reveal.</span></footer><Modal open={Boolean(preview)} onClose={() => { if (preview?.url) URL.revokeObjectURL(preview.url); setPreview(null); }} title={`Private preview · ${file?.name ?? ''}`} wide><div className="decrypted-preview">{preview?.text ? <pre>{preview.text}</pre> : file?.mimeType.startsWith('image/') ? <img src={preview?.url} alt={file.name} /> : <iframe src={preview?.url} title={file?.name} />}</div></Modal></div>;
};
