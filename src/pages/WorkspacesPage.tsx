import { Buildings, Check, Key, Plus, ShieldCheck, UserPlus, UsersThree } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { PrivacyBadge } from '../components/PrivacyBadge';
import { shortHash } from '../lib/encoding';
import { formatDate, initials } from '../lib/format';
import { useAppStore } from '../store/AppStore';
import type { MemberRole } from '../types';

export const WorkspacesPage = () => {
  const { state, actions } = useAppStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [credentialOpen, setCredentialOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberName, setMemberName] = useState('');
  const [wallet, setWallet] = useState('');
  const [role, setRole] = useState<MemberRole>('member');
  const [department, setDepartment] = useState('Engineering');
  const workspace = state.workspaces[0];

  return (
    <section className="page workspace-page">
      <header className="page-heading"><div><span className="eyebrow">Private teams</span><h1>{workspace?.name ?? 'Workspaces'}</h1><p>{workspace?.description ?? 'Organize encrypted work around roles and credentials.'}</p></div><div className="heading-actions"><Button tone="secondary" onClick={() => setCreateOpen(true)}><Plus size={16} /> New workspace</Button><Button tone="primary" onClick={() => setInviteOpen(true)}><UserPlus size={17} /> Invite member</Button></div></header>
      {workspace && <div className="workspace-overview"><div><Buildings size={28} weight="thin" /><span><small>Workspace</small><strong>{workspace.name}</strong></span></div><div><UsersThree size={28} weight="thin" /><span><small>Members</small><strong>{workspace.memberIds.length} active</strong></span></div><div><ShieldCheck size={28} weight="thin" /><span><small>Privacy</small><PrivacyBadge level={workspace.privacy} /></span></div><div><Key size={28} weight="thin" /><span><small>Access model</small><strong>Role + credential</strong></span></div></div>}

      <div className="workspace-grid">
        <section className="members-panel"><header><div><span className="overline">Directory</span><h2>Members and roles</h2></div><button onClick={() => setCredentialOpen(true)}>Issue credential</button></header><div className="member-list">{state.members.map((member) => <article key={member.id}><span className="member-avatar">{initials(member.name)}</span><div><strong>{member.name}</strong><small>{member.wallet}</small></div><span>{member.department}</span><select className="select" value={member.role} onChange={(event) => actions.updateMember(member.id, { role: event.target.value as MemberRole })} disabled={member.id === 'alice'}><option value="owner">Owner</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="member">Member</option><option value="guest">Guest</option></select><i className={`member-status member-status--${member.status}`}>{member.status}</i></article>)}</div></section>
        <aside className="credential-panel"><span className="overline">Private credentials</span><h2 className="serif">Prove the role. Hide the record.</h2><p>Workspace credentials let a member satisfy file policies without revealing the whole credential.</p><div className="credential-stack">{state.credentials.map((credential) => <article key={credential.id}><header><span><ShieldCheck size={17} weight="light" />{credential.status}</span><code>{shortHash(credential.commitment, 5, 4)}</code></header><strong>{credential.subjectName}</strong><p>{credential.organization} · {credential.department} · {credential.role}</p><small>Expires {formatDate(credential.expiresAt)}</small></article>)}</div></aside>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a private workspace"><form className="simple-form" onSubmit={(event) => { event.preventDefault(); actions.addWorkspace(name, description); setCreateOpen(false); setName(''); setDescription(''); }}><label className="field"><span>Name</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field"><span>Description</span><textarea className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} /></label><footer className="modal-actions"><Button tone="primary" disabled={!name.trim()}>Create workspace</Button></footer></form></Modal>
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a wallet"><form className="simple-form" onSubmit={(event) => { event.preventDefault(); actions.addMember({ name: memberName, wallet, role, department, status: 'invited' }); setInviteOpen(false); }}><label className="field"><span>Name</span><input className="input" value={memberName} onChange={(event) => setMemberName(event.target.value)} /></label><label className="field"><span>Midnight wallet</span><input className="input" value={wallet} onChange={(event) => setWallet(event.target.value)} placeholder="mn_addr_preprod1…" /></label><div className="form-split"><label className="field"><span>Role</span><select className="select" value={role} onChange={(event) => setRole(event.target.value as MemberRole)}><option value="admin">Admin</option><option value="manager">Manager</option><option value="member">Member</option><option value="guest">Guest</option></select></label><label className="field"><span>Department</span><input className="input" value={department} onChange={(event) => setDepartment(event.target.value)} /></label></div><footer className="modal-actions"><Button tone="primary" disabled={!memberName || !wallet}>Send private invite</Button></footer></form></Modal>
      <Modal open={credentialOpen} onClose={() => setCredentialOpen(false)} title="Issue an organization credential"><form className="simple-form" onSubmit={async (event) => { event.preventDefault(); const subject = state.members.find((member) => member.name === memberName) ?? state.members[0]!; await actions.issueCredential({ subjectId: subject.id, subjectName: subject.name, issuer: workspace?.name ?? 'VeilDrive', organization: workspace?.name ?? 'VeilDrive', department, role, status: 'active', expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString() }); setCredentialOpen(false); }}><label className="field"><span>Member</span><select className="select" value={memberName} onChange={(event) => setMemberName(event.target.value)}>{state.members.map((member) => <option key={member.id}>{member.name}</option>)}</select></label><div className="form-split"><label className="field"><span>Department</span><input className="input" value={department} onChange={(event) => setDepartment(event.target.value)} /></label><label className="field"><span>Role claim</span><input className="input" value={role} onChange={(event) => setRole(event.target.value as MemberRole)} /></label></div><p><Check size={14} /> Only the credential commitment is registered. Claim values remain in the holder’s private state.</p><footer className="modal-actions"><Button tone="primary">Issue credential</Button></footer></form></Modal>
    </section>
  );
};
