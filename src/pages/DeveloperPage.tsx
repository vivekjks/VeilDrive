import { BracketsCurly, Copy, ShieldCheck, TerminalWindow } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '../components/Button';

const code = `import {
  registerFileOnMidnight,
  verifyFileOnMidnight,
} from './lib/midnight-contract';

const txId = await registerFileOnMidnight(
  fileId,
  encryptedBlobCommitment,
  encryptedMetadataCommitment,
);

await verifyFileOnMidnight(fileId, encryptedBlobCommitment);`;

const circuits = [
  'registerFile · updateFile · revokeFile · verifyCommitment · verifyFileVersion',
  'grantAccess · proveWalletAccess · consumeWalletAccess · revokeAccess',
  'createAccessPolicy · provePolicyAccess · consumePolicyAccess · revokeAccessPolicy',
  'registerIssuer · issueCredential · revokeCredential',
  'createCapabilityAccess · proveCapabilityAccess · consumeCapabilityAccess · revokeCapabilityAccess',
  'recordAuditEvent · verifyAuditEvent',
  'commitPrivateRecord · verifyPrivateRecord · revokePrivateRecord',
];

export const DeveloperPage = () => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="page developer-page">
      <header className="page-heading"><div><span className="eyebrow">Contract</span><h1>One private state machine.</h1></div></header>
      <div className="developer-grid">
        <section className="code-panel">
          <header><span><TerminalWindow size={18} weight="light" /> Live integration</span><Button tone="quiet" trailing={false} onClick={copy}><Copy size={14} /> {copied ? 'Copied' : 'Copy'}</Button></header>
          <pre><code>{code}</code></pre>
        </section>
        <aside className="sdk-features">
          <BracketsCurly size={34} weight="thin" /><h2 className="serif">Seven proof circuits. 25 guarded operations.</h2>
          {circuits.map((group) => <div key={group}><ShieldCheck size={16} /><p>{group}</p></div>)}
        </aside>
      </div>
    </section>
  );
};
