import http from "node:http";
import crypto from "node:crypto";
import { shell } from "electron";
import type { Platform, PlatformAccountRecord } from "@welz/shared";
import type { WelzRepository } from "@welz/database";

export interface OAuthConfigStatus {
  linkedin: { configured: boolean; clientId?: string };
  instagram: { configured: boolean; appId?: string };
  whatsapp: { configured: boolean; phoneId?: string };
}

interface PendingOAuthTransaction {
  platform: Platform;
  state: string;
  codeVerifier?: string;
  codeChallenge?: string;
  redirectUri: string;
  createdAt: number;
}

export class OAuthManager {
  private server: http.Server | null = null;
  private pendingTransaction: PendingOAuthTransaction | null = null;
  private readonly redirectUri = "http://127.0.0.1:54321/callback";

  constructor(
    private readonly repo: WelzRepository,
    private readonly storeSecret: (ref: string, val: string) => boolean,
    private readonly getSecret: (ref: string) => string | null,
    private readonly onAccountConnected: (account: PlatformAccountRecord) => void
  ) {}

  // -------------------------------------------------------------------------
  // Config Management (Secure at rest, secrets never exposed to renderer)
  // -------------------------------------------------------------------------
  getConfigStatus(): OAuthConfigStatus {
    const liClientId = this.repo.getSetting("cfg_linkedin_client_id");
    const liClientSecret = this.getSecret("cfg_linkedin_client_secret");

    const metaAppId = this.repo.getSetting("cfg_meta_app_id");
    const metaAppSecret = this.getSecret("cfg_meta_app_secret");

    const waPhoneId = this.repo.getSetting("cfg_whatsapp_phone_id");
    const waToken = this.getSecret("cfg_whatsapp_token");

    return {
      linkedin: {
        configured: Boolean(liClientId && liClientSecret),
        clientId: liClientId ?? undefined,
      },
      instagram: {
        configured: Boolean(metaAppId && metaAppSecret),
        appId: metaAppId ?? undefined,
      },
      whatsapp: {
        configured: Boolean(waPhoneId && waToken),
        phoneId: waPhoneId ?? undefined,
      },
    };
  }

  saveConfig(payload: {
    platform: Platform;
    clientId?: string;
    clientSecret?: string;
    appId?: string;
    appSecret?: string;
    phoneId?: string;
    token?: string;
    wabaId?: string;
  }): { ok: boolean; message: string } {
    if (payload.platform === "linkedin") {
      if (payload.clientId) this.repo.setSetting("cfg_linkedin_client_id", payload.clientId.trim());
      if (payload.clientSecret) {
        this.storeSecret("cfg_linkedin_client_secret", payload.clientSecret.trim());
      }
      return { ok: true, message: "LinkedIn OAuth credentials updated securely." };
    }

    if (payload.platform === "instagram") {
      if (payload.appId) this.repo.setSetting("cfg_meta_app_id", payload.appId.trim());
      if (payload.appSecret) {
        this.storeSecret("cfg_meta_app_secret", payload.appSecret.trim());
      }
      return { ok: true, message: "Meta App credentials updated securely." };
    }

    if (payload.platform === "whatsapp") {
      if (payload.phoneId) this.repo.setSetting("cfg_whatsapp_phone_id", payload.phoneId.trim());
      if (payload.wabaId) this.repo.setSetting("cfg_whatsapp_waba_id", payload.wabaId.trim());
      if (payload.token) {
        this.storeSecret("cfg_whatsapp_token", payload.token.trim());
      }
      return { ok: true, message: "WhatsApp Cloud API credentials saved securely." };
    }

    return { ok: false, message: "Unsupported platform config" };
  }

