import { useEffect, useState } from "react";
import { getWelz, useAppStore } from "../../store";

interface Props {
  onClose: () => void;
}

export function AutomateDrawer({ onClose }: Props) {
  const [publishingTiming, setPublishingTiming] = useState<"now" | "schedule" | "repeat">("schedule");
  const [repeatMode, setRepeatMode] = useState<"daily" | "weekly" | "custom">("daily");
  const [retryTemporary, setRetryTemporary] = useState(true);
  const [enginePaused, setEnginePaused] = useState(false);
  const pushToast = useAppStore((s) => s.pushToast);

  useEffect(() => {
    void getWelz()
      .settings.get()
      .then((s) => setEnginePaused(s.automationPaused));
  }, []);

  async function toggleEngine() {
    try {
      if (enginePaused) {
        await getWelz().automation.resume();
        setEnginePaused(false);
        pushToast("Automation engine resumed.");
      } else {
        await getWelz().automation.pause();
        setEnginePaused(true);
        pushToast("Automation engine paused.");
      }
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Engine toggle failed", "error");
    }
  }

  function handleSave() {
    pushToast(`Automation saved: ${publishingTiming === "repeat" ? `Repeat ${repeatMode}` : publishingTiming}, retry: ${retryTemporary ? "enabled" : "disabled"}.`);
    onClose();
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2 className="drawer-title">AUTOMATE THIS POST</h2>
          <button type="button" className="drawer-close-btn" onClick={onClose} title="Close drawer">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-section-title">Publishing</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { id: "now", label: "Now" },
              { id: "schedule", label: "Schedule" },
              { id: "repeat", label: "Repeat" },
            ].map((opt) => (
              <label
                key={opt.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  background: publishingTiming === opt.id ? "rgba(56, 189, 248, 0.06)" : "var(--bg-app)",
                  border: `1px solid ${publishingTiming === opt.id ? "rgba(56, 189, 248, 0.35)" : "var(--border-subtle)"}`,
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontSize: 13,
                  color: publishingTiming === opt.id ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                <input
                  type="radio"
                  name="timing"
                  checked={publishingTiming === opt.id}
                  onChange={() => setPublishingTiming(opt.id as any)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {publishingTiming === "repeat" && (
            <>
              <div className="drawer-section-title">Repeat Frequency</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { id: "daily", label: "Every day" },
                  { id: "weekly", label: "Every week" },
                  { id: "custom", label: "Custom" },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      background: repeatMode === opt.id ? "rgba(56, 189, 248, 0.06)" : "var(--bg-app)",
                      border: `1px solid ${repeatMode === opt.id ? "rgba(56, 189, 248, 0.35)" : "var(--border-subtle)"}`,
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      fontSize: 13,
                      color: repeatMode === opt.id ? "var(--text-primary)" : "var(--text-secondary)",
                    }}
                  >
                    <input
                      type="radio"
                      name="repeatFrequency"
                      checked={repeatMode === opt.id}
                      onChange={() => setRepeatMode(opt.id as any)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          <div className="drawer-section-title">Recovery</div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              background: "var(--bg-app)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontSize: 13,
              color: "var(--text-primary)",
            }}
          >
            <input
              type="checkbox"
              checked={retryTemporary}
              onChange={(e) => setRetryTemporary(e.target.checked)}
            />
            <span>Retry temporary failures</span>
          </label>

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
                Engine: {enginePaused ? "Paused" : "Running"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {enginePaused ? "Automatic dispatch is halted" : "Scheduler active"}
              </div>
            </div>

            <button
              type="button"
              className="btn-tiny"
              style={{
                background: enginePaused ? "var(--primary-muted)" : "var(--bg-elevated)",
                color: enginePaused ? "var(--primary)" : "var(--text-secondary)",
              }}
              onClick={toggleEngine}
            >
              {enginePaused ? "Resume" : "Pause"}
            </button>
          </div>
        </div>

        <div className="drawer-footer">
          <button type="button" className="btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-publish-cta" onClick={handleSave}>
            Save automation
          </button>
        </div>
      </div>
    </div>
  );
}
