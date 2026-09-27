import { useEffect, useState } from "react";
import type { PlatformResultRecord, PublishingJobRecord } from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";
import { formatDateTime, getWelz, useAppStore } from "../../store";

interface Props {
  onClose: () => void;
  onPostSelect?: (postId: string) => void;
}

type Filter = "all" | "published" | "failed" | "scheduled";

export function ActivityDrawer({ onClose, onPostSelect }: Props) {
  const [results, setResults] = useState<PlatformResultRecord[]>([]);
  const [jobs, setJobs] = useState<Map<string, PublishingJobRecord>>(new Map());
  const [postTitles, setPostTitles] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<Filter>("all");
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  const timezone = useAppStore((s) => s.timezone);
  const pushToast = useAppStore((s) => s.pushToast);

  async function loadData() {
    try {
      const [historyList, allJobs, allPosts] = await Promise.all([
        getWelz().history.list(),
        getWelz().jobs.list(),
        getWelz().posts.list(),
      ]);
      setResults(historyList);
      setJobs(new Map(allJobs.map((j) => [j.id, j])));
      setPostTitles(new Map(allPosts.map((p) => [p.id, p.title])));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleRetry(jobId: string) {
    setRetryingJobId(jobId);
    try {
      await getWelz().jobs.retry(jobId);
      pushToast("Retry queued for destination.");
      await loadData();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Retry failed", "error");
    } finally {
      setRetryingJobId(null);
    }
  }

  const filtered = results.filter((r) => {
    if (filter === "all") return true;
    if (filter === "published") return r.status === "published";
    if (filter === "failed") return r.status === "failed";
    if (filter === "scheduled") return r.status === "queued" || r.status === "ready";
    return true;
  });

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel wide" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2 className="drawer-title">Activity & Publishing Audit</h2>
          <button type="button" className="drawer-close-btn" onClick={onClose} title="Close drawer">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          {/* Filter Pills */}
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "published", "failed", "scheduled"] as Filter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`variant-pill ${filter === tab ? "active" : ""}`}
                style={{ textTransform: "capitalize" }}
                onClick={() => setFilter(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="drawer-section-title">Operations Log ({filtered.length})</div>

          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No operations found in history.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((item) => {
                const job = jobs.get(item.jobId);
                const title = postTitles.get(item.postId) || "Untitled post";
                const isFailed = item.status === "failed";
                const isPublished = item.status === "published";

                return (
                  <div key={item.id} className="drawer-card-item">
                    <div className="drawer-item-header">
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className={`dest-platform-badge badge-${item.platform}`}>
                          {PLATFORM_LABELS[item.platform]}
                        </span>
                        <span
                          className="drawer-item-title"
                          style={{ cursor: onPostSelect ? "pointer" : "default" }}
                          onClick={() => {
                            if (onPostSelect) {
                              onPostSelect(item.postId);
                              onClose();
                            }
                          }}
                          title={title}
                        >
                          {title}
                        </span>
                      </div>

                      <span
                        className="drawer-badge"
                        style={{
                          background: isPublished
                            ? "rgba(16, 185, 129, 0.15)"
                            : isFailed
                            ? "rgba(239, 68, 68, 0.15)"
                            : "rgba(245, 158, 11, 0.15)",
                          color: isPublished
                            ? "var(--success)"
                            : isFailed
                            ? "var(--error)"
                            : "var(--warning)",
                        }}
                      >
                        {item.status}
                      </span>
                    </div>

                    {item.externalPostId && (
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                        Remote Post ID: {item.externalPostId}
                      </div>
                    )}

                    {item.error && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--error)",
                          background: "rgba(239, 68, 68, 0.08)",
                          padding: "6px 8px",
                          borderRadius: 4,
                          lineHeight: 1.35,
                        }}
                      >
                        {item.error}
                      </div>
                    )}

                    <div className="drawer-item-meta">
                      <span>{formatDateTime(item.createdAt, timezone)}</span>

                      <div className="drawer-item-actions">
                        {isFailed && (
                          <button
                            type="button"
                            className="btn-tiny"
                            style={{
                              background: "rgba(239, 68, 68, 0.1)",
                              color: "var(--error)",
                              borderColor: "rgba(239, 68, 68, 0.3)",
                            }}
                            disabled={retryingJobId === item.jobId}
                            onClick={() => handleRetry(item.jobId)}
                          >
                            {retryingJobId === item.jobId ? "Retrying..." : "Retry Destination"}
                          </button>
                        )}
                        {onPostSelect && (
                          <button
                            type="button"
                            className="btn-tiny btn-tiny-ghost"
                            onClick={() => {
                              onPostSelect(item.postId);
                              onClose();
                            }}
                          >
                            Open in Editor
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="drawer-footer">
          <button type="button" className="btn-quiet" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
