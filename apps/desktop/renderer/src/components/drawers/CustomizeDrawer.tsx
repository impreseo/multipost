import { useState } from "react";
import type { Platform, PlatformAccountRecord, PostVariantRecord } from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";
import { getWelz, useAppStore } from "../../store";

interface Props {
  postId: string | null;
  masterContent: string;
  variants: PostVariantRecord[];
  selectedAccounts: PlatformAccountRecord[];
  onVariantUpdated: (updated: PostVariantRecord) => void;
  onClose: () => void;
}

export function CustomizeDrawer({
  postId,
  masterContent,
  variants,
  selectedAccounts,
  onVariantUpdated,
  onClose,
}: Props) {
  const selectedPlatforms = Array.from(new Set(selectedAccounts.map((a) => a.platform)));
  const [activePlatform, setActivePlatform] = useState<Platform>(
    selectedPlatforms[0] || "instagram"
  );
  const pushToast = useAppStore((s) => s.pushToast);

  const activeVariant = variants.find((v) => v.platform === activePlatform);
  const isCustomized = Boolean(
    activeVariant && activeVariant.content && activeVariant.content !== masterContent
  );

  async function handleContentChange(text: string) {
    if (!activeVariant) return;
    try {
      const updated = await getWelz().variants.update(activeVariant.id, text);
      onVariantUpdated(updated);
    } catch {
      // silent
    }
  }

  async function handleResetToMaster() {
    if (!postId) return;
    try {
      const reset = await getWelz().variants.reset(postId, activePlatform);
      onVariantUpdated(reset);
      pushToast(`Reset ${PLATFORM_LABELS[activePlatform]} to master content.`);
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Reset failed", "error");
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2 className="drawer-title">CUSTOMIZE CONTENT</h2>
          <button type="button" className="drawer-close-btn" onClick={onClose} title="Close drawer">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45 }}>
            Adapt your message per platform. Content here overrides the master copy for that specific destination.
          </p>

          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {selectedPlatforms.map((p) => (
              <button
                key={p}
                type="button"
                className={`variant-pill ${activePlatform === p ? "active" : ""}`}
                onClick={() => setActivePlatform(p)}
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              {PLATFORM_LABELS[activePlatform]} Copy
            </span>
            {isCustomized ? (
              <button
                type="button"
                className="btn-tiny btn-tiny-ghost"
                onClick={handleResetToMaster}
                title="Sync back to master content"
              >
                Sync with Master
              </button>
            ) : (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Currently using master</span>
            )}
          </div>

          <textarea
            className="drawer-form-input"
            style={{
              minHeight: 280,
              fontSize: 14,
              lineHeight: 1.6,
              resize: "vertical",
              padding: "12px 14px",
              fontFamily: "var(--font-sans)",
            }}
            placeholder={`Custom copy for ${PLATFORM_LABELS[activePlatform]}...`}
            value={activeVariant?.content || ""}
            onChange={(e) => void handleContentChange(e.target.value)}
          />

          <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
            <span>{activeVariant?.content?.length || 0} characters</span>
            <span>
              {activePlatform === "linkedin"
                ? "Max 3,000"
                : activePlatform === "instagram"
                ? "Max 2,200"
                : "Max 4,096"}
            </span>
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
