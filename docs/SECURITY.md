# Security model

## Protected

- File bytes and readable metadata are encrypted before persistence.
- Each version uses a fresh content key and fresh AES-GCM IVs.
- The device wrapping key is unexportable and stored using IndexedDB structured cloning.
- Contract private witnesses are encrypted at rest by the Midnight level private-state provider.
- File, grant, credential, policy, and audit identifiers are domain-separated before Compact calls.
- Failed preprod file registrations remove the orphaned local ciphertext.
- Invalid, expired, revoked, or consumed external capabilities do not reveal file metadata.
- PWA caching excludes proving keys, ZKIR/compiler assets, and WASM.

## Explicit limitations

- The included blob provider is device-local. Opening a capability on another browser requires a deployed encrypted object-storage/key-envelope service.
- A recipient can copy plaintext after legitimate decryption. This is not DRM.
- Revocation stops future contract authorization; robust group offboarding also rotates and re-wraps keys.
- Recovery guardians in this build are a planning/control surface, not a deployed threshold-recovery cryptosystem.
- The product has no demo receipt mode. An on-chain action fails visibly when a preprod wallet or contract is unavailable.
- Credential claims must be provisioned into the holder’s private witness out of band. Issuing a ledger commitment does not itself disclose or transport the claim material.

## Operational recommendations

- Run only the pinned proof-server image and bind it to loopback.
- Treat `public/keys` as large public proving assets; they contain no user witness data.
- Serve production builds over HTTPS with strict CSP, frame protection, and immutable hashed assets.
- Use a dedicated encrypted blob service with authenticated upload URLs for multi-device deployments.
- Back up wallet recovery material independently; VeilDrive cannot recover wallet secrets.
- Rotate workspace keys whenever a member is offboarded from highly sensitive content.

## Reporting

Do not include private files, wallet secrets, seed phrases, signed witness payloads, or API secrets in an issue report. Provide only reproducible steps and sanitized transaction/contract identifiers.
