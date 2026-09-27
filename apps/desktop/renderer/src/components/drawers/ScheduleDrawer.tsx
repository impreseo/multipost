import type { PlatformAccountRecord } from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";
import { useAppStore } from "../../store";

interface Props {
  date: string;
  time: string;
  selectedAccounts: PlatformAccountRecord[];
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onConfirmSchedule: () => void;
  onClose: () => void;
}

export function ScheduleDrawer({
  date,
  time,
  selectedAccounts,
  onDateChange,
  onTimeChange,
  onConfirmSchedule,
  onClose,
}: Props) {
  const timezone = useAppStore((s) => s.timezone);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2 className="drawer-title">Schedule Post</h2>
          <button type="button" className="drawer-close-btn" onClick={onClose} title="Close drawer">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4 }}>
            Set the date and time to dispatch your post across the selected channels.
          </p>

          <div className="drawer-form-group">
            <label className="drawer-form-label">Date</label>
            <input
              type="date"
              className="drawer-form-input"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>

          <div className="drawer-form-group">
            <label className="drawer-form-label">Time</label>
            <input
              type="time"
              className="drawer-form-input"
              value={time}
              onChange={(e) => onTimeChange(e.target.value)}
            />
          </div>

          <div className="drawer-form-group">
            <label className="drawer-form-label">Timezone</label>
            <div
              style={{
                padding: "8px 12px",
                background: "var(--bg-app)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {timezone || "UTC"}
            </div>
          </div>

          <div className="drawer-section-title">Selected Destinations ({selectedAccounts.length})</div>

          {selectedAccounts.length === 0 ? (
            <div style={{ color: "var(--warning)", fontSize: 12 }}>
              ⚠ No destinations selected. Please select at least one channel from the left rail.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {selectedAccounts.map((acc) => (
                <div
                  key={acc.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: "var(--bg-app)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 12,
                  }}
                >
                  <span className={`dest-platform-badge badge-${acc.platform}`}>
                    {PLATFORM_LABELS[acc.platform]}
                  </span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{acc.accountName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="drawer-footer">
          <button type="button" className="btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-publish-cta"
            disabled={selectedAccounts.length === 0}
            onClick={() => {
              onConfirmSchedule();
              onClose();
            }}
          >
            Schedule Post →
          </button>
        </div>
      </div>
    </div>
  );
}
