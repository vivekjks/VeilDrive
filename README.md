# VeilDrive

**Your files. Your keys. Your privacy.**

VeilDrive is a privacy-first encrypted drive and proof exchange for Midnight preprod. It encrypts files and readable metadata in the browser, keeps ciphertext in a device-local vault, and uses a real Compact contract for ownership, commitments, access grants, credentials, policies, revocation, one-time access, and verifiable audit records.

![VeilDrive encrypted data core](public/assets/veil-core.png)

## Product overview

VeilDrive gives users a familiar drive interface without putting documents, filenames, comments, credential claims, or identity secrets on-chain. Midnight is the authorization and proof layer—not the large-file storage layer.

The application starts empty. It contains no demo files, fake users, seeded grants, or fabricated transaction receipts. A receipt appears only after a wallet submits a real Midnight preprod transaction.

## Feature status

| Area | Implemented behavior |
| --- | --- |
| Encrypted drive | Upload, preview, download, folders, search, sort, tags, favorites, trash, restore, comments, and version history |
| File integrity | Salted document commitments, current and historical version verification, and preprod transaction receipts |
| Direct sharing | Holder-bound Veil ID grants with view, download, edit, and reshare permission masks |
| Policy sharing | Credential-claim commitments, AND/OR conditions, expiry, revocation, and one-time consumption |
| External access | Secret capability commitments, expiry, permission controls, proof, consume, and revoke operations |
| Organizations | Workspaces, member roles, private member records, issuer registration, credential issue/import/revoke flows |
| Data rooms | Confidential room records, participants, expiry, credential requirements, and file organization |
| Governance | Access requests, private audit commitments, privacy presets, notifications, recovery-contact records, and API-key records |
| Wallet and network | DApp Connector API v4 discovery for compatible Lace and 1AM wallets on Midnight preprod |
| Delivery | Responsive PWA, offline app shell, reduced-motion support, production Vite build, and Vercel configuration |

## Privacy architecture

```text
Browser / PWA
  ├─ Web Crypto: AES-256-GCM content + metadata encryption
  ├─ Unexportable AES-256-KW device key: wraps each file key
  ├─ IndexedDB: encrypted state, wrapped keys, and encrypted blobs
  ├─ Wallet: signs identity unlocks and submits transactions
  └─ Midnight JS
       ├─ encrypted private-state database
       ├─ local proof server at http://localhost:6300
       ├─ preprod indexer and node
       └─ VeilDrive Compact registry
```

Midnight receives opaque, domain-separated identifiers and commitments plus the policy controls needed by the contract. It does not receive plaintext file bytes, readable names, comments, capability secrets, the local identity secret, or raw credential claims.

### Upload and version flow

1. The browser generates a random AES-256-GCM file key and independent content and metadata IVs.
2. File bytes and readable metadata are encrypted locally.
3. The per-file key is wrapped by an unexportable AES-256-KW device key.
4. Ciphertext is stored under an opaque IndexedDB blob identifier.
5. VeilDrive computes a randomly salted content commitment and an encrypted-metadata commitment.
6. The wallet proves ownership and submits the commitment through `fileOperation` on Midnight preprod.
7. Only after submission succeeds does the UI show an on-chain transaction receipt. Ambiguous or failed writes stay in a visible local retry queue.

File updates preserve the same shape and add an immutable commitment to the contract’s version map.

### Access flow

- **Wallet grants:** the owner grants a permission mask to a recipient’s Veil ID. Proving or consuming access requires the recipient’s private identity witness.
- **Credential policies:** an issuer commits a holder and private claim set. Policies compare claim commitments without publishing the raw claims, and enforce expiry, revocation, and one-time use.
- **External capabilities:** the owner shares a random secret off-chain; only its commitment is registered. Presenting the secret satisfies the capability witness, subject to expiry and revocation.
- **Private records:** workspace, room, comment, request, guardian, and API-key state remains encrypted off-chain while versioned commitments provide on-chain integrity anchors.

### Contract design

The Compact contract contains 25 guarded feature operations behind seven deployable proof-circuit dispatchers:

| Circuit | Operations |
| --- | --- |
| `fileOperation` | register, update, verify current, verify version, revoke |
| `walletAccessOperation` | grant, revoke, prove, consume |
| `credentialOperation` | register issuer, issue, revoke |
| `policyAccessOperation` | create, revoke, prove, consume |
| `capabilityAccessOperation` | create, prove, consume, revoke |
| `auditOperation` | record, verify |
| `privateRecordOperation` | commit, revoke, verify |

