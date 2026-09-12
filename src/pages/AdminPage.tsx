import { Check, Key, ShieldCheck, UserMinus, UsersThree, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { formatDate, initials } from '../lib/format';
import { useAppStore } from '../store/AppStore';

export const AdminPage = () => {
  const { state, actions } = useAppStore();
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeMembers = state.members.filter((member) => member.status === 'active').length;
  const activeCredentials = state.credentials.filter((credential) => credential.status === 'active').length;
  const member = state.members.find((item) => item.id === revokeId);
  const revokeMember = async () => {
    if (!member) return;
    setBusy(true);
    setError('');
    try {
      const credential = state.credentials.find((item) => item.subjectId === member.id && item.status === 'active');
      if (credential) await actions.revokeCredential(credential.id);
      await actions.updateMember(member.id, { status: 'revoked' });
      setRevokeId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Organization access could not be revoked.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="page admin-page"><header className="page-heading"><div><span className="eyebrow">Organization administration</span><h1>Control access at the source.</h1><p>Manage people, private credentials, access requests, and revocation together.</p></div></header><div className="admin-metrics"><article><UsersThree size={26} weight="thin" /><strong>{activeMembers}</strong><span>Active members</span></article><article><Key size={26} weight="thin" /><strong>{activeCredentials}</strong><span>Valid credentials</span></article><article><ShieldCheck size={26} weight="thin" /><strong>{state.grants.filter((grant) => !grant.revokedAt).length}</strong><span>Active grants</span></article><article><span className="metric-pulse" /><strong>{state.accessRequests.filter((request) => request.status === 'pending').length}</strong><span>Pending decisions</span></article></div><div className="admin-layout"><section className="admin-members"><header><h2>Organization members</h2><span>{state.members.length} total</span></header>{state.members.map((item) => { const credential = state.credentials.find((candidate) => candidate.subjectId === item.id); return <article key={item.id}><span className="member-avatar">{initials(item.name)}</span><div><strong>{item.name}</strong><small>{item.wallet}</small></div><span><strong>{item.department}</strong><small>{item.role}</small></span><span className={credential?.status === 'active' ? 'credential-valid' : 'credential-missing'}>{credential?.status === 'active' ? <Check size={13} /> : <X size={13} />} {credential?.status ?? 'No credential'}</span><span className={`member-status member-status--${item.status}`}>{item.status}</span>{item.id !== 'owner' && item.status !== 'revoked' ? <button className="revoke-action" onClick={() => { setError(''); setRevokeId(item.id); }}><UserMinus size={15} /> Revoke</button> : <span />}</article>; })}</section><aside className="admin-requests"><span className="overline">Decision queue</span><h2>Access requests</h2>{state.accessRequests.map((request) => <article key={request.id}><span>{request.requesterName.slice(0,1)}</span><div><strong>{request.requesterName}</strong><p>{request.message}</p><small>{formatDate(request.createdAt, true)}</small></div>{request.status === 'pending' ? <div><button onClick={() => actions.resolveAccessRequest(request.id, 'rejected')} aria-label="Reject request"><X size={14} /></button><button onClick={() => actions.resolveAccessRequest(request.id, 'granted')} aria-label="Grant request"><Check size={14} /></button></div> : <em>{request.status}</em>}</article>)}</aside></div><Modal open={Boolean(member)} onClose={() => !busy && setRevokeId(null)} title="Revoke organization access"><div className="confirm-delete"><UserMinus size={30} weight="light" /><p>Revoking <strong>{member?.name}</strong> disables their credential and new authorized retrievals. Rotate affected group keys for cryptographic offboarding.</p><p className="security-note">Already obtained plaintext cannot be recalled. VeilDrive never overclaims this boundary.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><Button tone="quiet" trailing={false} onClick={() => setRevokeId(null)} disabled={busy}>Cancel</Button><Button tone="danger" onClick={revokeMember} disabled={busy}>{busy ? 'Revoking on preprod…' : 'Revoke credential & access'}</Button></div></div></Modal></section>;
};
