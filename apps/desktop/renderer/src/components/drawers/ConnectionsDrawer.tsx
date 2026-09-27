import { useEffect, useState } from "react";
import type { PlatformAccountRecord } from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";
import { getWelz, useAppStore } from "../../store";

interface Props {
  onClose: () => void;
  onChanged: () => void;
}

interface PlatformStatusInfo {
  connected: boolean;
  mode: string;
  accountType?: string;
  capabilities: string[];
  message: string;
  lastVerifiedAt: string | null;
  health: string;
}

export function ConnectionsDrawer({ onClose, onChanged }: Props) {
  const [accounts, setAccounts] = useState<PlatformAccountRecord[]>([]);
  const [statuses, setStatuses] = useState<Record<string, PlatformStatusInfo>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [verifyModalAccount, setVerifyModalAccount] = useState<PlatformAccountRecord | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [oauthConfig, setOauthConfig] = useState<{
    linkedin: { configured: boolean };
    instagram: { configured: boolean };
    whatsapp: { configured: boolean };
  } | null>(null);

  const devMode = useAppStore((s) => s.devMode);
  const pushToast = useAppStore((s) => s.pushToast);
  const setConnectedCount = useAppStore((s) => s.setConnectedCount);
  const setActiveDrawer = useAppStore((s) => s.setActiveDrawer);

  async function loadData() {
    try {
      const list = await getWelz().platforms.list();
      setAccounts(list);
      setConnectedCount(list.filter((a) => a.status === "connected").length);

      const statusMap: Record<string, PlatformStatusInfo> = {};
      for (const acc of list) {
        try {
          const info = await getWelz().platforms.status(acc.id);
          statusMap[acc.id] = info;
        } catch {
          // ignore
        }
      }
      setStatuses(statusMap);

      const cfg = await getWelz().oauth?.status?.();
      if (cfg) {
        setOauthConfig(cfg);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadData();

    // Listen for live background OAuth updates from loopback callback server
    const unsub = getWelz().oauth?.onPlatformsUpdated?.(async (newAccount) => {
      pushToast(`Connected: ${newAccount.accountName}`, "default");
      await loadData();
      onChanged();
    });

    return () => unsub?.();
  }, [devMode]);

  async function handleTest(accountId: string) {
    setTestingId(accountId);
    try {
      const res = await getWelz().platforms.test(accountId);
      pushToast(res.message, res.ok ? "default" : "error");
      await loadData();
      onChanged();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Test failed", "error");
    } finally {
      setTestingId(null);
    }
  }

  async function handleConnect(accountId: string) {
    setConnectingId(accountId);
    try {
      const res = await getWelz().platforms.connect(accountId);
      pushToast(res.message, res.ok ? "default" : "error");
      await loadData();
      onChanged();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Connection failed", "error");
    } finally {
      setConnectingId(null);
    }
  }

  async function handleDisconnect(accountId: string, accountName: string) {
    if (!confirm(`Disconnect "${accountName}"? Historical posts and analytics will remain preserved.`)) {
      return;
    }
    try {
      await getWelz().platforms.disconnect(accountId);
      pushToast("Destination disconnected.");
      await loadData();
      onChanged();
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
        await loadData();
        onChanged();
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
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h2 className="drawer-title">Platform Connections</h2>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {devMode ? "● Simulation / Sandbox Mode" : "● Official OAuth & Cloud APIs"}
            </span>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose} title="Close drawer">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          {devMode ? (
            <div
              style={{
                background: "var(--warning-muted)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                fontSize: 12,
                color: "var(--warning)",
                lineHeight: 1.4,
              }}
            >
              <strong>Simulation Sandbox Active:</strong> Publishing calls loop back locally with verified mock responses. To initiate live official OAuth authorization with LinkedIn, Meta, or WhatsApp, switch to Real Mode in Settings.
            </div>
          ) : (
            <div
              style={{
                background: "rgba(56, 189, 248, 0.08)",
                border: "1px solid rgba(56, 189, 248, 0.2)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.4,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong style={{ color: "var(--text-primary)" }}>Official Authorization Architecture:</strong>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Tokens are encrypted with OS safeStorage and never exposed to the renderer.
                </div>
              </div>
              <button
                type="button"
                className="btn-tiny"
                style={{ whiteSpace: "nowrap" }}
                onClick={() => setActiveDrawer("settings")}
              >
                API Credentials
              </button>
            </div>
          )}

          <div className="drawer-section-title">Connected Publishing Channels</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {accounts.map((acc) => {
              const info = statuses[acc.id];
              const isConnected = acc.status === "connected";
              const isTesting = testingId === acc.id;
              const isConnecting = connectingId === acc.id;
              const isConfigured =
                oauthConfig &&
                ((acc.platform === "linkedin" && oauthConfig.linkedin.configured) ||
                  (acc.platform === "instagram" && oauthConfig.instagram.configured) ||
                  (acc.platform === "whatsapp" && oauthConfig.whatsapp.configured));

              return (
                <div key={acc.id} className="drawer-card-item">
                  <div className="drawer-item-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className={`dest-platform-badge badge-${acc.platform}`}>
                        {PLATFORM_LABELS[acc.platform]}
                      </span>
                      <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>
                        {acc.accountName}
                      </strong>
                    </div>

                    <span
                      className="drawer-badge"
                      style={{
                        background: isConnected ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: isConnected ? "var(--success)" : "var(--error)",
                      }}
                    >
                      {isConnected ? "Connected ✓" : "Not Connected"}
                    </span>
                  </div>

                  {info?.message && (
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.35 }}>
                      {info.message}
                    </div>
                  )}

                  {!devMode && !isConfigured && !isConnected && (
                    <div style={{ fontSize: 11, color: "#f59e0b", background: "rgba(245, 158, 11, 0.1)", padding: "4px 8px", borderRadius: 4 }}>
                      Developer App ID & Secret required in Settings → API Credentials before live authorization.
                    </div>
                  )}

                  {info?.capabilities && info.capabilities.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                      {info.capabilities.map((cap) => (
                        <span
                          key={cap}
                          style={{
                            fontSize: 10,
                            padding: "1px 5px",
                            borderRadius: 3,
                            background: "var(--bg-elevated)",
                            color: "var(--text-muted)",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="drawer-item-meta" style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {info?.lastVerifiedAt
                        ? `Last verified: ${new Date(info.lastVerifiedAt).toLocaleDateString()} ${new Date(info.lastVerifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "Not verified"}
                    </span>

                    <div className="drawer-item-actions">
                      <button
                        type="button"
                        className="btn-tiny"
                        disabled={isTesting || !isConnected}
                        onClick={() => handleTest(acc.id)}
                        title="Test API connectivity & token credentials"
                      >
                        {isTesting ? "Testing..." : "Test"}
                      </button>

                      {isConnected && (
                        <button
                          type="button"
                          className="btn-tiny"
                          style={{
                            background: "rgba(56, 189, 248, 0.12)",
                            color: "#38bdf8",
                            borderColor: "rgba(56, 189, 248, 0.3)",
                          }}
                          onClick={() => setVerifyModalAccount(acc)}
                          title="Publish a real live verification post to confirm provider integration"
                        >
                          Verify Live
                        </button>
                      )}

                      {isConnected ? (
                        <button
                          type="button"
                          className="btn-tiny btn-tiny-danger"
                          onClick={() => handleDisconnect(acc.id, acc.accountName)}
                          title="Disconnect account"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-tiny"
                          style={{
                            background: "var(--primary-muted)",
                            color: "var(--primary)",
                            borderColor: "var(--primary)",
                          }}
                          disabled={isConnecting}
                          onClick={() => handleConnect(acc.id)}
                        >
                          {isConnecting ? "Authorizing..." : `Connect ${PLATFORM_LABELS[acc.platform]}`}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="drawer-footer">
          <button type="button" className="btn-quiet" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      {/* Explicit Live Verification Confirmation Modal */}
      {verifyModalAccount && (
        <div className="modal-backdrop" onClick={() => !isVerifying && setVerifyModalAccount(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Live API Verification</h3>
              <button
                type="button"
                className="drawer-close-btn"
                disabled={isVerifying}
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
                className="btn-quiet"
                disabled={isVerifying}
                onClick={() => setVerifyModalAccount(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-publish-cta"
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
