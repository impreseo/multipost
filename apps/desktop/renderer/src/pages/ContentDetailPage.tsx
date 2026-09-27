import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  MediaRecord,
  PlatformAccountRecord,
  PostRecord,
  PostVariantRecord,
  PublishingJobRecord,
} from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";
import { JobStatusBadge, PostStatusBadge } from "../components/StatusBadge";
import { formatDateTime, getWelz, useAppStore } from "../store";

type PostDetail = PostRecord & {
  destinations: PlatformAccountRecord[];
  media: MediaRecord[];
};

export function ContentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const timezone = useAppStore((s) => s.timezone);
  const pushToast = useAppStore((s) => s.pushToast);
  const [post, setPost] = useState<PostDetail | null>(null);
  const [variants, setVariants] = useState<PostVariantRecord[]>([]);
  const [jobs, setJobs] = useState<PublishingJobRecord[]>([]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const list = await getWelz().posts.list();
      setPost(list.find((p) => p.id === id) ?? null);
      setVariants(await getWelz().posts.listVariants(id));
      setJobs(await getWelz().jobs.list({ postId: id }));
    })();
  }, [id]);

  if (!post) {
    return (
      <div className="empty-state">
        <h3>Post not found</h3>
        <Link to="/content">Back to content</Link>
      </div>
    );
  }

  return (
    <>
      <header className="page-header">
        <div className="actions-row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1 className="page-title">{post.title}</h1>
            <p className="page-subtitle">Created {formatDateTime(post.createdAt, timezone)}</p>
          </div>
          <PostStatusBadge status={post.status} />
        </div>
      </header>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title">Master content</h2>
          <div style={{ whiteSpace: "pre-wrap" }}>{post.masterContent || "—"}</div>
        </section>
        <section className="card">
          <h2 className="card-title">Actions</h2>
          <div className="actions-row">
            <Link to={`/compose?id=${post.id}`} className="btn btn-secondary">
              Edit in composer
            </Link>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (!confirm("Delete this post? This cannot be undone.")) return;
                void getWelz()
                  .posts.delete(post.id)
                  .then(() => {
                    pushToast("Post deleted.");
                    navigate("/content");
                  });
              }}
            >
              Delete
            </button>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="card-title">Platform versions</h2>
        {variants.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>No variants prepared yet.</p>
        ) : (
          variants.map((v) => (
            <div key={v.id} className="list-row">
              <div>
                <strong>{PLATFORM_LABELS[v.platform]}</strong>
                <div style={{ whiteSpace: "pre-wrap", marginTop: 8, color: "var(--text-secondary)" }}>
                  {v.content}
                </div>
              </div>
              <span className={`badge ${v.status === "approved" ? "badge-success" : "badge-neutral"}`}>
                {v.status}
              </span>
            </div>
          ))
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="card-title">Publishing jobs</h2>
        {jobs.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>No jobs yet.</p>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="list-row">
              <div>
                <div className="mono">{job.id.slice(0, 8)}</div>
                {job.error ? (
                  <div style={{ color: "var(--error)", marginTop: 4 }}>{job.error}</div>
                ) : null}
              </div>
              <JobStatusBadge status={job.status} />
            </div>
          ))
        )}
      </section>
    </>
  );
}
