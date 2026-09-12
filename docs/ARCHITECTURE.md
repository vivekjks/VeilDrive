# VeilDrive architecture

## Trust split

VeilDrive separates ciphertext transport from private authorization:

```text
Browser / PWA
  ├─ Web Crypto: encrypt content + metadata, wrap per-file keys
  ├─ IndexedDB: ciphertext and unexportable wrapping key
  ├─ Wallet connector: balance and submit transactions
  └─ Midnight JS providers
       ├─ encrypted private-state database
       ├─ proving keys served from the app origin
       ├─ loopback proof server at localhost:6300
       ├─ preprod indexer
       └─ VeilDrive Compact contract
```

The storage provider never receives plaintext. Midnight never receives the file bytes, names, comments, private identity secret, or raw credential claims. It receives domain-separated identifiers, SHA-256 commitments, permission masks, lifecycle controls, and proof/audit commitments.

## Upload transaction

1. Generate an AES-256-GCM file key and independent content/metadata IVs.
2. Encrypt file bytes and JSON metadata locally.
3. Wrap the file key using an unexportable AES-256-KW device key.
4. Store ciphertext by an opaque blob ID in IndexedDB.
5. Compute a randomly salted plaintext commitment and an encrypted-metadata commitment.
6. Call `registerFile` on preprod. If submission fails or is ambiguous, retain the local ciphertext without presenting it as registered.

Version updates follow the same transaction shape. Local encrypted bytes are retained across ambiguous network failures.

## Identity and access

The wallet’s payment/address surface is not used as a Compact identity. VeilDrive deterministically unlocks an encrypted private witness using `signData`, derives `identityCommitment(secretKey)`, and exposes that value as the user’s **Veil ID**. Direct grants target this 32-byte identity commitment.

Team sharing creates a credential policy. Policy grants compare the credential’s claim commitment with the policy’s required-claim commitment and verify that the connected private witness belongs to the credential holder. Expiry, revocation, and one-time consumption are enforced by contract circuits.

## Contract surface

The contract implements 25 guarded state operations behind seven exported proof-circuit dispatchers. This keeps every authorization and lifecycle check in one shared state machine while reducing the verifier-key payload of the initial deployment.

| Exported circuit | Guarded operations |
| --- | --- |
| `fileOperation` | register, update, revoke, verify current commitment, verify historical version |
| `walletAccessOperation` | grant, revoke, prove, consume |
| `credentialOperation` | register issuer, issue, revoke |
| `policyAccessOperation` | create, revoke, prove, consume |
| `capabilityAccessOperation` | create, revoke, prove, consume |
| `auditOperation` | record, verify |
| `privateRecordOperation` | commit, verify, revoke |

The browser integration exposes descriptive TypeScript functions such as `registerFileOnMidnight` and `revokeWalletAccessOnMidnight`; callers do not handle dispatcher action numbers directly.

The deployed administrator is automatically registered as the first credential issuer.

## Build assets

The Compact compiler emits contract bindings, ZKIR, prover keys, verifier keys, and compiler metadata beneath `contract/src/managed/veil-drive`. `scripts/sync-zk-assets.mjs` copies only runtime proof assets to the static public directories before dev/build. Those large copies are ignored; the canonical compiler output is Git LFS-ready.

The seven-dispatcher layout is also a deployment constraint: the original 25-export build exceeded the preprod block limit while calculating the deployment fee because every exported state circuit contributes a verifier key. Dispatching keeps the same feature operations and tests while lowering the initial verifier-key payload.
