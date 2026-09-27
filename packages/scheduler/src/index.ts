import type { WelzRepository } from "@welz/database";
import { nowIso } from "@welz/database";

/** Ensures queued jobs with past scheduled_at are visible to the automation engine. */
export function processDueSchedules(_repo: WelzRepository): number {
  /* Jobs are created with status queued and scheduled_at; engine picks them via getDueQueuedJobs */
  return 0;
}

export function isScheduleDue(scheduledAt: string | null, now = nowIso()): boolean {
  if (!scheduledAt) return true;
  return scheduledAt <= now;
}
