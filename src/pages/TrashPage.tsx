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
  const trashed = state.items.filter((item) => item.trashed);
  return <section className="page"><header className="page-heading"><div><span className="eyebrow">Recoverable deletion</span><h1>Trash</h1><p>Deleted items stay encrypted until you remove their ciphertext permanently.</p></div></header><div className="trash-notice"><Warning size={20} weight="light" /><span><strong>Cryptographic deletion is permanent.</strong><small>Removing the encrypted blob and its wrapped key cannot be undone.</small></span></div><div className="trash-list">{trashed.map((item) => <article key={item.id}><span className="file-glyph"><FileIcon item={item} size={20} /></span><div><strong>{item.name}</strong><small>{formatBytes(item.size)} · modified {formatDate(item.modifiedAt)}</small></div><Button tone="secondary" trailing={false} onClick={() => actions.restore(item.id)}><ArrowCounterClockwise size={15} /> Restore</Button><Button tone="danger" trailing={false} onClick={() => setPendingDelete(item)}><Trash size={15} /> Delete forever</Button></article>)}{trashed.length === 0 && <div className="empty-state"><Trash size={42} weight="thin" /><h3>Your encrypted trash is empty</h3><p>Items moved here can be restored until permanently deleted.</p></div>}</div><Modal open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} title="Permanently delete ciphertext?"><div className="confirm-delete"><Warning size={30} weight="light" /><p>This removes <strong>{pendingDelete?.name}</strong>, all local encrypted versions, comments, and access grants. Midnight commitments remain as historical proof.</p><div className="modal-actions"><Button tone="quiet" trailing={false} onClick={() => setPendingDelete(null)}>Cancel</Button><Button tone="danger" onClick={async () => { if (pendingDelete) await actions.deleteForever(pendingDelete.id); setPendingDelete(null); }}>Delete forever</Button></div></div></Modal></section>;
};
