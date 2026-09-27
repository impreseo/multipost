import type { JobStatus, Platform, PostStatus } from "@welz/shared";
import { jobStatusLabel, postStatusLabel } from "@welz/shared";

export function PostStatusBadge({ status }: { status: PostStatus }) {
  const className = badgeClassForPost(status);
  return <span className={`badge ${className}`}>{postStatusLabel(status)}</span>;
}

export function JobStatusBadge({ status, platform }: { status: JobStatus; platform?: Platform }) {
  const className = badgeClassForJob(status);
  return <span className={`badge ${className}`}>{jobStatusLabel(status, platform)}</span>;
}

function badgeClassForPost(status: PostStatus): string {
  switch (status) {
    case "published":
      return "badge-success";
    case "failed":
      return "badge-error";
    case "scheduled":
    case "publishing":
      return "badge-info";
    case "ready":
      return "badge-warning";
    default:
      return "badge-neutral";
  }
}

function badgeClassForJob(status: JobStatus): string {
  switch (status) {
    case "published":
      return "badge-success";
    case "failed":
      return "badge-error";
    case "queued":
    case "retrying":
      return "badge-warning";
    case "uploading":
    case "publishing":
      return "badge-info";
    default:
      return "badge-neutral";
  }
}
