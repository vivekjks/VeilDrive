import { Check, DownloadSimple, Eye, FileArrowUp, Funnel, LockKey, ShieldCheck, Trash, UserMinus, UsersThree } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { shortHash } from '../lib/encoding';
import { formatDate, relativeTime } from '../lib/format';
import { useAppStore } from '../store/AppStore';
import type { AuditEvent } from '../types';

const eventIcons: Record<AuditEvent['action'], typeof Eye> = {
  upload: FileArrowUp, view: Eye, download: DownloadSimple, share: UsersThree, revoke: UserMinus,
  verify: ShieldCheck, proof: ShieldCheck, comment: LockKey, delete: Trash, restore: FileArrowUp,
};

export const ActivityPage = () => {
  const { state } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'authorized' | 'denied'>('all');
  const filtered = useMemo(() => state.audit.filter((event) => filter === 'all' || (filter === 'authorized' ? event.authorized : !event.authorized)), [filter, state.audit]);

  return (
    <section className="page activity-page">
      <header className="page-heading"><div><span className="eyebrow">Audit trail</span><h1>Private evidence.</h1></div></header>
      <div className="activity-summary">
        <article><span>{state.audit.length}</span><p>Recorded actions</p></article>
        <article><span>{state.audit.filter((event) => event.transactionId).length}</span><p>Preprod receipts</p></article>
        <article><span>{state.audit.filter((event) => !event.authorized).length}</span><p>Denied attempts</p></article>
      </div>
      <div className="audit-toolbar"><div><Funnel size={16} weight="light" />Filters</div><div>{(['all', 'authorized', 'denied'] as const).map((item) => <button key={item} className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
      <div className="audit-log">
        {filtered.map((event) => {
          const Icon = eventIcons[event.action];
          return <article key={event.id}><span className={`audit-icon ${event.authorized ? 'is-valid' : 'is-denied'}`}><Icon size={19} weight="light" /></span><div><strong>{event.actor}</strong><p>{event.action} · {event.target}</p></div><span className={`audit-decision ${event.authorized ? 'is-valid' : 'is-denied'}`}>{event.authorized ? <Check size={13} /> : '×'} {event.authorized ? 'Authorized' : 'Denied'}</span><span><strong>{relativeTime(event.createdAt)}</strong><small>{formatDate(event.createdAt, true)}</small></span><code>{event.transactionId ? shortHash(event.transactionId) : 'Local only'}</code></article>;
        })}
        {!filtered.length && <div className="empty-state"><ShieldCheck size={40} weight="thin" /><h3>No activity yet</h3><p>Real receipts appear after completed actions.</p></div>}
      </div>
    </section>
  );
};
