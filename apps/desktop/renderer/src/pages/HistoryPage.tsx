import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { PlatformResultRecord, PublishingJobRecord } from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";
import { JobStatusBadge } from "../components/StatusBadge";
import { formatDateTime, getWelz, useAppStore } from "../store";

type FilterTab = "all" | "published" | "failed" | "scheduled" | "cancelled";

export function HistoryPage() {
  const navigate = useNavigate();
  const timezone = useAppStore((s) => s.timezone);
  const pushToast = useAppStore((s) => s.pushToast);
  const [results, setResults] = useState<PlatformResultRecord[]>([]);
  const [jobs, setJobs] = useState<Map<string, PublishingJobRecord>>(new Map());
  const [posts, setPosts] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<FilterTab>("all");
  const [reusingId, setReusingId] = useState<string | null>(null);

  async function loadData() {
    const [history, allJobs, allPosts] = await Promise.all([
      getWelz().history.list(),
      getWelz().jobs.list(),
      getWelz().posts.list(),
    ]);
    setResults(history);
    setJobs(new Map(allJobs.map((j) => [j.id, j])));
    setPosts(new Map(allPosts.map((p) => [p.id, p.title])));
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleReuse(postId: string) {
    setReusingId(postId);
    try {
      const newDraft = await getWelz().posts.reuse(postId);
      pushToast("New draft created from historical post.");
      navigate(`/?id=${newDraft.id}`);
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Failed to reuse post", "error");
    } finally {
      setReusingId(null);
    }
  }

  const filteredResults = results.filter((row) => {
    if (filter === "all") return true;
    if (filter === "published") return row.status === "published";
    if (filter === "failed") return row.status === "failed";
    if (filter === "scheduled") return row.status === "queued" || row.status === "ready";
    if (filter === "cancelled") return row.status === "cancelled";
    return true;
  });

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Publishing History</h1>
          <p className="page-subtitle">Complete audit trail of all platform dispatches and outcomes.</p>
        </div>
        <div className="filter-bar" style={{ margin: 0 }}>
          {(["all", "published", "failed", "scheduled", "cancelled"] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`chip${filter === tab ? " active" : ""}`}
              onClick={() => setFilter(tab)}
              style={{ textTransform: "capitalize" }}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {filteredResults.length === 0 ? (
        <div className="card empty-state">
          <h3>No publishing history found</h3>
          <p>
            {filter === "all"
              ? "Completed publishing jobs and platform dispatches will appear here."
              : `No events matching filter "${filter}".`}
          </p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 12 }}>
            Open Publish Workstation
          </Link>
        </div>
      ) : (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredResults.map((row) => {
            const job = jobs.get(row.jobId);
            const postTitle = posts.get(row.postId) ?? "Untitled Post";
            const isReusing = reusingId === row.postId;

            return (
              <div key={row.id} className="list-row" style={{ alignItems: "flex-start", padding: "14px 16px" }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "1.05rem" }}>{postTitle}</span>
                    <span className="badge" style={{ textTransform: "capitalize" }}>
                      {PLATFORM_LABELS[row.platform]}
                    </span>
                    {row.simulated ? (
                      <span className="badge" style={{ background: "rgba(234, 179, 8, 0.15)", color: "#eab308" }}>
                        SIMULATED
                      </span>
                    ) : null}
                  </div>

                  <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: 4 }}>
                    Dispatched {formatDateTime(row.createdAt, timezone)}
                    {job?.attemptCount ? ` · Attempt ${job.attemptCount}` : ""}
                    {job?.idempotencyKey ? ` · Key: ${job.idempotencyKey.slice(0, 18)}...` : ""}
                  </div>

                  {row.externalPostId ? (
                    <div className="mono" style={{ marginTop: 6, fontSize: "0.85rem", color: "var(--accent-teal)" }}>
                      Remote ID: {row.externalPostId}
                    </div>
                  ) : null}

                  {row.error ? (() => {
                    const errMatch = row.error.match(/^\[([A-Z_]+)\]\s*(.*)$/);
                    const errCode = errMatch ? errMatch[1] : null;
                    const errMsg = errMatch ? errMatch[2] : row.error;

                    return (
                      <div className="error-panel" style={{ marginTop: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 6px 0" }}>
                          <h4 style={{ margin: 0, color: "var(--status-failed)" }}>Publishing failed</h4>
                          {errCode && (
                            <span className="badge" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", fontSize: "0.72rem" }}>
                              {errCode}
                            </span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: "0.88rem" }}>{errMsg}</p>
                        <div className="actions-row" style={{ marginTop: 10 }}>
                          <Link to="/connections" className="btn btn-secondary btn-sm">
                            Check Connection
                          </Link>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() =>
                              void getWelz()
                                .jobs.retry(row.jobId)
                                .then(() => {
                                  pushToast("Retry queued for this destination.");
                                  void loadData();
                                })
                            }
                          >
                            Retry Destination
                          </button>
                        </div>
                      </div>
                    );
                  })() : null}

                  <div className="actions-row" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={isReusing}
                      onClick={() => void handleReuse(row.postId)}
                      title="Create a new draft with this post's content and media"
                    >
                      {isReusing ? "Reusing..." : "Reuse in New Draft"}
                    </button>
                    <Link to={`/?id=${row.postId}`} className="btn btn-ghost btn-sm">
                      Open in Workstation
                    </Link>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <JobStatusBadge status={row.status} platform={row.platform} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
