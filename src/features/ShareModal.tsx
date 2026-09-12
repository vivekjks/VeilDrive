import { Check, Link as LinkIcon, ShieldCheck, Wallet } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { FileIcon } from '../components/FileIcon';
import { Modal } from '../components/Modal';
import { useAppStore } from '../store/AppStore';
import type { AccessMethod, DriveItem, Permission, PolicyCondition, ShareDraft } from '../types';

interface ShareModalProps { file: DriveItem | null; onClose: () => void; }
const permissions: Permission[] = ['view', 'download', 'edit', 'reshare'];
const claimFields = ['organization', 'department', 'role'] as const;

const emptyConditions = (): PolicyCondition[] => claimFields.map((field) => ({
  id: field,
  field,
  operator: 'is',
  value: '',
}));

export const ShareModal = ({ file, onClose }: ShareModalProps) => {
  const { actions } = useAppStore();
  const [method, setMethod] = useState<Exclude<AccessMethod, 'team'>>('wallet');
  const [recipient, setRecipient] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(['view']);
  const [conditions, setConditions] = useState<PolicyCondition[]>(emptyConditions);
  const [expires, setExpires] = useState('7-days');
  const [oneTime, setOneTime] = useState(false);
  const [resultLink, setResultLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const recipientLabel = useMemo(() => {
    if (method === 'policy') return 'Private credential rule';
    if (method === 'external') return recipient.trim() || 'External recipient';
    return recipient.trim();
  }, [method, recipient]);

  const expiry = () => {
    if (expires === 'never') return null;
    const hours = { '1-hour': 1, '24-hours': 24, '7-days': 168, '30-days': 720 }[expires] ?? 168;
    return new Date(Date.now() + hours * 3_600_000).toISOString();
  };

  const close = () => {
    setResultLink(''); setError(''); onClose();
  };

  const create = async () => {
    if (!file) return;
    if (method === 'wallet' && !/^(?:0x)?[0-9a-f]{64}$/i.test(recipient.trim())) {
      setError('Enter the recipient’s 64-character Veil ID.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const draft: ShareDraft = {
        method,
        recipient: method === 'policy' ? 'private-policy' : recipient.trim(),
        recipientLabel,
        permissions: selectedPermissions,
        conditions: method === 'policy' ? conditions : [],
        logic: 'AND',
        expiresAt: expiry(),
        oneTime,
      };
      const grant = await actions.share(file.id, draft);
      if (grant.token) setResultLink(`${window.location.origin}/share/${grant.token}`);
      else close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The preprod grant failed.');
    } finally {
      setSaving(false);
    }
  };

  const updateClaim = (field: PolicyCondition['field'], value: string) => setConditions((items) => items.map((item) => item.field === field ? { ...item, value } : item));
  const invalid = !selectedPermissions.length || (method === 'policy' ? conditions.some((item) => !item.value.trim()) : !recipient.trim());

  return (
    <Modal open={Boolean(file)} onClose={close} wide className="share-modal">
      {file && <div className="share-workspace">
        <section className="share-builder">
          <header className="share-title"><span className="file-glyph"><FileIcon item={file} size={24} /></span><div><h2>Share {file.name}</h2><p>{file.privacy} · encrypted</p></div></header>
          <div className="share-tabs">
            {([['wallet', Wallet, 'Veil ID'], ['policy', ShieldCheck, 'Credential'], ['external', LinkIcon, 'Link']] as const).map(([value, Icon, label]) => <button key={value} onClick={() => setMethod(value)} className={method === value ? 'is-active' : ''}><Icon size={18} weight="light" />{label}</button>)}
          </div>

          {method === 'policy' ? <div className="share-step">
            <span className="step-number">1</span><div><h3>Required credential</h3></div>
            <div className="conditions-list">{conditions.map((condition) => <label className="field" key={condition.id}><span>{condition.field}</span><input className="input" value={condition.value} onChange={(event) => updateClaim(condition.field, event.target.value)} /></label>)}</div>
          </div> : <div className="share-step">
            <span className="step-number">1</span><div><h3>{method === 'wallet' ? 'Recipient Veil ID' : 'Private link label'}</h3></div>
            <label className="field share-recipient"><span>{method === 'wallet' ? '64-character Veil ID' : 'Recipient'}</span><input className="input" value={recipient} onChange={(event) => setRecipient(event.target.value)} /></label>
          </div>}

          <div className="share-step share-controls">
            <span className="step-number">2</span><div><h3>Access</h3></div>
            <div className="control-row">
              <label className="field"><span>Expires</span><select className="select" value={expires} onChange={(event) => setExpires(event.target.value)}><option value="1-hour">1 hour</option><option value="24-hours">24 hours</option><option value="7-days">7 days</option><option value="30-days">30 days</option><option value="never">Never</option></select></label>
              <label className="toggle-row"><span><strong>One-time</strong></span><input type="checkbox" checked={oneTime} onChange={(event) => setOneTime(event.target.checked)} /><i /></label>
            </div>
          </div>

          <div className="share-step">
            <span className="step-number">3</span><div><h3>Permissions</h3></div>
            <div className="permission-grid">{permissions.map((permission) => <button key={permission} className={selectedPermissions.includes(permission) ? 'is-active' : ''} onClick={() => setSelectedPermissions((items) => items.includes(permission) ? items.filter((item) => item !== permission) : [...items, permission])}>{permission}{selectedPermissions.includes(permission) && <Check size={15} weight="bold" />}</button>)}</div>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <footer className="share-actions"><Button tone="primary" onClick={create} disabled={saving || invalid}>{saving ? 'Committing…' : 'Create access'}</Button><Button tone="quiet" trailing={false} onClick={close}>Cancel</Button></footer>
          {resultLink && <div className="share-result"><strong>Private link</strong><input className="input" readOnly value={resultLink} /><Button tone="secondary" onClick={() => navigator.clipboard.writeText(resultLink)}>Copy</Button></div>}
        </section>
        <aside className="privacy-inspector"><ShieldCheck size={30} weight="thin" /><h3>On Midnight</h3><p>Authorization, expiry, consumption, and revocation.</p><h3>Private</h3><p>File bytes, readable metadata, and credential values.</p></aside>
      </div>}
    </Modal>
  );
};
