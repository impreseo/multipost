import { useEffect, useState } from "react";
import type { PlatformAccountRecord } from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";
import { formatDateTime, getWelz, useAppStore } from "../store";

interface PlatformStatusInfo {
  connected: boolean;
  mode: string;
  accountType?: string;
  capabilities: string[];
  message: string;
  lastVerifiedAt: string | null;
  health: string;
  requiresConfig?: boolean;
  configRequirements?: string[];
}

export function PlatformsPage() {
  const devMode = useAppStore((s) => s.devMode);
  const pushToast = useAppStore((s) => s.pushToast);
  const [accounts, setAccounts] = useState<PlatformAccountRecord[]>([]);
  const [statuses, setStatuses] = useState<Record<string, PlatformStatusInfo>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [verifyModalAccount, setVerifyModalAccount] = useState<PlatformAccountRecord | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  async function refresh() {
    const list = await getWelz().platforms.list();
    setAccounts(list);

    // Fetch detailed status for each account
    const statusMap: Record<string, PlatformStatusInfo> = {};
    for (const acc of list) {
      try {
        const info = await getWelz().platforms.status(acc.id);
        statusMap[acc.id] = info;
      } catch {
        // fallback
      }
    }
    setStatuses(statusMap);
  }

  useEffect(() => {
    void refresh();
  }, [devMode]);

  async function handleTest(accountId: string) {
    setTestingId(accountId);
    try {
      const res = await getWelz().platforms.test(accountId);
      pushToast(res.message, res.ok ? "default" : "error");
      await refresh();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Test failed", "error");
    } finally {
      setTestingId(null);
    }
  }

  async function handleConnect(accountId: string) {
    try {
      const res = await getWelz().platforms.connect(accountId);
      pushToast(res.message, res.ok ? "default" : "error");
      await refresh();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Connection failed", "error");
    }
  }

  async function handleDisconnect(accountId: string, accountName: string) {
    if (!confirm(`Disconnect destination "${accountName}"? Future scheduled jobs targeting this channel will require re-authorization.`)) {
      return;
    }
    try {
      await getWelz().platforms.disconnect(accountId);
      pushToast("Destination account disconnected.");
      await refresh();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Disconnect failed", "error");
    }
  }

  async function handleVerifyLive(account: PlatformAccountRecord) {
    setIsVerifying(true);
    try {
      const res = await getWelz().platforms.verifyLive({
        accountId: account.id,
        content: `WELZ live integration verification (${new Date().toLocaleTimeString()}).`,
      });

      if (res.ok && res.externalPostId) {
        pushToast(`LIVE VERIFIED ✓ Remote ID: ${res.externalPostId}`, "default");
        await refresh();
        setVerifyModalAccount(null);
      } else {
        const errorMsg = res.error || "Live verification failed.";
        pushToast(`LIVE VERIFICATION FAILED: ${errorMsg}`, "error");
      }
    } catch (err: unknown) {
      pushToast(`Verification failed: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <div className="platforms-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Platform Connections</h1>
          <p className="page-subtitle">
            Manage channel authorization, verify API capabilities, and inspect connection health.
          </p>
        </div>
        <div className="platform-header-right">
          <span className={`integration-badge ${devMode ? "mode-sim" : "mode-real"}`}>
            {devMode ? "MODE: SIMULATION / LOCAL TEST" : "MODE: PRODUCTION / OFFICIAL API"}
          </span>
        </div>
      </header>

      {devMode ? (
        <div className="notice-banner notice-warning" style={{ marginBottom: 20 }}>
          <div className="notice-icon">⚠</div>
          <div className="notice-content">
            <strong>Simulation Sandbox Active:</strong> All platform publishing actions and validations are currently simulated locally. Real external tokens are not transmitted to LinkedIn, Meta, or WhatsApp servers.
          </div>
        </div>
      ) : (
        <div className="notice-banner notice-info" style={{ marginBottom: 20 }}>
          <div className="notice-icon">ℹ</div>
          <div className="notice-content">
            <strong>Official API Integration:</strong> WELZ Publisher maintains external credentials inside the OS-secured Electron keychain. Content is only marked as published when the provider confirms creation.
          </div>
        </div>
      )}

      <div className="platforms-grid">
        {accounts.map((account) => {
          const status = statuses[account.id];
          const isConnected = account.status === "connected";
          const isTesting = testingId === account.id;

          const isOrg = account.accountName.toLowerCase().includes("welz") || (account.platform === "linkedin" && account.accountName.toLowerCase().includes("page"));
          const accountTypeLabel =
            account.platform === "whatsapp"
              ? "WhatsApp Business Messaging (Cloud API)"
              : account.platform === "instagram"
              ? "Meta Instagram Professional Account"
              : isOrg
              ? "LinkedIn Organization Page"
              : "LinkedIn Personal Member Profile";

          const defaultCaps =
            account.platform === "whatsapp"
              ? ["text", "media", "approved_templates"]
              : account.platform === "instagram"
              ? ["image", "video/reels", "carousel", "caption"]
              : ["text", "image", "video", "document"];

          const capabilities = status?.capabilities || defaultCaps;

          return (
            <div key={account.id} className="platform-card">
              <div className="platform-card-top">
                <div className="platform-identity">
                  <span className={`platform-logo-badge badge-${account.platform}`}>
                    {PLATFORM_LABELS[account.platform]}
                  </span>
                  <div>
                    <h2 className="platform-account-title">{account.accountName}</h2>
                    <span className="platform-type-desc">{accountTypeLabel}</span>
                  </div>
                </div>

                <div className="platform-status-pill-box">
                  <span className={`status-badge-connection ${isConnected ? "badge-connected" : "badge-disconnected"}`}>
                    <span className="dot" />
                    {isConnected ? "CONNECTED" : "UNLINKED"}
                  </span>
                </div>
              </div>

              {/* PLATFORM SPECIFIC ARCHITECTURE NOTICES */}
              <div className="platform-architecture-note">
                {account.platform === "linkedin" && (
                  <p>
                    <strong>LinkedIn Posts API:</strong> Distinguishes between member profile (<code>w_member_social</code>) and organization page (<code>w_organization_social</code>). Char limit: 3,000.
                  </p>
                )}
                {account.platform === "instagram" && (
                  <p>
                    <strong>Meta Content Publishing API:</strong> Professional (Creator / Business) accounts only. Requires publicly accessible HTTPS media URLs for container processing.
                  </p>
                )}
                {account.platform === "whatsapp" && (
                  <p>
                    <strong>Business Messaging:</strong> WhatsApp Cloud API dispatch. Direct customer and channel announcements. Not a social-feed publishing destination.
                  </p>
                )}
              </div>

              {/* CAPABILITIES */}
              <div className="platform-capabilities-section">
                <span className="cap-label">Verified Capabilities:</span>
                <div className="cap-list">
                  {capabilities.map((cap) => (
                    <span key={cap} className="cap-badge">
                      ✓ {cap}
                    </span>
                  ))}
                </div>
              </div>

              {/* CONNECTION MESSAGE & REQUIREMENTS */}
              <div className="platform-status-message">
                <div className="status-msg-title">Connection Status:</div>
                <div className="status-msg-text">
                  {status?.message || (isConnected ? "Authenticated & active." : "API authorization not configured.")}
                </div>
                {status?.requiresConfig && status.configRequirements && (
                  <ul className="config-requirements-list">
                    {status.configRequirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* CARD FOOTER WITH ACTIONS */}
              <div className="platform-card-footer">
                <div className="platform-verified-meta">
                  {account.lastVerifiedAt ? (
                    <span>Last checked: {formatDateTime(account.lastVerifiedAt)}</span>
                  ) : (
                    <span>Not yet verified</span>
                  )}
                </div>

                <div className="platform-actions-row">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={isTesting}
                    onClick={() => void handleTest(account.id)}
                    title="Validate stored token and check remote API endpoint"
                  >
                    {isTesting ? "Testing…" : "Test Connection"}
                  </button>

                  {isConnected && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        background: "rgba(59, 130, 246, 0.12)",
                        color: "#60a5fa",
                        border: "1px solid rgba(59, 130, 246, 0.3)",
                        fontWeight: 600,
                      }}
                      onClick={() => setVerifyModalAccount(account)}
                      title="Perform genuine production API publish test"
                    >
                      Verify Live ↗
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void handleConnect(account.id)}
                  >
                    {isConnected ? "Reconnect" : "Connect"}
                  </button>

                  {isConnected && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void handleDisconnect(account.id, account.accountName)}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* VERIFY LIVE MODAL */}
      {verifyModalAccount && (
        <div
          className="drawer-backdrop"
          style={{ zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setVerifyModalAccount(null)}
        >
          <div
            className="drawer-panel"
            style={{
              maxWidth: 440,
              maxHeight: "none",
              borderRadius: "var(--radius-md)",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
              border: "1px solid var(--border-medium)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                Verify Live Publishing
              </h3>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setVerifyModalAccount(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: "var(--text-primary)", margin: "14px 0 8px 0" }}>
              This will create an actual live post or message on your connected account:
            </p>

            <div
              style={{
                padding: "10px 14px",
                background: "var(--bg-app)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>
                {PLATFORM_LABELS[verifyModalAccount.platform]} — {verifyModalAccount.accountName}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Content: "WELZ live integration verification ({new Date().toLocaleTimeString()})."
              </div>
            </div>

            <div
              style={{
                fontSize: 11,
                color: "#f59e0b",
                background: "rgba(245, 158, 11, 0.1)",
                padding: "8px 10px",
                borderRadius: 4,
                marginBottom: 16,
              }}
            >
              ⚠ A genuine API call will be executed against the official provider endpoint. Real post ID and remote confirmation will be captured.
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={isVerifying}
                onClick={() => setVerifyModalAccount(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isVerifying}
                onClick={() => void handleVerifyLive(verifyModalAccount)}
              >
                {isVerifying ? "Publishing Real Test..." : "Publish Real Test →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
