import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type {
  MediaRecord,
  Platform,
  PlatformAccountRecord,
  PostRecord,
  PostVariantRecord,
  PublishingJobRecord,
} from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";
import { formatDateTime, getWelz, useAppStore } from "../store";

// Contextual Drawers
import { DraftsDrawer } from "../components/drawers/DraftsDrawer";
import { ConnectionsDrawer } from "../components/drawers/ConnectionsDrawer";
import { ActivityDrawer } from "../components/drawers/ActivityDrawer";
import { MediaDrawer } from "../components/drawers/MediaDrawer";
import { ScheduleDrawer } from "../components/drawers/ScheduleDrawer";
import { AutomateDrawer } from "../components/drawers/AutomateDrawer";
import { SettingsDrawer } from "../components/drawers/SettingsDrawer";
import { PreviewDrawer } from "../components/drawers/PreviewDrawer";
import { CustomizeDrawer } from "../components/drawers/CustomizeDrawer";

interface DestinationValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface PublishResultFeedback {
  postId: string;
  jobs: PublishingJobRecord[];
  allSucceeded: boolean;
  failedJobs: PublishingJobRecord[];
}

export function PlatformIcon({ platform, size = 16 }: { platform: Platform; size?: number }) {
  if (platform === "linkedin") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#0A66C2">
        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m1.37 9.74v-8.37H5.1v8.37z" />
      </svg>
    );
  }
  if (platform === "instagram") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.92-9.91-9.92z" />
    </svg>
  );
}

