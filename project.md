 

# Project Name: **VeilDrive**

**Tagline:** *Your files. Your keys. Your privacy.*

**One-line pitch:**
**VeilDrive is a privacy-first decentralized cloud drive built with Midnight, where files are encrypted before upload and Midnight smart contracts privately control who can access, share, verify, or revoke access to them.**

The key difference from a normal decentralized storage project is that **Midnight is not necessarily where we dump large files**. Midnight is the **privacy + authorization + proof layer** of the application.

---

# 1. What exactly is VeilDrive?

Imagine combining:

**Google Drive + end-to-end encryption + wallet identity + private access rules + zero-knowledge proofs + verifiable document history.**

Suppose a company has:

```text
Acme Workspace

├── Engineering
│   ├── architecture.pdf
│   └── source-backup.zip
│
├── Finance
│   ├── payroll.xlsx
│   └── revenue.xlsx
│
└── Legal
    └── contracts.pdf
```

In Google Drive, access is generally tied to accounts and conventional server-side authorization.

VeilDrive introduces cryptographic authorization.

A Finance document could have a rule such as:

```text
Can access if:

Employee = TRUE
AND
Department = Finance
AND
Credential = Valid
```

A person could prove that those conditions are satisfied **without publicly revealing all of their underlying credential data**.

That selective-disclosure model is exactly the kind of privacy functionality Midnight is designed around. 

---

# 2. The most important architecture decision

Don't build:

> Upload file → put file directly on blockchain.

Instead:

```text
                VEILDRIVE

        ┌─────────────────────┐
        │    Web / Mobile UI  │
        └──────────┬──────────┘
                   │
             Encrypt locally
                   │
        ┌──────────▼──────────┐
        │ Encrypted File      │
        │ Storage Layer       │
        └──────────┬──────────┘
                   │
            encrypted blob
                   │
                   │
      ┌────────────▼────────────┐
      │       MIDNIGHT          │
      │                         │
      │ Private permissions     │
      │ Access policies         │
      │ Credential proofs       │
      │ File commitments        │
      │ Sharing/revocation      │
      │ Private audit proofs    │
      └─────────────────────────┘
```

This separation is important.

### Storage layer

Stores:

* encrypted PDFs
* encrypted images
* encrypted videos
* encrypted ZIPs
* encrypted documents

Possible storage could eventually be decentralized storage or conventional object storage depending on what you choose.

### Midnight

Handles things like:

* who is authorized
* private roles
* access policies
* proof verification
* file commitments/hashes
* revocation
* private sharing state
* verifiable events

That gives Midnight an actual reason to exist in the architecture.

---

# 3. How file upload works

Let's say Alice uploads:

**company-strategy.pdf**

### Step 1 — Select file

Alice clicks:

```text
+ Upload

company-strategy.pdf
24.6 MB
```

### Step 2 — Generate encryption key

Her browser generates a random symmetric encryption key.

Conceptually:

```text
File Key

K = random encryption key
```

### Step 3 — Encrypt locally

Before the file leaves Alice's device:

```text
company-strategy.pdf
        ↓
     Encrypt
        ↓
8Hsj2ks92ksEncryptedBlob...
```

The storage provider receives the **encrypted version**, not the readable document.

### Step 4 — Upload encrypted blob

```text
Encrypted File
      ↓
Storage Layer
      ↓
CID / Object ID / Storage reference
```

### Step 5 — Create file commitment

We calculate something like:

```text
Hash(original file)

→ file commitment
```

That commitment can later help prove that a particular document is the same document that was registered earlier.

### Step 6 — Midnight state

The Compact contract can manage privacy-sensitive information associated with the file/access policy.

Conceptually:

```text
File ID
File commitment
Owner
Access policy
Authorized credentials/users
Revocation state
```

The exact split between public and private state would be decided during implementation.

---

# 4. User POV — first time opening VeilDrive

Imagine you're the user.

You visit:

```text
veil.drive
```

You see:

> **Private cloud storage without giving up control of your data.**

**[ Connect Wallet ]**

You connect your compatible wallet.

---

# 5. Your Drive

After login:

```text
Good morning, Alice

My Drive                         + Upload

Storage
████████░░░░░░░
3.2 GB

Recent

📁 Company
📁 Personal
📁 Shared With Me

📄 pitch-deck.pdf
📄 agreement.pdf
📄 research.pdf
🖼 design.png
```

