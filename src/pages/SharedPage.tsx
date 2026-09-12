import { Check, Clock, Link as LinkIcon, ShieldCheck, UserPlus, Wallet, X } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { FileIcon } from '../components/FileIcon';
import { PrivacyBadge } from '../components/PrivacyBadge';
import { formatDate } from '../lib/format';
import { shortHash } from '../lib/encoding';
import { useAppStore } from '../store/AppStore';

export const SharedPage = () => {
  const { state, actions } = useAppStore();
  const [tab, setTab] = useState<'grants' | 'requests' | 'links'>('grants');
  const grants = useMemo(() => state.grants.filter((grant) => tab === 'links' ? grant.method === 'external' : grant.method !== 'external'), [state.grants, tab]);
  const itemFor = (fileId: string) => state.items.find((item) => item.id === fileId);

  return (
    <section className="page page--shared">
      <header className="page-heading"><div><span className="eyebrow">Private access</span><h1>Shared, without oversharing.</h1><p>Every grant is explicit, expirable, revocable, and commitment-backed.</p></div><Button tone="primary" onClick={() => setTab('requests')}><UserPlus size={17} weight="light" /> Review requests</Button></header>
      <div className="page-tabs"><button className={tab === 'grants' ? 'is-active' : ''} onClick={() => setTab('grants')}>Active grants <span>{state.grants.filter((grant) => grant.method !== 'external' && !grant.revokedAt).length}</span></button><button className={tab === 'requests' ? 'is-active' : ''} onClick={() => setTab('requests')}>Access requests <span>{state.accessRequests.filter((request) => request.status === 'pending').length}</span></button><button className={tab === 'links' ? 'is-active' : ''} onClick={() => setTab('links')}>External links</button></div>
      {tab === 'requests' ? (
        <div className="request-list">
          {state.accessRequests.map((request) => {
            const item = itemFor(request.fileId);
            return <article className="request-card bezel" key={request.id}><div className="bezel__core"><span className="request-card__avatar">{request.requesterName.slice(0, 1)}</span><div><span className="overline">Access request · {formatDate(request.createdAt, true)}</span><h2>{request.requesterName} wants to {request.permission}</h2><p>{item?.name} · “{request.message}”</p></div>{request.status === 'pending' ? <div className="request-actions"><Button tone="quiet" trailing={false} onClick={() => actions.resolveAccessRequest(request.id, 'rejected')}><X size={15} /> Reject</Button><Button tone="primary" onClick={() => actions.resolveAccessRequest(request.id, 'granted')}><Check size={15} /> Grant</Button></div> : <span className={`decision decision--${request.status}`}>{request.status}</span>}</div></article>;
          })}
        </div>
      ) : (
        <div className="access-table">
          <header><span>File</span><span>Recipient / rule</span><span>Control</span><span>Receipt</span><span /></header>
          {grants.map((grant) => {
            const item = itemFor(grant.fileId);
            if (!item) return null;
            return <article key={grant.id} className={grant.revokedAt ? 'is-revoked' : ''}><div className="access-file"><span className="file-glyph"><FileIcon item={item} size={19} /></span><span><strong>{item.name}</strong><PrivacyBadge level={item.privacy} /></span></div><div className="access-recipient"><span>{grant.method === 'wallet' ? <Wallet size={17} weight="light" /> : grant.method === 'external' ? <LinkIcon size={17} weight="light" /> : <ShieldCheck size={17} weight="light" />}</span><span><strong>{grant.recipientLabel}</strong><small>{grant.method === 'policy' ? `${grant.logic} · ${grant.conditions.length} hidden conditions` : grant.method}</small></span></div><div className="access-control"><strong>{grant.permissions.join(' · ')}</strong><small><Clock size={12} weight="light" /> {grant.expiresAt ? formatDate(grant.expiresAt, true) : 'No expiry'}{grant.oneTime ? ' · one time' : ''}</small></div><code>{shortHash(grant.transactionId)}</code><div>{!grant.revokedAt ? <button className="revoke-action" onClick={() => actions.revokeGrant(grant.id)}>Revoke</button> : <span className="revoked-label">Revoked</span>}</div></article>;
          })}
          {grants.length === 0 && <div className="empty-state"><ShieldCheck size={40} weight="thin" /><h3>No access grants in this view</h3><p>Create one from any file’s inspector.</p></div>}
        </div>
      )}
    </section>
  );
};
