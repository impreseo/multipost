import type {
  IntegrationMode,
  Platform,
  PlatformAccountRecord,
  PlatformErrorCode,
} from "@welz/shared";

export type CredentialResolver = (authReference: string) => string | null;

export interface ConnectionStatus {
  connected: boolean;
  mode: IntegrationMode;
  accountType?: "member" | "organization" | "professional" | "business_messaging";
  capabilities: string[];
  message: string;
  lastVerifiedAt: string | null;
  health: "healthy" | "warning" | "error" | "unconfigured";
  requiresConfig?: boolean;
  configRequirements?: string[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface MediaUploadInput {
  localPath: string;
  mimeType: string;
}

export interface MediaUploadResult {
  ok: boolean;
  platformMediaId?: string;
  errorCode?: PlatformErrorCode;
  error?: string;
}

export interface PublishInput {
  account: PlatformAccountRecord;
  text: string;
  mediaPaths: string[];
  idempotencyKey: string;
}

export interface PublishResult {
  ok: boolean;
  mode: IntegrationMode;
  externalPostId?: string;
  errorCode?: PlatformErrorCode;
  error?: string;
  responseMeta?: Record<string, unknown>;
}

export interface PlatformAdapter {
  readonly platform: Platform;
  getConnectionStatus(account: PlatformAccountRecord): Promise<ConnectionStatus>;
  connect(accountId: string): Promise<{ ok: boolean; message: string }>;
  disconnect(accountId: string): Promise<void>;
  testConnection(account: PlatformAccountRecord): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }>;
  validatePost(text: string): ValidationResult;
  validateMedia(paths: string[]): ValidationResult;
  uploadMedia(
    account: PlatformAccountRecord,
    media: MediaUploadInput[]
  ): Promise<MediaUploadResult[]>;
  publishPost(account: PlatformAccountRecord, input: PublishInput): Promise<PublishResult>;
}

export type AdapterFactory = (options: { devSimulation: boolean }) => PlatformAdapter;