  // -------------------------------------------------------------------------
  // Loopback Server & OAuth Initiation
  // -------------------------------------------------------------------------
  async startOAuth(platform: Platform): Promise<{ ok: boolean; message: string; authUrl?: string }> {
    const config = this.getConfigStatus();

    if (platform === "linkedin" && !config.linkedin.configured) {
      return {
        ok: false,
        message:
          "LinkedIn Developer App credentials required. Please configure Client ID & Secret in Settings → Developer / Integrations.",
      };
    }

    if (platform === "instagram" && !config.instagram.configured) {
      return {
        ok: false,
        message:
          "Meta / Instagram App ID and App Secret required. Please configure them in Settings → Developer / Integrations.",
      };
    }

    if (platform === "whatsapp") {
      // WhatsApp can connect via configured Cloud API credentials directly or verify existing
      return this.connectWhatsAppDirect();
    }

    // Generate CSRF state & PKCE code challenge
    const state = crypto.randomBytes(24).toString("hex");
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    this.pendingTransaction = {
      platform,
      state,
      codeVerifier,
      codeChallenge,
      redirectUri: this.redirectUri,
      createdAt: Date.now(),
    };

    // Spin up local loopback server to receive the callback
    await this.ensureServerRunning();

    let authUrl = "";
    if (platform === "linkedin") {
      const clientId = this.repo.getSetting("cfg_linkedin_client_id")!;
      // Official LinkedIn v2 permissions
      const scopes = [
        "w_member_social",
        "w_organization_social",
        "openid",
        "profile",
        "email",
      ].join("%20");
      authUrl =
        `https://www.linkedin.com/oauth/v2/authorization?response_type=code` +
        `&client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
        `&state=${state}` +
        `&scope=${scopes}`;
    } else if (platform === "instagram") {
      const appId = this.repo.getSetting("cfg_meta_app_id")!;
      // Official Meta Graph API scopes for Instagram Professional content publishing
      const scopes = [
        "instagram_basic",
        "instagram_content_publish",
        "pages_show_list",
        "pages_read_engagement",
        "business_management",
      ].join(",");
      authUrl =
        `https://www.facebook.com/v21.0/dialog/oauth?client_id=${encodeURIComponent(appId)}` +
        `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
        `&state=${state}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&response_type=code`;
    }

    // Launch system browser for secure official OAuth login
    void shell.openExternal(authUrl);

    return {
      ok: true,
      message: `Opened secure ${platform === "linkedin" ? "LinkedIn" : "Instagram"} authorization in your browser.`,
      authUrl,
    };
  }

  private async connectWhatsAppDirect(): Promise<{ ok: boolean; message: string }> {
    const phoneId = this.repo.getSetting("cfg_whatsapp_phone_id");
    const token = this.getSecret("cfg_whatsapp_token");

    if (!phoneId || !token) {
      return {
        ok: false,
        message:
          "WhatsApp Cloud API requires Phone Number ID and Access Token. Configure them in Settings → Developer / Integrations.",
      };
    }

    try {
      // Verify credentials with Meta WhatsApp Cloud API
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}?fields=id,verified_name,display_phone_number,quality_rating`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errJson = (await res.json()) as { error?: { message?: string } };
        return {
          ok: false,
          message: `WhatsApp API verification failed: ${errJson.error?.message || res.statusText}`,
        };
      }

      const data = (await res.json()) as {
        id: string;
        verified_name?: string;
        display_phone_number?: string;
      };

      const accountName = data.verified_name
        ? `${data.verified_name} (${data.display_phone_number || "Cloud API"})`
        : `WhatsApp Business (${data.display_phone_number || phoneId})`;

      const authRef = `oauth-wa-${data.id}`;
      this.storeSecret(authRef, token);

      const record = this.repo.upsertPlatformAccount({
        platform: "whatsapp",
        accountName,
        accountId: data.id,
        authReference: authRef,
        status: "connected",
      });

      this.onAccountConnected(record);

      return {
        ok: true,
        message: `Connected WhatsApp Business Account: ${accountName}.`,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        message: `Network error verifying WhatsApp credentials: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Loopback Server Handler
  // -------------------------------------------------------------------------
  private ensureServerRunning(): Promise<void> {
    if (this.server) return Promise.resolve();

    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        try {
          const urlObj = new URL(req.url || "/", "http://127.0.0.1:54321");
          if (urlObj.pathname === "/callback") {
            void this.handleCallback(urlObj, res);
            return;
          }
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error");
        }
      });

      this.server.listen(54321, "127.0.0.1", () => {
        resolve();
      });

      this.server.on("error", () => {
        // If port 54321 error, resolve anyway
        resolve();
      });
    });
  }

  private async handleCallback(urlObj: URL, res: http.ServerResponse): Promise<void> {
    const code = urlObj.searchParams.get("code");
    const state = urlObj.searchParams.get("state");
    const error = urlObj.searchParams.get("error");
    const errorDescription = urlObj.searchParams.get("error_description");

    const renderHtmlResponse = (title: string, message: string, isSuccess: boolean) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>WELZ Publisher — ${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #080A0D; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #13171e; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 40px; text-align: center; max-width: 440px; box-shadow: 0 12px 36px rgba(0,0,0,0.5); }
    .icon { font-size: 38px; margin-bottom: 14px; }
    .icon.success { color: #10b981; }
    .icon.error { color: #ef4444; }
    h1 { font-size: 20px; margin: 0 0 12px 0; font-weight: 600; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.55; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon ${isSuccess ? "success" : "error"}">${isSuccess ? "✓" : "⚠"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`);
    };

