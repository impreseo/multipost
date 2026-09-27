import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  AutomationStatusSnapshot,
  JobStatus,
  PlatformAccountRecord,
  PublishingJobRecord,
} from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";
import { JobStatusBadge } from "../components/StatusBadge";
import { formatDateTime, getWelz, useAppStore } from "../store";

type FilterTab = "all" | "queue" | "active" | "completed" | "failed";

export function PublishingPage() {
  const timezone = useAppStore((s) => s.timezone);
  const pushToast = useAppStore((s) => s.pushToast);
  const [jobs, setJobs] = useState<PublishingJobRecord[]>([]);
  const [accounts, setAccounts] = useState<PlatformAccountRecord[]>([]);
  const [automation, setAutomation] = useState<AutomationStatusSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  async function refresh() {
    const [allJobs, accs, status] = await Promise.all([
      getWelz().jobs.list(),
      getWelz().platforms.list(),
      getWelz().automation.status(),
    ]);
    setJobs(allJobs);
    setAccounts(accs);
    setAutomation(status);
  }

  useEffect(() => {
    void refresh();
    const off = getWelz().automation.onJob(() => void refresh());
    return off;
  }, []);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const filteredJobs = useMemo(() => {
    switch (activeTab) {
      case "queue":
        return jobs.filter((j) => j.status === "queued" || j.status === "ready");
      case "active":
        return jobs.filter((j) => ["uploading", "publishing", "retrying"].includes(j.status));
      case "completed":
        return jobs.filter((j) => j.status === "published");
      case "failed":
        return jobs.filter((j) => j.status === "failed");
      default:
        return jobs;
    }
  }, [jobs, activeTab]);

  const counts = useMemo(
    () => ({
      all: jobs.length,
      queue: jobs.filter((j) => j.status === "queued" || j.status === "ready").length,
      active: jobs.filter((j) => ["uploading", "publishing", "retrying"].includes(j.status)).length,
      completed: jobs.filter((j) => j.status === "published").length,
      failed: jobs.filter((j) => j.status === "failed").length,
    }),
    [jobs]
  );

  async function handleRetry(jobId: string) {
    try {
      await getWelz().jobs.retry(jobId);
      pushToast("Retry queued for publishing job.");
      await refresh();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Retry failed", "error");
    }
  }

  async function handleCancel(jobId: string) {
    if (!confirm("Cancel this scheduled job?")) return;
    try {
      await getWelz().jobs.cancel(jobId);
      pushToast("Job cancelled.");
      await refresh();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Cancel failed", "error");
    }
  }

  return (
    <div className="publishing-console">
      <header className="page-header">
        <div>
          <h1 className="page-title">Publishing Operations</h1>
          <p className="page-subtitle">
            Operations console · Real-time dispatch queue, active transfers, idempotency tracking, and failure management.
          </p>
        </div>

        <div className="publishing-header-controls">
          <div className="engine-status-pill">
            <span className={`engine-dot ${automation?.state || "offline"}`} />
            <span>ENGINE: {automation?.state?.toUpperCase() || "READY"}</span>
          </div>

          {automation?.state === "paused" ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void getWelz().automation.resume().then(refresh)}
            >
              ▶ Resume Engine
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void getWelz().automation.pause().then(refresh)}
            >
              ⏸ Pause Engine
            </button>
          )}

          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refresh()}>
            ↻ Refresh
          </button>
        </div>
      </header>

      {/* FILTER TABS */}
      <div className="console-tabs">
        <button
          type="button"
          className={`console-tab ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All Jobs ({counts.all})
        </button>
        <button
          type="button"
          className={`console-tab ${activeTab === "queue" ? "active" : ""}`}
          onClick={() => setActiveTab("queue")}
        >
          Queue ({counts.queue})
        </button>
        <button
          type="button"
          className={`console-tab ${activeTab === "active" ? "active" : ""}`}
          onClick={() => setActiveTab("active")}
        >
          Active ({counts.active})
        </button>
        <button
          type="button"
          className={`console-tab ${activeTab === "completed" ? "active" : ""}`}
          onClick={() => setActiveTab("completed")}
        >
          Completed ({counts.completed})
        </button>
        <button
          type="button"
          className={`console-tab ${activeTab === "failed" ? "active" : ""}`}
          onClick={() => setActiveTab("failed")}
        >
          Failed ({counts.failed})
        </button>
      </div>

      {/* JOBS TABLE / CONSOLE */}
      <div className="console-table-card">
        {filteredJobs.length === 0 ? (
          <div className="empty-state-editorial" style={{ padding: "48px 24px" }}>
            <p className="empty-title">No jobs in {activeTab === "all" ? "publishing queue" : activeTab}</p>
            <p className="empty-desc">
              When posts are approved and scheduled or published, individual channel dispatch jobs appear here.
            </p>
          </div>
        ) : (
          <div className="job-rows-container">
            {filteredJobs.map((job) => {
              const account = accountMap.get(job.platformAccountId);
              const isFailed = job.status === "failed";
              const isQueued = job.status === "queued" || job.status === "ready";
              const isCompleted = job.status === "published";

              return (
                <div key={job.id} className={`job-console-row status-${job.status}`}>
                  <div className="job-cell-status">
                    <JobStatusBadge status={job.status} />
                    {job.simulated === 1 && <span className="sim-tag">SIMULATED</span>}
                  </div>

                  <div className="job-cell-destination">
                    <span className="dest-name">
                      {account ? PLATFORM_LABELS[account.platform] : "Channel"}
                    </span>
                    <span className="dest-sub">{account?.accountName || "Account"}</span>
                  </div>

                  <div className="job-cell-content">
                    <div className="job-content-text">
                      {job.platformContent ? (
                        job.platformContent.length > 120
                          ? `${job.platformContent.slice(0, 120)}…`
                          : job.platformContent
                      ) : (
                        <span className="meta-dim">Empty payload</span>
                      )}
                    </div>
                    {job.error && (
                      <div className="job-error-callout">
                        <strong>Error:</strong> {job.error}
                      </div>
                    )}
                    {job.externalPostId && (
                      <div className="job-remote-id">
                        <span>Remote ID:</span> <code className="mono">{job.externalPostId}</code>
                      </div>
                    )}
                  </div>

                  <div className="job-cell-time">
                    <div className="time-primary mono">
                      {job.scheduledAt ? formatDateTime(job.scheduledAt, timezone) : "Immediate"}
                    </div>
                    <div className="time-sub">
                      Attempts: {job.attemptCount} · Key: {job.idempotencyKey.slice(0, 8)}…
                    </div>
                  </div>

                  <div className="job-cell-actions">
                    {isFailed && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => void handleRetry(job.id)}
                      >
                        Retry
                      </button>
                    )}
                    {isQueued && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => void handleCancel(job.id)}
                      >
                        Cancel
                      </button>
                    )}
                    <Link to={`/content/${job.postId}`} className="btn btn-secondary btn-sm">
                      Open Post
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
