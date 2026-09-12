import { ChatCircle, ClockCounterClockwise, DownloadSimple, Eye, LockKey, ShareNetwork, UploadSimple, UsersThree, X } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { Button } from '../components/Button';
import { FileIcon } from '../components/FileIcon';
import { Modal } from '../components/Modal';
import { PrivacyBadge } from '../components/PrivacyBadge';
import { shortHash } from '../lib/encoding';
import { formatBytes, formatDate, relativeTime } from '../lib/format';
import { useAppStore } from '../store/AppStore';
import type { DriveItem } from '../types';

interface FileInspectorProps { file: DriveItem; onClose: () => void; onShare: () => void; }

export const FileInspector = ({ file, onClose, onShare }: FileInspectorProps) => {
  const { state, actions } = useAppStore();
  const [comment, setComment] = useState('');
  const [preview, setPreview] = useState<{ url?: string; text?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const versionInput = useRef<HTMLInputElement>(null);
  const versions = state.versions.filter((version) => version.fileId === file.id).sort((a, b) => b.version - a.version);
  const current = versions.find((version) => version.id === file.currentVersionId) ?? versions[0];
  const grants = state.grants.filter((grant) => grant.fileId === file.id);
  const comments = state.comments.filter((item) => item.fileId === file.id);

  const read = async () => {
    setBusy(true);
    setError('');
    try {
      const blob = await actions.download(file.id);
      if (file.mimeType.startsWith('text/') || file.mimeType.includes('markdown')) setPreview({ text: await blob.text() });
      else setPreview({ url: URL.createObjectURL(blob) });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The encrypted file could not be opened.');
    } finally { setBusy(false); }
  };

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const blob = await actions.download(file.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = file.name; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The encrypted file could not be downloaded.');
    } finally { setBusy(false); }
  };

  const revoke = async (grantId: string) => {
    setBusy(true);
    setError('');
    try { await actions.revokeGrant(grantId); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The access grant could not be revoked.'); }
    finally { setBusy(false); }
  };

  const addVersion = async (selected: File) => {
    setBusy(true);
    setError('');
    try { await actions.addVersion(file.id, selected); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The encrypted version could not be added.'); }
    finally { setBusy(false); if (versionInput.current) versionInput.current.value = ''; }
  };

  return (
    <>
      <aside className="file-inspector">
        <header className="file-inspector__head"><span className="file-glyph"><FileIcon item={file} size={23} /></span><div><h2>{file.name}</h2><p>{formatBytes(file.size)} · {formatDate(file.modifiedAt, true)}</p></div><button className="icon-button" onClick={onClose} aria-label="Close inspector"><X size={19} weight="light" /></button></header>
        <div className="file-preview-card"><FileIcon item={file} size={42} /><strong>{file.name.split('.')[0]}</strong><span>Confidential · Encrypted · In motion.</span></div>
        <div className="inspector-actions"><Button tone="primary" onClick={read} disabled={busy} trailing={<Eye size={15} weight="light" />}>{busy ? 'Working…' : 'Preview'}</Button><button className="icon-button" onClick={download} disabled={busy} aria-label="Download"><DownloadSimple size={20} weight="light" /></button><button className="icon-button" onClick={onShare} disabled={busy} aria-label="Share"><ShareNetwork size={20} weight="light" /></button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <section className="inspector-section"><header><h3><LockKey size={18} weight="light" /> Encryption</h3><PrivacyBadge level={file.privacy} /></header><dl><div><dt>Status</dt><dd>End-to-end encrypted</dd></div><div><dt>Commitment</dt><dd>{shortHash(current?.commitment)}</dd></div><div><dt>Stored on</dt><dd><i className="status-dot" /> {state.storageProvider === 'indexeddb' ? 'This device' : state.storageProvider.toUpperCase()}</dd></div></dl></section>
        <section className="inspector-section"><header><h3><UsersThree size={18} weight="light" /> Access ({grants.filter((grant) => !grant.revokedAt).length})</h3><button onClick={onShare}>Manage</button></header>{grants.length === 0 ? <p className="empty-copy">Only you can access this file.</p> : grants.slice(0,3).map((grant) => <div className="grant-row" key={grant.id}><span>{grant.recipientLabel.slice(0, 1).toUpperCase()}</span><div><strong>{grant.recipientLabel}</strong><small>{grant.revokedAt ? 'Revoked' : grant.permissions.join(' · ')}</small></div>{!grant.revokedAt && <button disabled={busy} onClick={() => revoke(grant.id)}>Revoke</button>}</div>)}</section>
        <section className="inspector-section"><header><h3><ClockCounterClockwise size={18} weight="light" /> Versions ({versions.length})</h3><button disabled={busy} onClick={() => versionInput.current?.click()}>Add</button></header><input className="sr-only" type="file" ref={versionInput} onChange={(event) => { const selected = event.target.files?.[0]; if (selected) addVersion(selected); }} />{versions.slice(0,4).map((version) => <div className="version-row" key={version.id}><strong>v{version.version}</strong><span>{formatDate(version.createdAt, true)}</span>{version.id === file.currentVersionId && <em>Current</em>}</div>)}</section>
        <section className="inspector-section inspector-comments"><header><h3><ChatCircle size={18} weight="light" /> Encrypted comments ({comments.length})</h3></header>{comments.map((item) => <article key={item.id}><span>{item.author.slice(0, 1)}</span><div><strong>{item.author}<small>{relativeTime(item.createdAt)}</small></strong><p>{item.body}</p></div></article>)}<form onSubmit={(event) => { event.preventDefault(); if (!comment.trim()) return; actions.addComment(file.id, comment.trim()); setComment(''); }}><input className="input" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add encrypted comment…" /><button className="icon-button" aria-label="Send comment"><UploadSimple size={18} weight="light" /></button></form></section>
      </aside>
      <Modal open={Boolean(preview)} onClose={() => { if (preview?.url) URL.revokeObjectURL(preview.url); setPreview(null); }} title={`Private preview · ${file.name}`} wide>
        <div className="decrypted-preview">
          {preview?.text ? <pre>{preview.text}</pre> : file.mimeType.startsWith('image/') ? <img src={preview?.url} alt={file.name} /> : file.mimeType.includes('pdf') ? <iframe src={preview?.url} title={file.name} /> : <div><FileIcon item={file} size={56} /><h3>Preview is not available for this format.</h3><p>The file decrypted successfully. Download it to open it in a compatible application.</p><Button tone="primary" onClick={download}>Download decrypted file</Button></div>}
        </div>
      </Modal>
    </>
  );
};
