import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MediaCategory, MediaRecord } from "@welz/shared";
import { formatDateTime, getWelz, useAppStore } from "../store";

const categories: Array<{ key?: MediaCategory; label: string }> = [
  { label: "All Assets" },
  { key: "brand", label: "Brand" },
  { key: "events", label: "Events" },
  { key: "social", label: "Social" },
  { key: "projects", label: "Projects" },
  { key: "general", label: "General" },
];

export function MediaPage() {
  const navigate = useNavigate();
  const timezone = useAppStore((s) => s.timezone);
  const pushToast = useAppStore((s) => s.pushToast);
  const [category, setCategory] = useState<MediaCategory | undefined>();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<MediaRecord[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");

  async function refresh() {
    setItems(await getWelz().media.list(category));
  }

  useEffect(() => {
    void refresh();
  }, [category]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const term = search.toLowerCase();
    return items.filter((m) => m.filename.toLowerCase().includes(term));
  }, [items, search]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Media Library</h1>
          <p className="page-subtitle">Centralized asset management for images and videos across all channels.</p>
        </div>
        <div className="actions-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              const uploaded = await getWelz().media.upload();
              if (uploaded.length > 0) {
                await refresh();
                pushToast(`Uploaded ${uploaded.length} asset(s).`);
              }
            }}
          >
            + Upload Media
          </button>
          <button
            type="button"
            className={`btn btn-ghost${view === "grid" ? " active" : ""}`}
            onClick={() => setView("grid")}
          >
            Grid
          </button>
          <button
            type="button"
            className={`btn btn-ghost${view === "list" ? " active" : ""}`}
            onClick={() => setView("list")}
          >
            List
          </button>
        </div>
      </header>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="search"
          className="search-input"
          placeholder="Search media by filename..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <div className="filter-bar" style={{ margin: 0 }}>
          {categories.map((c) => (
            <button
              key={c.label}
              type="button"
              className={`chip${!c.key && !category ? " active" : category === c.key ? " active" : ""}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="card empty-state">
          <h3>Your media library is empty</h3>
          <p>Upload images or videos to organize brand assets and attach them across your publishing channels.</p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 12 }}
            onClick={async () => {
              const uploaded = await getWelz().media.upload();
              if (uploaded.length > 0) {
                await refresh();
                pushToast(`Uploaded ${uploaded.length} asset(s).`);
              }
            }}
          >
            Upload Media Now
          </button>
        </div>
      ) : view === "grid" ? (
        <div className="media-grid">
          {filteredItems.map((m) => (
            <MediaTile
              key={m.id}
              item={m}
              timezone={timezone}
              onRefresh={refresh}
              onUse={() => {
                navigate(`/?mediaId=${m.id}`);
                pushToast("Media attached to publish workstation.");
              }}
            />
          ))}
        </div>
      ) : (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredItems.map((m) => (
            <MediaRow
              key={m.id}
              item={m}
              timezone={timezone}
              onRefresh={refresh}
              onUse={() => {
                navigate(`/?mediaId=${m.id}`);
                pushToast("Media attached to publish workstation.");
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaTile({
  item,
  timezone,
  onRefresh,
  onUse,
}: {
  item: MediaRecord;
  timezone: string;
  onRefresh: () => Promise<void>;
  onUse: () => void;
}) {
  const [usage, setUsage] = useState<number | null>(null);
  const pushToast = useAppStore((s) => s.pushToast);

  useEffect(() => {
    void getWelz()
      .media.usage(item.id)
      .then(setUsage);
  }, [item.id]);

  const isVideo = item.type.startsWith("video");
  const mediaUrl = `welz-media://local/${encodeURIComponent(item.path)}`;

  async function handleDelete() {
    if (usage && usage > 0) {
      if (!confirm(`Warning: This file is currently linked to ${usage} post(s). Are you sure you want to permanently delete it?`)) {
        return;
      }
    } else {
      if (!confirm(`Delete "${item.filename}" from media library?`)) return;
    }
    await getWelz().media.delete(item.id);
    pushToast("Media deleted.");
    await onRefresh();
  }

  return (
    <div className="media-tile">
      <div className="media-tile-thumb" style={{ position: "relative", overflow: "hidden", background: "#0a0c0e" }}>
        {isVideo ? (
          <video
            src={mediaUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            controls={false}
          />
        ) : (
          <img
            src={mediaUrl}
            alt={item.filename}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        <span
          className="badge"
          style={{
            position: "absolute",
            bottom: 6,
            left: 6,
            fontSize: "0.7rem",
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
          }}
        >
          {isVideo ? "VIDEO" : "IMAGE"} · {formatBytes(item.size)}
        </span>
      </div>

      <div className="media-tile-meta" style={{ padding: "10px" }}>
        <div style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.filename}>
          {item.filename}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 2 }}>
          {usage !== null ? `Used in ${usage} post(s)` : "Checking usage..."}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: 2 }}>
          {formatDateTime(item.createdAt, timezone)}
        </div>

        <div className="actions-row" style={{ marginTop: 10, gap: 6 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={onUse} style={{ flex: 1 }}>
            Use in Post
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handleDelete()}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function MediaRow({
  item,
  timezone,
  onRefresh,
  onUse,
}: {
  item: MediaRecord;
  timezone: string;
  onRefresh: () => Promise<void>;
  onUse: () => void;
}) {
  const [usage, setUsage] = useState<number | null>(null);
  const pushToast = useAppStore((s) => s.pushToast);

  useEffect(() => {
    void getWelz()
      .media.usage(item.id)
      .then(setUsage);
  }, [item.id]);

  async function handleDelete() {
    if (usage && usage > 0) {
      if (!confirm(`Warning: This file is currently linked to ${usage} post(s). Are you sure you want to permanently delete it?`)) {
        return;
      }
    } else {
      if (!confirm(`Delete "${item.filename}" from media library?`)) return;
    }
    await getWelz().media.delete(item.id);
    pushToast("Media deleted.");
    await onRefresh();
  }

  return (
    <div className="list-row" style={{ padding: "10px 14px", alignItems: "center" }}>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: "0.95rem" }}>{item.filename}</strong>
          <span className="badge" style={{ fontSize: "0.75rem" }}>
            {item.type.split("/")[1]?.toUpperCase() ?? "FILE"}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{formatBytes(item.size)}</span>
        </div>
        <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: 3 }}>
          {usage !== null ? `Used in ${usage} post(s)` : ""} · Added {formatDateTime(item.createdAt, timezone)}
        </div>
      </div>

      <div className="actions-row" style={{ gap: 8 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={onUse}>
          Use in Post
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const name = prompt("Rename asset filename", item.filename);
            if (!name || name === item.filename) return;
            void getWelz()
              .media.rename(item.id, name)
              .then(() => {
                pushToast("Asset renamed.");
                void onRefresh();
              });
          }}
        >
          Rename
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handleDelete()}>
          Delete
        </button>
      </div>
    </div>
  );
}
