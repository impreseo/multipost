import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { MediaRecord, Platform, PlatformAccountRecord, PostVariantRecord } from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";
import { PlatformPreview } from "../components/PlatformPreview";
import { formatDateTime, getWelz, useAppStore } from "../store";

type PreviewTab = "master" | Platform;

export function ComposePage() {
  const [search] = useSearchParams();
  const editId = search.get("id");
  const navigate = useNavigate();
  const timezone = useAppStore((s) => s.timezone);
  const devMode = useAppStore((s) => s.devMode);
  const pushToast = useAppStore((s) => s.pushToast);

  const [postId, setPostId] = useState<string | null>(editId);
  const [title, setTitle] = useState("");
  const [masterContent, setMasterContent] = useState("");
  const [accounts, setAccounts] = useState<PlatformAccountRecord[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [libraryMedia, setLibraryMedia] = useState<MediaRecord[]>([]);
  const [variants, setVariants] = useState<PostVariantRecord[]>([]);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("master");
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("18:30");
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getWelz()
      .platforms.list()
      .then(setAccounts);
    void getWelz()
      .media.list()
      .then(setLibraryMedia);
  }, []);

  useEffect(() => {
    if (!editId) return;
    void (async () => {
      const post = await getWelz().posts.get(editId);
      if (!post) return;
      setPostId(post.id);
      setTitle(post.title);
      setMasterContent(post.masterContent);
      const all = await getWelz().posts.list();
      const row = all.find((p) => p.id === editId);
      if (row) {
        setSelectedAccounts(row.destinations.map((d) => d.id));
        setMedia(row.media);
      } else {
        setMedia(await getWelz().posts.getMedia(editId));
      }
      setVariants(await getWelz().posts.listVariants(editId));
    })();
  }, [editId]);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  async function ensurePost(): Promise<string> {
    if (postId) {
      await getWelz().posts.update({ id: postId, title, masterContent });
      return postId;
    }
    const created = await getWelz().posts.create({ title: title || "Untitled draft", masterContent });
    setPostId(created.id);
    return created.id;
  }

  async function saveDraft() {
    setBusy(true);
    try {
      const id = await ensurePost();
      await getWelz().posts.setDestinations(id, selectedAccounts);
      await getWelz().posts.setMedia(
        id,
        media.map((m) => m.id)
      );
      pushToast("Draft saved.");
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function prepareVersions() {
    setBusy(true);
    try {
      const id = await ensurePost();
      await getWelz().posts.setDestinations(id, selectedAccounts);
      const v = await getWelz().posts.prepareVariants(id);
      setVariants(v);
      pushToast("Platform versions prepared — review and approve.");
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function approveAll() {
    if (!postId) return;
    setBusy(true);
    try {
      const v = await getWelz().posts.approveVariants(postId);
      setVariants(v);
      pushToast("Versions approved.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const id = await ensurePost();
      if (selectedAccounts.length === 0) {
        pushToast("Select at least one destination.", "error");
        return;
      }
      if (variants.length === 0) {
        pushToast("Prepare and approve platform versions first.", "error");
        return;
      }
      const unapproved = variants.some((v) => v.status !== "approved");
      if (unapproved) {
        pushToast("Approve all platform versions before publishing.", "error");
        return;
      }

      let scheduledAt: string | undefined;
      if (publishMode === "schedule") {
        if (!scheduleDate) {
          pushToast("Choose a schedule date.", "error");
          return;
        }
        scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      }

      const jobs = await getWelz().publish.schedule({
        postId: id,
        platformAccountIds: selectedAccounts,
        mode: publishMode === "now" ? "now" : "schedule",
        scheduledAt,
        timezone,
      });

      const simulated = devMode;
      pushToast(
        publishMode === "now"
          ? simulated
            ? "Jobs queued — simulated publishing (development mode)."
            : "Jobs queued — publishing in progress."
          : `Scheduled for ${formatDateTime(scheduledAt!, timezone)}`
      );
      navigate(`/publishing?post=${id}&jobs=${jobs.length}`);
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setBusy(false);
    }
  }

  function toggleAccount(id: string) {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function attachMedia(item: MediaRecord) {
    if (media.some((m) => m.id === item.id)) return;
    setMedia((prev) => [...prev, item]);
  }

  function removeMedia(id: string) {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }

  function applyAssistant(action: "shorten" | "professional" | "grammar" | "hashtags") {
    if (!masterContent.trim()) {
      pushToast("Write some master content first.", "error");
      return;
    }
    let transformed = masterContent;
    if (action === "shorten") {
      transformed = masterContent
        .split("\n")
        .map((line) =>
          line.replace(/\b(in order to|due to the fact that|as a matter of fact|at this point in time)\b/gi, "")
        )
        .join("\n")
        .replace(/\s{2,}/g, " ")
        .trim();
      pushToast("Content shortened and condensed.");
    } else if (action === "professional") {
      transformed = masterContent
        .replace(/\b(wanna|gonna|gotta)\b/gi, (m) =>
          m.toLowerCase() === "wanna" ? "want to" : m.toLowerCase() === "gonna" ? "going to" : "have to"
        )
        .trim();
      if (!transformed.endsWith(".")) transformed += ".";
      pushToast("Tone refined to professional standard.");
    } else if (action === "grammar") {
      transformed = masterContent
        .replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase())
        .trim();
      pushToast("Grammar and casing polished.");
    } else if (action === "hashtags") {
      const tags = "\n\n#WELZ #BuildingWhatNext #Innovation #Technology #Founders";
      if (!masterContent.includes("#WELZ")) {
        transformed = masterContent.trim() + tags;
        pushToast("Hashtags appended.");
      }
    }
    setMasterContent(transformed);
  }

  function optimizeForInstagram(variantId: string, current: string) {
    let opt = current.trim();
    if (!opt.includes("#")) {
      opt += "\n\n#welz #buildingwhatsnext #community #tech #innovation";
    }
    setVariants((prev) => prev.map((x) => (x.id === variantId ? { ...x, content: opt } : x)));
    void getWelz().variants.update(variantId, opt);
    pushToast("Instagram tags & formatting added.");
  }

  function optimizeForWhatsApp(variantId: string, current: string) {
    const lines = current.split("\n").filter(Boolean);
    const titleLine = lines[0] ? `*${lines[0].replace(/\*/g, "")}*\n` : "";
    const bodyLines = lines.slice(1).map((l) => (l.startsWith("•") ? l : `• ${l}`)).join("\n");
    const opt = `${titleLine}\n${bodyLines}\n\n_— WELZ Operations_`.trim();
    setVariants((prev) => prev.map((x) => (x.id === variantId ? { ...x, content: opt } : x)));
    void getWelz().variants.update(variantId, opt);
    pushToast("WhatsApp announcement bullet formatting applied.");
  }

  const previewContent =
    previewTab === "master"
      ? masterContent
      : variants.find((v) => v.platform === previewTab)?.content ?? masterContent;

  const previewAccount =
    previewTab === "master"
      ? undefined
      : selectedAccounts
          .map((id) => accountMap.get(id))
          .find((a) => a?.platform === previewTab);

  const wordCount = masterContent.trim() ? masterContent.trim().split(/\s+/).length : 0;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Compose</h1>
        <p className="page-subtitle">Create master content, prepare destinations, review, publish.</p>
      </header>

      <div className="composer-layout">
        <div>
          <div className="field">
            <label className="field-label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="WELZ Forge Launch"
            />
          </div>
          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label className="field-label" htmlFor="master" style={{ margin: 0 }}>
                Master content
              </label>
              <span className="char-counter">
                {masterContent.length} chars · {wordCount} words
              </span>
            </div>

            <div className="assistant-toolbar">
              <span className="assistant-title">AI Assistant:</span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "4px 8px", fontSize: 12 }}
                onClick={() => applyAssistant("professional")}
              >
                ✨ Professionalise
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "4px 8px", fontSize: 12 }}
                onClick={() => applyAssistant("shorten")}
              >
                ✂️ Shorten
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "4px 8px", fontSize: 12 }}
                onClick={() => applyAssistant("grammar")}
              >
                🔍 Fix Grammar
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "4px 8px", fontSize: 12 }}
                onClick={() => applyAssistant("hashtags")}
              >
                #️⃣ Add Hashtags
              </button>
            </div>

            <textarea
              id="master"
              className="textarea"
              value={masterContent}
              onChange={(e) => setMasterContent(e.target.value)}
              placeholder="Introducing WELZ Forge — Build What's Next. We're building a community for students, builders, creators..."
            />
          </div>

          <section className="card" style={{ marginBottom: 16 }}>
            <h2 className="card-title">Media</h2>
            {media.length === 0 ? (
              <p style={{ color: "var(--text-secondary)" }}>No media attached.</p>
            ) : (
              <div className="media-grid">
                {media.map((m) => (
                  <div key={m.id} className="media-tile">
                    <div
                      className="media-tile-meta"
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 110,
                        }}
                        title={m.filename}
                      >
                        {m.filename}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: "0 6px", fontSize: 14, height: 20, color: "var(--error)" }}
                        onClick={() => removeMedia(m.id)}
                        title="Remove attachment"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="actions-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  const uploaded = await getWelz().media.upload();
                  if (uploaded.length) {
                    setLibraryMedia(await getWelz().media.list());
                    uploaded.forEach(attachMedia);
                  }
                }}
              >
                Upload
              </button>
            </div>
            {libraryMedia.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <p className="field-label">Library</p>
                <div className="actions-row">
                  {libraryMedia.slice(0, 8).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => attachMedia(m)}
                    >
                      + {m.filename}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {variants.length > 0 ? (
            <section className="card">
              <h2 className="card-title">Platform versions</h2>
              {variants.map((v) => {
                const maxLen = v.platform === "linkedin" ? 3000 : v.platform === "instagram" ? 2200 : 4096;
                return (
                  <div key={v.id} className="field">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <label className="field-label" style={{ margin: 0 }}>
                        {PLATFORM_LABELS[v.platform]}
                      </label>
                      <span className="char-counter">
                        {v.content.length} / {maxLen} chars
                      </span>
                    </div>
                    <textarea
                      className="textarea"
                      style={{ minHeight: 120 }}
                      value={v.content}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((x) => (x.id === v.id ? { ...x, content: e.target.value } : x))
                        )
                      }
                      onBlur={(e) => void getWelz().variants.update(v.id, e.target.value)}
                    />
                    <div className="actions-row">
                      <span
                        className={`badge ${
                          v.status === "approved" ? "badge-success" : "badge-neutral"
                        }`}
                      >
                        {v.status}
                      </span>
                      {v.platform === "instagram" ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 12 }}
                          onClick={() => optimizeForInstagram(v.id, v.content)}
                        >
                          📸 Add IG Tags
                        </button>
                      ) : null}
                      {v.platform === "whatsapp" ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 12 }}
                          onClick={() => optimizeForWhatsApp(v.id, v.content)}
                        >
                          📢 Format Announcement
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() =>
                          void getWelz()
                            .variants.reset(postId!, v.platform)
                            .then((updated) =>
                              setVariants((prev) =>
                                prev.map((x) => (x.id === updated.id ? updated : x))
                              )
                            )
                        }
                      >
                        Reset to prepared
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          ) : null}
        </div>

        <aside className="composer-panel">
          <section className="card">
            <h2 className="card-title">Destinations</h2>
            <div className="destinations">
              {accounts.map((account) => (
                <label key={account.id} className="destination-item">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(account.id)}
                    onChange={() => toggleAccount(account.id)}
                  />
                  <span>
                    {PLATFORM_LABELS[account.platform]} — {account.accountName}
                  </span>
                  <span
                    className={`badge ${
                      account.status === "connected" ? "badge-success" : "badge-neutral"
                    }`}
                    style={{ marginLeft: "auto" }}
                  >
                    {account.status}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="card-title">Publish</h2>
            <div className="radio-row">
              <label>
                <input
                  type="radio"
                  name="mode"
                  checked={publishMode === "now"}
                  onChange={() => setPublishMode("now")}
                />{" "}
                Publish now
              </label>
              <label>
                <input
                  type="radio"
                  name="mode"
                  checked={publishMode === "schedule"}
                  onChange={() => setPublishMode("schedule")}
                />{" "}
                Schedule
              </label>
            </div>
            {publishMode === "schedule" ? (
              <div className="schedule-fields">
                <input
                  type="date"
                  className="input"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
                <input
                  type="time"
                  className="input"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            ) : null}
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
              Timezone: {timezone}
            </p>
          </section>

          <div className="actions-row">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void saveDraft()}>
              Save draft
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowPreview((v) => !v)}>
              Preview
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void prepareVersions()}>
              Prepare versions
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy || !postId} onClick={() => void approveAll()}>
              Approve
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void publish()}>
              Publish
            </button>
          </div>

          {showPreview ? (
            <section className="card">
              <div className="tabs">
                {(["master", "linkedin", "instagram", "whatsapp"] as PreviewTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`tab${previewTab === tab ? " active" : ""}`}
                    onClick={() => setPreviewTab(tab)}
                  >
                    {tab === "master" ? "Master" : PLATFORM_LABELS[tab]}
                  </button>
                ))}
              </div>
              <PlatformPreview
                platform={previewTab}
                account={previewAccount}
                content={previewContent}
                media={media}
              />
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
