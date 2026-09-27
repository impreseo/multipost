import type { Platform, PlatformAccountRecord } from "@welz/shared";
import type {
  ConnectionStatus,
  CredentialResolver,
  MediaUploadInput,
  MediaUploadResult,
  PlatformAdapter,
  PublishInput,
  PublishResult,
  ValidationResult,
} from "./types.js";

export class UnavailablePlatformAdapter implements PlatformAdapter {
  readonly platform: Platform;

  constructor(platform: Platform, private readonly reason: string) {
    this.platform = platform;
  }

  async getConnectionStatus(account: PlatformAccountRecord): Promise<ConnectionStatus> {
    const connected = account.status === "connected";
    return {
      connected,
      mode: "unavailable",
      accountType: "member",
      capabilities: [],
      health: connected ? "warning" : "unconfigured",
      message: connected
        ? "Account marked connected but API integration is not configured."
        : this.reason,
      lastVerifiedAt: account.lastVerifiedAt,
    };
  }

  async connect(): Promise<{ ok: boolean; message: string }> {
    return {
      ok: false,
      message:
        "Official API credentials are required. Configure platform app credentials in the main process before connecting.",
    };
  }

  async disconnect(): Promise<void> {
    /* no-op */
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: false, message: this.reason };
  }

  validatePost(text: string): ValidationResult {
    if (!text.trim()) return { ok: false, errors: ["Post text is required."] };
    return { ok: true, errors: [] };
  }

  validateMedia(): ValidationResult {
    return { ok: true, errors: [] };
  }

  async uploadMedia(): Promise<MediaUploadResult[]> {
    return [{ ok: false, errorCode: "API_ERROR", error: "Platform API not configured." }];
  }

  async publishPost(_account: PlatformAccountRecord, _input: PublishInput): Promise<PublishResult> {
    return {
      ok: false,
      mode: "unavailable",
      errorCode: "API_ERROR",
      error:
        "Publishing unavailable. Connect an account with supported API permissions, or enable Development mode for simulated testing.",
    };
  }
}

export class SimulatedPlatformAdapter implements PlatformAdapter {
  readonly platform: Platform;

  constructor(platform: Platform) {
    this.platform = platform;
  }

  async getConnectionStatus(account: PlatformAccountRecord): Promise<ConnectionStatus> {
    const isOrg =
      account.accountName.toLowerCase().includes("welz") ||
      (account.platform === "linkedin" && account.accountName.toLowerCase().includes("page"));

    return {
      connected: account.status === "connected",
      mode: "simulated",
      accountType:
        this.platform === "whatsapp"
          ? "business_messaging"
          : this.platform === "instagram"
          ? "professional"
          : isOrg
          ? "organization"
          : "member",
      capabilities:
        this.platform === "whatsapp"
          ? ["text", "media", "approved_templates"]
          : this.platform === "instagram"
          ? ["image", "video/reels", "carousel", "caption"]
          : ["text", "image", "video", "document"],
      health: "healthy",
      message: "SIMULATION / LOCAL TEST — Active sandbox mode. No live API credentials transmitted.",
      lastVerifiedAt: account.lastVerifiedAt ?? new Date().toISOString(),
    };
  }

  async connect(accountId: string): Promise<{ ok: boolean; message: string }> {
    return {
      ok: true,
      message: `SIMULATION: Connected sandbox account ${accountId}. Local test environment active.`,
    };
  }

  async disconnect(): Promise<void> {
    /* no-op */
  }

  async testConnection(account: PlatformAccountRecord): Promise<{ ok: boolean; message: string }> {
    return {
      ok: true,
      message: `SIMULATION TEST: Sandbox loopback test successful for ${account.accountName}. Ready for simulated workflows.`,
    };
  }

  validatePost(text: string): ValidationResult {
    const errors: string[] = [];
    if (!text.trim()) errors.push("Post text is required.");
    if (this.platform === "linkedin" && text.length > 3000) {
      errors.push(`LinkedIn posts cannot exceed 3,000 characters (currently ${text.length}).`);
    }
    if (this.platform === "instagram" && text.length > 2200) {
      errors.push(`Instagram captions cannot exceed 2,200 characters (currently ${text.length}).`);
    }
    if (this.platform === "whatsapp" && text.length > 4096) {
      errors.push(`WhatsApp messages cannot exceed 4,096 characters (currently ${text.length}).`);
    }
    return { ok: errors.length === 0, errors };
  }