It should feel familiar.

That's intentional.

We don't want users thinking:

> "How do I operate this weird ZK blockchain application?"

We want:

> "This feels like Drive, except my privacy is cryptographically controlled."

---

# 6. Sharing a normal file

Alice has:

```text
📄 pitch-deck.pdf
```

She clicks:

**Share**

VeilDrive offers multiple sharing methods.

### Option A — Share with wallet

```text
Share with

Wallet:
midnight1.....xyz

Permission:

○ View
○ Download
○ Edit
○ Reshare

[ Grant Access ]
```

The recipient gets access to the encrypted file/key according to the authorization scheme.

---

# 7. Private rule-based sharing

This is where the project becomes much more interesting.

Instead of selecting a particular person:

**Share → Private Access Rule**

Alice could create:

```text
ACCESS REQUIREMENTS

✓ Verified Acme employee
✓ Engineering department
✓ Active credential

Identity disclosure:
NONE

[ Create Private Access Rule ]
```

Now Bob wants the file.

Bob doesn't necessarily have to reveal:

```text
Bob Smith
Employee ID: 84721
Department: Engineering
...
```

Instead, Bob proves:

```text
Verified Employee       ✓

Engineering Department  ✓

Credential Active       ✓
```

The application verifies the required facts.

If valid:

```text
ACCESS APPROVED ✓
```

The underlying sensitive credential information doesn't need to be disclosed just to satisfy the rule.

---

# 8. Why Zero-Knowledge matters

This distinction will be very important in your hackathon pitch.

A normal app asks:

> **"Give me the information so I can verify it."**

VeilDrive aims for:

> **"Prove that the required condition is true without revealing unnecessary information."**

For example:

```text
NORMAL SYSTEM

Employee ID → server
Name        → server
Department  → server
Credential  → server

Server checks everything.
```

Versus:

```text
VEILDRIVE

Private credential
       ↓
ZK / privacy-preserving verification
       ↓
"Engineering employee = TRUE"
       ↓
Access
```

That's the Midnight story.

---

# 9. Private team workspaces

This should be one of the major features.

Example:

```text
ACME CORPORATION

Members: 28

─────────────────────

📁 General

📁 Engineering
   🔐 Engineering only

📁 Finance
   🔐 Finance only

📁 Executives
   🔐 Executive credential required

📁 Legal
   🔐 Legal team only
```

Permissions can be associated with credentials/roles rather than just maintaining giant public membership lists.

---

# 10. Private credentials

Organizations could issue credentials.

For example:

```text
ACME EMPLOYEE CREDENTIAL

Organization: Acme
Department: Engineering
Role: Developer
Status: Active
```

These credentials can participate in access proofs.

A user could prove:

```text
"I am an active Acme Engineering employee."
```

without needing to reveal every field of their credential.

This is particularly aligned with the hackathon because identity credentials that users can verify privately are one of the use cases described for Midnight. 

---

# 11. Revoking access

Alice shares:

```text
secret-plan.pdf
```

with Bob.

Later Bob leaves the company.

Admin goes:

```text
Members

Bob
Engineering

Access: ACTIVE

[ Revoke ]
```

Bob's authorization is revoked.

For robust cryptographic revocation, we'd also need to design **key rotation/re-encryption** appropriately. Simply changing an on-chain permission cannot magically make Bob forget a decryption key he already obtained.

That's an important security detail I would explicitly account for rather than overclaiming.

---

# 12. Expiring files

When sharing:

```text
ACCESS EXPIRATION

○ Never

○ 1 hour

○ 24 hours

○ 7 days

● Custom
  Sep 30, 2026 6:00 PM
```

After the deadline, the application stops granting new authorized access.

This is useful for:

* investor documents
* legal files
* client deliverables
* confidential reports
* temporary contractors

---

# 13. One-time access

Another cool feature:

```text
secret-document.pdf

Access Type

● ONE-TIME ACCESS
```

Recipient proves authorization.

They get one authorized retrieval/session.

Then the permission becomes consumed.

Again, the product should clearly distinguish this from DRM: once someone legitimately obtains plaintext, software cannot guarantee they didn't save/copy it.

---

# 14. Proof of document existence

This is one of my favorite features.

Suppose you've created:

```text
research-paper.pdf
```

on September 12.

