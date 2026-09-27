import React, { useState } from "react";
import type { MediaRecord, Platform, PlatformAccountRecord } from "@welz/shared";
import { PLATFORM_LABELS } from "@welz/shared";

interface Props {
  platform: Platform | "master";
  account?: PlatformAccountRecord;
  content: string;
  media: MediaRecord[];
  isVariant?: boolean;
}

export function PlatformPreview({ platform, account, content, media, isVariant }: Props) {
  if (platform === "linkedin") {
    return <LinkedInPreview account={account} content={content} media={media} isVariant={isVariant} />;
  }
  if (platform === "instagram") {
    return <InstagramPreview account={account} content={content} media={media} isVariant={isVariant} />;
  }
  if (platform === "whatsapp") {
    return <WhatsAppPreview account={account} content={content} media={media} isVariant={isVariant} />;
  }
  return <MasterPreview content={content} media={media} />;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function mediaPathToUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return `welz-media://local/${encodeURIComponent(normalized)}`;
}

function formatWhatsAppText(text: string): React.ReactNode[] {
  if (!text) return [];
  const lines = text.split("\n");
  return lines.map((line, lIdx) => {
    // Basic WhatsApp formatting: *bold*, _italic_, ~strike~, `code`
    const parts: React.ReactNode[] = [];
    let cur = line;
    let keyIdx = 0;

    // Simple regex replace with spans
    const tokenRegex = /(\*[^*]+\*|_[^_]+_|~[^~]+~|`[^`]+`)/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = tokenRegex.exec(cur)) !== null) {
      if (match.index > lastIndex) {
        parts.push(cur.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith("*") && token.endsWith("*")) {
        parts.push(<strong key={keyIdx++}>{token.slice(1, -1)}</strong>);
      } else if (token.startsWith("_") && token.endsWith("_")) {
        parts.push(<em key={keyIdx++}>{token.slice(1, -1)}</em>);
      } else if (token.startsWith("~") && token.endsWith("~")) {
        parts.push(<del key={keyIdx++}>{token.slice(1, -1)}</del>);
      } else if (token.startsWith("`") && token.endsWith("`")) {
        parts.push(<code key={keyIdx++} style={{ background: "rgba(0,0,0,0.2)", padding: "1px 4px", borderRadius: 3 }}>{token.slice(1, -1)}</code>);
      }
      lastIndex = match.index + token.length;
    }
    if (lastIndex < cur.length) {
      parts.push(cur.substring(lastIndex));
    }

    return (
      <React.Fragment key={lIdx}>
        {parts.length > 0 ? parts : "\u00A0"}
        {lIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

function formatHashtags(text: string): React.ReactNode[] {
  const parts = text.split(/(#[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("#")) {
      return (
        <span key={i} style={{ color: "#3b82f6", fontWeight: 500 }}>
          {part}
        </span>
      );
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// LINKEDIN PREVIEW
// ---------------------------------------------------------------------------
export function LinkedInPreview({
  account,
  content,
  media,
  isVariant,
}: {
  account?: PlatformAccountRecord;
  content: string;
  media: MediaRecord[];
  isVariant?: boolean;
}) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const isOrg =
    account?.accountName.toLowerCase().includes("page") ||
    account?.accountName.toLowerCase().includes("organization") ||
    account?.accountName.toLowerCase().includes("company") ||
    account?.accountName === "WELZ";
  const displayName = account?.accountName || "WELZ Official";
  const headline = isOrg ? "Company · Software & Technology" : "Creator & Product Leader · 1st";
  const charLimit = 3000;
  const isOverLimit = content.length > charLimit;

  const currentMedia = media[carouselIndex] || media[0];

  return (
    <div className="preview-frame-v2 preview-linkedin" aria-label="LinkedIn preview">
      {/* Header Bar */}
      <div className="preview-top-badge">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="platform-tag linkedin-tag">LinkedIn</span>
          <span className="account-type-tag">{isOrg ? "Organization Page" : "Personal Profile"}</span>
          {isVariant && <span className="variant-tag">Platform Variant</span>}
        </div>
        <div className={`preview-counter ${isOverLimit ? "counter-over" : ""}`}>
          {content.length.toLocaleString()} / {charLimit.toLocaleString()} chars
        </div>
      </div>

      {/* Post Author Card */}
      <div className="linkedin-card-header">
        <div className="linkedin-avatar">
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="linkedin-meta">
          <div className="linkedin-name-row">
            <span className="linkedin-author">{displayName}</span>
            <span className="linkedin-degree">{isOrg ? "• 1,280 followers" : "• 1st"}</span>
          </div>
          <div className="linkedin-headline">{headline}</div>
          <div className="linkedin-timestamp">
            <span>Just now</span>
            <span>•</span>
            <span title="Shared publicly">🌐</span>
          </div>
        </div>
        {isOrg && (
          <button type="button" className="linkedin-follow-btn">
            + Follow
          </button>
        )}
      </div>

      {/* Post Body */}
      <div className="linkedin-content">
        {content ? (
          formatHashtags(content)
        ) : (
          <span className="preview-empty-hint">Start writing to preview your LinkedIn post...</span>
        )}
      </div>

      {/* Media Attachment */}
      {media.length > 0 && (
        <div className="linkedin-media-area">
          {currentMedia?.type.startsWith("image") ? (
            <div className="linkedin-image-wrap">
              <img
                src={mediaPathToUrl(currentMedia.path)}
                alt={currentMedia.filename}
                className="linkedin-media-img"
              />
              {media.length > 1 && (
                <div className="carousel-nav-overlay">
                  <button
                    type="button"
                    className="carousel-btn prev"
                    disabled={carouselIndex === 0}
                    onClick={() => setCarouselIndex((i) => Math.max(0, i - 1))}
                  >
                    ‹
                  </button>
                  <span className="carousel-pill">
                    {carouselIndex + 1} / {media.length}
                  </span>
                  <button
                    type="button"
                    className="carousel-btn next"
                    disabled={carouselIndex === media.length - 1}
                    onClick={() => setCarouselIndex((i) => Math.min(media.length - 1, i + 1))}
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="linkedin-video-box">
              <div className="video-play-icon">▶</div>
              <div className="video-meta">
                <span className="video-title">{currentMedia?.filename}</span>
                <span className="video-badge">Native LinkedIn Video</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Social Engagement Stats */}
      <div className="linkedin-stats-bar">
        <div className="linkedin-reactions-pill">
          <span style={{ fontSize: 13 }}>👍❤️💡</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>42</span>
        </div>
        <div className="linkedin-comment-count">
          <span>8 comments</span>
          <span>•</span>
          <span>3 reposts</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="linkedin-action-bar">
        <button type="button" className="linkedin-action-btn">
          <span>👍</span> Like
        </button>
        <button type="button" className="linkedin-action-btn">
          <span>💬</span> Comment
        </button>
        <button type="button" className="linkedin-action-btn">
          <span>🔁</span> Repost
        </button>
        <button type="button" className="linkedin-action-btn">
          <span>📤</span> Send
        </button>
      </div>

      {/* Validation Banner if errors */}
      {isOverLimit && (
        <div className="preview-validation-banner error">
          ⚠ Content exceeds LinkedIn 3,000 character limit by {(content.length - charLimit).toLocaleString()} characters.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// INSTAGRAM PREVIEW
// ---------------------------------------------------------------------------
export function InstagramPreview({
  account,
  content,
  media,
  isVariant,
}: {
  account?: PlatformAccountRecord;
  content: string;
  media: MediaRecord[];
  isVariant?: boolean;
}) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [viewFormat, setViewFormat] = useState<"post" | "reel">("post");
  const username = (account?.accountName || "welz_official").toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const charLimit = 2200;
  const isOverLimit = content.length > charLimit;
  const hashtagsCount = (content.match(/#[a-zA-Z0-9_]+/g) || []).length;
  const isVideo = media.length > 0 && media[0].type.startsWith("video");

  const currentMedia = media[carouselIndex] || media[0];

  return (
    <div className="preview-frame-v2 preview-instagram" aria-label="Instagram preview">
      {/* Header Bar */}
      <div className="preview-top-badge">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="platform-tag instagram-tag">Instagram</span>
          <span className="account-type-tag">Professional Account</span>
          {isVariant && <span className="variant-tag">Platform Variant</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isVideo && (
            <div className="format-toggle">
              <button
                type="button"
                className={`format-btn ${viewFormat === "post" ? "active" : ""}`}
                onClick={() => setViewFormat("post")}
              >
                Post
              </button>
              <button
                type="button"
                className={`format-btn ${viewFormat === "reel" ? "active" : ""}`}
                onClick={() => setViewFormat("reel")}
              >
                Reel
              </button>
            </div>
          )}
          <div className={`preview-counter ${isOverLimit ? "counter-over" : ""}`}>
            {content.length.toLocaleString()} / {charLimit.toLocaleString()} chars
          </div>
        </div>
      </div>

      {/* Phone/Frame Wrapper for Instagram */}
      <div className={`ig-phone-shell ${viewFormat === "reel" ? "reel-mode" : ""}`}>
        {/* Instagram Header */}
        <div className="ig-header">
          <div className="ig-avatar-ring">
            <div className="ig-avatar">{username.slice(0, 2).toUpperCase()}</div>
          </div>
          <div className="ig-meta">
            <span className="ig-username">{username}</span>
            <span className="ig-subtext">{viewFormat === "reel" ? "Original Audio" : "Original publication"}</span>
          </div>
          <div className="ig-options-btn">•••</div>
        </div>

        {/* Media Frame */}
        <div className={`ig-media-viewport ${viewFormat === "reel" ? "vertical-reel" : ""}`}>
          {media.length > 0 ? (
            currentMedia?.type.startsWith("image") ? (
              <div className="ig-img-wrap">
                <img
                  src={mediaPathToUrl(currentMedia.path)}
                  alt={currentMedia.filename}
                  className="ig-media-element"
                />
                {media.length > 1 && (
                  <>
                    <div className="carousel-nav-overlay">
                      <button
                        type="button"
                        className="carousel-btn prev"
                        disabled={carouselIndex === 0}
                        onClick={() => setCarouselIndex((i) => Math.max(0, i - 1))}
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        className="carousel-btn next"
                        disabled={carouselIndex === media.length - 1}
                        onClick={() => setCarouselIndex((i) => Math.min(media.length - 1, i + 1))}
                      >
                        ›
                      </button>
                    </div>
                    <div className="ig-carousel-badge">
                      {carouselIndex + 1} / {media.length}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="ig-video-wrap">
                <div className="video-play-icon">▶</div>
                <div className="ig-video-label">
                  {viewFormat === "reel" ? "Vertical Reel (9:16)" : "Video Post"}
                  <br />
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{currentMedia?.filename}</span>
                </div>
              </div>
            )
          ) : (
            <div className="ig-media-empty">
              <span style={{ fontSize: 24 }}>📷</span>
              <span>Photo or video required for Instagram publication</span>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="ig-action-bar">
          <div className="ig-action-group">
            <button type="button" className="ig-icon-btn" title="Like">
              ❤️
            </button>
            <button type="button" className="ig-icon-btn" title="Comment">
              💬
            </button>
            <button type="button" className="ig-icon-btn" title="Share">
              ✈️
            </button>
          </div>
          {media.length > 1 && (
            <div className="ig-dot-indicators">
              {media.slice(0, 5).map((_, idx) => (
                <span key={idx} className={`ig-dot ${idx === carouselIndex ? "active" : ""}`} />
              ))}
            </div>
          )}
          <button type="button" className="ig-icon-btn bookmark-btn" title="Save">
            🔖
          </button>
        </div>

        {/* Likes Count */}
        <div className="ig-likes-row">
          <span>Liked by <strong>welz_team</strong> and <strong>128 others</strong></span>
        </div>

        {/* Caption */}
        <div className="ig-caption-block">
          <span className="ig-caption-author">{username}</span>{" "}
          <span className="ig-caption-text">
            {content ? formatHashtags(content) : <span className="preview-empty-hint">No caption written yet.</span>}
          </span>
        </div>

        {/* Hashtag counter indicator */}
        <div className="ig-meta-footer">
          <span>{hashtagsCount} / 30 hashtags</span>
          <span>•</span>
          <span>View all 12 comments</span>
        </div>
      </div>

      {/* Validation Banners */}
      {isOverLimit && (
        <div className="preview-validation-banner error">
          ⚠ Caption exceeds Instagram 2,200 character limit by {(content.length - charLimit).toLocaleString()} characters.
        </div>
      )}
      {media.length === 0 && (
        <div className="preview-validation-banner warning">
          ⚠ Instagram requires at least one attached image or video.
        </div>
      )}
      {hashtagsCount > 30 && (
        <div className="preview-validation-banner error">
          ⚠ Instagram supports maximum 30 hashtags (currently {hashtagsCount}).
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WHATSAPP BUSINESS PREVIEW
// ---------------------------------------------------------------------------
export function WhatsAppPreview({
  account,
  content,
  media,
  isVariant,
}: {
  account?: PlatformAccountRecord;
  content: string;
  media: MediaRecord[];
  isVariant?: boolean;
}) {
  const [msgType, setMsgType] = useState<"standard" | "template">("standard");
  const businessName = account?.accountName || "WELZ Business";
  const charLimit = 4096;
  const isOverLimit = content.length > charLimit;
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const currentMedia = media[0];

  return (
    <div className="preview-frame-v2 preview-whatsapp" aria-label="WhatsApp preview">
      {/* Header Bar */}
      <div className="preview-top-badge">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="platform-tag whatsapp-tag">WhatsApp</span>
          <span className="account-type-tag">Cloud API / Business</span>
          {isVariant && <span className="variant-tag">Platform Variant</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="format-toggle">
            <button
              type="button"
              className={`format-btn ${msgType === "standard" ? "active" : ""}`}
              onClick={() => setMsgType("standard")}
            >
              Direct Message
            </button>
            <button
              type="button"
              className={`format-btn ${msgType === "template" ? "active" : ""}`}
              onClick={() => setMsgType("template")}
            >
              Template
            </button>
          </div>
          <div className={`preview-counter ${isOverLimit ? "counter-over" : ""}`}>
            {content.length.toLocaleString()} / {charLimit.toLocaleString()} chars
          </div>
        </div>
      </div>

      {/* WhatsApp Window Shell */}
      <div className="wa-chat-window">
        {/* Contact Header */}
        <div className="wa-chat-header">
          <div className="wa-avatar">📢</div>
          <div className="wa-header-meta">
            <div className="wa-contact-name">
              <span>{businessName}</span>
              <span className="wa-verified-badge" title="Official WhatsApp Business Account">✓</span>
            </div>
            <div className="wa-contact-status">Official Business Account</div>
          </div>
          <div className="wa-header-icons">
            <span>📹</span>
            <span>📞</span>
            <span>⋮</span>
          </div>
        </div>

        {/* Chat Canvas with Wallpaper Background */}
        <div className="wa-chat-canvas">
          <div className="wa-date-pill">TODAY</div>

          {/* WhatsApp Message Bubble */}
          <div className="wa-bubble-container">
            <div className={`wa-message-bubble ${msgType === "template" ? "template-bubble" : ""}`}>
              {/* Template Header if template mode */}
              {msgType === "template" && (
                <div className="wa-template-header">
                  <strong>UPDATE FROM {businessName.toUpperCase()}</strong>
                </div>
              )}

              {/* Media Container inside bubble */}
              {media.length > 0 && (
                <div className="wa-bubble-media">
                  {currentMedia?.type.startsWith("image") ? (
                    <img
                      src={mediaPathToUrl(currentMedia.path)}
                      alt={currentMedia.filename}
                      className="wa-media-img"
                    />
                  ) : (
                    <div className="wa-video-card">
                      <span>▶ Video Attachment: {currentMedia?.filename}</span>
                    </div>
                  )}
                  {media.length > 1 && (
                    <div className="wa-more-media-pill">+{media.length - 1} more assets</div>
                  )}
                </div>
              )}

              {/* Message Text */}
              <div className="wa-bubble-text">
                {content ? (
                  formatWhatsAppText(content)
                ) : (
                  <span className="preview-empty-hint">Type a message to preview WhatsApp dispatch...</span>
                )}
              </div>

              {/* Meta: Timestamp + Double Blue Tick */}
              <div className="wa-bubble-meta">
                <span className="wa-timestamp">{timeStr}</span>
                <span className="wa-ticks" title="Read by recipient">✓✓</span>
              </div>

              {/* Interactive Template Buttons */}
              {msgType === "template" && (
                <div className="wa-template-buttons">
                  <button type="button" className="wa-action-btn">
                    🌐 Visit Website
                  </button>
                  <button type="button" className="wa-action-btn">
                    💬 Quick Reply
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Validation Banners */}
      {isOverLimit && (
        <div className="preview-validation-banner error">
          ⚠ Message exceeds WhatsApp 4,096 character limit by {(content.length - charLimit).toLocaleString()} characters.
        </div>
      )}
      {media.length > 4 && (
        <div className="preview-validation-banner error">
          ⚠ WhatsApp supports maximum 4 media attachments per dispatch (currently {media.length}).
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MASTER CONTENT PREVIEW
// ---------------------------------------------------------------------------
export function MasterPreview({ content, media }: { content: string; media: MediaRecord[] }) {
  return (
    <div className="preview-frame-v2 preview-master" aria-label="Master preview">
      <div className="preview-top-badge">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="platform-tag master-tag">Master Content</span>
          <span className="account-type-tag">Source of Truth</span>
        </div>
        <div className="preview-counter">{content.length.toLocaleString()} characters</div>
      </div>

      <div className="master-content-body">
        {content ? (
          content
        ) : (
          <span className="preview-empty-hint">Write master content in the editor to preview canonical text.</span>
        )}
      </div>

      {media.length > 0 && (
        <div className="master-media-grid">
          {media.map((m, idx) => (
            <div key={m.id} className="master-media-item">
              {m.type.startsWith("image") ? (
                <img src={mediaPathToUrl(m.path)} alt={m.filename} className="master-thumb" />
              ) : (
                <div className="master-video-thumb">▶ {m.filename}</div>
              )}
              <span className="master-media-caption">
                {idx + 1}. {m.filename}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
