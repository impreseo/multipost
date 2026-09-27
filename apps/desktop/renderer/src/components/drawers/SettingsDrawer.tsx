import { useEffect, useState } from "react";
import { getWelz, useAppStore } from "../../store";

interface Props {
  onClose: () => void;
}

export function SettingsDrawer({ onClose }: Props) {
  const devMode = useAppStore((s) => s.devMode);
  const setDevMode = useAppStore((s) => s.setDevMode);
  const timezone = useAppStore((s) => s.timezone);
  const setTimezone = useAppStore((s) => s.setTimezone);
  const pushToast = useAppStore((s) => s.pushToast);

  const [dataRoot, setDataRoot] = useState("");
  const [enginePaused, setEnginePaused] = useState(false);

  // Developer OAuth state
  const [oauthStatus, setOauthStatus] = useState<{
    linkedin: { configured: boolean; clientId?: string };
    instagram: { configured: boolean; appId?: string };
    whatsapp: { configured: boolean; phoneId?: string };
  } | null>(null);

  // Form fields for credentials
  const [liClientId, setLiClientId] = useState("");
  const [liClientSecret, setLiClientSecret] = useState("");
  const [metaAppId, setMetaAppId] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");
  const [waPhoneId, setWaPhoneId] = useState("");
  const [waToken, setWaToken] = useState("");
  const [waWabaId, setWaWabaId] = useState("");

  const redirectUri = "http://127.0.0.1:54321/callback";

  async function loadSettings() {
    try {
      const s = await getWelz().settings.get();
      setDevMode(s.devMode);
      setTimezone(s.timezone);
      setDataRoot(s.dataRoot);
      setEnginePaused(s.automationPaused);

      const status = await getWelz().oauth?.status?.();
      if (status) {
        setOauthStatus(status);
        if (status.linkedin.clientId) setLiClientId(status.linkedin.clientId);
        if (status.instagram.appId) setMetaAppId(status.instagram.appId);
        if (status.whatsapp.phoneId) setWaPhoneId(status.whatsapp.phoneId);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadSettings();
  }, [setDevMode, setTimezone]);

  async function handleToggleDevMode() {
    const nextMode = !devMode;
    try {
      await getWelz().settings.set({ devMode: nextMode });
      setDevMode(nextMode);
      pushToast(nextMode ? "Simulation mode enabled." : "Production API mode enabled.");
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Failed to toggle mode", "error");
    }
  }

  async function handleChangeStorage() {
    try {
      const path = await getWelz().dialog.chooseDataRoot();
      if (!path) return;
      await getWelz().settings.set({ dataRoot: path });
      setDataRoot(path);
      pushToast("Storage location updated. Restart app to apply.");
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Failed to change directory", "error");
    }
  }

  async function handleTimezoneBlur() {
    try {
      await getWelz().settings.set({ timezone });
      pushToast("Timezone saved.");
    } catch {
      // ignore
    }
  }

  async function toggleEngine() {
    try {
      if (enginePaused) {
        await getWelz().automation.resume();
        setEnginePaused(false);
        pushToast("Automation resumed.");
      } else {
        await getWelz().automation.pause();
        setEnginePaused(true);
        pushToast("Automation paused.");
      }
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Toggle failed", "error");
    }
  }

  async function saveLinkedInCredentials() {
    if (!liClientId.trim()) {
      pushToast("Please enter LinkedIn Client ID", "error");
      return;
    }
    try {
      const res = await getWelz().oauth.saveConfig({
        platform: "linkedin",
        clientId: liClientId,
        clientSecret: liClientSecret || undefined,
      });
      pushToast(res.message, res.ok ? "default" : "error");
      setLiClientSecret("");
      await loadSettings();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Failed to save LinkedIn config", "error");
    }
  }

  async function saveMetaCredentials() {
    if (!metaAppId.trim()) {
      pushToast("Please enter Meta App ID", "error");
      return;
    }
    try {
      const res = await getWelz().oauth.saveConfig({
        platform: "instagram",
        appId: metaAppId,
        appSecret: metaAppSecret || undefined,
      });
      pushToast(res.message, res.ok ? "default" : "error");
      setMetaAppSecret("");
      await loadSettings();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Failed to save Meta config", "error");
    }
  }

  async function saveWhatsAppCredentials() {
    if (!waPhoneId.trim()) {
      pushToast("Please enter WhatsApp Phone Number ID", "error");
      return;
    }
    try {
      const res = await getWelz().oauth.saveConfig({
        platform: "whatsapp",
        phoneId: waPhoneId,
        token: waToken || undefined,
        wabaId: waWabaId || undefined,
      });
      pushToast(res.message, res.ok ? "default" : "error");
      setWaToken("");
      await loadSettings();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Failed to save WhatsApp config", "error");
    }
  }

  function copyRedirectUri() {
    void navigator.clipboard.writeText(redirectUri);
    pushToast("Redirect URI copied to clipboard.");
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2 className="drawer-title">Settings</h2>
          <button type="button" className="drawer-close-btn" onClick={onClose} title="Close drawer">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          {/* Execution Mode */}
          <div className="drawer-section-title">Execution Mode</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              background: "var(--bg-app)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                {devMode ? "● Simulation / Mock Sandbox" : "● Production Official APIs"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {devMode
                  ? "Dispatches complete locally with mock credentials"
                  : "Dispatches call real LinkedIn, Meta, and WhatsApp APIs"}
              </div>
            </div>

            <button
              type="button"
              className="btn-tiny"
              style={{
                background: devMode ? "var(--warning-muted)" : "var(--primary-muted)",
                color: devMode ? "var(--warning)" : "var(--primary)",
                borderColor: devMode ? "rgba(245, 158, 11, 0.3)" : "rgba(56, 189, 248, 0.3)",
              }}
              onClick={handleToggleDevMode}
            >
              {devMode ? "Switch to Real API" : "Switch to Simulation"}
            </button>
          </div>

          {/* Timezone */}
          <div className="drawer-form-group" style={{ marginTop: 14 }}>
            <label className="drawer-form-label">Timezone</label>
            <input
              type="text"
              className="drawer-form-input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              onBlur={handleTimezoneBlur}
              placeholder="e.g. Asia/Kolkata, UTC, America/New_York"
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Used for scheduled post dispatch calculations and audit timestamps.
            </span>
          </div>

          {/* Developer / OAuth API Credentials */}
          <div className="drawer-section-title" style={{ marginTop: 18 }}>
            API Connections & OAuth Setup
          </div>

          {/* Redirect URI Box */}
          <div
            style={{
              padding: "10px 12px",
              background: "var(--bg-app)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
              Registered OAuth Redirect URI:
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <code style={{ fontSize: 11, color: "#38bdf8", flex: 1 }}>{redirectUri}</code>
              <button type="button" className="btn-tiny" onClick={copyRedirectUri}>
                Copy
              </button>
            </div>
            <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginTop: 4 }}>
              Register this exact URI in your LinkedIn Developer App and Meta App Dashboard.
            </span>
          </div>

          {/* LinkedIn Credentials */}
          <div
            style={{
              padding: "12px",
              background: "var(--bg-app)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="dest-platform-badge badge-linkedin">LinkedIn</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Developer App</span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: 3,
                  background: oauthStatus?.linkedin.configured ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: oauthStatus?.linkedin.configured ? "#10b981" : "#ef4444",
                }}
              >
                {oauthStatus?.linkedin.configured ? "Configured ✓" : "Unconfigured"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                type="text"
                className="drawer-form-input"
                placeholder="Client ID (e.g. 78xxxxxxxxxxxx)"
                value={liClientId}
                onChange={(e) => setLiClientId(e.target.value)}
              />
              <input
                type="password"
                className="drawer-form-input"
                placeholder={oauthStatus?.linkedin.configured ? "Client Secret (configured ••••••••)" : "Client Secret"}
                value={liClientSecret}
                onChange={(e) => setLiClientSecret(e.target.value)}
              />
              <button
                type="button"
                className="btn-tiny"
                style={{ alignSelf: "flex-end", marginTop: 2 }}
                onClick={saveLinkedInCredentials}
              >
                Save LinkedIn Credentials
              </button>
            </div>
          </div>

          {/* Meta / Instagram Credentials */}
          <div
            style={{
              padding: "12px",
              background: "var(--bg-app)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="dest-platform-badge badge-instagram">Instagram</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Meta App</span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: 3,
                  background: oauthStatus?.instagram.configured ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: oauthStatus?.instagram.configured ? "#10b981" : "#ef4444",
                }}
              >
                {oauthStatus?.instagram.configured ? "Configured ✓" : "Unconfigured"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                type="text"
                className="drawer-form-input"
                placeholder="Meta App ID (e.g. 123456789012345)"
                value={metaAppId}
                onChange={(e) => setMetaAppId(e.target.value)}
              />
              <input
                type="password"
                className="drawer-form-input"
                placeholder={oauthStatus?.instagram.configured ? "Meta App Secret (configured ••••••••)" : "Meta App Secret"}
                value={metaAppSecret}
                onChange={(e) => setMetaAppSecret(e.target.value)}
              />
              <button
                type="button"
                className="btn-tiny"
                style={{ alignSelf: "flex-end", marginTop: 2 }}
                onClick={saveMetaCredentials}
              >
                Save Meta Credentials
              </button>
            </div>
          </div>

          {/* WhatsApp Cloud API Credentials */}
          <div
            style={{
              padding: "12px",
              background: "var(--bg-app)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="dest-platform-badge badge-whatsapp">WhatsApp</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Cloud API</span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: 3,
                  background: oauthStatus?.whatsapp.configured ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: oauthStatus?.whatsapp.configured ? "#10b981" : "#ef4444",
                }}
              >
                {oauthStatus?.whatsapp.configured ? "Configured ✓" : "Unconfigured"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                type="text"
                className="drawer-form-input"
                placeholder="Phone Number ID (e.g. 109876543210987)"
                value={waPhoneId}
                onChange={(e) => setWaPhoneId(e.target.value)}
              />
              <input
                type="text"
                className="drawer-form-input"
                placeholder="WhatsApp Business Account ID (WABA ID)"
                value={waWabaId}
                onChange={(e) => setWaWabaId(e.target.value)}
              />
              <input
                type="password"
                className="drawer-form-input"
                placeholder={oauthStatus?.whatsapp.configured ? "Permanent Access Token (configured ••••••••)" : "Permanent Access Token"}
                value={waToken}
                onChange={(e) => setWaToken(e.target.value)}
              />
              <button
                type="button"
                className="btn-tiny"
                style={{ alignSelf: "flex-end", marginTop: 2 }}
                onClick={saveWhatsAppCredentials}
              >
                Save WhatsApp Credentials
              </button>
            </div>
          </div>

          {/* Automation Engine */}
          <div className="drawer-section-title">Automation Engine</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              background: "var(--bg-app)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                {enginePaused ? "Engine Paused" : "Engine Active"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {enginePaused ? "Automatic dispatching is halted" : "Scheduler ticks every 30s"}
              </div>
            </div>

            <button type="button" className="btn-tiny" onClick={toggleEngine}>
              {enginePaused ? "Resume" : "Pause"}
            </button>
          </div>

          {/* Storage Directory */}
          <div className="drawer-section-title">Local Workspace Storage</div>
          <div className="drawer-form-group">
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Database & Media Folder:</span>
            <div
              style={{
                padding: "8px 10px",
                background: "var(--bg-app)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--text-secondary)",
                wordBreak: "break-all",
              }}
            >
              {dataRoot || "Default local directory"}
            </div>
            <button
              type="button"
              className="btn-quiet"
              style={{ border: "1px solid var(--border-subtle)", alignSelf: "flex-start", marginTop: 4 }}
              onClick={handleChangeStorage}
            >
              Change Location…
            </button>
          </div>
        </div>

        <div className="drawer-footer">
          <button type="button" className="btn-quiet" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
