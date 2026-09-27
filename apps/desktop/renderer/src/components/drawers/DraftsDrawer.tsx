import React, { useEffect, useState } from "react";
import type { PlatformAccountRecord, PostRecord } from "@welz/shared";
import { formatDateTime, getWelz, useAppStore } from "../../store";

interface Props {
  onSelectPost: (postId: string) => void;
  onNewBlankPost: () => void;
  onClose: () => void;
}

type PostWithRelations = PostRecord & {
  destinations: PlatformAccountRecord[];
  media: any[];
};

export function DraftsDrawer({ onSelectPost, onNewBlankPost, onClose }: Props) {
  const [posts, setPosts] = useState<PostWithRelations[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const timezone = useAppStore((s) => s.timezone);
  const pushToast = useAppStore((s) => s.pushToast);

  async function loadPosts() {
    try {
      setLoading(true);
      const list = await getWelz().posts.list();
      setPosts(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPosts();
  }, []);

  async function handleReuse(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      const reused = await getWelz().posts.reuse(id);
      pushToast("New draft created from post.");
      onSelectPost(reused.id);
      onClose();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Failed to reuse post", "error");
    }
  }

  async function handleDuplicate(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      const dup = await getWelz().posts.duplicate(id);
      pushToast("Post duplicated.");
      await loadPosts();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Failed to duplicate post", "error");
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string, title: string) {
    e.stopPropagation();
    if (!confirm(`Delete "${title || "Untitled"}"?`)) return;
    try {
      await getWelz().posts.delete(id);
      pushToast("Post deleted.");
      await loadPosts();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Failed to delete post", "error");
    }
  }

  const filtered = posts.filter((p) => {
    const term = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(term) ||
      p.masterContent.toLowerCase().includes(term) ||
      p.status.toLowerCase().includes(term)
    );
  });

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2 className="drawer-title">Drafts & Content Library</h2>
          <button type="button" className="drawer-close-btn" onClick={onClose} title="Close drawer">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              className="drawer-search-input"
              placeholder="Search drafts, scheduled, or published posts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="btn-quiet"
              style={{ border: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}
              onClick={() => {
                onNewBlankPost();
                onClose();
              }}
            >
              + Blank
            </button>
          </div>

          <div className="drawer-section-title">
            All Posts ({filtered.length})
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Loading posts...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {search ? "No posts match your search query." : "No posts saved yet. Write something in the editor!"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((post) => (
                <div
                  key={post.id}
                  className="drawer-card-item"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    onSelectPost(post.id);
                    onClose();
                  }}
                >
                  <div className="drawer-item-header">
                    <span className="drawer-item-title" title={post.title || "Untitled"}>
                      {post.title || "Untitled Post"}
                    </span>
                    <span
                      className="drawer-badge"
                      style={{
                        background:
                          post.status === "published"
                            ? "rgba(16, 185, 129, 0.15)"
                            : post.status === "scheduled"
                            ? "rgba(245, 158, 11, 0.15)"
                            : "var(--bg-elevated)",
                        color:
                          post.status === "published"
                            ? "var(--success)"
                            : post.status === "scheduled"
                            ? "var(--warning)"
                            : "var(--text-muted)",
                      }}
                    >
                      {post.status}
                    </span>
                  </div>

                  <p className="drawer-item-excerpt">
                    {post.masterContent || "No content."}
                  </p>

                  <div className="drawer-item-meta">
                    <span>
                      {post.destinations.length > 0
                        ? `${post.destinations.length} destination${post.destinations.length > 1 ? "s" : ""}`
                        : "No destinations"}
                      {" · "}
                      {formatDateTime(post.updatedAt, timezone)}
                    </span>

                    <div className="drawer-item-actions">
                      <button
                        type="button"
                        className="btn-tiny btn-tiny-ghost"
                        onClick={(e) => handleReuse(e, post.id)}
                        title="Reuse as a new draft"
                      >
                        Reuse
                      </button>
                      <button
                        type="button"
                        className="btn-tiny btn-tiny-ghost"
                        onClick={(e) => handleDuplicate(e, post.id)}
                        title="Duplicate"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        className="btn-tiny btn-tiny-danger"
                        onClick={(e) => handleDelete(e, post.id, post.title)}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