    if (error) {
      renderHtmlResponse("Authorization Denied", errorDescription || "Provider authorization was declined.", false);
      this.closeServer();
      return;
    }

    if (!this.pendingTransaction || !code || !state || state !== this.pendingTransaction.state) {
      renderHtmlResponse("Authentication Error", "Invalid OAuth transaction or CSRF state mismatch. Please try again.", false);
      this.closeServer();
      return;
    }

    const { platform } = this.pendingTransaction;
    this.pendingTransaction = null;

    try {
      if (platform === "linkedin") {
        await this.exchangeAndDiscoverLinkedIn(code);
      } else if (platform === "instagram") {
        await this.exchangeAndDiscoverInstagram(code);
      }

      renderHtmlResponse(
        "Authorization Successful",
        `Your ${platform === "linkedin" ? "LinkedIn" : "Instagram"} account has been connected. You can now close this window and return to WELZ Publisher.`,
        true
      );
    } catch (err: unknown) {
      renderHtmlResponse(
        "Connection Error",
        `Failed to complete authorization: ${err instanceof Error ? err.message : String(err)}`,
        false
      );
    } finally {
      this.closeServer();
    }
  }

  // -------------------------------------------------------------------------
  // Provider Exchange & Discovery
  // -------------------------------------------------------------------------
  private async exchangeAndDiscoverLinkedIn(code: string): Promise<void> {
    const clientId = this.repo.getSetting("cfg_linkedin_client_id")!;
    const clientSecret = this.getSecret("cfg_linkedin_client_secret")!;

    // 1. Token Exchange
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`LinkedIn token exchange failed (HTTP ${tokenRes.status}): ${text.slice(0, 160)}`);
    }

    const tokenData = (await tokenRes.json()) as { access_token: string; expires_in?: number };
    const accessToken = tokenData.access_token;

    // 2. Discover Personal Profile
    const userinfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (userinfoRes.ok) {
      const user = (await userinfoRes.json()) as {
        sub: string;
        name: string;
        email?: string;
        picture?: string;
      };

      const authRef = `oauth-li-personal-${user.sub}`;
      this.storeSecret(authRef, accessToken);

      const personalAccount = this.repo.upsertPlatformAccount({
        platform: "linkedin",
        accountName: user.name || "LinkedIn Personal",
        accountId: user.sub,
        authReference: authRef,
        status: "connected",
      });

      this.onAccountConnected(personalAccount);
    }

    // 3. Discover Organization Pages
    try {
      const aclRes = await fetch("https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": "202401",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      });

      if (aclRes.ok) {
        const aclData = (await aclRes.json()) as {
          elements?: Array<{
            organizationalTarget?: string;
            role?: string;
          }>;
        };

        if (aclData.elements && aclData.elements.length > 0) {
          for (const elem of aclData.elements) {
            const orgTarget = elem.organizationalTarget; // e.g. "urn:li:organization:12345"
            if (orgTarget) {
              const orgId = orgTarget.replace("urn:li:organization:", "");
              const orgAuthRef = `oauth-li-org-${orgId}`;
              this.storeSecret(orgAuthRef, accessToken);

              const orgAccount = this.repo.upsertPlatformAccount({
                platform: "linkedin",
                accountName: `LinkedIn Page (${orgId})`,
                accountId: orgId,
                authReference: orgAuthRef,
                status: "connected",
              });

              this.onAccountConnected(orgAccount);
            }
          }
        }
      }
    } catch {
      // Organization discovery is optional if user only has personal profile
    }
  }

  private async exchangeAndDiscoverInstagram(code: string): Promise<void> {
    const appId = this.repo.getSetting("cfg_meta_app_id")!;
    const appSecret = this.getSecret("cfg_meta_app_secret")!;

    // 1. Short-lived token exchange
    const tokenUrl =
      `https://graph.facebook.com/v21.0/oauth/access_token` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&code=${encodeURIComponent(code)}`;

    const tokenRes = await fetch(tokenUrl);
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Meta token exchange failed (HTTP ${tokenRes.status}): ${errText.slice(0, 160)}`);
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };
    let userToken = tokenData.access_token;

    // 2. Exchange for 60-day Long-Lived Token
    try {
      const longTokenUrl =
        `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token` +
        `&client_id=${encodeURIComponent(appId)}` +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&fb_exchange_token=${encodeURIComponent(userToken)}`;

      const longRes = await fetch(longTokenUrl);
      if (longRes.ok) {
        const longData = (await longRes.json()) as { access_token: string };
        if (longData.access_token) {
          userToken = longData.access_token;
        }
      }
    } catch {
      /* continue with short-lived if exchange failed */
    }

    // 3. Discover Instagram Professional Accounts via Facebook Pages
    const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,username,name,profile_picture_url}&access_token=${encodeURIComponent(userToken)}`;
    const pagesRes = await fetch(pagesUrl);

    if (!pagesRes.ok) {
      const errText = await pagesRes.text();
      throw new Error(`Failed to discover Instagram accounts (HTTP ${pagesRes.status}): ${errText.slice(0, 160)}`);
    }

    const pagesData = (await pagesRes.json()) as {
      data?: Array<{
        id: string;
        name: string;
        instagram_business_account?: {
          id: string;
          username?: string;
          name?: string;
          profile_picture_url?: string;
        };
      }>;
    };

    let discoveredCount = 0;
    if (pagesData.data && pagesData.data.length > 0) {
      for (const page of pagesData.data) {
        const ig = page.instagram_business_account;
        if (ig && ig.id) {
          const authRef = `oauth-ig-${ig.id}`;
          this.storeSecret(authRef, userToken);

          const igAccount = this.repo.upsertPlatformAccount({
            platform: "instagram",
            accountName: ig.username ? `@${ig.username}` : `@instagram_${ig.id}`,
            accountId: ig.id,
            authReference: authRef,
            status: "connected",
          });

          this.onAccountConnected(igAccount);
          discoveredCount++;
        }
      }
    }

    if (discoveredCount === 0) {
      // Store under default Instagram account if no linked business account found
      const authRef = "oauth-ig-default";
      this.storeSecret(authRef, userToken);
      const acc = this.repo.upsertPlatformAccount({
        platform: "instagram",
        accountName: "@instagram_account",
        accountId: "ig-default",
        authReference: authRef,
        status: "connected",
      });
      this.onAccountConnected(acc);
    }
  }

  private closeServer(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
