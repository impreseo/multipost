import { useEffect, useState } from "react";
import type { MediaRecord } from "@welz/shared";
import { getWelz, useAppStore } from "../../store";

interface Props {
  attachedMedia: MediaRecord[];
  onToggleAttach: (item: MediaRecord) => void;
  onClose: () => void;
}

export function MediaDrawer({ attachedMedia, onToggleAttach, onClose }: Props) {
  const [library, setLibrary] = useState<MediaRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const pushToast = useAppStore((s) => s.pushToast);

  async function loadMedia() {
    try {
      const items = await getWelz().media.list();
      setLibrary(items);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadMedia();
  }, []);

  async function handleUpload() {
    setUploading(true);
    try {
      const uploaded = await getWelz().media.upload();
      if (uploaded.length > 0) {
        pushToast(`Added ${uploaded.length} asset${uploaded.length > 1 ? "s" : ""} to library.`);
        await loadMedia();
        for (const item of uploaded) {
          onToggleAttach(item);
        }
      }
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation();
    if (!confirm(`Delete media asset "${name}"?`)) return;
    try {
      const ok = await getWelz().media.delete(id);
      if (ok) {
        pushToast("Media deleted.");
        await loadMedia();
      }
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel wide" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h2 className="drawer-title">Media Library</h2>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {attachedMedia.length} attached to active post
            </span>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose} title="Close drawer">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="drawer-section-title">All Assets ({library.length})</span>
            <button
              type="button"
              className="btn-tiny"
              style={{ background: "var(--primary)", color: "#0a0c10", fontWeight: 600 }}
              disabled={uploading}
              onClick={handleUpload}
            >
              {uploading ? "Adding..." : "+ Upload File"}
            </button>
          </div>

          {library.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No media in library yet. Click "+ Upload File" or drop files into the editor!
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 10,
              }}
            >
              {library.map((item) => {
                const isAttached = attachedMedia.some((m) => m.id === item.id);
                const url = `welz-media://local/${encodeURIComponent(item.path.replace(/\\/g, "/"))}`;

                return (
                  <div
                    key={item.id}
                    className="drawer-card-item"
                    style={{
                      padding: 8,
                      cursor: "pointer",
                      borderColor: isAttached ? "var(--primary)" : "var(--border-subtle)",
                      background: isAttached ? "rgba(56, 189, 248, 0.05)" : "var(--bg-app)",
                    }}
                    onClick={() => onToggleAttach(item)}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: 90,
                        borderRadius: 4,
                        overflow: "hidden",
                        background: "#000",
                      }}
                    >
                      {item.type.startsWith("image") ? (
                        <img
                          src={url}
                          alt={item.filename}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          ▶ Video
                        </div>
                      )}

                      {isAttached && (
                        <span
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            background: "var(--primary)",
                            color: "#0a0c10",
                            borderRadius: "50%",
                            width: 18,
                            height: 18,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={item.filename}
                      >
                        {item.filename}
                      </span>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {(item.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        <button
                          type="button"
                          className="btn-tiny btn-tiny-danger"
                          style={{ padding: "1px 4px", fontSize: 9 }}
                          onClick={(e) => handleDelete(e, item.id, item.filename)}
                          title="Delete asset"
                        >
                          ✕
                        </button>
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
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