VeilDrive can commit the document's hash.

Later there's a dispute about when the document existed.

You can present the document and verify that it matches the earlier commitment.

Conceptually:

```text
research-paper.pdf

SHA / commitment
      ↓
0x83ba72...

Registered:
12 Sep 2026
```

Later:

```text
Document
   ↓
Hash
   ↓
Compare commitment
   ↓

MATCH ✓
```

This provides evidence that the exact file corresponding to that commitment existed/was registered by that point, without requiring the original file to be public.

---

# 15. Private audit trail

For business users, this could become a major feature.

Normal audit systems might expose a lot:

```text
Alice uploaded salary.xlsx
Bob viewed salary.xlsx
Charlie downloaded salary.xlsx
...
```

Instead, VeilDrive can be designed so that sensitive audit information remains private while authorized parties can produce proofs about specific questions.

For example:

> "Was this document accessed by an authorized user?"

Result:

```text
AUTHORIZED ACCESS VERIFIED ✓
```

without necessarily exposing every person's activity.

This is an area where the exact privacy guarantees would depend heavily on what goes into Midnight's public/private state.

---

# 16. Request Access

Suppose Bob finds:

```text
🔒 Q4-Strategy.pdf

You don't currently have access.
```

Instead of failing:

**[ Request Access ]**

Alice receives:

```text
ACCESS REQUEST

Q4-Strategy.pdf

Requester:
Bob

Requested:
View

[ Reject ] [ Grant ]
```

Or Bob could satisfy an existing credential rule automatically:

```text
Required:

✓ Employee
✓ Strategy Team
✓ Active credential

Generate proof?

[ Generate Proof ]
```

---

# 17. Secure external sharing

You also want users who aren't part of the organization.

Alice chooses:

```text
Share → External
```

Possible controls:

```text
Expires: 24 hours

Require:
☑ Wallet verification
☑ Credential proof

Permission:
☑ View
☐ Download
☐ Reshare
```

This gives you a privacy-focused alternative to:

> "Anyone with the link."

---

# 18. Encrypted metadata

This is an advanced feature that could differentiate VeilDrive considerably.

Encrypting only file contents isn't enough.

Metadata itself can leak information.

Imagine a storage provider sees:

```text
Acquisition-of-Company-X.pdf
Employee-Termination-John.pdf
2027-Layoff-Plan.xlsx
```

Even without seeing contents, filenames reveal a lot.

So an advanced VeilDrive version could encrypt:

* filenames
* folder names
* descriptions
* tags
* comments
* selected ownership/sharing metadata

Storage might see:

```text
f_8h291.enc
f_88aj2.enc
f_12hs9.enc
```

instead.

---

# 19. Encrypted comments

Inside a file:

```text
contract.pdf

COMMENTS

Alice:
Change clause 4.

Bob:
Legal approved the revision.
```

Comments can also be encrypted for authorized collaborators.

This makes VeilDrive more like an actual collaboration platform rather than merely storage.

---

# 20. File version history

Google Drive users expect versions.

```text
pitch.pdf

VERSION HISTORY

v1   Sep 10
v2   Sep 11
v3   Sep 12 ← Current
```

Each version can have:

* encrypted file
* commitment/hash
* timestamp
* authorized access policy
* version relationship

This could make document integrity demonstrations especially compelling.

---

# 21. Verify a downloaded file

Suppose Bob downloads a contract.

Later he wants to ensure nobody substituted another file.

VeilDrive:

```text
Verify Document

[ Upload contract.pdf ]

Checking...

File commitment ✓
Version ✓
Integrity ✓

DOCUMENT VERIFIED
```

That's a very easy blockchain feature for judges to understand.

---

# 22. Privacy-preserving document requests

This could be a killer feature.

Instead of someone sharing an existing file, another organization requests one.

Example:

```text
University Application

DOCUMENT REQUEST

Required:
Verified Bachelor's Degree

But:

Do NOT reveal:
❌ Student ID
❌ Date of birth
❌ Full transcript
```

The applicant could potentially provide a credential proof rather than uploading the entire document.

Now VeilDrive starts becoming:

**Private Drive + Private Credential Exchange**

That is much more powerful.

---

# 23. Confidential data rooms

Businesses regularly need controlled data rooms for:

* fundraising
* M&A
* investors
* legal due diligence
* partnerships

VeilDrive could offer:

