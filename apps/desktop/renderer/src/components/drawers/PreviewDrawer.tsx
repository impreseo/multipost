import { useEffect, useState } from "react";
import type { MediaRecord, Platform, PlatformAccountRecord, PostVariantRecord } from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";
import { PlatformPreview } from "../PlatformPreview";

interface Props {
  selectedAccounts: PlatformAccountRecord[];
  media: MediaRecord[];
  getContentForPlatform: (platform: Platform) => string;
  masterContent?: string;
  variants?: PostVariantRecord[];
  onClose: () => void;
}

type Tab = "all" | Platform;

export function PreviewDrawer({
  selectedAccounts,
  media,
  getContentForPlatform,
  masterContent = "",
  variants = [],
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [contentSource, setContentSource] = useState<"variant" | "master">("variant");

  const selectedPlatforms = Array.from(new Set(selectedAccounts.map((a) => a.platform)));

  // Keyboard navigation: Escape closes drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Determine content to show based on Master vs Variant toggle
  function resolveContent(platform: Platform): string {
    if (contentSource === "master") {
      return masterContent;
    }
    return getContentForPlatform(platform);
  }

  // Count platform-specific validation errors
  const platformValidation = {
    linkedin: {
      maxChars: 3000,
      charCount: resolveContent("linkedin").length,
      maxMedia: 9,
      valid: resolveContent("linkedin").length <= 3000 && media.length <= 9 && resolveContent("linkedin").trim().length > 0,
      errors: [
        ...(resolveContent("linkedin").length > 3000 ? ["Exceeds 3,000 char limit"] : []),
        ...(media.length > 9 ? ["Max 9 media attachments"] : []),
        ...(!resolveContent("linkedin").trim() ? ["Text required"] : []),
      ],
    },
    instagram: {
      maxChars: 2200,
      charCount: resolveContent("instagram").length,
      maxMedia: 10,
      valid:
        resolveContent("instagram").length <= 2200 &&
        media.length >= 1 &&
        media.length <= 10 &&
        resolveContent("instagram").trim().length > 0,
      errors: [
        ...(resolveContent("instagram").length > 2200 ? ["Exceeds 2,200 char limit"] : []),
        ...(media.length === 0 ? ["Requires image or video"] : []),
        ...(media.length > 10 ? ["Max 10 carousel items"] : []),
        ...(!resolveContent("instagram").trim() ? ["Caption required"] : []),
      ],
    },
    whatsapp: {
      maxChars: 4096,
      charCount: resolveContent("whatsapp").length,
      maxMedia: 4,
      valid: resolveContent("whatsapp").length <= 4096 && media.length <= 4 && resolveContent("whatsapp").trim().length > 0,
      errors: [
        ...(resolveContent("whatsapp").length > 4096 ? ["Exceeds 4,096 char limit"] : []),
        ...(media.length > 4 ? ["Max 4 attachments"] : []),
        ...(!resolveContent("whatsapp").trim() ? ["Message required"] : []),
      ],
    },
  };

  const hasAnyErrors = selectedAccounts.some((a) => !platformValidation[a.platform]?.valid);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel extra-wide" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="drawer-header" style={{ padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <h2 className="drawer-title" style={{ letterSpacing: "0.04em", fontSize: 13, fontWeight: 700 }}>
                LIVE PREVIEW
              </h2>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {activeTab === "all" ? "Side-by-Side Comparison" : PLATFORM_LABELS[activeTab]}
              </span>
            </div>

            {/* Platform Switcher */}
            <div className="preview-tabs">
              <button
                type="button"
                className={`preview-tab-btn ${activeTab === "all" ? "active" : ""}`}
                onClick={() => setActiveTab("all")}
                title="Compare all selected destinations side-by-side"
              >
                All (Compare)
              </button>
              {selectedPlatforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`preview-tab-btn ${activeTab === p ? "active" : ""}`}
                  onClick={() => setActiveTab(p)}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>

            {/* Master vs Variant Toggle */}
            <div className="content-source-toggle" title="Switch preview between Master content and platform customized variant">
              <button
                type="button"
                className={`source-toggle-btn ${contentSource === "master" ? "active" : ""}`}
                onClick={() => setContentSource("master")}
              >
                Master
              </button>
              <button
                type="button"
                className={`source-toggle-btn ${contentSource === "variant" ? "active" : ""}`}
                onClick={() => setContentSource("variant")}
              >
                Platform Variant
                {variants.length > 0 && <span className="source-dot" />}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              className={`preview-readiness-badge ${hasAnyErrors ? "badge-attention" : "badge-ready"}`}
            >
              {hasAnyErrors ? "⚠ Platform validation issues" : "✓ All destinations valid"}
            </div>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={onClose}
              title="Close preview (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body preview-drawer-body">
          {selectedAccounts.length === 0 ? (
            <div className="preview-empty-container">
              <div style={{ fontSize: 24, marginBottom: 8 }}>✦</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                No publishing destinations selected
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 360, margin: "6px auto 0" }}>
                Select one or more destinations from the top bar (LinkedIn, Instagram, WhatsApp) to preview how your content will appear.
              </p>
            </div>
          ) : activeTab === "all" ? (
            /* SIDE-BY-SIDE COMPARISON GRID */
            <div className="preview-comparison-grid">
              {selectedAccounts.map((acc) => {
                const p = acc.platform;
                const val = platformValidation[p];
                const content = resolveContent(p);

                return (
                  <div key={acc.id} className="comparison-column">
                    <div className="comparison-col-header">
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={`dest-platform-badge badge-${p}`}>
                          {PLATFORM_LABELS[p]}
                        </span>
                        <span className="comparison-acc-name">{acc.accountName}</span>
                      </div>
                      <span className={`comparison-status-pill ${val.valid ? "valid" : "error"}`}>
                        {val.valid ? "✓ Valid" : `⚠ ${val.errors[0]}`}
                      </span>
                    </div>

                    <div className="comparison-preview-wrap">
                      <PlatformPreview
                        platform={p}
                        account={acc}
                        content={content}
                        media={media}
                        isVariant={contentSource === "variant" && variants.some((v) => v.platform === p)}
                      />
                    </div>

                    {/* Compact comparative metrics footer */}
                    <div className="comparison-col-footer">
                      <div className="metrics-row">
                        <span className="metric-label">Chars</span>
                        <span className={`metric-val ${val.charCount > val.maxChars ? "over" : ""}`}>
                          {val.charCount.toLocaleString()} / {val.maxChars.toLocaleString()}
                        </span>
                      </div>
                      <div className="metrics-row">
                        <span className="metric-label">Media</span>
                        <span className="metric-val">
                          {media.length} / {val.maxMedia}
                        </span>
                      </div>
                      <div className="metrics-row">
                        <span className="metric-label">Source</span>
                        <span className="metric-val">
                          {contentSource === "variant" && variants.some((v) => v.platform === p)
                            ? "Customized"
                            : "Master"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* SINGLE PLATFORM FOCUSED PREVIEW */
            <div className="single-platform-preview-container">
              {selectedAccounts
                .filter((a) => a.platform === activeTab)
                .map((acc) => {
                  const val = platformValidation[activeTab];
                  const content = resolveContent(activeTab);

                  return (
                    <div key={acc.id} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <PlatformPreview
                        platform={activeTab}
                        account={acc}
                        content={content}
                        media={media}
                        isVariant={contentSource === "variant" && variants.some((v) => v.platform === activeTab)}
                      />

                      {/* Detailed Platform Validation Panel */}
                      <div className="preview-validation-panel">
                        <div className="validation-panel-header">
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                            {PLATFORM_LABELS[activeTab]} Publishing Validation
                          </span>
                          <span className={`comparison-status-pill ${val.valid ? "valid" : "error"}`}>
                            {val.valid ? "✓ Ready to publish" : "⚠ Action required"}
                          </span>
                        </div>

                        <div className="validation-checklist">
                          <div className={`check-item ${content.trim() ? "pass" : "fail"}`}>
                            <span>{content.trim() ? "✓" : "✕"}</span>
                            <span>Content text present</span>
                          </div>
                          <div className={`check-item ${val.charCount <= val.maxChars ? "pass" : "fail"}`}>
                            <span>{val.charCount <= val.maxChars ? "✓" : "✕"}</span>
                            <span>
                              Character count within limit ({val.charCount.toLocaleString()} /{" "}
                              {val.maxChars.toLocaleString()})
                            </span>
                          </div>
                          <div
                            className={`check-item ${
                              activeTab === "instagram" ? (media.length >= 1 && media.length <= 10 ? "pass" : "fail") : media.length <= val.maxMedia ? "pass" : "fail"
                            }`}
                          >
                            <span>
                              {(activeTab === "instagram" ? media.length >= 1 && media.length <= 10 : media.length <= val.maxMedia) ? "✓" : "✕"}
                            </span>
                            <span>
                              {activeTab === "instagram"
                                ? `Media attachment (${media.length} attached, min 1, max 10)`
                                : `Media limit (${media.length} / ${val.maxMedia})`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="drawer-footer" style={{ justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Real-time live preview reflects current composer state and platform publishing constraints.
          </div>
          <button type="button" className="btn-quiet" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
