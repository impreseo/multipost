import fs from "node:fs";
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
import { resolvePublicMediaUrl, type MediaHostConfig } from "./media-host.js";

// ===========================================================================
// Unavailable Platform Adapter
// ===========================================================================
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
        "Official API credentials are required. Configure platform app credentials before connecting.",
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

  async publishPost(): Promise<PublishResult> {
    return {
      ok: false,
      mode: "unavailable",
      errorCode: "API_ERROR",
      error: "Publishing unavailable. Connect an account with supported official API permissions.",
    };
  }
}

// ===========================================================================
// Simulated Platform Adapter (Isolated for Unit Tests / Sandboxes)
// ===========================================================================
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
      platformMediaId: `sim-asset-${Date.now()}-${i}`,
    }));
  }

  async publishPost(
    account: PlatformAccountRecord,
    input: PublishInput
  ): Promise<PublishResult> {
    const ts = Date.now();
    const idem = input.idempotencyKey ? `${input.idempotencyKey.slice(0, 8)}-` : "";
    return {
      ok: true,
      mode: "simulated",
      externalPostId: `sim-${account.platform}-${idem}${ts}`,
      responseMeta: {
        simulated: true,
        dispatchedAt: new Date().toISOString(),
        idempotencyKey: input.idempotencyKey,
      },
    };
  }
}

// ===========================================================================
// LINKEDIN PLATFORM ADAPTER (Real Official LinkedIn Posts & Media API)
// ===========================================================================
export class LinkedInPlatformAdapter implements PlatformAdapter {
  readonly platform: Platform = "linkedin";

  constructor(private readonly getSecret?: CredentialResolver) {}

  private resolveToken(account: PlatformAccountRecord): string | null {
    if (account.authReference && this.getSecret) {
      const secret = this.getSecret(account.authReference);
      if (secret) return secret;
    }
    return process.env.LINKEDIN_ACCESS_TOKEN || null;
  }

  private getAuthorUrn(account: PlatformAccountRecord): string {
    const isOrg =
      account.accountName.toLowerCase().includes("page") ||
      account.accountName.toLowerCase().includes("organization") ||
      account.accountName.toLowerCase().includes("company") ||
      account.accountName === "WELZ";

    if (account.accountId) {
      return isOrg
        ? `urn:li:organization:${account.accountId}`
        : `urn:li:person:${account.accountId}`;
    }
    return "urn:li:person:me";
  }

  async getConnectionStatus(account: PlatformAccountRecord): Promise<ConnectionStatus> {
    const token = this.resolveToken(account);
    const connected = account.status === "connected" && !!token;
    const authorUrn = this.getAuthorUrn(account);
    const accountType = authorUrn.startsWith("urn:li:organization") ? "organization" : "member";

    return {
      connected,
      mode: "real",
      accountType,
      capabilities: ["text", "image", "video", "document"],
      health: connected ? "healthy" : "unconfigured",
      requiresConfig: !connected,
      configRequirements: [
        "LinkedIn Developer App Client ID & Secret",
        `OAuth 2.0 Scope: ${accountType === "organization" ? "w_organization_social" : "w_member_social"}`,
        accountType === "organization"
          ? "Organization Administrator Access (URN: urn:li:organization)"
          : "Member Identity (URN: urn:li:person)",
      ],
      message: connected
        ? `Connected via LinkedIn Posts API as ${accountType === "organization" ? "Organization Page" : "Personal Profile"}.`
        : "LinkedIn publishing requires official OAuth 2.0 authorization with w_member_social or w_organization_social scope.",
      lastVerifiedAt: account.lastVerifiedAt,
    };
  }

  async connect(accountId: string): Promise<{ ok: boolean; message: string }> {
    return {
      ok: false,
      message: `LinkedIn OAuth connection required for ${accountId}. Initiate official OAuth authorization flow.`,
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
        message: `LinkedIn test failed [AUTH_ERROR]: No OAuth access token found for ${account.accountName}. Please connect your LinkedIn account.`,
      };
    }