```text
PRIVATE DATA ROOM

Series A Fundraise

📁 Financials
📁 Legal
📁 Product
📁 Cap Table
📁 Contracts

Participants: 7

Privacy Mode: HIGH
```

Investor access could require an approved credential.

Access could expire automatically.

That's a serious commercial use case.

---

# 24. Privacy levels

To make UX simpler, we can create presets.

### Standard

Encrypted file + wallet sharing.

### Private

Encrypted metadata + restricted permissions.

### Confidential

Credential-based access + expiring authorization.

### Maximum Privacy

Minimal public metadata + private authorization + restricted audit disclosure.

The user doesn't have to understand ZK circuits to use the product.

---

# 25. Recovery

This is something many hackathon projects forget.

If everything depends on one wallet and Alice loses it, that's terrible UX.

Eventually VeilDrive could support a recovery design such as:

```text
RECOVERY GUARDIANS

Alice's second wallet
Company admin
Recovery service

Threshold:

2 / 3 approvals required
```

The exact cryptographic recovery mechanism would need careful design, but having recovery in the roadmap makes the product much more realistic.

---

# 26. Organization roles

Organizations could have:

```text
Owner
Admin
Manager
Member
Guest
```

But we can go beyond simple roles.

Policies might be:

```text
ALLOW if:

Organization = Acme
AND

(
 Department = Legal
 OR
 Role = Executive
)

AND

CredentialStatus = Active
```

Then a user's private credentials can satisfy the policy.

---

# 27. What Midnight actually does

This needs to be crystal clear in your presentation.

Midnight describes a **dual-ledger model involving public and private state**, and the hackathon specifically expects teams to understand private-state management. 

We would use that architecture deliberately.

### Midnight/Compact layer

Potential responsibilities:

**1. File registration**

Register commitments associated with files.

**2. Ownership**

Prove/control who can administer a file.

**3. Private access state**

Manage privacy-sensitive authorization information.

**4. Credential verification**

Determine whether a user satisfies an access policy.

**5. Sharing**

Grant authorization.

**6. Revocation**

Invalidate authorization/credentials.

**7. Proof verification**

Verify conditions without unnecessarily exposing underlying private values.

**8. Audit commitments**

Provide verifiable evidence around important actions without making the complete activity history public.

---

# 28. Compact smart contracts

I would probably divide the system into a few logical contracts/modules rather than creating one monster contract.

Conceptually:

```text
FileRegistry.compact

registerFile()
updateFile()
verifyCommitment()
```

Then:

```text
AccessControl.compact

grantAccess()
revokeAccess()
checkAccess()
```

Then eventually:

```text
CredentialAccess.compact

registerIssuer()
verifyCredential()
proveRole()
```

And:

```text
Audit.compact

recordEvent()
proveEvent()
```

We'd finalize the actual contract structure based on Midnight's current Compact capabilities.

Most importantly, **at least one Compact contract must compile successfully** for this hackathon; otherwise the submission is automatically disqualified. 

So Compact can't just appear in the architecture diagram—we need genuine working Midnight functionality.

---

# 29. Full technical flow

The whole system could look approximately like this:

```text
                   USER
                     │
                     ▼
              ┌─────────────┐
              │ VeilDrive UI│
              └──────┬──────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
   FILE ENCRYPTION          MIDNIGHT
   in browser               WALLET
          │                     │
          ▼                     ▼
   Encrypted Blob        Compact Contracts
          │                     │
          ▼                     │
   Storage Network             │
          │                     │
          └──────────┬──────────┘
                     │
                     ▼
               File Metadata
               Permissions
               Commitments
               Private State
```

---

# 30. Download flow

Bob wants `strategy.pdf`.

```text
Bob
 │
 ▼
Open file
 │
 ▼
VeilDrive checks policy
 │
 ▼
Midnight verification
 │
 ├── INVALID → Access denied
 │
 └── VALID
       │
       ▼
Encrypted file retrieved
       │
       ▼
Authorized key material obtained
       │
       ▼
Decrypt locally
       │
       ▼
strategy.pdf
```

The server/storage layer should not simply hand out plaintext.

---

# 31. Important security concept: key management

This is probably the hardest part of the project.

Suppose:

```text
File encryption key:

K_file
```

We should **not** simply put `K_file` publicly on-chain.

One conceptual design is:

