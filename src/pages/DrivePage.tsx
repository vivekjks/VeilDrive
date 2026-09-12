import { CaretDown, CaretRight, DotsThree, GridFour, List, Plus, SortAscending, Star, Trash, UploadSimple } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { FileIcon } from '../components/FileIcon';
import { Modal } from '../components/Modal';
import { PrivacyBadge } from '../components/PrivacyBadge';
import { FileInspector } from '../features/FileInspector';
import { ShareModal } from '../features/ShareModal';
import { UploadModal } from '../features/UploadModal';
import { formatBytes, formatDate } from '../lib/format';
import { useAppStore } from '../store/AppStore';
import type { DriveItem } from '../types';
import './DrivePage.css';

export const DrivePage = () => {
  const { state, actions } = useAppStore();
  const [params] = useSearchParams();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shareFile, setShareFile] = useState<DriveItem | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [filter, setFilter] = useState<'all' | 'folders' | 'recent' | 'starred'>('all');
  const [sort, setSort] = useState<'modified' | 'name'>('modified');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [actionError, setActionError] = useState('');
  const [retrying, setRetrying] = useState('');
  const query = (params.get('q') ?? '').toLowerCase();

  const parentFolder = state.items.find((item) => item.id === folderId);
  const selected = state.items.find((item) => item.id === selectedId && item.kind === 'file') ?? null;
  const totalBytes = state.items.filter((item) => item.kind === 'file' && !item.trashed).reduce((sum, item) => sum + item.size, 0);
  const visible = useMemo(() => {
    let items = state.items.filter((item) => !item.trashed && !item.workspaceId && !item.dataRoomId);
    if (query) items = items.filter((item) => `${item.name} ${item.tags.join(' ')}`.toLowerCase().includes(query));
    else if (folderId) items = items.filter((item) => item.parentId === folderId);
    else items = items.filter((item) => item.parentId === null);
    if (filter === 'folders') items = items.filter((item) => item.kind === 'folder');
    if (filter === 'recent') items = items.filter((item) => item.kind === 'file');
    if (filter === 'starred') items = items.filter((item) => item.favorite);
    return [...items].sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder') || (sort === 'name' ? a.name.localeCompare(b.name) : b.modifiedAt.localeCompare(a.modifiedAt)));
  }, [filter, folderId, query, sort, state.items]);

  const openItem = (item: DriveItem) => {
    if (item.kind === 'folder') { setFolderId(item.id); setSelectedId(null); }
    else setSelectedId(item.id);
  };

  const createFolder = async () => {
    if (!folderName.trim()) return;
    setCreatingFolder(true);
    setActionError('');
    try {
      await actions.createFolder(folderName.trim(), folderId);
      setFolderName(''); setFolderOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Folder creation failed.');
    } finally {
      setCreatingFolder(false);
    }
  };

  return (
    <div className={`drive-page ${selected ? 'drive-page--inspector' : ''}`}>
      <section className="drive-canvas">
        <header className="page-heading drive-heading">
          <div><span className="eyebrow">{query ? 'Search results' : parentFolder ? 'Private folder' : 'My drive'}</span><h1>{query ? `“${params.get('q')}”` : parentFolder?.name ?? 'My encrypted drive'}</h1><p>{query ? `${visible.length} encrypted items found.` : 'Files stay encrypted; commitments stay verifiable.'}</p></div>
          <div className="drive-heading__actions"><Button tone="secondary" onClick={() => setFolderOpen(true)} trailing={false}><Plus size={17} weight="light" /> New folder</Button><Button tone="primary" onClick={() => setUploadOpen(true)} trailing={<CaretDown size={14} weight="light" />}><UploadSimple size={17} weight="light" /> Upload</Button></div>
        </header>

        <div className="storage-strip bezel"><div className="bezel__core"><div className="storage-meter"><strong>{state.items.filter((item) => item.kind === 'file' && !item.trashed).length}</strong></div><div><span>{formatBytes(totalBytes)} <small>encrypted locally</small></span><p><i className="status-dot" /> Preprod registry</p></div><div className="storage-fact"><strong>Client-side encrypted</strong><span>Readable bytes stay on this device.</span></div><div className="storage-fact"><strong>On-chain commitments</strong><span>{state.versions.length} registered versions.</span></div></div></div>
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        {state.pendingFileWrites.length > 0 && <div className="pending-writes" role="status">{state.pendingFileWrites.map((pending) => <article key={pending.item.id}><span className="file-glyph"><FileIcon item={pending.item} size={18} /></span><div><strong>{pending.item.name}</strong><p>Encrypted locally · waiting for preprod registration</p></div><Button tone="secondary" trailing={false} disabled={Boolean(retrying)} onClick={async () => { setRetrying(pending.item.id); setActionError(''); try { await actions.retryPendingFileWrite(pending.item.id); } catch (error) { setActionError(error instanceof Error ? error.message : 'Retry failed.'); } finally { setRetrying(''); } }}>{retrying === pending.item.id ? 'Retrying…' : 'Retry'}</Button></article>)}</div>}

        {folderId && <div className="breadcrumbs"><button onClick={() => setFolderId(null)}>My drive</button><CaretRight size={13} weight="light" /><span>{parentFolder?.name}</span></div>}
        <div className="drive-toolbar"><div>{(['all', 'folders', 'recent', 'starred'] as const).map((item) => <button key={item} className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><div><button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={17} weight="light" /></button><button className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><GridFour size={17} weight="light" /></button><button onClick={() => setSort((value) => value === 'modified' ? 'name' : 'modified')}><SortAscending size={17} weight="light" /> {sort === 'modified' ? 'Modified' : 'Name'}</button></div></div>

        {view === 'list' ? (
          <div className="file-table" role="table">
            <div className="file-table__head" role="row"><span>Name</span><span>Privacy</span><span>Size</span><span>Last modified</span><span /></div>
            {visible.map((item) => (
              <div className={`file-row ${selectedId === item.id ? 'is-selected' : ''}`} key={item.id} role="row" tabIndex={0} onClick={() => openItem(item)} onDoubleClick={() => openItem(item)} onKeyDown={(event) => event.key === 'Enter' && openItem(item)}>
                <div className="file-row__name"><span className="file-glyph"><FileIcon item={item} size={20} /></span><button className={`star-button ${item.favorite ? 'is-active' : ''}`} onClick={(event) => { event.stopPropagation(); setActionError(''); actions.toggleFavorite(item.id).catch((error) => setActionError(error instanceof Error ? error.message : 'Favorite update failed.')); }} aria-label="Toggle favorite"><Star size={15} weight={item.favorite ? 'fill' : 'light'} /></button><strong>{item.name}</strong></div>
                <PrivacyBadge level={item.privacy} /><span>{formatBytes(item.size)}</span><span>{formatDate(item.modifiedAt)}</span>
                <div className="row-actions"><button aria-label="Move to trash" onClick={(event) => { event.stopPropagation(); setActionError(''); actions.moveToTrash(item.id).catch((error) => setActionError(error instanceof Error ? error.message : 'Trash update failed.')); }}><Trash size={16} weight="light" /></button><button aria-label="Open details" onClick={(event) => { event.stopPropagation(); openItem(item); }}><DotsThree size={19} weight="bold" /></button></div>
              </div>
            ))}
            {visible.length === 0 && <div className="empty-state"><FileIcon item={{ kind: 'folder' } as DriveItem} size={38} /><h3>No encrypted items here</h3><p>Upload a file or create a private folder to begin.</p></div>}
          </div>
        ) : (
          <div className="file-grid">{visible.map((item) => <button key={item.id} className={selectedId === item.id ? 'is-selected' : ''} onClick={() => openItem(item)}><span className="file-grid__visual"><FileIcon item={item} size={38} /></span><strong>{item.name}</strong><small>{item.kind === 'folder' ? 'Private folder' : `${formatBytes(item.size)} · ${formatDate(item.modifiedAt)}`}</small><PrivacyBadge level={item.privacy} /></button>)}</div>
        )}
      </section>

      {selected && <FileInspector file={selected} onClose={() => setSelectedId(null)} onShare={() => setShareFile(selected)} />}
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} parentId={folderId} onComplete={setSelectedId} />
      <ShareModal file={shareFile} onClose={() => setShareFile(null)} />
      <Modal open={folderOpen} onClose={() => !creatingFolder && setFolderOpen(false)} title="Create a private folder"><form className="simple-form" onSubmit={(event) => { event.preventDefault(); createFolder(); }}><label className="field"><span>Folder name</span><input autoFocus className="input" value={folderName} onChange={(event) => setFolderName(event.target.value)} /></label>{actionError && <p className="form-error" role="alert">{actionError}</p>}<footer className="modal-actions"><Button tone="quiet" trailing={false} type="button" onClick={() => setFolderOpen(false)} disabled={creatingFolder}>Cancel</Button><Button tone="primary" type="submit" disabled={creatingFolder || !folderName.trim()}>{creatingFolder ? 'Committing…' : 'Create folder'}</Button></footer></form></Modal>
    </div>
  );
};