    try {
      const res = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        return {
          ok: false,
          message: "LinkedIn test failed [AUTH_ERROR]: Access token expired or revoked. Please reconnect your account.",
        };
      }
      if (res.status === 403) {
        return {
          ok: false,
          message: "LinkedIn test failed [PERMISSION_ERROR]: Connected account lacks required member publishing permissions.",
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
        message: `LinkedIn connection healthy: Verified identity for ${String(data.name || account.accountName)}.`,
        details: { sub: data.sub, name: data.name },
      };
    } catch (err: unknown) {
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
        error: "LinkedIn media upload requires an active OAuth access token.",
      }));
    }

    const authorUrn = this.getAuthorUrn(account);
    const results: MediaUploadResult[] = [];

    for (const item of items) {
      try {
        if (!fs.existsSync(item.localPath)) {
          results.push({
            ok: false,
            errorCode: "MEDIA_ERROR",
            error: `Local media file not found: ${item.localPath}`,
          });
          continue;
        }

        const buffer = fs.readFileSync(item.localPath);
        const isVideo = item.mimeType.startsWith("video");

        if (isVideo) {
          // 1. Initialize Video Upload
          const initRes = await fetch("https://api.linkedin.com/rest/videos?action=initializeUpload", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "LinkedIn-Version": "202401",
              "X-Restli-Protocol-Version": "2.0.0",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              initializeUploadRequest: {
                owner: authorUrn,
                fileSizeBytes: buffer.length,
                uploadCaptions: false,
                uploadThumbnail: false,
              },
            }),
          });

          if (!initRes.ok) {
            const errText = await initRes.text();
            results.push({
              ok: false,
              errorCode: "MEDIA_ERROR",
              error: `LinkedIn video registration failed (HTTP ${initRes.status}): ${errText.slice(0, 160)}`,
            });
            continue;
          }

          const initData = (await initRes.json()) as {
            value?: {
              uploadInstructions?: Array<{ uploadUrl: string }>;
              video?: string;
            };
          };

          const uploadUrl = initData.value?.uploadInstructions?.[0]?.uploadUrl;
          const videoUrn = initData.value?.video;

          if (!uploadUrl || !videoUrn) {
            results.push({
              ok: false,
              errorCode: "MEDIA_ERROR",
              error: "LinkedIn video response did not provide upload URL.",
            });
            continue;
          }

          // 2. Binary PUT of video bytes
          const putRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": item.mimeType,
            },
            body: buffer,
          });

          if (!putRes.ok) {
            results.push({
              ok: false,
              errorCode: "MEDIA_ERROR",
              error: `LinkedIn video binary upload failed (HTTP ${putRes.status}).`,
            });
            continue;
          }

          results.push({ ok: true, platformMediaId: videoUrn });
        } else {
          // 1. Initialize Image Upload
          const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "LinkedIn-Version": "202401",
              "X-Restli-Protocol-Version": "2.0.0",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              initializeUploadRequest: {
                owner: authorUrn,
              },
            }),
          });

          if (!initRes.ok) {
            const errText = await initRes.text();
            results.push({
              ok: false,
              errorCode: "MEDIA_ERROR",
              error: `LinkedIn image registration failed (HTTP ${initRes.status}): ${errText.slice(0, 160)}`,
            });
            continue;
          }

          const initData = (await initRes.json()) as {
            value?: {
              uploadUrl?: string;
              image?: string;
            };
          };

          const uploadUrl = initData.value?.uploadUrl;
          const imageUrn = initData.value?.image;

          if (!uploadUrl || !imageUrn) {
            results.push({
              ok: false,
              errorCode: "MEDIA_ERROR",
              error: "LinkedIn image response did not provide upload instructions.",
            });
            continue;
          }

          // 2. Binary PUT of image bytes
          const putRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": item.mimeType,
            },
            body: buffer,
          });

          if (!putRes.ok) {
            results.push({
              ok: false,
              errorCode: "MEDIA_ERROR",
              error: `LinkedIn image binary upload failed (HTTP ${putRes.status}).`,
            });
            continue;
          }

          results.push({ ok: true, platformMediaId: imageUrn });
        }
      } catch (err: unknown) {
        results.push({
          ok: false,
          errorCode: "MEDIA_ERROR",
          error: `Media upload exception: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    return results;
  }

  async publishPost(account: PlatformAccountRecord, input: PublishInput): Promise<PublishResult> {
    const token = this.resolveToken(account);
    if (!token) {
      return {
        ok: false,
        mode: "real",
        errorCode: "AUTH_ERROR",
        error: "LinkedIn authentication required. Reconnect your account with valid OAuth credentials.",
      };
    }

    const authorUrn = this.getAuthorUrn(account);
    const isOrg = authorUrn.startsWith("urn:li:organization");

    try {
      let contentBlock: Record<string, unknown> | undefined;

      // Handle media attachments if present
      if (input.mediaPaths.length > 0) {
        const uploadInputs = input.mediaPaths.map((p) => {
          const ext = p.split(".").pop()?.toLowerCase();
          const mime = ext === "mp4" || ext === "mov" ? "video/mp4" : "image/jpeg";
          return { localPath: p, mimeType: mime };
        });

        const uploads = await this.uploadMedia(account, uploadInputs);
        const failedUpload = uploads.find((u) => !u.ok);
        if (failedUpload) {
          return {
            ok: false,
            mode: "real",
            errorCode: failedUpload.errorCode || "MEDIA_ERROR",
            error: failedUpload.error || "LinkedIn media upload failed.",
          };
        }

        const mediaIds = uploads.map((u) => u.platformMediaId!).filter(Boolean);

        if (mediaIds.length === 1) {
          const isVideo = mediaIds[0].startsWith("urn:li:video");
          contentBlock = {
            media: {
              id: mediaIds[0],
              title: isVideo ? "Video Post" : "Post Image",
            },
          };
        } else if (mediaIds.length > 1) {
          contentBlock = {
            multiImage: {
              images: mediaIds.map((id, idx) => ({
                id,
                altText: `Attachment ${idx + 1}`,
              })),
            },
          };
        }
      }

      const payload: Record<string, unknown> = {
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

      if (contentBlock) {
        payload.content = contentBlock;
      }

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
        const remoteId = res.headers.get("x-restli-id") || `urn:li:share:${Date.now()}`;
        return {
          ok: true,
          mode: "real",
          externalPostId: remoteId,
          responseMeta: { status: 201, restliId: remoteId, author: authorUrn },
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
          error: isOrg
            ? "LinkedIn Organization publishing failed. The authenticated member requires an Administrator role on the LinkedIn Page (urn:li:organization)."
            : "LinkedIn Member publishing failed. Account lacks w_member_social permission.",
        };
      }

      if (res.status === 422) {
        const errText = await res.text();
        return {
          ok: false,
          mode: "real",
          errorCode: "VALIDATION_ERROR",
          error: `LinkedIn post validation error: ${errText.slice(0, 200)}`,
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
    } catch (err: unknown) {
      return {
        ok: false,
        mode: "real",
        errorCode: "NETWORK_ERROR",
        error: `Network failure connecting to LinkedIn API: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

// ===========================================================================
// INSTAGRAM PLATFORM ADAPTER (Real Meta Content Publishing API)
// ===========================================================================
export class InstagramPlatformAdapter implements PlatformAdapter {
  readonly platform: Platform = "instagram";

  constructor(
    private readonly getSecret?: CredentialResolver,
    private readonly mediaHostConfig?: MediaHostConfig
  ) {}

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
        : "Instagram publishing requires official Meta OAuth authorization and public HTTPS media hosting.",
      lastVerifiedAt: account.lastVerifiedAt,
    };
  }

  async connect(accountId: string): Promise<{ ok: boolean; message: string }> {
    return {
      ok: false,
      message: `Meta / Instagram authorization required for ${accountId}. Initiate official OAuth flow.`,
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
        message: "Instagram test failed [AUTH_ERROR]: No Meta access token found. Please connect your Instagram Professional Account.",
      };
    }

    try {
      const igId = account.accountId || "me";
      const res = await fetch(`https://graph.facebook.com/v21.0/${igId}?fields=id,username,name&access_token=${token}`);

      if (res.status === 401 || res.status === 190) {
        return {
          ok: false,
          message: "Instagram test failed [AUTH_ERROR]: Meta OAuth access token is invalid or expired. Reconnect your account.",
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
    } catch (err: unknown) {
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
    _account: PlatformAccountRecord,
    items: MediaUploadInput[]
  ): Promise<MediaUploadResult[]> {
    const results: MediaUploadResult[] = [];
    for (const item of items) {
      const resolved = await resolvePublicMediaUrl(item.localPath, this.mediaHostConfig);
      if (!resolved.ok) {
        results.push({
          ok: false,
          errorCode: "MEDIA_HOSTING_REQUIRED",
          error: resolved.error,
        });
      } else {
        results.push({
          ok: true,
          platformMediaId: resolved.url,
        });
      }
    }
    return results;
  }

  private async pollContainerStatus(containerId: string, token: string, maxAttempts = 12): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${token}`);
        if (res.ok) {
          const json = (await res.json()) as { status_code?: string };
          if (json.status_code === "FINISHED") return true;
          if (json.status_code === "ERROR") return false;
        }
      } catch {
        // continue polling
      }
    }
    return true; // proceed to publish attempt
  }

  async publishPost(account: PlatformAccountRecord, input: PublishInput): Promise<PublishResult> {
    const token = this.resolveToken(account);
    if (!token) {
      return {
        ok: false,
        mode: "real",
        errorCode: "AUTH_ERROR",
        error: "Instagram authentication required. Connect an Instagram Professional Account with instagram_content_publish permission.",
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

    const igUserId = account.accountId;
    if (!igUserId) {
      return {
        ok: false,
        mode: "real",
        errorCode: "PERMISSION_ERROR",
        error: "Instagram Professional Account ID not found. Ensure account is linked to Meta Business Manager.",
      };
    }

    // Resolve public HTTPS URLs for all media items
    const resolvedUrls: string[] = [];
    for (const p of input.mediaPaths) {
      const res = await resolvePublicMediaUrl(p, this.mediaHostConfig);
      if (!res.ok || !res.url) {
        return {
          ok: false,
          mode: "real",
          errorCode: "MEDIA_HOSTING_REQUIRED",
          error: res.error || "Public HTTPS media URL required for Instagram container publishing.",
        };
      }
      resolvedUrls.push(res.url);
    }

    try {
      let creationId = "";

      if (resolvedUrls.length === 1) {
        const isVideo = input.mediaPaths[0].toLowerCase().endsWith(".mp4") || input.mediaPaths[0].toLowerCase().endsWith(".mov");

        // 1. Create Media Container
        const containerBody = isVideo
          ? {
              media_type: "REELS",
              video_url: resolvedUrls[0],
              caption: input.text,
              access_token: token,
            }
          : {
              image_url: resolvedUrls[0],
              caption: input.text,
              access_token: token,
            };

        const containerRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(containerBody),
        });

        const containerData = (await containerRes.json()) as { id?: string; error?: { message?: string; code?: number } };
        if (!containerRes.ok || !containerData.id) {
          return {
            ok: false,
            mode: "real",
            errorCode: "MEDIA_ERROR",
            error: `Instagram container creation failed: ${containerData.error?.message || "Invalid media asset"}`,
          };
        }

        creationId = containerData.id;
        await this.pollContainerStatus(creationId, token);
      } else {
        // Carousel Container Publishing (2 to 10 items)
        const childContainerIds: string[] = [];

        for (let i = 0; i < resolvedUrls.length; i++) {
          const url = resolvedUrls[i];
          const isVid = input.mediaPaths[i].toLowerCase().endsWith(".mp4");
          const childBody = isVid
            ? { is_carousel_item: true, media_type: "VIDEO", video_url: url, access_token: token }
            : { is_carousel_item: true, image_url: url, access_token: token };

          const childRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(childBody),
          });

          const childData = (await childRes.json()) as { id?: string; error?: { message?: string } };
          if (!childRes.ok || !childData.id) {
            return {
              ok: false,
              mode: "real",
              errorCode: "MEDIA_ERROR",
              error: `Instagram carousel child item ${i + 1} creation failed: ${childData.error?.message || "Invalid item"}`,
            };
          }

          childContainerIds.push(childData.id);
          await this.pollContainerStatus(childData.id, token, 8);
        }

        // Create Parent Carousel Container
        const carouselRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "CAROUSEL",
            caption: input.text,
            children: childContainerIds,
            access_token: token,
          }),
        });

        const carouselData = (await carouselRes.json()) as { id?: string; error?: { message?: string } };
        if (!carouselRes.ok || !carouselData.id) {
          return {
            ok: false,
            mode: "real",
            errorCode: "MEDIA_ERROR",
            error: `Instagram carousel container error: ${carouselData.error?.message || "Failed to create carousel"}`,
          };
        }

        creationId = carouselData.id;
        await this.pollContainerStatus(creationId, token);
      }

      // Step 2: Publish the media container
      const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: token,
        }),
      });

      const publishData = (await publishRes.json()) as { id?: string; error?: { message?: string } };
      if (!publishRes.ok || !publishData.id) {
        return {
          ok: false,
          mode: "real",
          errorCode: "API_ERROR",
          error: `Instagram publish failed: ${publishData.error?.message || "Publish call returned error"}`,
        };
      }

      return {
        ok: true,
        mode: "real",
        externalPostId: String(publishData.id),
        responseMeta: { containerId: creationId, igMediaId: publishData.id },
      };
    } catch (err: unknown) {
      return {
        ok: false,
        mode: "real",
        errorCode: "NETWORK_ERROR",
        error: `Network failure connecting to Meta Graph API: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

// ===========================================================================
// WHATSAPP PLATFORM ADAPTER (Real WhatsApp Business Cloud API)
// ===========================================================================
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
        : "WhatsApp Business Messaging requires Phone Number ID and Permanent System User token.",
      lastVerifiedAt: account.lastVerifiedAt,
    };
  }

  async connect(accountId: string): Promise<{ ok: boolean; message: string }> {
    return {
      ok: false,
      message: `WhatsApp Cloud API configuration required for ${accountId}. Configure Phone Number ID and token in Settings.`,
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
        message: "WhatsApp test failed [AUTH_ERROR]: No Cloud API Access Token found. Configure credentials in Settings.",
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

      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}?access_token=${token}`);
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
    } catch (err: unknown) {
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
    const phoneId = account.accountId;

    if (!token || !phoneId) {
      return items.map(() => ({
        ok: false,
        errorCode: "AUTH_ERROR",
        error: "WhatsApp media upload requires Cloud API Phone Number ID and Access Token.",
      }));
    }

    const results: MediaUploadResult[] = [];

    for (const item of items) {
      try {
        if (!fs.existsSync(item.localPath)) {
          results.push({
            ok: false,
            errorCode: "MEDIA_ERROR",
            error: `File not found: ${item.localPath}`,
          });
          continue;
        }

        const buffer = fs.readFileSync(item.localPath);
        const filename = item.localPath.split(/[\\/]/).pop() || "media";

        const formData = new FormData();
        formData.append("messaging_product", "whatsapp");
        formData.append("type", item.mimeType);
        formData.append("file", new Blob([buffer], { type: item.mimeType }), filename);

        const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/media`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) {
          const errText = await res.text();
          results.push({
            ok: false,
            errorCode: "MEDIA_ERROR",
            error: `WhatsApp media upload failed (HTTP ${res.status}): ${errText.slice(0, 160)}`,
          });
          continue;
        }

        const json = (await res.json()) as { id?: string };
        if (json.id) {
          results.push({ ok: true, platformMediaId: json.id });
        } else {
          results.push({ ok: false, errorCode: "MEDIA_ERROR", error: "Missing media ID in response." });
        }
      } catch (err: unknown) {
        results.push({
          ok: false,
          errorCode: "MEDIA_ERROR",
          error: `Media upload exception: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    return results;
  }

  async publishPost(account: PlatformAccountRecord, input: PublishInput): Promise<PublishResult> {
    const token = this.resolveToken(account);
    if (!token) {
      return {
        ok: false,
        mode: "real",
        errorCode: "AUTH_ERROR",
        error: "WhatsApp API credentials not found. Configure Phone Number ID and Access Token in Settings.",
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
      const recipient = process.env.WHATSAPP_RECIPIENT || process.env.WHATSAPP_TEST_RECIPIENT || "me";

      let payload: Record<string, unknown>;

      if (input.mediaPaths.length > 0) {
        // Upload media to get WhatsApp media ID
        const uploadInputs = input.mediaPaths.map((p) => {
          const ext = p.split(".").pop()?.toLowerCase();
          const mime = ext === "mp4" || ext === "mov" ? "video/mp4" : "image/jpeg";
          return { localPath: p, mimeType: mime };
        });

        const uploads = await this.uploadMedia(account, uploadInputs);
        const failed = uploads.find((u) => !u.ok);
        if (failed) {
          return {
            ok: false,
            mode: "real",
            errorCode: failed.errorCode || "MEDIA_ERROR",
            error: failed.error || "WhatsApp media upload failed.",
          };
        }

        const mediaId = uploads[0].platformMediaId;
        const isVideo = input.mediaPaths[0].toLowerCase().endsWith(".mp4");

        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: isVideo ? "video" : "image",
          [isVideo ? "video" : "image"]: {
            id: mediaId,
            caption: input.text,
          },
        };
      } else if (input.text.startsWith("TEMPLATE:")) {
        // Template message parsing
        const templateName = input.text.replace("TEMPLATE:", "").trim().split(/\s+/)[0];
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en_US" },
          },
        };
      } else {
        // Standard Text Message
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: { body: input.text },
        };
      }

      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
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
            error: "WhatsApp Cloud API token is expired or unauthorized. Reconnect your account.",
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
      const messageId =
        messages && messages[0] && typeof messages[0].id === "string"
          ? messages[0].id
          : `wamid.${Date.now()}`;

      return {
        ok: true,
        mode: "real",
        externalPostId: messageId,
        responseMeta: { status: "Sent", messageId, recipient },
      };
    } catch (err: unknown) {
      return {
        ok: false,
        mode: "real",
        errorCode: "NETWORK_ERROR",
        error: `Network failure connecting to WhatsApp Cloud API: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