```text
File
 ↓
Encrypted with K_file
 ↓
Encrypted blob

K_file
 ↓
Wrapped/encrypted for authorized users
 ↓
Encrypted key material
```

Only authorized recipients can recover the necessary key.

For groups, we could eventually use hierarchical/group keys and rotate keys when membership changes.

This is where a lot of the actual security engineering of VeilDrive lives.

---

# 32. Feature set

If time isn't a concern, this is where I would eventually take the product:

* End-to-end encrypted uploads
* Encrypted downloads
* Wallet authentication
* My Drive
* Folders
* Search
* Favorites
* Trash
* File previews
* File versioning
* Wallet-to-wallet sharing
* Team workspaces
* Role-based permissions
* Credential-based permissions
* Zero-knowledge access proofs
* Expiring access
* One-time access
* Access requests
* Revocation
* Encrypted filenames
* Encrypted metadata
* Encrypted comments
* File integrity verification
* Proof of document existence
* Private audit trail
* Organization credentials
* External sharing
* Confidential data rooms
* Multi-user collaboration
* Recovery system
* Notifications
* Admin dashboard
* Privacy dashboard
* Developer API
* SDK
* Storage-provider abstraction
* Mobile application

But we shouldn't try to implement all of those simultaneously. They form the long-term product vision.

---

# 33. One especially cool feature — Privacy Inspector

Before sharing, show:

```text
PRIVACY INSPECTOR

You're sharing:

📄 contract.pdf

Recipient will learn:

✓ File exists
✓ They have permission
✓ File size: Hidden
✓ Owner identity: Hidden
✓ Other recipients: Hidden

Recipient will NOT learn:

✗ Other members
✗ Your other files
✗ Private credential data
✗ Activity history
```

This makes Midnight's privacy benefits **visible in the UX**.

Judges shouldn't have to infer that your application is private.

Show them.

---

# 34. Another killer feature — Proof Request

Imagine a company asks:

> "We need proof that you have more than ₹10 lakh available."

Normally:

**Upload your bank statement.**

That's horrible for privacy.

Through a future VeilDrive credential integration:

```text
Document Request

Required:
Financial eligibility

Condition:
Balance > ₹10,00,000

[ Generate Private Proof ]
```

Result:

```text
REQUIREMENT SATISFIED ✓

Exact Balance:
NOT DISCLOSED
```

The verifier doesn't need the entire bank statement.

At this point VeilDrive becomes bigger than Drive.

It becomes a **privacy-preserving document and proof exchange platform.**

---

# 35. What the user experience looks like

The user shouldn't care that Compact/ZK is underneath.

From their perspective:

```text
Connect Wallet
      ↓
Create Drive
      ↓
Upload File
      ↓
File automatically encrypted
      ↓
Choose Share
      ↓
Choose:

Person
Team
Credential
Private Rule
Temporary Link

      ↓
Recipient proves authorization
      ↓
File opens
```

That's it.

The difficult cryptography stays behind the UI.

---

# 36. Why not just Google Drive?

This will absolutely be asked by judges.

Your answer shouldn't be:

> "Because blockchain is decentralized."

That's weak.

The answer is:

**Google Drive requires users to trust the platform's authorization infrastructure and reveal information to establish access. VeilDrive is designed around client-side encryption and cryptographically verifiable private authorization, allowing users to prove that they satisfy access conditions without exposing unnecessary underlying identity or credential information.**

That's the actual differentiator.

---

# 37. Why Midnight?

Another judge question.

Your answer:

> **Storage is only half of the privacy problem. The other half is deciding who is allowed to access information without forcing them to expose more information about themselves. Midnight gives VeilDrive programmable private state and selective disclosure, allowing access policies to be proven rather than simply declared to a centralized server.**

This matches Midnight's stated goal of allowing facts to be proven while protecting the underlying information. 

---

 

## Final project identity

**Name:** **VeilDrive**

**Tagline:** **Your files. Your keys. Your privacy.**

**Pitch:**

> **VeilDrive is a privacy-first cloud storage and collaboration platform powered by Midnight. Files are encrypted before leaving the user's device, while Midnight enables private access control, credential-based permissions, selective disclosure, document verification, and privacy-preserving collaboration. Users can share sensitive information based on what someone can prove—not how much personal information they're willing to reveal.**

And I would make **“prove, don't reveal”** the philosophy behind the whole product.
