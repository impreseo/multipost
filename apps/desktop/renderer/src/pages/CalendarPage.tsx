import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDateTime, getWelz, useAppStore } from "../store";

type CalEvent = {
  scheduleId: string;
  postId: string;
  postTitle: string;
  scheduledAt: string;
  timezone: string;
};

export function CalendarPage() {
  const timezone = useAppStore((s) => s.timezone);
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);

  const range = useMemo(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
    if (view === "week") {
      const day = cursor.getDay();
      const weekStart = new Date(cursor);
      weekStart.setDate(cursor.getDate() - day);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59);
      return { start: weekStart, end: weekEnd };
    }
    return { start, end };
  }, [cursor, view]);

  useEffect(() => {
    void getWelz()
      .calendar.range(range.start.toISOString(), range.end.toISOString())
      .then(setEvents);
  }, [range.start, range.end]);

  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Calendar</h1>
        <p className="page-subtitle">Scheduled publishing across your content pipeline.</p>
      </header>

      <div className="actions-row" style={{ marginBottom: 16 }}>
        <button type="button" className="btn btn-secondary" onClick={() => setCursor(new Date())}>
          Today
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            setCursor((d) => new Date(d.getFullYear(), d.getMonth() + (view === "month" ? -1 : 0), d.getDate() - 7))
          }
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            setCursor((d) => new Date(d.getFullYear(), d.getMonth() + (view === "month" ? 1 : 0), d.getDate() + 7))
          }
        >
          Next
        </button>
        <button type="button" className={`chip${view === "month" ? " active" : ""}`} onClick={() => setView("month")}>
          Month
        </button>
        <button type="button" className={`chip${view === "week" ? " active" : ""}`} onClick={() => setView("week")}>
          Week
        </button>
      </div>

      {events.length === 0 ? (
        <div className="card empty-state">
          <h3>No scheduled content yet</h3>
          <p>Your publishing calendar is clear. Plan ahead and schedule posts across destinations.</p>
          <Link to="/" className="btn btn-primary">
            Create &amp; Schedule Post
          </Link>
        </div>
      ) : null}

      <div className="calendar-grid">
        {cells.map((cell) => {
          const dayEvents = events.filter((e) => sameDay(new Date(e.scheduledAt), cell.date));
          return (
            <div key={cell.key} className={`calendar-cell${cell.muted ? " calendar-cell-muted" : ""}`}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{cell.date.getDate()}</div>
              {dayEvents.map((e) => (
                <Link key={e.scheduleId} to={`/?id=${e.postId}`} className="calendar-event" title="Click to view and edit in publish workstation">
                  {formatDateTime(e.scheduledAt, timezone).split(",")[1]?.trim() ?? ""} · {e.postTitle}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthCells(cursor: Date): Array<{ key: string; date: Date; muted: boolean }> {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const cells: Array<{ key: string; date: Date; muted: boolean }> = [];
  const start = new Date(year, month, 1 - startDay);
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push({
      key: date.toISOString(),
      date,
      muted: date.getMonth() !== month,
    });
  }
  return cells;
}
