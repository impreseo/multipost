import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { PostRecord, PostStatus, PlatformAccountRecord, MediaRecord } from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";
import { PostStatusBadge } from "../components/StatusBadge";
import { formatDateTime, getWelz, useAppStore } from "../store";

const filters: Array<{ key?: PostStatus; label: string }> = [
  { label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "ready", label: "Ready" },
  { key: "scheduled", label: "Scheduled" },
  { key: "publishing", label: "Publishing" },
  { key: "published", label: "Published" },
  { key: "failed", label: "Failed" },
];

type PostRow = PostRecord & { destinations: PlatformAccountRecord[]; media: MediaRecord[] };

export function ContentPage() {
  const timezone = useAppStore((s) => s.timezone);
  const pushToast = useAppStore((s) => s.pushToast);
  const navigate = useNavigate();

  const [filter, setFilter] = useState<PostStatus | undefined>();
  const [search, setSearch] = useState("");
  const [posts, setPosts] = useState<PostRow[]>([]);

  async function refresh() {
    const list = await getWelz().posts.list(filter);
    setPosts(list);
  }

  useEffect(() => {
    void refresh();
  }, [filter]);

  async function handleReuse(postId: string) {
    try {
      const newPost = await getWelz().posts.reuse(postId);
      pushToast(`Created new draft from "${newPost.title}".`);
      navigate(`/?id=${newPost.id}`);
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Reuse failed", "error");
    }
  }

  async function handleDuplicate(postId: string) {
    try {
      const newPost = await getWelz().posts.duplicate(postId);
      pushToast(`Duplicated as "${newPost.title}".`);
      await refresh();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Duplicate failed", "error");
    }
  }

  async function handleDelete(postId: string, title: string) {
    if (!confirm(`Delete post "${title}"? This will also remove any pending scheduled publishing jobs.`)) {
      return;
    }
    try {
      await getWelz().posts.delete(postId);
      pushToast("Post deleted.");
      await refresh();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  const filteredPosts = posts.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.masterContent.toLowerCase().includes(q) ||
      p.destinations.some((d) => d.accountName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="content-library-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Content Library</h1>
          <p className="page-subtitle">
            Manage drafts, prepared content, scheduled dispatches, and historical posts.
          </p>
        </div>
        <div className="content-header-actions">
          <Link to="/" className="btn btn-primary">
            + New post
          </Link>
        </div>
      </header>

      <div className="content-toolbar">
        <div className="filter-chips-row">
          {filters.map((f) => (
            <button
              key={f.label}
              type="button"
              className={`chip${f.key === filter || (!f.key && filter === undefined) ? " active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="search-box-wrapper">
          <input
            type="text"
            className="input input-search"
            placeholder="Search content, text, channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="card empty-state-box">
          <div className="empty-icon">📝</div>
          <h3>No content found</h3>
          <p>
            {search
              ? `No content matches query "${search}".`
              : "No posts in this category yet. Create your first post to start publishing."}
          </p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 12 }}>
            Create master post
          </Link>
        </div>
      ) : (
        <div className="content-cards-list">
          {filteredPosts.map((post) => (
            <div key={post.id} className="content-row-card">
              <div className="content-card-main">
                <div className="content-card-title-line">
                  <Link to={`/?id=${post.id}`} className="content-card-title">
                    {post.title}
                  </Link>
                  <PostStatusBadge status={post.status} />
                </div>

                <div className="content-card-snippet">
                  {post.masterContent ? (
                    post.masterContent.length > 140
                      ? `${post.masterContent.slice(0, 140)}…`
                      : post.masterContent
                  ) : (
                    <span className="meta-dim">No text content written</span>
                  )}
                </div>

                <div className="content-card-meta-line">
                  <div className="content-destinations">
                    {post.destinations.length > 0 ? (
                      post.destinations.map((d) => (
                        <span key={d.id} className="content-channel-badge">
                          {PLATFORM_LABELS[d.platform]} ({d.accountName})
                        </span>
                      ))
                    ) : (
                      <span className="meta-dim">No destinations</span>
                    )}
                  </div>

                  <span className="meta-sep">·</span>

                  <span className="content-media-info">
                    {post.media.length > 0 ? `📎 ${post.media.length} media attached` : "Text only"}
                  </span>

                  <span className="meta-sep">·</span>

                  <span className="content-timestamp">
                    Updated {formatDateTime(post.updatedAt, timezone)}
                  </span>
                </div>
              </div>

              <div className="content-card-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate(`/?id=${post.id}`)}
                >
                  Edit in Workstation
                </button>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleReuse(post.id)}
                  title="Create new draft with identical content and destinations"
                >
                  Reuse
                </button>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDuplicate(post.id)}
                  title="Duplicate post"
                >
                  Duplicate
                </button>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-danger-hover"
                  onClick={() => handleDelete(post.id, post.title)}
                  title="Delete post"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