The dispatcher design keeps all features in one shared state machine, so revoking a file invalidates its dependent authorization paths. It also keeps the deployment below preprod’s transaction block limit by reducing the initial verifier-key payload. The TypeScript layer exposes named functions, so application code never uses numeric action selectors directly.

The administrator’s private identity witness becomes the initial issuer. Owner checks, administrator checks, claim checks, permission bounds, active state, expiry, consumption, and revocation are enforced inside Compact.

## Security guarantees and boundaries

VeilDrive provides local encryption, commitment integrity, private-witness authorization, and contract-enforced future access decisions. It deliberately does not claim DRM: revocation prevents future successful authorization proofs but cannot erase plaintext or a key a recipient already obtained.

The included ciphertext provider is IndexedDB on the current device. Therefore:

- deployed Vercel clients can use the on-chain registry, but encrypted blobs do not automatically move between devices;
- an external link or collaborator can prove authorization, but cross-device blob and key delivery requires a separately deployed encrypted object-storage and key-envelope service;
- recovery contacts are encrypted governance records, not a cryptographic key-recovery protocol;
- clearing browser storage destroys locally held ciphertext and wrapped keys unless they were exported elsewhere.

These limits are surfaced instead of replaced with dummy network data. See [Security model](docs/SECURITY.md) for the detailed threat boundary.

## Prerequisites

- Node.js 22 or newer
- pnpm 11
- WSL2 on Windows for the Compact compiler image
- Docker available inside WSL, or Docker on Linux/macOS
- A DApp Connector API v4-compatible wallet configured and funded for Midnight preprod

The compatible stack is pinned: Midnight JS `4.1.1`, DApp Connector API `4.0.1`, Compact compiler `0.31.1`, ledger `8.1.0`, on-chain runtime `3.0.0`, and proof server `8.1.0`.

## Local development

```bash
pnpm install
pnpm contract:compile:wsl
pnpm proof-server
pnpm dev
```

Open `http://localhost:5173`, connect a compatible wallet, and choose **Settings → Deploy new registry**. To use an existing registry, enter its complete address and choose **Join registry**.

On Windows, the proof-server command runs Docker through WSL and reuses the named container:

```bash
pnpm proof-server:status
pnpm proof-server:stop
```

Use the [preprod faucet](https://midnight-tmnight-preprod.nethermind.dev/) when the wallet needs NIGHT or DUST. Deployment and every contract write require wallet approval and sufficient balance.

## Verification

```bash
pnpm check
pnpm --dir sdk build
```

`pnpm check` runs ESLint, browser cryptography/state-vault tests, all Compact simulator tests, SDK tests, binding generation, proof-asset synchronization, TypeScript, and the optimized production build.

Individual commands:

```bash
pnpm lint
pnpm test
pnpm contract:test
pnpm build
```

## Production deployment

The repository includes `vercel.json`. Build and deploy with:

```bash
vercel --prod
```

Vercel serves the static PWA and its proving assets. Midnight JS deliberately connects the user’s browser to a loopback proof service, so each production user still needs the pinned proof server reachable at `http://localhost:6300`. A hosted proving service is not silently substituted because proof requests may contain private witness material.

For a release, run `pnpm check`, deploy, open the production URL in Chrome, connect a preprod wallet, run the endpoint health check, join/deploy the registry, and confirm a real write and explorer receipt.

## Project structure

```text
contract/                    Compact state machine, private witnesses, tests
contract/src/managed/        Generated bindings, ZKIR, prover/verifier keys
sdk/                         Typed standalone SDK and transport interface
scripts/                     Contract asset sync and proof-service helpers
src/lib/crypto.ts            Encryption, wrapping, and commitment utilities
src/lib/indexed-db.ts        Encrypted browser persistence and blob vault
src/lib/midnight.ts          Wallet discovery and preprod health checks
src/lib/midnight-contract.ts Named contract operations and providers
src/store/AppStore.tsx       Application workflows and atomic state updates
src/pages/                   Drive, sharing, proofs, rooms, admin, settings
public/assets/               Generated visual assets used by the interface
docs/                        Architecture, security, and preprod runbook
```

More detail: [Architecture](docs/ARCHITECTURE.md), [Security model](docs/SECURITY.md), and [Preprod runbook](docs/PREPROD.md).

## Midnight references

- [Wallet integration](https://docs.midnight.network/sdks/community/wallets/community-wallets-integration)
- [DApp Connector API](https://docs.midnight.network/api-reference/dapp-connector)
- [Compact installation and compiler](https://docs.midnight.network/develop/tutorial/using/chrome-ext)
- [Network endpoints](https://docs.midnight.network/relnotes/midnight-node)

## License

Apache-2.0. See [LICENSE](LICENSE).
