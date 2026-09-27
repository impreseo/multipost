import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SearchResultItem } from "@welz/shared";

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Actions";
  shortcut?: string;
  action: () => void;
}

export function CommandCenter({ isOpen, onClose }: CommandCenterProps) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const staticCommands: CommandItem[] = [
    {
      id: "cmd-new-post",
      title: "New Post — Open Composer",
      category: "Actions",
      shortcut: "Ctrl+N",
      action: () => {
        navigate("/compose");
        onClose();
      },
    },
    {
      id: "cmd-nav-overview",
      title: "Go to Overview",
      category: "Navigation",
      action: () => {
        navigate("/");
        onClose();
      },
    },
    {
      id: "cmd-nav-compose",
      title: "Go to Compose",
      category: "Navigation",
      action: () => {
        navigate("/compose");
        onClose();
      },
    },
    {
      id: "cmd-nav-content",
      title: "Go to Content Library",
      category: "Navigation",
      action: () => {
        navigate("/content");
        onClose();
      },
    },
    {
      id: "cmd-nav-media",
      title: "Go to Media Library",
      category: "Navigation",
      action: () => {
        navigate("/media");
        onClose();
      },
    },
    {
      id: "cmd-nav-calendar",
      title: "Go to Calendar",
      category: "Navigation",
      action: () => {
        navigate("/calendar");
        onClose();
      },
    },
    {
      id: "cmd-nav-publishing",
      title: "Go to Publishing Queue",
      category: "Navigation",
      action: () => {
        navigate("/publishing");
        onClose();
      },
    },
    {
      id: "cmd-nav-history",
      title: "Go to Audit History",
      category: "Navigation",
      action: () => {
        navigate("/history");
        onClose();
      },
    },
    {
      id: "cmd-nav-platforms",
      title: "Go to Platform Connections",
      category: "Navigation",
      action: () => {
        navigate("/platforms");
        onClose();
      },
    },
    {
      id: "cmd-nav-settings",
      title: "Go to Settings",
      category: "Navigation",
      action: () => {
        navigate("/settings");
        onClose();
      },
    },
  ];

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Query search backend
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void window.welz?.search?.query(query).then((res) => {
        setSearchResults(res || []);
        setSelectedIndex(0);
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  // Filter commands
  const filteredCommands = staticCommands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase())
  );

  // Combine items for keyboard navigation
  const allItems = [
    ...filteredCommands.map((c) => ({
      type: "command" as const,
      id: c.id,
      title: c.title,
      subtitle: c.category,
      shortcut: c.shortcut,
      onSelect: c.action,
    })),
    ...searchResults.map((r) => ({
      type: "result" as const,
      id: r.id,
      title: r.title,
      subtitle: r.subtitle,
      badge: r.badge,
      onSelect: () => {
        navigate(r.linkTo);
        onClose();
      },
    })),
  ];

  // Key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < allItems.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : allItems.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].onSelect();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cmd-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="cmd-search-bar">
          <svg className="cmd-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="Search content, commands, media, jobs... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="cmd-esc-hint">ESC</span>
        </div>

        <div className="cmd-results">
          {allItems.length === 0 ? (
            <div className="cmd-empty">No matching commands or content found for "{query}"</div>
          ) : (
            <>
              {filteredCommands.length > 0 && (
                <div className="cmd-group-label">Commands</div>
              )}
              {filteredCommands.map((cmd) => {
                const globalIndex = allItems.findIndex((i) => i.id === cmd.id);
                const isSelected = globalIndex === selectedIndex;
                return (
                  <div
                    key={cmd.id}
                    className={`cmd-item ${isSelected ? "selected" : ""}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  >
                    <span className="cmd-item-title">{cmd.title}</span>
                    {cmd.shortcut && <span className="cmd-badge-shortcut">{cmd.shortcut}</span>}
                  </div>
                );
              })}

              {searchResults.length > 0 && (
                <div className="cmd-group-label">Local Data Search Results</div>
              )}
              {searchResults.map((res) => {
                const globalIndex = allItems.findIndex((i) => i.id === res.id);
                const isSelected = globalIndex === selectedIndex;
                return (
                  <div
                    key={res.id}
                    className={`cmd-item ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      navigate(res.linkTo);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  >
                    <div className="cmd-item-content">
                      <span className="cmd-item-title">{res.title}</span>
                      <span className="cmd-item-subtitle">{res.subtitle}</span>
                    </div>
                    {res.badge && <span className="cmd-item-badge">{res.badge}</span>}
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="cmd-footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Select</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
