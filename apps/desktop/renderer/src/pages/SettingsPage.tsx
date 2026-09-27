import { useEffect, useState } from "react";
import { getWelz, useAppStore } from "../store";

export function SettingsPage() {
  const devMode = useAppStore((s) => s.devMode);
  const setDevMode = useAppStore((s) => s.setDevMode);
  const timezone = useAppStore((s) => s.timezone);
  const setTimezone = useAppStore((s) => s.setTimezone);
  const pushToast = useAppStore((s) => s.pushToast);
  const [dataRoot, setDataRoot] = useState("");
  const [automationPaused, setAutomationPaused] = useState(false);

  useEffect(() => {
    void getWelz()
      .settings.get()
      .then((s) => {
        setDevMode(s.devMode);
        setTimezone(s.timezone);
        setDataRoot(s.dataRoot);
        setAutomationPaused(s.automationPaused);
      });
  }, [setDevMode, setTimezone]);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Local workspace, scheduling, and development controls.</p>
      </header>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title">General</h2>
          <div className="field">
            <label className="field-label" htmlFor="tz">
              Timezone
            </label>
            <input
              id="tz"
              className="input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              onBlur={() =>
                void getWelz()
                  .settings.set({ timezone })
                  .then(() => pushToast("Timezone saved."))
              }
            />
          </div>
          <div className="field">
            <label className="field-label">Data location</label>
            <p className="mono">{dataRoot}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                const path = await getWelz().dialog.chooseDataRoot();
                if (!path) return;
                await getWelz().settings.set({ dataRoot: path });
                pushToast("Restart the app to use the new data location.");
              }}
            >
              Change storage location
            </button>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Automation</h2>
          <p style={{ color: "var(--text-secondary)" }}>
            Status: {automationPaused ? "Paused" : "Running"}
          </p>
          <div className="actions-row">
            {automationPaused ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  void getWelz()
                    .automation.resume()
                    .then(() => {
                      setAutomationPaused(false);
                      pushToast("Automation resumed.");
                    })
                }
              >
                Resume
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  void getWelz()
                    .automation.pause()
                    .then(() => {
                      setAutomationPaused(true);
                      pushToast("Automation paused.");
                    })
                }
              >
                Pause
              </button>
            )}
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Development mode</h2>
          <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
            Simulates platform adapter responses for local UI and automation testing. Simulated publishes
            are labelled and must not be treated as real external posts.
          </p>
          <label className="destination-item">
            <input
              type="checkbox"
              checked={devMode}
              onChange={(e) => {
                const next = e.target.checked;
                void getWelz()
                  .settings.set({ devMode: next })
                  .then(() => {
                    setDevMode(next);
                    pushToast(next ? "Development mode enabled." : "Development mode disabled.");
                  });
              }}
            />
            Enable development mode
          </label>
        </section>
      </div>
    </>
  );
}
