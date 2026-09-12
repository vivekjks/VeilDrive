import { ArrowLeft, Check, Clock, DownloadSimple, Eye, Folder, Plus, ShieldCheck, UserPlus, UsersThree, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { PrivacyBadge } from '../components/PrivacyBadge';
import { UploadModal } from '../features/UploadModal';
import { formatDate, initials, relativeTime } from '../lib/format';
import { useAppStore } from '../store/AppStore';

export const DataRoomsPage = () => {
  const { state, actions } = useAppStore();
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState(state.dataRooms[0]?.id ?? '');
  const room = state.dataRooms.find((candidate) => candidate.id === roomId) ?? state.dataRooms[0];
  const [selectedMemberId, setSelectedMemberId] = useState(room?.participantIds[0] ?? 'owner');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitee, setInvitee] = useState('');
  const [uploadParent, setUploadParent] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [description, setDescription] = useState('');
  const [requirement, setRequirement] = useState('Active organization credential');
  const [expires, setExpires] = useState(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectedMember = state.members.find((member) => member.id === selectedMemberId);
  const credential = state.credentials.find((item) => item.subjectId === selectedMemberId);
  const folders = state.items.filter((item) => item.parentId === room?.rootFolderId);
  const roomEvents = state.audit.slice(0, 6);

  const createRoom = async () => {
    setBusy(true); setError('');
    try {
      const created = await actions.createDataRoom(roomName.trim(), description.trim(), new Date(`${expires}T23:59:59`).toISOString(), requirement.trim());
      setRoomId(created.id); setSelectedMemberId('owner'); setCreateOpen(false); setRoomName(''); setDescription('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Data room creation failed.'); }
    finally { setBusy(false); }
  };

  if (!room) return <section className="page"><header className="page-heading"><div><span className="eyebrow">Confidential collaboration</span><h1>Data rooms</h1><p>Create an expiring, credential-gated encrypted workspace.</p></div><Button tone="primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> New data room</Button></header><div className="empty-state"><ShieldCheck size={46} weight="thin" /><h3>No data rooms yet</h3><p>Your first data room will be committed to the preprod registry.</p></div><Modal open={createOpen} onClose={() => !busy && setCreateOpen(false)} title="Create a confidential data room"><form className="simple-form" onSubmit={(event) => { event.preventDefault(); createRoom(); }}><label className="field"><span>Name</span><input className="input" value={roomName} onChange={(event) => setRoomName(event.target.value)} /></label><label className="field"><span>Description</span><textarea className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="field"><span>Credential requirement</span><input className="input" value={requirement} onChange={(event) => setRequirement(event.target.value)} /></label><label className="field"><span>Expires</span><input className="input" type="date" value={expires} onChange={(event) => setExpires(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<footer className="modal-actions"><Button tone="primary" disabled={busy || !roomName.trim() || !requirement.trim() || !expires}>{busy ? 'Committing…' : 'Create data room'}</Button></footer></form></Modal></section>;
  return (
    <section className="data-room-page">
      <header className="data-room-hero">
        <img src="/assets/veil-core.png" alt="Encrypted private data room" />
        <div className="data-room-hero__copy"><span className="back-link"><ArrowLeft size={14} /> Data rooms</span>{state.dataRooms.length > 1 && <select className="select workspace-switcher" value={room.id} onChange={(event) => { setRoomId(event.target.value); const next = state.dataRooms.find((candidate) => candidate.id === event.target.value); setSelectedMemberId(next?.participantIds[0] ?? 'owner'); }}>{state.dataRooms.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select>}<h1 className="serif">{room.name} · Confidential data room</h1><p>{room.description}</p><div className="room-stats"><span><UsersThree size={24} weight="thin" /><small>Participants</small><strong>{room.participantIds.length}</strong></span><span><ShieldCheck size={24} weight="thin" /><small>Privacy level</small><PrivacyBadge level={room.privacy} /></span><span><Clock size={24} weight="thin" /><small>Access expires</small><strong>{formatDate(room.expiresAt)}</strong></span><Button tone="primary" onClick={() => setInviteOpen(true)}><UserPlus size={16} /> Invite</Button></div></div>
      </header>
      <div className="data-room-layout">
        <div className="data-room-main">
          <section className="room-files"><header><h2>Files</h2><button onClick={() => setUploadParent(room.rootFolderId)}><Plus size={15} /> Add files</button></header><div className="room-folder-grid">{folders.map((folder) => <button key={folder.id} onClick={() => setUploadParent(folder.id)}><Folder size={38} weight="light" /><strong>{folder.name}</strong><span>{state.items.filter((item) => item.parentId === folder.id).length} files</span></button>)}</div>{folders.length === 0 && <div className="empty-state"><Folder size={36} weight="thin" /><p>Add encrypted files to begin.</p></div>}</section>
          <section className="room-access"><header><h2>Recent access</h2><button onClick={() => navigate('/activity')}>View all</button></header><div className="access-timeline">{roomEvents.map((event) => <article key={event.id}><i className={event.authorized ? 'is-valid' : ''} /><time>{relativeTime(event.createdAt)}</time><span>{event.action === 'view' ? <Eye size={16} weight="light" /> : <DownloadSimple size={16} weight="light" />}</span><p><strong>{event.actor}</strong> {event.action}ed <em>{event.target}</em></p></article>)}</div></section>
          <section className="room-policy"><ShieldCheck size={46} weight="thin" /><div><span className="overline">Data room policy</span><h2 className="serif">{room.credentialRequirement}</h2><p>Only invitees with a valid investor credential can access this data room. Proof inputs stay private.</p></div><span>Disclosure<br />with intention</span></section>
        </div>
        <aside className="participant-panel"><header><h2>Participants ({room.participantIds.length})</h2></header>{room.participantIds.map((id) => { const member = state.members.find((candidate) => candidate.id === id); return member && <button className={selectedMemberId === id ? 'is-active' : ''} key={id} onClick={() => setSelectedMemberId(id)}><span>{initials(member.name)}</span><div><strong>{member.name}</strong><small>{member.department}</small></div><i className={`member-status member-status--${member.status}`}>{member.status}</i></button>; })}{selectedMember && <div className="participant-detail"><h3>{selectedMember.name}</h3><dl><div><dt>Access status</dt><dd><i className="status-dot" />{selectedMember.status}</dd></div><div><dt>Credential proof</dt><dd>{credential?.status === 'active' ? <><Check size={13} /> Verified</> : 'Not provided'}</dd></div><div><dt>Access expires</dt><dd>{formatDate(room.expiresAt)}</dd></div><div><dt>Permission</dt><dd>View + download</dd></div></dl>{selectedMember.id !== 'owner' && <Button tone="danger" trailing={false} onClick={() => { setError(''); actions.updateMember(selectedMember.id, { status: 'revoked' }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Revocation failed.')); }}><X size={15} /> Revoke access</Button>}{error && <p className="form-error" role="alert">{error}</p>}</div>}</aside>
      </div>
      <Modal open={inviteOpen} onClose={() => !busy && setInviteOpen(false)} title="Invite to confidential data room"><form className="simple-form" onSubmit={async (event) => { event.preventDefault(); const member = state.members.find((item) => item.name === invitee); if (!member) return; setBusy(true); setError(''); try { await actions.inviteToDataRoom(room.id, member.id); setInviteOpen(false); setInvitee(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Invitation failed.'); } finally { setBusy(false); } }}><label className="field"><span>Participant</span><select className="select" value={invitee} onChange={(event) => setInvitee(event.target.value)}><option value="">Choose a workspace member</option>{state.members.filter((member) => !room.participantIds.includes(member.id)).map((member) => <option key={member.id}>{member.name}</option>)}</select></label>{error && <p className="form-error" role="alert">{error}</p>}<footer className="modal-actions"><Button tone="primary" disabled={busy || !invitee}>{busy ? 'Committing…' : 'Send invite'}</Button></footer></form></Modal>
      <UploadModal open={uploadParent !== null} onClose={() => setUploadParent(null)} parentId={uploadParent ?? room.rootFolderId} />
    </section>
  );
};
