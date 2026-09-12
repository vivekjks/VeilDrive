import { BracketsCurly, Check, Copy, Key, Plus, TerminalWindow, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { formatDate } from '../lib/format';
import { useAppStore } from '../store/AppStore';

const code = `import { VeilDriveClient } from '@veildrive/sdk';

const veil = new VeilDriveClient({
  network: 'preprod',
  wallet: midnightWallet,
});

const receipt = await veil.files.register({
  commitment,
  metadataCommitment,
  privacy: 'confidential',
});

await veil.access.grant(receipt.fileId, {
  policy: { department: 'Legal', active: true },
  permissions: ['view'],
  expiresAt: '2026-09-18T18:00:00Z',
});`;

export const DeveloperPage = () => {
  const { state, actions } = useAppStore();
  const [keyOpen, setKeyOpen] = useState(false);
  const [label, setLabel] = useState('Local integration');
  const [secret, setSecret] = useState('');
  return <section className="page developer-page"><header className="page-heading"><div><span className="eyebrow">Developer platform</span><h1>Privacy infrastructure, composable.</h1><p>Use the typed SDK and API surfaces without rebuilding encryption or private authorization.</p></div><Button tone="primary" onClick={() => setKeyOpen(true)}><Plus size={16} /> Create API key</Button></header><div className="developer-grid"><section className="code-panel"><header><span><TerminalWindow size={18} weight="light" /> TypeScript SDK</span><button onClick={() => navigator.clipboard.writeText(code)}><Copy size={14} /> Copy</button></header><pre><code>{code}</code></pre></section><aside className="sdk-features"><BracketsCurly size={34} weight="thin" /><h2 className="serif">One client. Three private surfaces.</h2><div><span>Files</span><p>Encrypt, register, version, download, verify.</p></div><div><span>Access</span><p>Grant, prove, consume, expire, revoke.</p></div><div><span>Credentials</span><p>Issue commitments and prove policy claims.</p></div></aside></div><section className="api-key-section"><header><div><span className="overline">Credentials</span><h2>API keys</h2></div><p>Secrets are shown once. Only a prefix is stored in VeilDrive.</p></header><div className="api-key-list">{state.apiKeys.map((key) => <article key={key.id} className={key.revokedAt ? 'is-revoked' : ''}><span><Key size={20} weight="light" /></span><div><strong>{key.label}</strong><code>{key.prefix}••••••••••</code></div><span>Created {formatDate(key.createdAt)}</span><span>{key.lastUsedAt ? `Used ${formatDate(key.lastUsedAt)}` : 'Never used'}</span>{key.revokedAt ? <em>Revoked</em> : <button onClick={() => actions.revokeApiKey(key.id)}><Trash size={15} /> Revoke</button>}</article>)}{state.apiKeys.length === 0 && <div className="empty-state"><Key size={38} weight="thin" /><h3>No API keys yet</h3><p>Create a scoped key for a server-side integration.</p></div>}</div></section><section className="api-reference"><span className="overline">HTTP API</span><h2>Small surface. Strong guarantees.</h2><div><code>POST /v1/files/commitments</code><span>Register encrypted file commitment</span></div><div><code>POST /v1/access/grants</code><span>Create wallet, team, policy, or external grant</span></div><div><code>POST /v1/proofs/verify</code><span>Verify a selective-disclosure proof</span></div><div><code>DELETE /v1/access/grants/:id</code><span>Revoke future authorized retrievals</span></div></section><Modal open={keyOpen} onClose={() => { setKeyOpen(false); setSecret(''); }} title="Create a scoped API key">{secret ? <div className="secret-reveal"><span><Check size={28} /></span><h3>Copy this secret now</h3><p>It will not be shown again.</p><code>{secret}</code><Button tone="secondary" onClick={() => navigator.clipboard.writeText(secret)}><Copy size={15} /> Copy secret</Button></div> : <form className="simple-form" onSubmit={async (event) => { event.preventDefault(); const created = await actions.createApiKey(label); setSecret(created.secret); }}><label className="field"><span>Key label</span><input className="input" value={label} onChange={(event) => setLabel(event.target.value)} /></label><p>This key can register commitments and request proofs. Wallet transaction approval is still required for on-chain writes.</p><footer className="modal-actions"><Button tone="primary">Create key</Button></footer></form>}</Modal></section>;
};
