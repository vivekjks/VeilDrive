import { Check, DownloadSimple, Eye, FileArrowUp, Funnel, LockKey, ShieldCheck, Trash, UserMinus, UsersThree } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { shortHash } from '../lib/encoding';
import { formatDate, relativeTime } from '../lib/format';
import { useAppStore } from '../store/AppStore';
import type { AuditEvent } from '../types';

const eventIcons: Record<AuditEvent['action'], typeof Eye> = {
  upload: FileArrowUp, view: Eye, download: DownloadSimple, share: UsersThree, revoke: UserMinus,
  verify: ShieldCheck, proof: ShieldCheck, comment: LockKey, delete: Trash, restore: FileArrowUp,
};

export const ActivityPage = () => {
  const { state, actions } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'authorized' | 'denied'>('all');
  const [proofOpen, setProofOpen] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofCommitment, setProofCommitment] = useState('');
  const [proofError, setProofError] = useState('');
  const filtered = useMemo(
    () => state.audit.filter((event) => filter === 'all' || (filter === 'authorized' ? event.authorized : !event.authorized)),
    [filter, state.audit],
  );
  const authorized = state.audit.filter((event) => event.authorized).length;

  const proveAuthorizedAccess = async () => {
    setProofBusy(true);
    setProofError('');
    try {
      const request = await actions.createProofRequest(
        'Authorized access audit',
        `${authorized} of ${state.audit.length} committed events were authorized`,
        ['Actor identities', 'Credential values', 'Other file activity'],
      );
      setProofCommitment(await actions.generateProof(request.id, request));
      setProofOpen(true);
    } catch (error) {
      setProofError(error instanceof Error ? error.message : 'Could not generate the audit proof.');
    } finally {
      setProofBusy(false);
    }
  };

  return (
    <section className="page activity-page">
      <header className="page-heading">
        <div><span className="eyebrow">Private audit trail</span><h1>Evidence, without exposure.</h1><p>Answer authorization questions without publishing everyone’s activity.</p></div>
        <Button tone="primary" onClick={proveAuthorizedAccess} disabled={proofBusy}><ShieldCheck size={17} /> {proofBusy ? 'Generating proof…' : 'Prove authorized access'}</Button>
      </header>
      {proofError && <p className="form-error" role="alert">{proofError}</p>}
      <div className="activity-summary"><article><span>{state.audit.length}</span><p>Committed events</p></article><article><span>{authorized}</span><p>Authorized actions</p></article><article><span>{state.audit.length - authorized}</span><p>Denied attempts</p></article><article><span>0</span><p>Private identities exposed</p></article></div>
      <div className="audit-toolbar"><div><Funnel size={16} weight="light" />Filters</div><div>{(['all', 'authorized', 'denied'] as const).map((item) => <button key={item} className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
      <div className="audit-log">{filtered.map((event) => { const Icon = eventIcons[event.action]; return <article key={event.id}><span className={`audit-icon ${event.authorized ? 'is-valid' : 'is-denied'}`}><Icon size={19} weight="light" /></span><div><strong>{event.actor}</strong><p>{event.action} · {event.target}</p></div><span className={`audit-decision ${event.authorized ? 'is-valid' : 'is-denied'}`}>{event.authorized ? <Check size={13} /> : '×'} {event.authorized ? 'Authorized' : 'Denied'}</span><span><strong>{relativeTime(event.createdAt)}</strong><small>{formatDate(event.createdAt, true)}</small></span><code>{event.transactionId ? shortHash(event.transactionId) : 'Private'}</code></article>; })}</div>
      <Modal open={proofOpen} onClose={() => setProofOpen(false)} title="Authorized access proof"><div className="proof-complete"><span><ShieldCheck size={30} weight="light" /></span><h3>Authorized access verified</h3><p>{authorized} recorded actions were authorized. Actor identities, credential fields, and unrelated activity remain hidden.</p><code>{proofCommitment}</code><Button tone="primary" onClick={() => setProofOpen(false)}>Done</Button></div></Modal>
    </section>
  );
};
