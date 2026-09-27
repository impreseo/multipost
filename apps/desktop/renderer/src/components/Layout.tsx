import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAppStore } from "../store";
import { CommandCenter } from "./CommandCenter";

export function Layout() {
  const devMode = useAppStore((s) => s.devMode);
  const setDevMode = useAppStore((s) => s.setDevMode);
  const setTimezone = useAppStore((s) => s.setTimezone);
  const activeDrawer = useAppStore((s) => s.activeDrawer);
  const setActiveDrawer = useAppStore((s) => s.setActiveDrawer);
  const autosaveStatus = useAppStore((s) => s.autosaveStatus);
  const connectedCount = useAppStore((s) => s.connectedCount);

  const [isCmdOpen, setCmdOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    void window.welz?.getMeta().then((meta) => {
      setDevMode(meta.devMode);
    });
    void window.welz?.settings.get().then((s) => {
      setDevMode(s.devMode);
      setTimezone(s.timezone);
    });
  }, [setDevMode, setTimezone]);

  // Global keyboard shortcuts: Ctrl+K for command center, Ctrl+N for new post
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && (e.key === "k" || e.key === "K" || e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      } else if (mod && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        navigate("/");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return (
    <div className="app-shell">
      {/* MINIMAL TOP DESKTOP HEADER */}
      <header className="cockpit-topbar">
        <div className="topbar-left-zone">
          <span className="brand-logo-text" onClick={() => navigate("/")} role="button" tabIndex={0} style={{ cursor: "pointer" }}>
            WELZ
          </span>
          <button
            type="button"
            className="topbar-nav-link active"
            onClick={() => navigate("/")}
            title="Publishing workspace"
          >
            Publish
          </button>
          <button
            type="button"
            className={`topbar-nav-link ${activeDrawer === "drafts" ? "active" : ""}`}
            onClick={() => setActiveDrawer(activeDrawer === "drafts" ? null : "drafts")}
            title="Open drafts & content library"
          >
            Drafts
          </button>
        </div>

        {/* CENTER SPOTLIGHT SEARCH */}
        <div className="topbar-center-zone">
          <button
            type="button"
            className="topbar-spotlight-btn"
            onClick={() => setCmdOpen(true)}
            title="Search content, commands, and media (Ctrl+K)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="spotlight-placeholder">Search or jump to...</span>
            <kbd className="spotlight-kbd">⌘K</kbd>
          </button>
        </div>

        {/* RIGHT STATUS & ACTIONS */}
        <div className="topbar-right-zone">
          <span className="topbar-meta-item" title="Autosave status">
            <span className="autosave-dot" />
            <span>{autosaveStatus || "Saved"}</span>
          </span>

          <button
            type="button"
            className={`topbar-nav-link ${activeDrawer === "connections" ? "active" : ""}`}
            onClick={() => setActiveDrawer(activeDrawer === "connections" ? null : "connections")}
            title="Manage connected destinations"
          >
            <span className="conn-dot" />
            <span>Connected</span>
          </button>

          <button
            type="button"
            className={`topbar-nav-link ${activeDrawer === "activity" ? "active" : ""}`}
            onClick={() => setActiveDrawer(activeDrawer === "activity" ? null : "activity")}
            title="Publishing activity & audit history"
          >
            Activity
          </button>

          <button
            type="button"
            className={`topbar-nav-link ${activeDrawer === "settings" ? "active" : ""}`}
            onClick={() => setActiveDrawer(activeDrawer === "settings" ? null : "settings")}
            title="Workspace settings"
          >
            Settings
          </button>

          {devMode ? <span className="topbar-sim-badge">SIMULATION</span> : null}
        </div>
      </header>

      {/* WORKSPACE VIEWPORT */}
      <main className="app-content">
        <Outlet />
      </main>

      <CommandCenter isOpen={isCmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
