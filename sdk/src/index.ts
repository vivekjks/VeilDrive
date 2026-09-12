export type VeilDriveNetwork = 'preprod' | 'preview' | 'undeployed';
export type VeilDrivePermission = 'view' | 'download' | 'edit' | 'reshare';

export interface RegisterFileInput {
  commitment: string;
  metadataCommitment: string;
  privacy: 'standard' | 'private' | 'confidential' | 'maximum';
  fileId?: string;
}

export interface GrantAccessInput {
  recipient?: string;
  policy?: Record<string, string | number | boolean>;
  permissions: VeilDrivePermission[];
  expiresAt?: string;
  oneTime?: boolean;
}

export interface VeilDriveReceipt {
  fileId: string;
  transactionId: string;
  network: VeilDriveNetwork;
}

export interface VeilDriveTransport {
  registerFile(input: Required<RegisterFileInput>): Promise<VeilDriveReceipt>;
  grantAccess(fileId: string, input: GrantAccessInput): Promise<VeilDriveReceipt>;
  revokeAccess(fileId: string, grantId: string): Promise<VeilDriveReceipt>;
  issueCredential(input: Record<string, string>): Promise<{ credentialId: string; transactionId: string }>;
}

const digest = async (value: string): Promise<string> => {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(result)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

class LocalReceiptTransport implements VeilDriveTransport {
  constructor(private readonly network: VeilDriveNetwork) {}

  async registerFile(input: Required<RegisterFileInput>): Promise<VeilDriveReceipt> {
    return { fileId: input.fileId, transactionId: await digest(`register:${JSON.stringify(input)}`), network: this.network };
  }

  async grantAccess(fileId: string, input: GrantAccessInput): Promise<VeilDriveReceipt> {
    return { fileId, transactionId: await digest(`grant:${fileId}:${JSON.stringify(input)}`), network: this.network };
  }

  async revokeAccess(fileId: string, grantId: string): Promise<VeilDriveReceipt> {
    return { fileId, transactionId: await digest(`revoke:${fileId}:${grantId}`), network: this.network };
  }

  async issueCredential(input: Record<string, string>): Promise<{ credentialId: string; transactionId: string }> {
    const credentialId = await digest(`credential:${JSON.stringify(input)}`);
    return { credentialId, transactionId: await digest(`issue:${credentialId}`) };
  }
}

export interface VeilDriveClientOptions {
  network?: VeilDriveNetwork;
  transport?: VeilDriveTransport;
}

export class VeilDriveClient {
  readonly network: VeilDriveNetwork;
  readonly files: {
    register: (input: RegisterFileInput) => Promise<VeilDriveReceipt>;
    commitment: (file: Blob | ArrayBuffer) => Promise<string>;
    verify: (file: Blob | ArrayBuffer, expected: string) => Promise<boolean>;
  };
  readonly access: {
    grant: (fileId: string, input: GrantAccessInput) => Promise<VeilDriveReceipt>;
    revoke: (fileId: string, grantId: string) => Promise<VeilDriveReceipt>;
  };
  readonly credentials: {
    issue: (input: Record<string, string>) => Promise<{ credentialId: string; transactionId: string }>;
  };

  constructor(options: VeilDriveClientOptions = {}) {
    this.network = options.network ?? 'preprod';
    const transport = options.transport ?? new LocalReceiptTransport(this.network);
    const commitment = async (file: Blob | ArrayBuffer) => {
      const bytes = file instanceof Blob ? await file.arrayBuffer() : file;
      const result = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(result)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    };
    this.files = {
      register: async (input) => {
        const complete = { ...input, fileId: input.fileId ?? await digest(`${input.commitment}:${Date.now()}`) } as Required<RegisterFileInput>;
        return transport.registerFile(complete);
      },
      commitment,
      verify: async (file, expected) => (await commitment(file)) === expected.replace(/^0x/, ''),
    };
    this.access = {
      grant: (fileId, input) => transport.grantAccess(fileId, input),
      revoke: (fileId, grantId) => transport.revokeAccess(fileId, grantId),
    };
    this.credentials = { issue: (input) => transport.issueCredential(input) };
  }
}
