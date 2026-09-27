import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { OverviewData } from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";
import { JobStatusBadge } from "../components/StatusBadge";
import { formatDateTime, useAppStore } from "../store";

export function OverviewPage() {
  const timezone = useAppStore((s) => s.timezone);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function loadData() {
    try {
      if (window.welz?.overview?.get) {
        const overview = await window.welz.overview.get();
        setData(overview);
      } else {
        // Fallback to dashboard get if overview not yet reloaded
        const dash = await window.welz.dashboard.get();
        setData({
          attention: [],
          preparing: [],
          upcoming: dash.upcoming,
          destinations: [],
          activity: dash.activity,
          stats: dash.stats,
          automation: dash.automation,
        });
      }
    } catch (err) {
      console.error("Failed to load overview data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    const offJob = window.welz?.automation?.onJob(() => void loadData());
    return () => {
      offJob?.();
    };
  }, []);

  if (loading && !data) {
    return (
      <div className="overview-loading">
        <p>Loading operational workstation…</p>
      </div>
    );
  }

  const attention = data?.attention || [];
  const preparing = data?.preparing || [];
  const upcoming = data?.upcoming || [];
  const destinations = data?.destinations || [];
  const activity = data?.activity || [];

  return (
    <div className="overview-workstation">
      <header className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">
            Local-first content operations · Preparing, scheduled dispatches, and channel health.
          </p>
        </div>
        <div className="overview-header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void loadData()}>
            ↻ Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/compose")}>
            + Create master post
          </button>
        </div>
      </header>

      {/* 1. WHAT NEEDS MY ATTENTION? */}
      <section className="overview-section">
        <div className="section-header-compact">
          <h2 className="section-title-sm">Operational Attention</h2>
          <span className="section-tagline">Actionable items requiring review, retry, or configuration</span>
        </div>

        {attention.length === 0 ? (
          <div className="attention-banner attention-clear">
            <div className="attention-icon">✓</div>
            <div className="attention-body">
              <strong>All systems operational</strong>
              <p>No unapproved variants pending scheduling, no failed jobs, and all active channels are healthy.</p>
            </div>
          </div>
        ) : (
          <div className="attention-grid">
            {attention.map((item) => (
              <div key={item.id} className={`attention-card attention-${item.severity}`}>
                <div className="attention-card-header">
                  <span className={`attention-badge badge-${item.severity}`}>
                    {item.type === "unapproved_variants"
                      ? "APPROVAL GATE"
                      : item.type === "failed_job"
                      ? "PUBLISHING FAILURE"
                      : "AUTHENTICATION"}
                  </span>
                  <Link to={item.linkTo} className="attention-action-link">
                    Resolve →
                  </Link>
                </div>
                <div className="attention-card-title">{item.title}</div>
                <div className="attention-card-desc">{item.description}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2-COLUMN WORKSTATION LAYOUT */}
      <div className="overview-columns">
        {/* LEFT COLUMN: EDITORIAL CONTENT & SCHEDULE */}
        <div className="overview-col-main">
          {/* 2. WHAT CONTENT IS BEING PREPARED? */}
          <section className="card card-flush">
            <div className="card-header-row">
              <div>
                <h2 className="card-title">Content in Preparation</h2>
                <span className="card-subtitle">Active master drafts and variants currently being prepared</span>
              </div>
              <Link to="/content" className="btn btn-ghost btn-sm">
                View all content
              </Link>
            </div>

            {preparing.length === 0 ? (
              <div className="empty-state-editorial">
                <p className="empty-title">No content currently in preparation</p>
                <p className="empty-desc">Create master content to adapt and distribute across channels.</p>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate("/compose")}>
                  Start new post
                </button>
              </div>
            ) : (
              <div className="editorial-list">
                {preparing.map((post) => (
                  <div key={post.id} className="editorial-item">
                    <div className="editorial-item-info">
                      <div className="editorial-item-title-row">
                        <Link to={`/content/${post.id}`} className="editorial-item-title">
                          {post.title}
                        </Link>
                        <span className={`post-status-pill status-${post.status}`}>
                          {post.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="editorial-item-meta">
                        <div className="editorial-destinations">
                          {post.destinations.length === 0 ? (
                            <span className="meta-dim">No destinations selected</span>
                          ) : (
                            post.destinations.map((d, i) => (
                              <span key={i} className="platform-tag">
                                {PLATFORM_LABELS[d.platform]}: {d.accountName}
                              </span>
                            ))
                          )}
                        </div>
                        <span className="meta-separator">·</span>
                        <span className="meta-time">
                          Updated {new Date(post.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="editorial-item-actions">
                      <div className="variant-progress-box">
                        <span className="progress-label">Variants Approved:</span>
                        <span className={`progress-value ${post.variantsApproved === post.variantsTotal && post.variantsTotal > 0 ? "complete" : ""}`}>
                          {post.variantsApproved} / {post.variantsTotal}
                        </span>
                      </div>
                      <Link to={`/content/${post.id}`} className="btn btn-secondary btn-sm">
                        Open
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. WHAT IS SCHEDULED NEXT? */}
          <section className="card card-flush" style={{ marginTop: 24 }}>
            <div className="card-header-row">
              <div>
                <h2 className="card-title">Scheduled Next</h2>
                <span className="card-subtitle">Chronological timeline of upcoming automated dispatches</span>
              </div>
              <Link to="/calendar" className="btn btn-ghost btn-sm">
                Open calendar
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <div className="empty-state-editorial">
                <p className="empty-title">No content queued on the calendar</p>
                <p className="empty-desc">Approved posts ready for release can be scheduled from the Composer.</p>
              </div>
            ) : (
              <div className="schedule-timeline">
                {upcoming.map((item, idx) => (
                  <div key={`${item.postId}-${idx}`} className="schedule-item">
                    <div className="schedule-item-time mono">
                      {formatDateTime(item.scheduledAt, timezone)}
                    </div>
                    <div className="schedule-item-body">
                      <div className="schedule-item-title">{item.postTitle}</div>
                      <div className="schedule-item-platforms">
                        {item.platforms.map((p) => (
                          <span key={p} className="platform-badge-pill">
                            {PLATFORM_LABELS[p]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Link to={`/content/${item.postId}`} className="btn btn-ghost btn-sm">
                      Inspect
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: CHANNELS & OPERATIONS STREAM */}
        <div className="overview-col-side">
          {/* 4. WHICH DESTINATIONS ARE CONNECTED? */}
          <section className="card">
            <div className="card-header-row">
              <h2 className="card-title">Destination Health</h2>
              <Link to="/platforms" className="btn btn-ghost btn-sm">
                Connections
              </Link>
            </div>
            <p className="card-subtitle-small">Real API authentication state and verified capabilities</p>

            <div className="destinations-stack" style={{ marginTop: 14 }}>
              {destinations.length === 0 ? (
                <div className="empty-state-compact">Loading destination health…</div>
              ) : (
                destinations.map((dest) => (
                  <div key={dest.accountId} className="dest-health-card">
                    <div className="dest-health-top">
                      <div>
                        <div className="dest-platform-name">{PLATFORM_LABELS[dest.platform]}</div>
                        <div className="dest-account-name">{dest.accountName}</div>
                      </div>
                      <span className={`dest-status-badge ${dest.status}`}>
                        {dest.status === "connected" ? "CONNECTED" : "UNLINKED"}
                      </span>
                    </div>

                    <div className="dest-health-meta">
                      <span className="dest-type-badge">
                        {dest.accountType === "organization"
                          ? "Organization Page"
                          : dest.accountType === "business_messaging"
                          ? "Business Messaging"
                          : dest.accountType === "professional"
                          ? "Professional Account"
                          : "Personal Member"}
                      </span>
                      <span className={`dest-mode-pill ${dest.mode}`}>
                        {dest.mode === "simulated" ? "SIMULATION" : "OFFICIAL API"}
                      </span>
                    </div>

                    <div className="dest-capabilities-row">
                      {dest.capabilities.map((cap) => (
                        <span key={cap} className="cap-pill">
                          {cap}
                        </span>
                      ))}
                    </div>

                    <div className="dest-status-msg">{dest.statusMessage}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 5. WHAT RECENTLY HAPPENED? */}
          <section className="card" style={{ marginTop: 24 }}>
            <div className="card-header-row">
              <h2 className="card-title">Recent Activity</h2>
              <Link to="/history" className="btn btn-ghost btn-sm">
                Full history
              </Link>
            </div>
            <p className="card-subtitle-small">Recent audit records and dispatch events</p>

            <div className="activity-stream" style={{ marginTop: 14 }}>
              {activity.length === 0 ? (
                <div className="empty-state-compact">No recent publishing events recorded.</div>
              ) : (
                activity.slice(0, 6).map((item) => (
                  <div key={item.id} className="activity-item-row">
                    <div className="activity-item-main">
                      <div className="activity-item-post">{item.postTitle}</div>
                      <div className="activity-item-detail">
                        {PLATFORM_LABELS[item.platform]} · {item.accountName}
                        {item.simulated ? " · SIMULATED" : ""}
                      </div>
                    </div>
                    <JobStatusBadge status={item.status} />
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
