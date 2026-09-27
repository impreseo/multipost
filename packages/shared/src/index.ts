import { z } from "zod";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export const PostStatusSchema = z.enum([
  "draft",
  "ready",
  "scheduled",
  "publishing",
  "published",
  "failed",
]);
export type PostStatus = z.infer<typeof PostStatusSchema>;

export const JobStatusSchema = z.enum([
  "draft",
  "ready",
  "queued",
  "uploading",
  "publishing",
  "published",
  "failed",
  "retrying",
  "cancelled",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const PlatformSchema = z.enum(["linkedin", "instagram", "whatsapp"]);
export type Platform = z.infer<typeof PlatformSchema>;

export const PlatformAccountStatusSchema = z.enum([
  "connected",
  "disconnected",
  "error",
  "needs_reconnect",
]);
export type PlatformAccountStatus = z.infer<typeof PlatformAccountStatusSchema>;

export const AutomationEngineStateSchema = z.enum([
  "ready",
  "running",
  "paused",
  "error",
  "offline",
]);
export type AutomationEngineState = z.infer<typeof AutomationEngineStateSchema>;

export const VariantStatusSchema = z.enum([
  "draft",
  "prepared",
  "approved",
]);
export type VariantStatus = z.infer<typeof VariantStatusSchema>;

export const IntegrationModeSchema = z.enum([
  "real",
  "simulated",
  "unavailable",
]);
export type IntegrationMode = z.infer<typeof IntegrationModeSchema>;

export const MediaCategorySchema = z.enum([
  "brand",
  "events",
  "social",
  "projects",
  "general",
]);
export type MediaCategory = z.infer<typeof MediaCategorySchema>;

export const CreatePostInputSchema = z.object({
  title: z.string().min(1).max(500),
  masterContent: z.string().default(""),
});
export type CreatePostInput = z.infer<typeof CreatePostInputSchema>;

export const UpdatePostInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  masterContent: z.string().optional(),
  status: PostStatusSchema.optional(),
});
export type UpdatePostInput = z.infer<typeof UpdatePostInputSchema>;

export const SchedulePublishInputSchema = z.object({
  postId: z.string().uuid(),
  platformAccountIds: z.array(z.string().uuid()).min(1),
  mode: z.enum(["now", "schedule"]),
  scheduledAt: z.string().datetime().optional(),
  timezone: z.string().default(DEFAULT_TIMEZONE),
});
export type SchedulePublishInput = z.infer<typeof SchedulePublishInputSchema>;

export interface PostRecord {
  id: string;
  title: string;
  masterContent: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PostVariantRecord {
  id: string;
  postId: string;
  platform: Platform;
  platformAccountId: string | null;
  content: string;
  status: VariantStatus;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAccountRecord {
  id: string;
  platform: Platform;
  accountName: string;
  accountId: string | null;
  authReference: string | null;
  connectedAt: string | null;
  lastVerifiedAt: string | null;
  status: PlatformAccountStatus;
}

export interface PublishingJobRecord {
  id: string;
  postId: string;
  platformAccountId: string;
  variantId: string | null;
  platformContent: string;
  status: JobStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  publishedAt: string | null;
  attemptCount: number;
  error: string | null;
  externalPostId: string | null;
  simulated: number;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaRecord {
  id: string;
  filename: string;
  path: string;
  type: string;
  size: number;
  width: number | null;
  height: number | null;
  category: MediaCategory;
  createdAt: string;
  updatedAt: string;
}

export interface PostMediaLink {
  postId: string;
  mediaId: string;
  sortOrder: number;
}

export interface PlatformResultRecord {
  id: string;
  jobId: string;
  postId: string;
  platform: Platform;
  platformAccountId: string;
  status: JobStatus;
  externalPostId: string | null;
  responseMeta: string | null;
  error: string | null;
  simulated: number;
  createdAt: string;
}

export interface AutomationStatusSnapshot {
  state: AutomationEngineState;
  queueLength: number;
  activeJobs: number;
  nextScheduledAt: string | null;
  lastError: string | null;
}

export interface DashboardStats {
  drafts: number;
  ready: number;
  scheduled: number;
  publishing: number;
  published: number;
  failed: number;
}

export interface AttentionItem {
  id: string;
  type: "unapproved_variants" | "failed_job" | "disconnected_account";
  title: string;
  description: string;
  linkTo: string;
  severity: "warning" | "error" | "info";
  count?: number;
}

export interface PreparingPostItem {
  id: string;
  title: string;
  status: PostStatus;
  updatedAt: string;
  destinations: Array<{ platform: Platform; accountName: string }>;
  variantsTotal: number;
  variantsApproved: number;
}

export interface DestinationHealthItem {
  accountId: string;
  platform: Platform;
  accountName: string;
  accountType: "member" | "organization" | "professional" | "business_messaging";
  status: PlatformAccountStatus;
  mode: IntegrationMode;
  lastVerifiedAt: string | null;
  capabilities: string[];
  statusMessage?: string;
}

export interface SearchResultItem {
  id: string;
  type: "post" | "variant" | "media" | "job";
  title: string;
  subtitle: string;
  linkTo: string;
  badge?: string;
}

export interface ActivityItem {
  id: string;
  postTitle: string;
  platform: Platform;
  accountName: string;
  status: JobStatus;
  timestamp: string;
  simulated: boolean;
}

export interface UpcomingItem {
  postId: string;
  postTitle: string;
  scheduledAt: string;
  platforms: Platform[];
}

export interface OverviewData {
  attention: AttentionItem[];
  preparing: PreparingPostItem[];
  upcoming: UpcomingItem[];
  destinations: DestinationHealthItem[];
  activity: ActivityItem[];
  stats: DashboardStats;
  automation: AutomationStatusSnapshot;
}

export type PlatformErrorCode =
  | "AUTH_ERROR"
  | "PERMISSION_ERROR"
  | "VALIDATION_ERROR"
  | "MEDIA_ERROR"
  | "MEDIA_HOSTING_REQUIRED"
  | "CONFIGURATION_REQUIRED"
  | "NETWORK_ERROR"
  | "API_ERROR"
  | "RATE_LIMIT_ERROR"
  | "TIMEOUT_ERROR"
  | "UNKNOWN_ERROR";

export const PLATFORM_LABELS: Record<Platform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
};

export function jobStatusLabel(status: JobStatus, platform?: Platform): string {
  if (platform === "whatsapp") {
    switch (status) {
      case "published":
        return "Sent";
      case "publishing":
        return "Sending";
      case "queued":
        return "Queued";
      case "failed":
        return "Failed";
      case "retrying":
        return "Retrying";
      case "cancelled":
        return "Cancelled";
      default:
        return "Queued";
    }
  }
  const labels: Record<JobStatus, string> = {
    draft: "Draft",
    ready: "Ready",
    queued: "Queued",
    uploading: "Uploading",
    publishing: "Publishing",
    published: "Published",
    failed: "Failed",
    retrying: "Retrying",
    cancelled: "Cancelled",
  };
  return labels[status];
}

export function postStatusLabel(status: PostStatus): string {
  const labels: Record<PostStatus, string> = {
    draft: "Draft",
    ready: "Ready",
    scheduled: "Scheduled",
    publishing: "Publishing",
    published: "Published",
    failed: "Failed",
  };
  return labels[status];
}