  validateMedia(paths: string[]): ValidationResult {
    const errors: string[] = [];
    if (paths.some((p) => !p)) errors.push("Invalid media path.");
    if (this.platform === "instagram" && paths.length === 0) {
      errors.push("Instagram requires at least one image or video attachment.");
    }
    if (this.platform === "linkedin" && paths.length > 9) {
      errors.push("LinkedIn allows max 9 media attachments.");
    }
    if (this.platform === "whatsapp" && paths.length > 4) {
      errors.push("WhatsApp supports max 4 attachments per message dispatch.");
    }
    return { ok: errors.length === 0, errors };
  }

  async uploadMedia(
    _account: PlatformAccountRecord,
    items: MediaUploadInput[]
  ): Promise<MediaUploadResult[]> {
    return items.map((_, i) => ({
      ok: true,
      platformMediaId: `sim-media-${this.platform}-${i}`,
    }));
  }

  async publishPost(_account: PlatformAccountRecord, input: PublishInput): Promise<PublishResult> {
    return {
      ok: true,
      mode: "simulated",
      externalPostId: `sim-${this.platform}-${input.idempotencyKey.slice(0, 8)}`,
      responseMeta: { simulated: true, platform: this.platform, timestamp: new Date().toISOString() },
    };
  }
}

export class LinkedInPlatformAdapter implements PlatformAdapter {
  readonly platform: Platform = "linkedin";

  constructor(private readonly getSecret?: CredentialResolver) {}

  private getAccountType(account: PlatformAccountRecord): "member" | "organization" {
    return account.accountName.toLowerCase().includes("personal") ? "member" : "organization";
  }

  private resolveToken(account: PlatformAccountRecord): string | null {
    if (account.authReference && this.getSecret) {
      const secret = this.getSecret(account.authReference);
      if (secret) return secret;
    }
    return process.env.LINKEDIN_ACCESS_TOKEN || null;
  }

  async getConnectionStatus(account: PlatformAccountRecord): Promise<ConnectionStatus> {
    const token = this.resolveToken(account);
    const connected = account.status === "connected" && !!token;
    const accountType = this.getAccountType(account);
    const requiredScope = accountType === "organization" ? "w_organization_social" : "w_member_social";

    return {
      connected,
      mode: "real",
      accountType,
      capabilities: ["text", "image", "video", "document"],
      health: connected ? "healthy" : "unconfigured",
      requiresConfig: !connected,
      configRequirements: [
        "LinkedIn Developer App Client ID & Secret",
        `OAuth 2.0 Scope: ${requiredScope}`,
        accountType === "organization"
          ? "Organization Administrator Access (URN: urn:li:organization)"
          : "Member Identity (URN: urn:li:person)",
      ],
      message: connected
        ? `Connected via LinkedIn Posts API as ${accountType === "organization" ? "Organization Page" : "Personal Member"}.`
        : `LinkedIn publishing requires OAuth 2.0 credentials with ${requiredScope} scope.`,
      lastVerifiedAt: account.lastVerifiedAt,
    };
  }

  async connect(accountId: string): Promise<{ ok: boolean; message: string }> {
    return {
      ok: false,
      message:
        `LinkedIn OAuth connection boundary: Configure LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in platform settings or securely store OAuth access token for ${accountId}.`,
    };
  }

  async disconnect(): Promise<void> {
    /* no-op */
  }

