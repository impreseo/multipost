import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ActivityItem, AutomationStatusSnapshot, DashboardStats, UpcomingItem } from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";
import { JobStatusBadge } from "../components/StatusBadge";
import { formatDateTime, getWelz, useAppStore } from "../store";

export function CommandPage() {
  const timezone = useAppStore((s) => s.timezone);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [automation, setAutomation] = useState<AutomationStatusSnapshot | null>(null);

  async function refresh() {
    const data = await getWelz().dashboard.get();
    setStats(data.stats);
    setActivity(data.activity);
    setUpcoming(data.upcoming);
    setAutomation(data.automation);
  }

  useEffect(() => {
    void refresh();
    const off = getWelz().automation.onJob(() => void refresh());
    return off;
  }, []);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Command</h1>
        <p className="page-subtitle">Operational overview — create, publish, and track.</p>
      </header>

      {stats ? (
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          {[
            ["Drafts", stats.drafts],
            ["Ready", stats.ready],
            ["Scheduled", stats.scheduled],
            ["Publishing", stats.publishing],
            ["Published", stats.published],
            ["Failed", stats.failed],
          ].map(([label, value]) => (
            <div key={label} className="stat">
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid-3">
        <section className="card">
          <h2 className="card-title">Recent activity</h2>
          {activity.length === 0 ? (
            <div className="empty-state" style={{ padding: "24px 0" }}>
              <h3>No activity yet</h3>
              <p>Publishing jobs will appear here.</p>
              <Link to="/compose" className="btn btn-secondary">
                Create post
              </Link>
            </div>
          ) : (
            activity.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <div style={{ fontWeight: 600 }}>{item.postTitle}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                    {PLATFORM_LABELS[item.platform]} · {item.accountName}
                    {item.simulated ? " · SIMULATED" : ""}
                  </div>
                </div>
                <JobStatusBadge status={item.status} />
              </div>
            ))
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Upcoming</h2>
          {upcoming.length === 0 ? (
            <div className="empty-state" style={{ padding: "24px 0" }}>
              <h3>No scheduled content</h3>
              <p>Schedule a post to see it here.</p>
            </div>
          ) : (
            upcoming.map((item) => (
              <div key={`${item.postId}-${item.scheduledAt}`} className="list-row">
                <div>
                  <div className="mono">{formatDateTime(item.scheduledAt, timezone)}</div>
                  <div style={{ fontWeight: 600 }}>{item.postTitle}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {item.platforms.map((p) => PLATFORM_LABELS[p]).join(" · ")}
                  </div>
                </div>
                <Link to={`/content/${item.postId}`} className="btn btn-ghost">
                  Open
                </Link>
              </div>
            ))
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Automation</h2>
          {automation ? (
            <>
              <p>
                <span className={`status-dot ${automation.state}`} />
                {automation.state.toUpperCase()}
              </p>
              <p style={{ color: "var(--text-secondary)" }}>Queue: {automation.queueLength} jobs</p>
              <p style={{ color: "var(--text-secondary)" }}>Active: {automation.activeJobs}</p>
              {automation.nextScheduledAt ? (
                <p className="mono">Next: {formatDateTime(automation.nextScheduledAt, timezone)}</p>
              ) : null}
              <div className="actions-row" style={{ marginTop: 16 }}>
                <Link to="/publishing" className="btn btn-secondary">
                  Open publishing
                </Link>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </>
  );
}
