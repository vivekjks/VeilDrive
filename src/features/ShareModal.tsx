import { Check, EyeSlash, Link as LinkIcon, Plus, ShieldCheck, UsersThree, Wallet } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { FileIcon } from '../components/FileIcon';
import { Modal } from '../components/Modal';
import { useAppStore } from '../store/AppStore';
import type { AccessMethod, DriveItem, Permission, PolicyCondition, ShareDraft } from '../types';
import { randomId } from '../lib/encoding';

interface ShareModalProps { file: DriveItem | null; onClose: () => void; }
const permissions: Permission[] = ['view', 'download', 'edit', 'reshare'];

export const ShareModal = ({ file, onClose }: ShareModalProps) => {
  const { actions } = useAppStore();
  const [method, setMethod] = useState<AccessMethod>('policy');
  const [recipient, setRecipient] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(['view', 'download']);
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<PolicyCondition[]>([
    { id: 'default-org', field: 'organization', operator: 'is', value: 'Northstar Labs' },
    { id: 'default-dept', field: 'department', operator: 'is', value: 'Executive' },
    { id: 'default-status', field: 'credentialStatus', operator: 'is', value: 'Active' },
  ]);
  const [expires, setExpires] = useState('7-days');
  const [oneTime, setOneTime] = useState(false);
  const [resultLink, setResultLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const recipientLabel = useMemo(() => {
    if (method === 'policy') return `${conditions.length} private credential conditions`;
    if (method === 'team') return recipient || 'Northstar Labs';
    if (method === 'external') return recipient || 'External recipient';
    return recipient || 'Wallet recipient';
  }, [conditions.length, method, recipient]);

  const expiry = () => {
    if (expires === 'never') return null;
    const hours = expires === '1-hour' ? 1 : expires === '24-hours' ? 24 : expires === '7-days' ? 168 : 720;
    return new Date(Date.now() + hours * 3_600_000).toISOString();
  };

  const create = async () => {
    if (!file) return;
    setSaving(true);
    setError('');
    try {
      const draft: ShareDraft = { method, recipient: method === 'policy' ? 'private-policy' : recipient, recipientLabel, permissions: selectedPermissions, conditions: method === 'policy' ? conditions : [], logic, expiresAt: expiry(), oneTime };
      const grant = await actions.share(file.id, draft);
      if (grant.token) setResultLink(`${window.location.origin}/share/${grant.token}`);
      else close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the access grant.');
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    setResultLink('');
    setError('');
    onClose();
  };

  const updateCondition = (id: string, patch: Partial<PolicyCondition>) => setConditions((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));

  return (
    <Modal open={Boolean(file)} onClose={close} wide className="share-modal">
      {file && (
        <div className="share-workspace">
          <section className="share-builder">
            <header className="share-title"><span className="file-glyph"><FileIcon item={file} size={24} /></span><div><h2>Share {file.name}</h2><p>Encrypted metadata · {file.privacy} privacy</p></div></header>
            <div className="share-tabs">
              {([['wallet', Wallet, 'Person'], ['team', UsersThree, 'Team'], ['policy', ShieldCheck, 'Private rule'], ['external', LinkIcon, 'External']] as const).map(([value, Icon, label]) => <button key={value} onClick={() => setMethod(value)} className={method === value ? 'is-active' : ''}><Icon size={18} weight="light" />{label}</button>)}
            </div>

            {method === 'policy' ? (
              <div className="share-step">
                <span className="step-number">1</span><div><h3>Define who can access</h3><p>All conditions are proven privately. The underlying credential fields stay hidden.</p></div>
                <div className="logic-row">
                  <select className="select logic-select" value={logic} onChange={(event) => setLogic(event.target.value as 'AND' | 'OR')}><option>AND</option><option>OR</option></select>
                  <div className="conditions-list">
                    {conditions.map((condition) => (
                      <div className="condition" key={condition.id}>
                        <select className="select" value={condition.field} onChange={(event) => updateCondition(condition.id, { field: event.target.value as PolicyCondition['field'] })}><option value="organization">Organization</option><option value="department">Department</option><option value="role">Role</option><option value="credentialStatus">Credential status</option><option value="age">Age</option><option value="balance">Balance</option></select>
                        <select className="select" value={condition.operator} onChange={(event) => updateCondition(condition.id, { operator: event.target.value as PolicyCondition['operator'] })}><option value="is">is</option><option value="isNot">is not</option><option value="greaterThan">greater than</option><option value="lessThan">less than</option></select>
                        <input className="input" value={condition.value} onChange={(event) => updateCondition(condition.id, { value: event.target.value })} />
                        <button className="icon-button" aria-label="Remove condition" onClick={() => setConditions((items) => items.filter((item) => item.id !== condition.id))}>×</button>
                      </div>
                    ))}
                    <button className="add-condition" onClick={() => setConditions((items) => [...items, { id: randomId('condition'), field: 'role', operator: 'is', value: '' }])}><Plus size={16} weight="light" />Add condition</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="share-step">
                <span className="step-number">1</span><div><h3>{method === 'wallet' ? 'Share with a wallet' : method === 'team' ? 'Choose a private team' : 'Create a secure external link'}</h3><p>{method === 'external' ? 'The link still requires the controls you set below.' : 'Only the encrypted key envelope is addressed to this recipient.'}</p></div>
                <label className="field share-recipient"><span>{method === 'wallet' ? 'Midnight wallet address' : method === 'team' ? 'Workspace or team' : 'Recipient label or email'}</span><input className="input" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder={method === 'wallet' ? 'mn_addr_preprod1…' : method === 'team' ? 'Northstar · Executive' : 'Investor group'} /></label>
              </div>
            )}

            <div className="share-step share-controls"><span className="step-number">2</span><div><h3>Control how they can access</h3><p>Expiration prevents new retrievals. One-time access is consumed after one authorized session.</p></div><div className="control-row"><label className="field"><span>Expiration</span><select className="select" value={expires} onChange={(event) => setExpires(event.target.value)}><option value="never">Never</option><option value="1-hour">1 hour</option><option value="24-hours">24 hours</option><option value="7-days">7 days</option><option value="30-days">30 days</option></select></label><label className="toggle-row"><span><strong>One-time access</strong><small>Consume after retrieval</small></span><input type="checkbox" checked={oneTime} onChange={(event) => setOneTime(event.target.checked)} /><i /></label></div></div>
            <div className="share-step"><span className="step-number">3</span><div><h3>Set permissions</h3><p>Plaintext can still be copied once legitimately revealed; these controls govern VeilDrive actions.</p></div><div className="permission-grid">{permissions.map((permission) => <button key={permission} className={selectedPermissions.includes(permission) ? 'is-active' : ''} onClick={() => setSelectedPermissions((items) => items.includes(permission) ? items.filter((item) => item !== permission) : [...items, permission])}>{permission}{selectedPermissions.includes(permission) && <Check size={15} weight="bold" />}</button>)}</div></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <footer className="share-actions"><Button tone="primary" onClick={create} disabled={saving || selectedPermissions.length === 0 || ((method === 'wallet' || method === 'team') && !recipient.trim()) || (method === 'policy' && conditions.some((condition) => !condition.value.trim()))}>{saving ? 'Creating rule…' : method === 'external' ? 'Create secure link' : 'Grant private access'}</Button><Button tone="quiet" trailing={false} onClick={close}>Cancel</Button></footer>
            {resultLink && <div className="share-result"><strong>Secure link created</strong><input className="input" readOnly value={resultLink} /><Button tone="secondary" onClick={() => navigator.clipboard.writeText(resultLink)}>Copy link</Button></div>}
          </section>
          <aside className="privacy-inspector">
            <header><ShieldCheck size={28} weight="light" /><div><h3>Privacy Inspector</h3><p>Exactly what the recipient will and won’t learn.</p></div></header>
            <div><h4>Recipient will learn</h4>{['A protected file exists', `Permissions: ${selectedPermissions.join(', ') || 'none'}`, expires === 'never' ? 'Access does not expire' : `Access expires in ${expires.replace('-', ' ')}`, oneTime ? 'Access can be used once' : 'Access supports repeat sessions'].map((item) => <p key={item}><Check size={15} weight="bold" />{item}</p>)}</div>
            <div><h4>Recipient will not learn</h4>{['Your other files', 'Other recipients', 'Private credential values', 'Internal activity history', 'How the proof was satisfied'].map((item) => <p key={item}><EyeSlash size={15} weight="light" />{item}</p>)}</div>
            <footer><ShieldCheck size={19} weight="light" /><span><strong>Maximum privacy. Minimum friction.</strong><small>Share what matters. Keep what doesn’t.</small></span></footer>
          </aside>
        </div>
      )}
    </Modal>
  );
};
