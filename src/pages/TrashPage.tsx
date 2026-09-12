import { ArrowCounterClockwise, Trash, Warning } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '../components/Button';
import { FileIcon } from '../components/FileIcon';
import { Modal } from '../components/Modal';
import { formatBytes, formatDate } from '../lib/format';
import { useAppStore } from '../store/AppStore';
import type { DriveItem } from '../types';

export const TrashPage = () => {
  const { state, actions } = useAppStore();
  const [pendingDelete, setPendingDelete] = useState<DriveItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const trashed = state.items.filter((item) => item.trashed);
  const run = async (task: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await task(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The operation failed.'); }
    finally { setBusy(false); }
  };
  return <section className="page">
    <header className="page-heading"><div><h1>Trash</h1></div></header>
    {error && !pendingDelete && <p role="alert" className="form-error">{error}</p>}
    <div className="trash-list">{trashed.map((item) => <article key={item.id}>
      <span className="file-glyph"><FileIcon item={item} size={20} /></span>
      <div><strong>{item.name}</strong><small>{formatBytes(item.size)} · {formatDate(item.modifiedAt)}</small></div>
      <Button tone="secondary" trailing={false} disabled={busy} onClick={() => run(() => actions.restore(item.id))}><ArrowCounterClockwise size={15} /> Restore</Button>
      <Button tone="danger" trailing={false} disabled={busy} onClick={() => { setError(''); setPendingDelete(item); }}><Trash size={15} /> Delete forever</Button>
    </article>)}
    {!trashed.length && <div className="empty-state"><Trash size={42} weight="thin" /><h3>Trash is empty</h3></div>}</div>
    <Modal open={Boolean(pendingDelete)} onClose={() => !busy && setPendingDelete(null)} title="Delete permanently?">
      <div className="confirm-delete"><Warning size={30} weight="light" />
        <p>This revokes <strong>{pendingDelete?.name}</strong> on Midnight and removes its local encrypted versions. This cannot be undone.</p>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="modal-actions">
          <Button tone="quiet" trailing={false} disabled={busy} onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button tone="danger" disabled={busy} onClick={() => run(async () => { if (pendingDelete) await actions.deleteForever(pendingDelete.id); setPendingDelete(null); })}>{busy ? 'Deleting…' : 'Delete forever'}</Button>
        </div>
      </div>
    </Modal>
  </section>;
};