  async testConnection(account: PlatformAccountRecord): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }> {
    const token = this.resolveToken(account);
    if (!token) {
      const type = this.getAccountType(account);
      return {
        ok: false,
        message: `LinkedIn test failed [AUTH_ERROR]: No credentials found for ${account.accountName}. Please initiate OAuth 2.0 authorization (${type === "organization" ? "w_organization_social" : "w_member_social"}).`,
      };
    }

    try {
      const res = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        return {
          ok: false,
          message: "LinkedIn test failed [AUTH_ERROR]: Access token expired or invalid. Please re-authenticate.",
        };
      }
      if (res.status === 403) {
        return {
          ok: false,
          message: "LinkedIn test failed [PERMISSION_ERROR]: Account lacks required permissions.",
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          message: `LinkedIn test failed [API_ERROR]: HTTP ${res.status} ${res.statusText}`,
        };
      }

      const data = (await res.json()) as Record<string, unknown>;
      return {
        ok: true,
        message: `LinkedIn connection healthy: Verified identity for ${data.name || account.accountName}.`,
        details: { sub: data.sub, name: data.name },
      };
    } catch (err) {
      return {
        ok: false,
        message: `LinkedIn test failed [NETWORK_ERROR]: ${err instanceof Error ? err.message : "Network request failed"}`,
      };
    }
  }

  validatePost(text: string): ValidationResult {
    const errors: string[] = [];
    if (!text.trim()) errors.push("Post text is required.");
    if (text.length > 3000) {
      errors.push(`LinkedIn posts cannot exceed 3,000 characters (currently ${text.length}).`);
    }
    return { ok: errors.length === 0, errors };
  }

  validateMedia(paths: string[]): ValidationResult {
    const errors: string[] = [];
    if (paths.length > 9) {
      errors.push("LinkedIn allows up to 9 media attachments per post.");
    }
    return { ok: errors.length === 0, errors };
  }

  async uploadMedia(
    account: PlatformAccountRecord,
    items: MediaUploadInput[]
  ): Promise<MediaUploadResult[]> {
    const token = this.resolveToken(account);
    if (!token) {
      return items.map(() => ({
        ok: false,
        errorCode: "AUTH_ERROR",
        error: "LinkedIn media upload requires active OAuth access token with rest/images or rest/videos asset upload permissions.",
      }));
    }

    return items.map(() => ({
      ok: false,
      errorCode: "MEDIA_ERROR",
      error: "LinkedIn binary media upload requires two-step rest/images registration. Ensure image size <= 8MB or video <= 200MB.",
    }));
  }

  async publishPost(account: PlatformAccountRecord, input: PublishInput): Promise<PublishResult> {
    const token = this.resolveToken(account);
    if (!token) {
      return {
        ok: false,
        mode: "real",
        errorCode: "AUTH_ERROR",
        error: "LinkedIn authentication required. Reconnect your LinkedIn account with valid OAuth credentials.",
      };
    }

    const accountType = this.getAccountType(account);

    try {
      const authorUrn = account.accountId
        ? accountType === "organization"
          ? `urn:li:organization:${account.accountId}`
          : `urn:li:person:${account.accountId}`
        : "urn:li:person:me";

      const payload = {
        author: authorUrn,
        commentary: input.text,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      };

      const res = await fetch("https://api.linkedin.com/rest/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "LinkedIn-Version": "202401",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 201) {
        const remoteId = res.headers.get("x-restli-id") || `li-${Date.now()}`;
        return {
          ok: true,
          mode: "real",
          externalPostId: remoteId,
          responseMeta: { status: 201, restliId: remoteId },
        };
      }

      if (res.status === 401) {
        return {
          ok: false,
          mode: "real",
          errorCode: "AUTH_ERROR",
          error: "LinkedIn OAuth token expired or revoked. Please reconnect your account.",
        };
      }

      if (res.status === 403) {
        return {
          ok: false,
          mode: "real",
          errorCode: "PERMISSION_ERROR",
          error:
            accountType === "organization"
              ? "Organization publishing unavailable. The connected account does not have the required organization permission (w_organization_social)."
              : "Member publishing unavailable. The connected account lacks w_member_social permission.",
        };
      }

      if (res.status === 429) {
        return {
          ok: false,
          mode: "real",
          errorCode: "RATE_LIMIT_ERROR",
          error: "LinkedIn API rate limit reached. Please wait before retrying.",
        };
      }

      const errText = await res.text();
      return {
        ok: false,
        mode: "real",
        errorCode: "API_ERROR",
        error: `LinkedIn API error (HTTP ${res.status}): ${errText.slice(0, 200)}`,
      };
    } catch (err) {
      return {
        ok: false,
        mode: "real",
        errorCode: "NETWORK_ERROR",
        error: `Network failure connecting to LinkedIn API: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

export class InstagramPlatformAdapter implements PlatformAdapter {
  readonly platform: Platform = "instagram";

  constructor(private readonly getSecret?: CredentialResolver) {}

  private resolveToken(account: PlatformAccountRecord): string | null {
    if (account.authReference && this.getSecret) {
      const secret = this.getSecret(account.authReference);
      if (secret) return secret;
    }
    return process.env.INSTAGRAM_PAGE_TOKEN || process.env.META_ACCESS_TOKEN || null;
  }

  async getConnectionStatus(account: PlatformAccountRecord): Promise<ConnectionStatus> {
    const token = this.resolveToken(account);
    const connected = account.status === "connected" && !!token;

    return {
      connected,
      mode: "real",
      accountType: "professional",
      capabilities: ["image", "video/reels", "carousel", "caption"],
      health: connected ? "healthy" : "unconfigured",
      requiresConfig: !connected,
      configRequirements: [
        "Meta Business Account with Instagram Professional Account linked",
        "Meta App permission: instagram_content_publish",
        "Public HTTPS Media Hosting (Meta Content Publishing API requires publicly resolvable media URLs for container ingestion)",
      ],
      message: connected
        ? "Connected via Meta Graph API (Instagram Content Publishing API)."
        : "Instagram publishing requires a Meta Business Account (Creator or Business) linked to a Facebook Page, plus public HTTPS media storage.",
      lastVerifiedAt: account.lastVerifiedAt,
    };
  }

  async connect(accountId: string): Promise<{ ok: boolean; message: string }> {
    return {
      ok: false,
      message:
        `Meta API integration boundary: Instagram publishing for ${accountId} requires Facebook Login with instagram_content_publish permission and public media storage configuration.`,
    };
  }

  async disconnect(): Promise<void> {
    /* no-op */
  }

  async testConnection(account: PlatformAccountRecord): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }> {
    const token = this.resolveToken(account);
    if (!token) {
      return {
        ok: false,
        message: "Instagram test failed [AUTH_ERROR]: No Meta Page Access Token found. Connect a Meta Business Account with instagram_content_publish permission.",
      };
    }

    try {
      const igId = account.accountId || "me";
      const res = await fetch(`https://graph.facebook.com/v20.0/${igId}?fields=id,username&access_token=${token}`);
      if (res.status === 401 || res.status === 190) {
        return {
          ok: false,
          message: "Instagram test failed [AUTH_ERROR]: Meta OAuth access token is invalid or expired.",
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          message: `Instagram test failed [API_ERROR]: HTTP ${res.status} ${res.statusText}`,
        };
      }
      const data = (await res.json()) as Record<string, unknown>;
      return {
        ok: true,
        message: `Instagram connection verified: Meta Graph API professional account is active (${String(data.username || account.accountName)}).`,
        details: data,
      };
    } catch (err) {
      return {
        ok: false,
        message: `Instagram test failed [NETWORK_ERROR]: ${err instanceof Error ? err.message : "Network request failed"}`,
      };
    }
  }

  validatePost(text: string): ValidationResult {
    const errors: string[] = [];
    if (!text.trim()) errors.push("Post caption is required.");
    if (text.length > 2200) {
      errors.push(`Instagram captions cannot exceed 2,200 characters (currently ${text.length}).`);
    }
    const hashtagCount = (text.match(/#[a-zA-Z0-9_]+/g) || []).length;
    if (hashtagCount > 30) {
      errors.push(`Instagram allows up to 30 hashtags (currently ${hashtagCount}).`);
    }
    return { ok: errors.length === 0, errors };
  }

  validateMedia(paths: string[]): ValidationResult {
    const errors: string[] = [];
    if (paths.length === 0) {
      errors.push("Instagram requires at least one image or video attachment.");
    }
    if (paths.length > 10) {
      errors.push("Instagram carousel posts allow up to 10 media items.");
    }
    return { ok: errors.length === 0, errors };
  }

  async uploadMedia(
    account: PlatformAccountRecord,
    items: MediaUploadInput[]
  ): Promise<MediaUploadResult[]> {
    const token = this.resolveToken(account);
    if (!token) {
      return items.map(() => ({
        ok: false,
        errorCode: "AUTH_ERROR",
        error: "Instagram media container creation requires valid Meta Page Access Token.",
      }));
    }

    return items.map(() => ({
      ok: false,
      errorCode: "MEDIA_ERROR",
      error: "Instagram Content Publishing API requires publicly accessible HTTPS media URLs for container ingestion.",
    }));
  }

  async publishPost(account: PlatformAccountRecord, input: PublishInput): Promise<PublishResult> {
    const token = this.resolveToken(account);
    if (!token) {
      return {
        ok: false,
        mode: "real",
        errorCode: "AUTH_ERROR",
        error: "Instagram authentication required. Connect a Meta Business Account with instagram_content_publish permissions.",
      };
    }

    if (input.mediaPaths.length === 0) {
      return {
        ok: false,
        mode: "real",
        errorCode: "VALIDATION_ERROR",
        error: "Instagram publishing requires at least one image or video attachment.",
      };
    }

    // Check if media paths are public HTTPS URLs vs local file paths
    const hasLocalFiles = input.mediaPaths.some((p) => !p.startsWith("http://") && !p.startsWith("https://"));
    if (hasLocalFiles) {
      return {
        ok: false,
        mode: "real",
        errorCode: "MEDIA_ERROR",
        error: "Meta Content Publishing API requires publicly accessible HTTPS media URLs for container ingestion. Local desktop files cannot be fetched directly by Meta servers without configured public media hosting.",
      };
    }

    try {
      const igUserId = account.accountId;
      if (!igUserId) {
        return {
          ok: false,
          mode: "real",
          errorCode: "PERMISSION_ERROR",
          error: "Instagram Professional Account ID not found. Ensure account is linked to Meta Business Manager.",
        };
      }

      // Step 1: Create media container
      const containerRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: input.mediaPaths[0],
          caption: input.text,
          access_token: token,
        }),
      });

      const containerData = (await containerRes.json()) as Record<string, unknown>;

      if (!containerRes.ok || !containerData.id) {
        const errMsg = typeof containerData.error === "object" && containerData.error !== null
          ? String((containerData.error as Record<string, unknown>).message || "Container creation failed")
          : "Failed to create Instagram media container";

        return {
          ok: false,
          mode: "real",
          errorCode: "MEDIA_ERROR",
          error: `Instagram container creation error: ${errMsg}`,
        };
      }

      const creationId = containerData.id as string;

      // Step 2: Publish media container
      const publishRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: token,
        }),
      });

      const publishData = (await publishRes.json()) as Record<string, unknown>;

      if (!publishRes.ok || !publishData.id) {
        return {
          ok: false,
          mode: "real",
          errorCode: "API_ERROR",
          error: "Instagram media publish failed after container creation.",
        };
      }

      return {
        ok: true,
        mode: "real",
        externalPostId: String(publishData.id),
        responseMeta: { containerId: creationId, postId: publishData.id },
      };
    } catch (err) {
      return {
        ok: false,
        mode: "real",
        errorCode: "NETWORK_ERROR",
        error: `Network failure connecting to Meta Graph API: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

export class WhatsAppPlatformAdapter implements PlatformAdapter {
  readonly platform: Platform = "whatsapp";

  constructor(private readonly getSecret?: CredentialResolver) {}

  private resolveToken(account: PlatformAccountRecord): string | null {
    if (account.authReference && this.getSecret) {
      const secret = this.getSecret(account.authReference);
      if (secret) return secret;
    }
    return process.env.WHATSAPP_ACCESS_TOKEN || null;
  }

  async getConnectionStatus(account: PlatformAccountRecord): Promise<ConnectionStatus> {
    const token = this.resolveToken(account);
    const connected = account.status === "connected" && !!token;

    return {
      connected,
      mode: "real",
      accountType: "business_messaging",
      capabilities: ["text", "media", "approved_templates"],
      health: connected ? "healthy" : "unconfigured",
      requiresConfig: !connected,
      configRequirements: [
        "WhatsApp Business Cloud API Phone Number ID",
        "Meta Business Account ID (WABA ID)",
        "Permanent System User Access Token with whatsapp_business_messaging",
      ],
      message: connected
        ? "Connected via WhatsApp Cloud API (Business Messaging Platform)."
        : "WhatsApp Business Messaging requires WhatsApp Cloud API credentials (Phone Number ID & Permanent System User token).",
      lastVerifiedAt: account.lastVerifiedAt,
    };
  }

  async connect(accountId: string): Promise<{ ok: boolean; message: string }> {
    return {
      ok: false,
      message:
        `WhatsApp API boundary: Configure WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN for ${accountId} in platform settings.`,
    };
  }

  async disconnect(): Promise<void> {
    /* no-op */
  }

  async testConnection(account: PlatformAccountRecord): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }> {
    const token = this.resolveToken(account);
    if (!token) {
      return {
        ok: false,
        message: "WhatsApp test failed [AUTH_ERROR]: No Cloud API Phone Number ID or Access Token configured. Connect a Meta WhatsApp Business Platform account.",
      };
    }

    try {
      const phoneId = account.accountId;
      if (!phoneId) {
        return {
          ok: false,
          message: "WhatsApp test failed [VALIDATION_ERROR]: Missing WhatsApp Phone Number ID.",
        };
      }

      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}?access_token=${token}`);
      if (res.status === 401) {
        return {
          ok: false,
          message: "WhatsApp test failed [AUTH_ERROR]: Cloud API access token is invalid or expired.",
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          message: `WhatsApp test failed [API_ERROR]: HTTP ${res.status} ${res.statusText}`,
        };
      }

      const data = (await res.json()) as Record<string, unknown>;
      return {
        ok: true,
        message: `WhatsApp Cloud API connection verified: Sender number ${String(data.display_phone_number || phoneId)} is active.`,
        details: data,
      };
    } catch (err) {
      return {
        ok: false,
        message: `WhatsApp test failed [NETWORK_ERROR]: ${err instanceof Error ? err.message : "Network request failed"}`,
      };
    }
  }

  validatePost(text: string): ValidationResult {
    const errors: string[] = [];
    if (!text.trim()) errors.push("WhatsApp message content cannot be empty.");
    if (text.length > 4096) {
      errors.push(`WhatsApp messages cannot exceed 4,096 characters (currently ${text.length}).`);
    }
    return { ok: errors.length === 0, errors };
  }

  validateMedia(paths: string[]): ValidationResult {
    const errors: string[] = [];
    if (paths.length > 4) {
      errors.push("WhatsApp supports up to 4 attachments per message dispatch.");
    }
    return { ok: errors.length === 0, errors };
  }

  async uploadMedia(
    account: PlatformAccountRecord,
    items: MediaUploadInput[]
  ): Promise<MediaUploadResult[]> {
    const token = this.resolveToken(account);
    if (!token) {
      return items.map(() => ({
        ok: false,
        errorCode: "AUTH_ERROR",
        error: "WhatsApp media upload requires Cloud API System User token.",
      }));
    }

    return items.map(() => ({
      ok: false,
      errorCode: "MEDIA_ERROR",
      error: "WhatsApp Cloud API media upload requires active Phone Number ID and multipart upload session.",
    }));
  }

  async publishPost(account: PlatformAccountRecord, input: PublishInput): Promise<PublishResult> {
    const token = this.resolveToken(account);
    if (!token) {
      return {
        ok: false,
        mode: "real",
        errorCode: "AUTH_ERROR",
        error: "WhatsApp API credentials not found. Configure Phone Number ID and Access Token to dispatch announcements.",
      };
    }

    const phoneId = account.accountId;
    if (!phoneId) {
      return {
        ok: false,
        mode: "real",
        errorCode: "VALIDATION_ERROR",
        error: "WhatsApp Phone Number ID not configured.",
      };
    }

    try {
      // Recipient for business messaging (configured destination channel or test recipient)
      const recipient = process.env.WHATSAPP_TEST_RECIPIENT || "me";

      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: { body: input.text },
      };

      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        const errorObj = data.error as Record<string, unknown> | undefined;
        const code = typeof errorObj?.code === "number" ? errorObj.code : 0;
        const msg = typeof errorObj?.message === "string" ? errorObj.message : "WhatsApp dispatch failed";

        if (code === 131047 || code === 131026) {
          return {
            ok: false,
            mode: "real",
            errorCode: "VALIDATION_ERROR",
            error: "WhatsApp Business rule [TEMPLATE_REQUIRED]: Business-initiated messages require an approved pre-registered template when messaging outside the 24-hour customer service window.",
          };
        }

        if (code === 190) {
          return {
            ok: false,
            mode: "real",
            errorCode: "AUTH_ERROR",
            error: "WhatsApp Cloud API token is expired or unauthorized.",
          };
        }

        if (code === 130429 || code === 131048) {
          return {
            ok: false,
            mode: "real",
            errorCode: "RATE_LIMIT_ERROR",
            error: "WhatsApp Cloud API rate limit exceeded.",
          };
        }

        return {
          ok: false,
          mode: "real",
          errorCode: "API_ERROR",
          error: `WhatsApp Cloud API error (Code ${code}): ${msg}`,
        };
      }

      const messages = data.messages as Array<Record<string, unknown>> | undefined;
      const messageId = messages && messages[0] && typeof messages[0].id === "string" ? messages[0].id : `wa-${Date.now()}`;

      return {
        ok: true,
        mode: "real",
        externalPostId: messageId,
        responseMeta: { status: "Sent", messageId, recipient },
      };
    } catch (err) {
      return {
        ok: false,
        mode: "real",
        errorCode: "NETWORK_ERROR",
        error: `Network failure connecting to WhatsApp Cloud API: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