export function PublishWorkstationPage() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const navigate = useNavigate();

  const timezone = useAppStore((s) => s.timezone);
  const devMode = useAppStore((s) => s.devMode);
  const pushToast = useAppStore((s) => s.pushToast);
  const activeDrawer = useAppStore((s) => s.activeDrawer);
  const setActiveDrawer = useAppStore((s) => s.setActiveDrawer);
  const autosaveStatus = useAppStore((s) => s.autosaveStatus);
  const setAutosaveStatus = useAppStore((s) => s.setAutosaveStatus);
  const setConnectedCount = useAppStore((s) => s.setConnectedCount);

  // Core post state
  const [postId, setPostId] = useState<string | null>(editId);
  const [title, setTitle] = useState("");
  const [masterContent, setMasterContent] = useState("");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [variants, setVariants] = useState<PostVariantRecord[]>([]);

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Data records
  const [accounts, setAccounts] = useState<PlatformAccountRecord[]>([]);

  // Scheduling state
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [scheduleTime, setScheduleTime] = useState("18:30");

  // Publishing & feedback state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResultFeedback | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Load platforms and post data on mount or editId change
  useEffect(() => {
    void refreshData();
  }, []);

  async function refreshData() {
    try {
      const [accs, lib] = await Promise.all([
        getWelz().platforms.list(),
        getWelz().media.list(),
      ]);
      setAccounts(accs);
      const connected = accs.filter((a) => a.status === "connected");
      setConnectedCount(connected.length);

      const mediaId = searchParams.get("mediaId");
      if (mediaId && lib.length > 0) {
        const targetMedia = lib.find((m) => m.id === mediaId);
        if (targetMedia) {
          setMedia((prev) => (prev.some((m) => m.id === mediaId) ? prev : [...prev, targetMedia]));
        }
      }

      // Default select all connected accounts if none selected and new post
      if (selectedAccountIds.length === 0 && !editId) {
        if (connected.length > 0) {
          setSelectedAccountIds(connected.map((a) => a.id));
        } else if (accs.length > 0) {
          setSelectedAccountIds([accs[0].id]);
        }
      }
    } catch {
      // ignore
    }
  }

  // Load existing post if editId is provided
  useEffect(() => {
    if (!editId) return;
    void (async () => {
      try {
        const post = await getWelz().posts.get(editId);
        if (!post) return;
        setPostId(post.id);
        setTitle(post.title);
        setMasterContent(post.masterContent);
        const all = await getWelz().posts.list();
        const row = all.find((p) => p.id === editId);
        if (row) {
          setSelectedAccountIds(row.destinations.map((d) => d.id));
          setMedia(row.media);
        } else {
          setMedia(await getWelz().posts.getMedia(editId));
        }
        setVariants(await getWelz().posts.listVariants(editId));
      } catch {
        // ignore
      }
    })();
  }, [editId]);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const selectedAccounts = useMemo(() => {
    return selectedAccountIds
      .map((id) => accountMap.get(id))
      .filter((a): a is PlatformAccountRecord => a !== undefined);
  }, [selectedAccountIds, accountMap]);

  // Ensure post exists in SQLite
  async function ensurePost(): Promise<string> {
    const postTitle = title.trim() || masterContent.slice(0, 40).trim() || "Untitled post";
    if (postId) {
      await getWelz().posts.update({ id: postId, title: postTitle, masterContent });
      return postId;
    }
    const created = await getWelz().posts.create({ title: postTitle, masterContent });
    setPostId(created.id);
    return created.id;
  }

  // Autosave periodically
  useEffect(() => {
    if (!masterContent.trim() && !title.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const id = await ensurePost();
        await getWelz().posts.setDestinations(id, selectedAccountIds);
        await getWelz().posts.setMedia(id, media.map((m) => m.id));
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setAutosaveStatus(`Saved ${timeStr}`);
      } catch {
        // silent autosave
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [masterContent, title, selectedAccountIds, media]);

  function toggleDestination(accountId: string) {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  }

  // Pre-publish validation per platform
  const validations = useMemo<Record<Platform, DestinationValidation>>(() => {
    const results: Record<Platform, DestinationValidation> = {
      linkedin: { valid: true, errors: [], warnings: [] },
      instagram: { valid: true, errors: [], warnings: [] },
      whatsapp: { valid: true, errors: [], warnings: [] },
    };

    for (const p of ["linkedin", "instagram", "whatsapp"] as Platform[]) {
      const v = variants.find((item) => item.platform === p);
      const text = v?.content || masterContent;

      if (p === "linkedin") {
        if (!text.trim()) results.linkedin.errors.push("LinkedIn text cannot be empty.");
        if (text.length > 3000) results.linkedin.errors.push(`Exceeds 3,000 char limit (${text.length}).`);
        if (media.length > 9) results.linkedin.errors.push("Max 9 media attachments on LinkedIn.");
      }

      if (p === "instagram") {
        if (!text.trim()) results.instagram.errors.push("Instagram caption cannot be empty.");
        if (text.length > 2200) results.instagram.errors.push(`Exceeds 2,200 char limit (${text.length}).`);
        if (media.length === 0) results.instagram.errors.push("Instagram requires at least 1 image or video.");
        if (media.length > 10) results.instagram.errors.push("Max 10 carousel items on Instagram.");
        const hashtags = (text.match(/#[a-zA-Z0-9_]+/g) || []).length;
        if (hashtags > 30) results.instagram.errors.push("Max 30 hashtags on Instagram.");
      }

      if (p === "whatsapp") {
        if (!text.trim()) results.whatsapp.errors.push("WhatsApp message cannot be empty.");
        if (text.length > 4096) results.whatsapp.errors.push(`Exceeds 4,096 char limit (${text.length}).`);
        if (media.length > 4) results.whatsapp.errors.push("Max 4 attachments on WhatsApp.");
      }

      results[p].valid = results[p].errors.length === 0;
    }

    return results;
  }, [masterContent, variants, media]);

  // Overall readiness
  const totalErrors = useMemo(() => {
    let count = 0;
    for (const acc of selectedAccounts) {
      count += validations[acc.platform].errors.length;
    }
    return count;
  }, [selectedAccounts, validations]);

  const overallReady = useMemo(() => {
    if (selectedAccounts.length === 0) return false;
    if (!masterContent.trim()) return false;
    return totalErrors === 0;
  }, [selectedAccounts, masterContent, totalErrors]);

  // Global publish shortcut: ⌘ Enter / Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (overallReady && !isPublishing) {
          setShowConfirmModal(true);
        } else if (totalErrors > 0) {
          setActiveDrawer("preview");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [overallReady, isPublishing, totalErrors]);

  // Media attachments
  async function handleAddMedia() {
    const uploaded = await getWelz().media.upload();
    if (uploaded.length > 0) {
      setMedia((prev) => [...prev, ...uploaded]);
      pushToast(`Attached ${uploaded.length} asset${uploaded.length > 1 ? "s" : ""}.`);
    }
  }

  function removeMedia(index: number) {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  }

  function moveMedia(index: number, direction: "left" | "right") {
    setMedia((prev) => {
      const next = [...prev];
      const targetIndex = direction === "left" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  }

  // Drag and drop onto editor surface
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleAddMedia();
    }
  }

  // Dispatch / Schedule confirmed execution
  async function executePublishOrSchedule(mode: "now" | "schedule" = publishMode) {
    setIsPublishing(true);
    try {
      const id = await ensurePost();
      await getWelz().posts.setDestinations(id, selectedAccountIds);
      await getWelz().posts.setMedia(id, media.map((m) => m.id));

      let vList = await getWelz().posts.listVariants(id);
      if (vList.length === 0) {
        vList = await getWelz().posts.prepareVariants(id);
      }
      await getWelz().posts.approveVariants(id);

      const scheduledAtIso =
        mode === "schedule"
          ? new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
          : undefined;

      const jobs = await getWelz().publish.schedule({
        postId: id,
        platformAccountIds: selectedAccountIds,
        mode,
        scheduledAt: scheduledAtIso,
        timezone,
      });

      const failed = jobs.filter((j) => j.status === "failed");
      setPublishResult({
        postId: id,
        jobs,
        allSucceeded: failed.length === 0,
        failedJobs: failed,
      });

      if (mode === "now") {
        pushToast(`Dispatched to ${jobs.length} destination${jobs.length > 1 ? "s" : ""}!`);
      } else {
        pushToast(`Scheduled for ${formatDateTime(scheduledAtIso!, timezone)}.`);
      }

      await refreshData();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Publishing failed", "error");
    } finally {
      setIsPublishing(false);
    }
  }

  // Single-channel retry
  async function handleRetryJob(jobId: string) {
    try {
      await getWelz().jobs.retry(jobId);
      pushToast("Retry queued for destination.");
      if (publishResult) {
        setPublishResult({
          ...publishResult,
          jobs: publishResult.jobs.map((j) => (j.id === jobId ? { ...j, status: "retrying" } : j)),
          failedJobs: publishResult.failedJobs.filter((j) => j.id !== jobId),
        });
      }
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Retry failed", "error");
    }
  }

  function handleStartNewPost() {
    setPostId(null);
    setTitle("");
    setMasterContent("");
    setMedia([]);
    setVariants([]);
    setPublishResult(null);
    navigate("/");
  }

  function getContentForPlatform(p: Platform): string {
    const v = variants.find((item) => item.platform === p);
    return v?.content || masterContent;
  }

  const destinationsNeedingAttentionCount = useMemo(() => {
    return selectedAccounts.filter((acc) => !validations[acc.platform].valid).length;
  }, [selectedAccounts, validations]);

  // Primary action button label calculation
  const primaryButtonLabel = useMemo(() => {
    if (isPublishing) return "Publishing...";
    if (selectedAccounts.length === 0) return "Select destinations";
    if (totalErrors > 0) return "Fix issues →";
    if (selectedAccounts.length === 1) {
      return `Publish to ${PLATFORM_LABELS[selectedAccounts[0].platform]} →`;
    }
    return `Publish to ${selectedAccounts.length} destinations →`;
  }, [isPublishing, selectedAccounts, totalErrors]);

  const charCount = masterContent.length;
  const wordCount = masterContent.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="single-canvas-container">
      {/* SINGLE EDITORIAL PUBLISHING CANVAS VIEWPORT */}
      <div className="single-canvas-viewport">
        {/* PUBLISH FEEDBACK BANNER (IF DISPATCHED OR RETRIED) */}
        {publishResult && (
          <div
            style={{
              width: "100%",
              maxWidth: "min(1080px, calc(100vw - 80px))",
              padding: "10px 18px",
              marginBottom: 14,
              borderRadius: "var(--radius-sm)",
              background: publishResult.allSucceeded ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.08)",
              border: `1px solid ${publishResult.allSucceeded ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: publishResult.allSucceeded ? "var(--success)" : "var(--warning)" }}>
                {publishResult.allSucceeded ? "✓ Dispatched to all destinations" : "⚠ Partial dispatch result"}
              </span>

              <div style={{ display: "flex", gap: 8 }}>
                {publishResult.jobs.map((j) => {
                  const acc = accountMap.get(j.platformAccountId);
                  const isFailed = j.status === "failed";
                  return (
                    <div
                      key={j.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "2px 8px",
                        borderRadius: "var(--radius-xs)",
                        fontSize: 11,
                        color: isFailed ? "var(--error)" : "var(--text-secondary)",
                      }}
                    >
                      <span>{acc ? PLATFORM_LABELS[acc.platform] : "Channel"}:</span>
                      <strong>{j.status.toUpperCase()}</strong>
                      {isFailed && (
                        <button
                          type="button"
                          className="btn-quiet"
                          style={{ padding: "0 4px", fontSize: 10, color: "var(--error)" }}
                          onClick={() => handleRetryJob(j.id)}
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              className="btn-quiet"
              style={{ fontSize: 11 }}
              onClick={() => setPublishResult(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="publishing-workbench">
          {/* 1. PUBLISH DESTINATIONS TRAY */}
          <section className="dest-tray-section">
            <span className="dest-tray-label">Publish to</span>
            <div className="dest-tray-list">
              {accounts.length === 0 ? (
                <button
                  type="button"
                  className="dest-tray-add-btn"
                  onClick={() => setActiveDrawer("connections")}
                >
                  + Add destination
                </button>
              ) : (
                <>
                  {accounts.map((acc) => {
                    const isSelected = selectedAccountIds.includes(acc.id);
                    const isConnected = acc.status === "connected";

                    return (
                      <button
                        key={acc.id}
                        type="button"
                        className={`dest-tray-item ${isSelected ? "selected" : ""}`}
                        onClick={() => toggleDestination(acc.id)}
                        title={isConnected ? `Toggle ${acc.accountName}` : "Channel disconnected"}
                      >
                        {isSelected ? (
                          <span className="dest-tray-check">✓</span>
                        ) : (
                          <span className="dest-tray-dot" />
                        )}

                        <PlatformIcon platform={acc.platform} size={15} />

                        <span className="dest-tray-text">
                          {PLATFORM_LABELS[acc.platform]} · {acc.accountName}
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    className="dest-tray-add-btn"
                    onClick={() => setActiveDrawer("connections")}
                  >
                    + Add destination
                  </button>
                </>
              )}
            </div>
          </section>

          {/* 2. THE MONOLITHIC PUBLISHING DOCUMENT (#14191F) */}
          <article className="workbench-document">
            {/* DOCUMENT HEADER: TITLE & SUBTITLE */}
            <header className="document-header">
              <div className="document-editorial-column">
                <div className="document-identity-row">
                  <h1 className="document-heading">New post</h1>
                  <input
                    type="text"
                    className="document-title-input"
                    placeholder="Untitled post"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </div>
            </header>

            {/* DOCUMENT WRITING CANVAS */}
            <div
              className={`document-canvas-body ${isDraggingOver ? "dragging-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDrop}
            >
              <div className="document-editorial-column">
                <textarea
                  className="document-writing-textarea"
                  value={masterContent}
                  onChange={(e) => setMasterContent(e.target.value)}
                />

                {/* Upper-middle centered empty state */}
                {masterContent.length === 0 && (
                  <div
                    className="document-empty-state"
                    onClick={() => {
                      const el = document.querySelector(".document-writing-textarea") as HTMLTextAreaElement | null;
                      el?.focus();
                    }}
                  >
                    <div className="empty-primary">Write something worth publishing...</div>
                    <div className="empty-secondary">WELZ will adapt your post for each selected destination.</div>
                  </div>
                )}

                {/* Attached media tray (if any) */}
                {media.length > 0 && (
                  <div className="document-media-tray">
                    {media.map((item, index) => (
                      <div key={item.id} className="media-thumb-chip">
                        {item.type.startsWith("image") ? (
                          <img
                            src={`welz-media://local/${encodeURIComponent(item.path.replace(/\\/g, "/"))}`}
                            alt={item.filename}
                          />
                        ) : (
                          <div className="video-thumb-placeholder">▶ VIDEO</div>
                        )}

                        <button
                          type="button"
                          className="media-chip-remove"
                          onClick={() => removeMedia(index)}
                          title="Remove asset"
                        >
                          ×
                        </button>

                        <div className="media-chip-nav">
                          {index > 0 && (
                            <button type="button" onClick={() => moveMedia(index, "left")} title="Move left">
                              ‹
                            </button>
                          )}
                          {index < media.length - 1 && (
                            <button type="button" onClick={() => moveMedia(index, "right")} title="Move right">
                              ›
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      className="media-tray-add-btn"
                      onClick={handleAddMedia}
                      title="Attach another media file"
                    >
                      <span>+ Media</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* DOCUMENT FOOTER & EMBEDDED TOOLBAR */}
            <footer className="document-footer-area">
              <div className="document-meta-line">
                <div className="document-counters">
                  <span>{charCount} characters</span>
                  <span className="counter-dot">·</span>
                  <span>{wordCount} words</span>
                </div>

                <div className="document-limits">
                  <span title="LinkedIn max 3,000 characters">LI 3k</span>
                  <span className="counter-dot">·</span>
                  <span title="Instagram max 2,200 characters">IG 2.2k</span>
                  <span className="counter-dot">·</span>
                  <span title="WhatsApp max 4,096 characters">WA 4k</span>
                </div>
              </div>

              <div className="document-toolbar-strip">
                <div className="toolbar-group">
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={handleAddMedia}
                    title="Attach image or video"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    <span>+ Media</span>
                  </button>

                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => setActiveDrawer("media")}
                    title="Open media library"
                  >
                    <span>Library</span>
                  </button>
                </div>

                <div className="toolbar-sep" />

                <div className="toolbar-group">
                  <button
                    type="button"
                    className={`toolbar-btn ${variants.some((v) => v.content && v.content !== masterContent) ? "active" : ""}`}
                    onClick={async () => {
                      const id = await ensurePost();
                      let vList = await getWelz().posts.listVariants(id);
                      if (vList.length === 0) {
                        vList = await getWelz().posts.prepareVariants(id);
                      }
                      setVariants(vList);
                      setActiveDrawer("customize");
                    }}
                    title="Customize per-platform copies"
                  >
                    <span>Customize</span>
                  </button>

                  <button
                    type="button"
                    className="toolbar-item toolbar-btn"
                    onClick={() => setActiveDrawer("preview")}
                    title="Inspect platform previews"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <span>Preview</span>
                  </button>
                </div>

                <div className="toolbar-sep" />

                <div className="toolbar-group">
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => setActiveDrawer("schedule")}
                    title="Configure scheduled publishing"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>Schedule</span>
                  </button>

                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => setActiveDrawer("automate")}
                    title="Automate recurring dispatches"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span>Automate</span>
                  </button>
                </div>
              </div>
            </footer>
          </article>

          {/* 3. CALM VALIDATION STATUS LINE */}
          <div className="workbench-validation-line">
            {selectedAccounts.length === 0 ? (
              <span className="validation-quiet-note">Select at least one destination to publish.</span>
            ) : destinationsNeedingAttentionCount === 0 ? (
              <span className="validation-calm-ready">✓ Ready to publish</span>
            ) : (
              <button
                type="button"
                className="validation-calm-btn"
                onClick={() => setActiveDrawer("preview")}
                title="Click to inspect platform checks"
              >
                <span className="warn-glyph">⚠</span>
                <span>
                  {destinationsNeedingAttentionCount} destination{destinationsNeedingAttentionCount === 1 ? " needs" : "s need"} attention
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* STICKY BOTTOM ACTION BAR */}
      <footer className="cockpit-sticky-bottom-bar">
        <div className="bottom-bar-left">
          <span className="autosave-dot" />
          <span>{autosaveStatus || "Saved just now"}</span>
        </div>

        <div className="bottom-bar-center">
          {selectedAccounts.length === 0 ? null : destinationsNeedingAttentionCount === 0 ? (
            <span className="bottom-status-ready">
              ✓ Ready to publish
            </span>
          ) : (
            <button
              type="button"
              className="bottom-status-warning-btn"
              onClick={() => setActiveDrawer("preview")}
              title="Click to resolve publishing issues"
            >
              <span className="warn-glyph">⚠</span>
              <span>{destinationsNeedingAttentionCount} destination{destinationsNeedingAttentionCount === 1 ? " needs" : "s need"} attention</span>
            </button>
          )}
        </div>

        <div className="bottom-bar-right">
          <button
            type="button"
            className="btn-quiet"
            onClick={async () => {
              await ensurePost();
              pushToast("Draft saved.");
            }}
            title="Save draft to SQLite"
          >
            Save draft
          </button>

          <button
            type="button"
            className="btn-quiet"
            onClick={() => setActiveDrawer("schedule")}
            title="Configure post scheduling"
          >
            Schedule
          </button>

          <button
            type="button"
            className={`btn-publish-cta ${totalErrors > 0 ? "has-issues" : ""}`}
            disabled={isPublishing || selectedAccounts.length === 0}
            onClick={() => {
              if (totalErrors > 0) {
                setActiveDrawer("preview");
              } else if (overallReady) {
                setShowConfirmModal(true);
              }
            }}
          >
            <span>{primaryButtonLabel}</span>
          </button>
        </div>
      </footer>

      {/* CONTEXTUAL DRAWERS */}
      {activeDrawer === "drafts" && (
        <DraftsDrawer
          onSelectPost={(id) => {
            navigate(`/?id=${id}`);
            setActiveDrawer(null);
          }}
          onNewBlankPost={handleStartNewPost}
          onClose={() => setActiveDrawer(null)}
        />
      )}

      {activeDrawer === "connections" && (
        <ConnectionsDrawer
          onClose={() => setActiveDrawer(null)}
          onChanged={() => void refreshData()}
        />
      )}

      {activeDrawer === "activity" && (
        <ActivityDrawer
          onClose={() => setActiveDrawer(null)}
          onPostSelect={(id) => {
            navigate(`/?id=${id}`);
            setActiveDrawer(null);
          }}
        />
      )}

      {activeDrawer === "media" && (
        <MediaDrawer
          attachedMedia={media}
          onToggleAttach={(item) => {
            setMedia((prev) =>
              prev.some((m) => m.id === item.id)
                ? prev.filter((m) => m.id !== item.id)
                : [...prev, item]
            );
          }}
          onClose={() => setActiveDrawer(null)}
        />
      )}

      {activeDrawer === "schedule" && (
        <ScheduleDrawer
          date={scheduleDate}
          time={scheduleTime}
          selectedAccounts={selectedAccounts}
          onDateChange={setScheduleDate}
          onTimeChange={setScheduleTime}
          onConfirmSchedule={() => void executePublishOrSchedule("schedule")}
          onClose={() => setActiveDrawer(null)}
        />
      )}

      {activeDrawer === "automate" && (
        <AutomateDrawer onClose={() => setActiveDrawer(null)} />
      )}

      {activeDrawer === "settings" && (
        <SettingsDrawer onClose={() => setActiveDrawer(null)} />
      )}

      {activeDrawer === "preview" && (
        <PreviewDrawer
          selectedAccounts={selectedAccounts}
          media={media}
          getContentForPlatform={getContentForPlatform}
          masterContent={masterContent}
          variants={variants}
          onClose={() => setActiveDrawer(null)}
        />
      )}

      {activeDrawer === "customize" && (
        <CustomizeDrawer
          postId={postId}
          masterContent={masterContent}
          variants={variants}
          selectedAccounts={selectedAccounts}
          onVariantUpdated={(updated) => {
            setVariants((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
          }}
          onClose={() => setActiveDrawer(null)}
        />
      )}

      {/* CONFIRMATION MODAL BEFORE DISPATCH */}
      {showConfirmModal && (
        <div className="modal-backdrop" onClick={() => setShowConfirmModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                Publish to {selectedAccounts.length} destination{selectedAccounts.length > 1 ? "s" : ""}?
              </h3>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setShowConfirmModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "14px 0" }}>
              {selectedAccounts.map((acc) => (
                <div
                  key={acc.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg-editor)",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "var(--primary)", fontWeight: 700 }}>✓</span>
                  <PlatformIcon platform={acc.platform} size={15} />
                  <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{PLATFORM_LABELS[acc.platform]}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>— {acc.accountName}</span>
                </div>
              ))}
            </div>

            <p style={{ margin: "0 0 16px 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
              {devMode
                ? "Simulation mode active. Dispatches loopback locally with verified mock results."
                : "Dispatches directly through official platform APIs."}
            </p>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-quiet"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-publish-cta"
                onClick={() => {
                  setShowConfirmModal(false);
                  void executePublishOrSchedule("now");
                }}
              >
                Publish now →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
