import type {
  ActivityItem,
  AttentionItem,
  AutomationStatusSnapshot,
  CreatePostInput,
  DashboardStats,
  DestinationHealthItem,
  JobStatus,
  MediaCategory,
  MediaRecord,
  OverviewData,
  Platform,
  PlatformAccountRecord,
  PlatformResultRecord,
  PostRecord,
  PostStatus,
  PostVariantRecord,
  PreparingPostItem,
  PublishingJobRecord,
  SchedulePublishInput,
  SearchResultItem,
  UpcomingItem,
  UpdatePostInput,
  VariantStatus,
} from "@welz/shared";
import { DEFAULT_TIMEZONE } from "@welz/shared";
import type { WelzDatabase } from "./db.js";
import { newId, nowIso } from "./db.js";

function mapPost(row: Record<string, unknown>): PostRecord {
  return {
    id: row.id as string,
    title: row.title as string,
    masterContent: row.master_content as string,
    status: row.status as PostStatus,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapVariant(row: Record<string, unknown>): PostVariantRecord {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    platform: row.platform as Platform,
    platformAccountId: (row.platform_account_id as string) ?? null,
    content: row.content as string,
    status: row.status as VariantStatus,
    approvedAt: (row.approved_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapAccount(row: Record<string, unknown>): PlatformAccountRecord {
  return {
    id: row.id as string,
    platform: row.platform as Platform,
    accountName: row.account_name as string,
    accountId: (row.account_id as string) ?? null,
    authReference: (row.auth_reference as string) ?? null,
    connectedAt: (row.connected_at as string) ?? null,
    lastVerifiedAt: (row.last_verified_at as string) ?? null,
    status: row.status as PlatformAccountRecord["status"],
  };
}

function mapJob(row: Record<string, unknown>): PublishingJobRecord {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    platformAccountId: row.platform_account_id as string,
    variantId: (row.variant_id as string) ?? null,
    platformContent: row.platform_content as string,
    status: row.status as JobStatus,
    scheduledAt: (row.scheduled_at as string) ?? null,
    startedAt: (row.started_at as string) ?? null,
    publishedAt: (row.published_at as string) ?? null,
    attemptCount: row.attempt_count as number,
    error: (row.error as string) ?? null,
    externalPostId: (row.external_post_id as string) ?? null,
    simulated: row.simulated as number,
    idempotencyKey: row.idempotency_key as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapMedia(row: Record<string, unknown>): MediaRecord {
  return {
    id: row.id as string,
    filename: row.filename as string,
    path: row.path as string,
    type: row.type as string,
    size: row.size as number,
    width: (row.width as number) ?? null,
    height: (row.height as number) ?? null,
    category: row.category as MediaCategory,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class WelzRepository {
  constructor(private readonly db: WelzDatabase) {}

  getSetting(key: string): string | null {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(key, value, nowIso());
  }

  ensureDefaultPlatformAccounts(): void {
    const count = this.db
      .prepare("SELECT COUNT(*) as c FROM platform_accounts")
      .get() as { c: number };
    if (count.c > 0) return;
    const defaults: Array<{ platform: Platform; name: string }> = [
      { platform: "linkedin", name: "WELZ" },
      { platform: "linkedin", name: "Personal" },
      { platform: "instagram", name: "WELZ" },
      { platform: "whatsapp", name: "WELZ Channel" },
    ];
    const insert = this.db.prepare(
      `INSERT INTO platform_accounts (id, platform, account_name, status)
       VALUES (?, ?, ?, 'disconnected')`
    );
    for (const d of defaults) {
      insert.run(newId(), d.platform, d.name);
    }
  }

  listPlatformAccounts(): PlatformAccountRecord[] {
    return this.db
      .prepare("SELECT * FROM platform_accounts ORDER BY platform, account_name")
      .all()
      .map((r) => mapAccount(r as Record<string, unknown>));
  }

  getPlatformAccount(id: string): PlatformAccountRecord | null {
    const row = this.db
      .prepare("SELECT * FROM platform_accounts WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapAccount(row) : null;
  }

  updatePlatformAccountStatus(
    id: string,
    status: PlatformAccountRecord["status"],
    authReference?: string | null
  ): void {
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE platform_accounts SET status = ?, auth_reference = COALESCE(?, auth_reference),
         connected_at = CASE WHEN ? = 'connected' THEN ? ELSE connected_at END,
         last_verified_at = ?
         WHERE id = ?`
      )
      .run(status, authReference ?? null, status, ts, ts, id);
  }

  upsertPlatformAccount(account: {
    id?: string;
    platform: Platform;
    accountName: string;
    accountId?: string | null;
    authReference?: string | null;
    status: PlatformAccountRecord["status"];
  }): PlatformAccountRecord {
    const existing = account.id
      ? this.getPlatformAccount(account.id)
      : (this.db
          .prepare(
            "SELECT * FROM platform_accounts WHERE platform = ? AND (account_id = ? OR account_name = ?)"
          )
          .get(account.platform, account.accountId ?? "", account.accountName) as
          | Record<string, unknown>
          | undefined);

    const ts = nowIso();
    if (existing) {
      const id = String(existing.id);
      this.db
        .prepare(
          `UPDATE platform_accounts SET account_name = ?, account_id = COALESCE(?, account_id),
           auth_reference = COALESCE(?, auth_reference), status = ?,
           connected_at = CASE WHEN ? = 'connected' THEN ? ELSE connected_at END,
           last_verified_at = ? WHERE id = ?`
        )
        .run(
          account.accountName,
          account.accountId ?? null,
          account.authReference ?? null,
          account.status,
          account.status,
          ts,
          ts,
          id
        );
      return this.getPlatformAccount(id)!;
    }

    const newAccId = account.id || newId();
    this.db
      .prepare(
        `INSERT INTO platform_accounts (id, platform, account_name, account_id, auth_reference, connected_at, last_verified_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        newAccId,
        account.platform,
        account.accountName,
        account.accountId ?? null,
        account.authReference ?? null,
        account.status === "connected" ? ts : null,
        ts,
        account.status
      );
    return this.getPlatformAccount(newAccId)!;
  }

  createPost(input: CreatePostInput): PostRecord {
    const id = newId();
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT INTO posts (id, title, master_content, status, created_at, updated_at)
         VALUES (?, ?, ?, 'draft', ?, ?)`
      )
      .run(id, input.title, input.masterContent, ts, ts);
    return this.getPost(id)!;
  }

  getPost(id: string): PostRecord | null {
    const row = this.db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? mapPost(row) : null;
  }

  updatePost(input: UpdatePostInput): PostRecord {
    const existing = this.getPost(input.id);
    if (!existing) throw new Error("Post not found");
    const title = input.title ?? existing.title;
    const masterContent = input.masterContent ?? existing.masterContent;
    const status = input.status ?? existing.status;
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE posts SET title = ?, master_content = ?, status = ?, updated_at = ? WHERE id = ?`
      )
      .run(title, masterContent, status, ts, input.id);
    return this.getPost(input.id)!;
  }

  deletePost(id: string): void {
    this.db.prepare("DELETE FROM posts WHERE id = ?").run(id);
  }

  duplicatePost(postId: string): PostRecord {
    const post = this.getPost(postId);
    if (!post) throw new Error("Post not found");
    const newId_ = newId();
    const ts = nowIso();

    this.db
      .prepare(
        `INSERT INTO posts (id, title, master_content, status, created_at, updated_at)
         VALUES (?, ?, ?, 'draft', ?, ?)`
      )
      .run(newId_, `${post.title} (Copy)`, post.masterContent, ts, ts);

    const destinations = this.getPostDestinations(postId);
    const insDest = this.db.prepare(
      "INSERT INTO post_destinations (post_id, platform_account_id) VALUES (?, ?)"
    );
    for (const d of destinations) {
      insDest.run(newId_, d.id);
    }

    const media = this.getPostMedia(postId);
    const insMedia = this.db.prepare(
      "INSERT INTO post_media (post_id, media_id, sort_order) VALUES (?, ?, ?)"
    );
    media.forEach((m, idx) => {
      insMedia.run(newId_, m.id, idx);
    });

    const variants = this.listVariants(postId);
    const insVar = this.db.prepare(
      `INSERT INTO post_variants (id, post_id, platform, platform_account_id, content, status, approved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', NULL, ?, ?)`
    );
    for (const v of variants) {
      insVar.run(newId(), newId_, v.platform, v.platformAccountId, v.content, ts, ts);
    }

    return this.getPost(newId_)!;
  }

  reusePost(postId: string): PostRecord {
    const post = this.getPost(postId);
    if (!post) throw new Error("Post not found");
    const newId_ = newId();
    const ts = nowIso();

    this.db
      .prepare(
        `INSERT INTO posts (id, title, master_content, status, created_at, updated_at)
         VALUES (?, ?, ?, 'draft', ?, ?)`
      )
      .run(newId_, `${post.title} (Reused)`, post.masterContent, ts, ts);

    const destinations = this.getPostDestinations(postId);
    const insDest = this.db.prepare(
      "INSERT INTO post_destinations (post_id, platform_account_id) VALUES (?, ?)"
    );
    for (const d of destinations) {
      insDest.run(newId_, d.id);
    }

    const media = this.getPostMedia(postId);
    const insMedia = this.db.prepare(
      "INSERT INTO post_media (post_id, media_id, sort_order) VALUES (?, ?, ?)"
    );
    media.forEach((m, idx) => {
      insMedia.run(newId_, m.id, idx);
    });

    const variants = this.listVariants(postId);
    const insVar = this.db.prepare(
      `INSERT INTO post_variants (id, post_id, platform, platform_account_id, content, status, approved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', NULL, ?, ?)`
    );
    for (const v of variants) {
      insVar.run(newId(), newId_, v.platform, v.platformAccountId, v.content, ts, ts);
    }

    return this.getPost(newId_)!;
  }

  getLatestDraft(): PostRecord | null {
    const row = this.db
      .prepare("SELECT * FROM posts WHERE status = 'draft' ORDER BY updated_at DESC LIMIT 1")
      .get() as Record<string, unknown> | undefined;
    return row ? mapPost(row) : null;
  }

  listPosts(statusFilter?: PostStatus): PostRecord[] {
    if (statusFilter) {
      return this.db
        .prepare("SELECT * FROM posts WHERE status = ? ORDER BY updated_at DESC")
        .all(statusFilter)
        .map((r) => mapPost(r as Record<string, unknown>));
    }
    return this.db
      .prepare("SELECT * FROM posts ORDER BY updated_at DESC")
      .all()
      .map((r) => mapPost(r as Record<string, unknown>));
  }

  setPostDestinations(postId: string, platformAccountIds: string[]): void {
    const del = this.db.prepare("DELETE FROM post_destinations WHERE post_id = ?");
    const ins = this.db.prepare(
      "INSERT INTO post_destinations (post_id, platform_account_id) VALUES (?, ?)"
    );
    const tx = this.db.transaction(() => {
      del.run(postId);
      for (const accountId of platformAccountIds) {
        ins.run(postId, accountId);
      }
    });
    tx();
  }

  getPostDestinations(postId: string): PlatformAccountRecord[] {
    return this.db
      .prepare(
        `SELECT pa.* FROM platform_accounts pa
         INNER JOIN post_destinations pd ON pd.platform_account_id = pa.id
         WHERE pd.post_id = ?`
      )
      .all(postId)
      .map((r) => mapAccount(r as Record<string, unknown>));
  }

  listVariants(postId: string): PostVariantRecord[] {
    return this.db
      .prepare("SELECT * FROM post_variants WHERE post_id = ? ORDER BY platform")
      .all(postId)
      .map((r) => mapVariant(r as Record<string, unknown>));
  }

  prepareVariants(postId: string): PostVariantRecord[] {
    const post = this.getPost(postId);
    if (!post) throw new Error("Post not found");
    const destinations = this.getPostDestinations(postId);
    const upsert = this.db.prepare(
      `INSERT INTO post_variants (id, post_id, platform, platform_account_id, content, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'prepared', ?, ?)
       ON CONFLICT(post_id, platform) DO UPDATE SET
         content = CASE WHEN post_variants.status = 'approved' THEN post_variants.content ELSE excluded.content END,
         platform_account_id = excluded.platform_account_id,
         status = CASE WHEN post_variants.status = 'approved' THEN post_variants.status ELSE 'prepared' END,
         updated_at = excluded.updated_at`
    );
    const ts = nowIso();
    const tx = this.db.transaction(() => {
      for (const dest of destinations) {
        const content = this.defaultVariantContent(post.masterContent, dest.platform);
        upsert.run(newId(), postId, dest.platform, dest.id, content, ts, ts);
      }
      this.updatePost({ id: postId, status: "ready" });
    });
    tx();
    return this.listVariants(postId);
  }

  private defaultVariantContent(master: string, platform: Platform): string {
    if (platform === "instagram") {
      return master.length > 280 ? `${master.slice(0, 277)}…` : master;
    }
    if (platform === "whatsapp") {
      const firstParagraph = master.split("\n\n")[0] ?? master;
      return firstParagraph.length > 400 ? `${firstParagraph.slice(0, 397)}…` : firstParagraph;
    }
    return master;
  }

  updateVariant(id: string, content: string): PostVariantRecord {
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE post_variants SET content = ?, status = 'prepared', approved_at = NULL, updated_at = ? WHERE id = ?`
      )
      .run(content, ts, id);
    const row = this.db.prepare("SELECT * FROM post_variants WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new Error("Variant not found");
    return mapVariant(row);
  }

  approveVariant(id: string): PostVariantRecord {
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE post_variants SET status = 'approved', approved_at = ?, updated_at = ? WHERE id = ?`
      )
      .run(ts, ts, id);
    const row = this.db.prepare("SELECT * FROM post_variants WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new Error("Variant not found");
    return mapVariant(row);
  }

  approveAllVariants(postId: string): void {
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE post_variants SET status = 'approved', approved_at = ?, updated_at = ? WHERE post_id = ?`
      )
      .run(ts, ts, postId);
  }

  resetVariantToPrepared(postId: string, platform: Platform): PostVariantRecord {
    const post = this.getPost(postId);
    if (!post) throw new Error("Post not found");
    const content = this.defaultVariantContent(post.masterContent, platform);
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE post_variants SET content = ?, status = 'prepared', approved_at = NULL, updated_at = ?
         WHERE post_id = ? AND platform = ?`
      )
      .run(content, ts, postId, platform);
    const row = this.db
      .prepare("SELECT * FROM post_variants WHERE post_id = ? AND platform = ?")
      .get(postId, platform) as Record<string, unknown>;
    return mapVariant(row);
  }

  addMedia(record: Omit<MediaRecord, "createdAt" | "updatedAt">): MediaRecord {
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT INTO media (id, filename, path, type, size, width, height, category, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.id,
        record.filename,
        record.path,
        record.type,
        record.size,
        record.width,
        record.height,
        record.category,
        ts,
        ts
      );
    return this.getMedia(record.id)!;
  }

  getMedia(id: string): MediaRecord | null {
    const row = this.db.prepare("SELECT * FROM media WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? mapMedia(row) : null;
  }

  listMedia(category?: MediaCategory): MediaRecord[] {
    if (category) {
      return this.db
        .prepare("SELECT * FROM media WHERE category = ? ORDER BY created_at DESC")
        .all(category)
        .map((r) => mapMedia(r as Record<string, unknown>));
    }
    return this.db
      .prepare("SELECT * FROM media ORDER BY created_at DESC")
      .all()
      .map((r) => mapMedia(r as Record<string, unknown>));
  }

  deleteMedia(id: string): void {
    const usage = this.mediaUsageCount(id);
    if (usage > 0) {
      throw new Error(`Cannot delete media: asset is currently referenced by ${usage} post(s).`);
    }
    this.db.prepare("DELETE FROM media WHERE id = ?").run(id);
  }

  renameMedia(id: string, filename: string): MediaRecord {
    const ts = nowIso();
    this.db
      .prepare("UPDATE media SET filename = ?, updated_at = ? WHERE id = ?")
      .run(filename, ts, id);
    return this.getMedia(id)!;
  }

  setPostMedia(postId: string, mediaIds: string[]): void {
    const del = this.db.prepare("DELETE FROM post_media WHERE post_id = ?");
    const ins = this.db.prepare(
      "INSERT INTO post_media (post_id, media_id, sort_order) VALUES (?, ?, ?)"
    );
    const tx = this.db.transaction(() => {
      del.run(postId);
      mediaIds.forEach((mediaId, index) => {
        ins.run(postId, mediaId, index);
      });
    });
    tx();
  }

  getPostMedia(postId: string): MediaRecord[] {
    return this.db
      .prepare(
        `SELECT m.* FROM media m
         INNER JOIN post_media pm ON pm.media_id = m.id
         WHERE pm.post_id = ? ORDER BY pm.sort_order`
      )
      .all(postId)
      .map((r) => mapMedia(r as Record<string, unknown>));
  }

  mediaUsageCount(mediaId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as c FROM post_media WHERE media_id = ?")
      .get(mediaId) as { c: number };
    return row.c;
  }

  createPublishingJobs(input: SchedulePublishInput): PublishingJobRecord[] {
    const post = this.getPost(input.postId);
    if (!post) throw new Error("Post not found");
    const variants = this.listVariants(input.postId);
    const variantByAccount = new Map<string, PostVariantRecord>();
    for (const v of variants) {
      if (v.platformAccountId) variantByAccount.set(v.platformAccountId, v);
    }
    const scheduledAt =
      input.mode === "now" ? nowIso() : (input.scheduledAt ?? nowIso());
    const jobs: PublishingJobRecord[] = [];
    const insert = this.db.prepare(
      `INSERT INTO publishing_jobs (
        id, post_id, platform_account_id, variant_id, platform_content, status,
        scheduled_at, attempt_count, simulated, idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'queued', ?, 0, 0, ?, ?, ?)`
    );
    const ts = nowIso();
    const tx = this.db.transaction(() => {
      for (const accountId of input.platformAccountIds) {
        const account = this.getPlatformAccount(accountId);
        if (!account) continue;
        const variant =
          variantByAccount.get(accountId) ??
          variants.find((v) => v.platform === account.platform);
        if (!variant || variant.status !== "approved") {
          throw new Error(
            `Platform version for ${account.platform} must be approved before publishing`
          );
        }
        const jobId = newId();
        const idempotencyKey = `${input.postId}:${accountId}:${scheduledAt}`;
        insert.run(
          jobId,
          input.postId,
          accountId,
          variant.id,
          variant.content,
          scheduledAt,
          idempotencyKey,
          ts,
          ts
        );
        jobs.push(this.getJob(jobId)!);
      }
      const postStatus: PostStatus =
        input.mode === "now" ? "publishing" : "scheduled";
      this.updatePost({ id: input.postId, status: postStatus });
      if (input.mode === "schedule") {
        this.db
          .prepare(
            `INSERT INTO schedules (id, post_id, scheduled_at, timezone, created_at)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(newId(), input.postId, scheduledAt, input.timezone, ts);
      }
    });
    tx();
    return jobs;
  }

  getJob(id: string): PublishingJobRecord | null {
    const row = this.db.prepare("SELECT * FROM publishing_jobs WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? mapJob(row) : null;
  }

  listJobs(filters?: { status?: JobStatus[]; postId?: string }): PublishingJobRecord[] {
    let sql = "SELECT * FROM publishing_jobs WHERE 1=1";
    const params: unknown[] = [];
    if (filters?.postId) {
      sql += " AND post_id = ?";
      params.push(filters.postId);
    }
    if (filters?.status?.length) {
      sql += ` AND status IN (${filters.status.map(() => "?").join(",")})`;
      params.push(...filters.status);
    }
    sql += " ORDER BY COALESCE(scheduled_at, created_at) ASC";
    return this.db
      .prepare(sql)
      .all(...params)
      .map((r) => mapJob(r as Record<string, unknown>));
  }

  updateJobStatus(
    id: string,
    status: JobStatus,
    fields?: Partial<{
      error: string | null;
      externalPostId: string | null;
      startedAt: string | null;
      publishedAt: string | null;
      attemptCount: number;
      simulated: number;
    }>
  ): PublishingJobRecord {
    const job = this.getJob(id);
    if (!job) throw new Error("Job not found");
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE publishing_jobs SET status = ?, error = ?, external_post_id = ?,
         started_at = ?, published_at = ?, attempt_count = ?, simulated = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        status,
        fields?.error !== undefined ? fields.error : job.error,
        fields?.externalPostId !== undefined ? fields.externalPostId : job.externalPostId,
        fields?.startedAt !== undefined ? fields.startedAt : job.startedAt,
        fields?.publishedAt !== undefined ? fields.publishedAt : job.publishedAt,
        fields?.attemptCount !== undefined ? fields.attemptCount : job.attemptCount,
        fields?.simulated !== undefined ? fields.simulated : job.simulated,
        ts,
        id
      );
    return this.getJob(id)!;
  }

  recordPlatformResult(
    job: PublishingJobRecord,
    platform: Platform,
    status: JobStatus,
    meta: {
      externalPostId?: string | null;
      responseMeta?: string | null;
      error?: string | null;
      simulated?: boolean;
    }
  ): PlatformResultRecord {
    const id = newId();
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT INTO platform_results (
          id, job_id, post_id, platform, platform_account_id, status,
          external_post_id, response_meta, error, simulated, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        job.id,
        job.postId,
        platform,
        job.platformAccountId,
        status,
        meta.externalPostId ?? null,
        meta.responseMeta ?? null,
        meta.error ?? null,
        meta.simulated ? 1 : 0,
        ts
      );
    const row = this.db.prepare("SELECT * FROM platform_results WHERE id = ?").get(id) as
      Record<string, unknown>;
    return {
      id: row.id as string,
      jobId: row.job_id as string,
      postId: row.post_id as string,
      platform: row.platform as Platform,
      platformAccountId: row.platform_account_id as string,
      status: row.status as JobStatus,
      externalPostId: (row.external_post_id as string) ?? null,
      responseMeta: (row.response_meta as string) ?? null,
      error: (row.error as string) ?? null,
      simulated: row.simulated as number,
      createdAt: row.created_at as string,
    };
  }

  listPlatformResults(limit = 100): PlatformResultRecord[] {
    return this.db
      .prepare("SELECT * FROM platform_results ORDER BY created_at DESC LIMIT ?")
      .all(limit)
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: r.id as string,
          jobId: r.job_id as string,
          postId: r.post_id as string,
          platform: r.platform as Platform,
          platformAccountId: r.platform_account_id as string,
          status: r.status as JobStatus,
          externalPostId: (r.external_post_id as string) ?? null,
          responseMeta: (r.response_meta as string) ?? null,
          error: (r.error as string) ?? null,
          simulated: r.simulated as number,
          createdAt: r.created_at as string,
        };
      });
  }

  getDueQueuedJobs(now: string): PublishingJobRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM publishing_jobs
         WHERE status IN ('queued', 'retrying')
         AND (scheduled_at IS NULL OR scheduled_at <= ?)
         ORDER BY scheduled_at ASC LIMIT 10`
      )
      .all(now)
      .map((r) => mapJob(r as Record<string, unknown>));
  }

  recoverInterruptedJobs(): void {
    const ts = nowIso();
    // 1. Uploading jobs were interrupted prior to dispatch: safe to re-queue
    this.db
      .prepare(
        `UPDATE publishing_jobs SET status = 'queued', updated_at = ?
         WHERE status = 'uploading'`
      )
      .run(ts);

    // 2. In-flight publishing jobs that already received remote IDs: mark completed
    this.db
      .prepare(
        `UPDATE publishing_jobs SET status = 'published', updated_at = ?
         WHERE status = 'publishing' AND external_post_id IS NOT NULL`
      )
      .run(ts);

    // 3. In-flight publishing jobs without remote IDs: mark failed with clear actionable message
    this.db
      .prepare(
        `UPDATE publishing_jobs
         SET status = 'failed',
             error = '[TIMEOUT_ERROR] Dispatch interrupted by application termination. Verify destination before retrying.',
             updated_at = ?
         WHERE status = 'publishing' AND external_post_id IS NULL`
      )
      .run(ts);
  }

  syncPostStatusFromJobs(postId: string): void {
    const jobs = this.listJobs({ postId });
    if (jobs.length === 0) return;
    const hasFailed = jobs.some((j) => j.status === "failed");
    const allPublished = jobs.every((j) => j.status === "published" || j.status === "cancelled");
    const anyActive = jobs.some((j) =>
      ["queued", "uploading", "publishing", "retrying"].includes(j.status)
    );
    let status: PostStatus = "ready";
    if (hasFailed) status = "failed";
    else if (allPublished) status = "published";
    else if (anyActive) status = "publishing";
    else if (jobs.some((j) => j.status === "queued")) status = "scheduled";
    this.updatePost({ id: postId, status });
  }

  getDashboardStats(): DashboardStats {
    const counts = this.db
      .prepare(
        `SELECT status, COUNT(*) as c FROM posts GROUP BY status`
      )
      .all() as Array<{ status: PostStatus; c: number }>;
    const map = new Map(counts.map((c) => [c.status, c.c]));
    return {
      drafts: map.get("draft") ?? 0,
      ready: map.get("ready") ?? 0,
      scheduled: map.get("scheduled") ?? 0,
      publishing: map.get("publishing") ?? 0,
      published: map.get("published") ?? 0,
      failed: map.get("failed") ?? 0,
    };
  }

  getRecentActivity(limit = 8): ActivityItem[] {
    const rows = this.db
      .prepare(
        `SELECT j.id, p.title as post_title, pa.platform, pa.account_name, j.status, j.updated_at, j.simulated
         FROM publishing_jobs j
         INNER JOIN posts p ON p.id = j.post_id
         INNER JOIN platform_accounts pa ON pa.id = j.platform_account_id
         ORDER BY j.updated_at DESC LIMIT ?`
      )
      .all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as string,
      postTitle: r.post_title as string,
      platform: r.platform as Platform,
      accountName: r.account_name as string,
      status: r.status as JobStatus,
      timestamp: r.updated_at as string,
      simulated: (r.simulated as number) === 1,
    }));
  }

  getUpcoming(limit = 5): UpcomingItem[] {
    const rows = this.db
      .prepare(
        `SELECT s.post_id, s.scheduled_at, p.title as post_title
         FROM schedules s
         INNER JOIN posts p ON p.id = s.post_id
         WHERE s.scheduled_at >= datetime('now')
         ORDER BY s.scheduled_at ASC LIMIT ?`
      )
      .all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => {
      const postId = r.post_id as string;
      const platforms = this.getPostDestinations(postId).map((d) => d.platform);
      return {
        postId,
        postTitle: r.post_title as string,
        scheduledAt: r.scheduled_at as string,
        platforms: [...new Set(platforms)],
      };
    });
  }

  log(scope: string, level: string, message: string, meta?: Record<string, unknown>): void {
    this.db
      .prepare(
        `INSERT INTO logs (id, level, scope, message, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(newId(), level, scope, message, meta ? JSON.stringify(meta) : null, nowIso());
  }

  listScheduledInRange(startIso: string, endIso: string): Array<{
    scheduleId: string;
    postId: string;
    postTitle: string;
    scheduledAt: string;
    timezone: string;
  }> {
    return this.db
      .prepare(
        `SELECT s.id as schedule_id, s.post_id, s.scheduled_at, s.timezone, p.title as post_title
         FROM schedules s INNER JOIN posts p ON p.id = s.post_id
         WHERE s.scheduled_at >= ? AND s.scheduled_at <= ?
         ORDER BY s.scheduled_at`
      )
      .all(startIso, endIso)
      .map((r) => {
        const row = r as Record<string, unknown>;
        return {
          scheduleId: row.schedule_id as string,
          postId: row.post_id as string,
          postTitle: row.post_title as string,
          scheduledAt: row.scheduled_at as string,
          timezone: (row.timezone as string) ?? DEFAULT_TIMEZONE,
        };
      });
  }

  getAttentionItems(): AttentionItem[] {
    const items: AttentionItem[] = [];

    // 1. Unapproved variants for posts that have destinations selected
    const unapprovedPosts = this.db
      .prepare(
        `SELECT p.id, p.title, COUNT(pv.id) as unapproved_count
         FROM posts p
         INNER JOIN post_destinations pd ON pd.post_id = p.id
         LEFT JOIN post_variants pv ON pv.post_id = p.id AND pv.status != 'approved'
         WHERE p.status IN ('draft', 'ready')
         GROUP BY p.id
         HAVING unapproved_count > 0`
      )
      .all() as Array<{ id: string; title: string; unapproved_count: number }>;

    for (const post of unapprovedPosts) {
      items.push({
        id: `att-unapproved-${post.id}`,
        type: "unapproved_variants",
        title: `Approval Required: "${post.title}"`,
        description: `${post.unapproved_count} platform variant${post.unapproved_count > 1 ? "s" : ""} pending review and approval before scheduling.`,
        linkTo: `/content/${post.id}`,
        severity: "warning",
        count: post.unapproved_count,
      });
    }

    // 2. Failed jobs
    const failedJobs = this.db
      .prepare(
        `SELECT j.id, p.title as post_title, pa.platform, pa.account_name, j.error
         FROM publishing_jobs j
         INNER JOIN posts p ON p.id = j.post_id
         INNER JOIN platform_accounts pa ON pa.id = j.platform_account_id
         WHERE j.status = 'failed'
         ORDER BY j.updated_at DESC LIMIT 5`
      )
      .all() as Array<{ id: string; post_title: string; platform: Platform; account_name: string; error: string | null }>;

    for (const job of failedJobs) {
      items.push({
        id: `att-failed-${job.id}`,
        type: "failed_job",
        title: `Publishing Failed: "${job.post_title}"`,
        description: `${job.account_name} (${job.platform}): ${job.error ?? "Encountered error during dispatch."}`,
        linkTo: `/publishing`,
        severity: "error",
      });
    }

    // 3. Disconnected platform accounts
    const disconnected = this.listPlatformAccounts().filter((a) => a.status === "disconnected");
    if (disconnected.length > 0) {
      items.push({
        id: "att-disconnected-accounts",
        type: "disconnected_account",
        title: `${disconnected.length} Destination${disconnected.length > 1 ? "s" : ""} Unlinked`,
        description: `API authorization required for: ${disconnected.map((a) => a.accountName).join(", ")}.`,
        linkTo: "/platforms",
        severity: "info",
        count: disconnected.length,
      });
    }

    return items;
  }

  getPreparingPosts(limit = 6): PreparingPostItem[] {
    const posts = this.db
      .prepare(
        `SELECT id, title, status, updated_at
         FROM posts
         WHERE status IN ('draft', 'ready')
         ORDER BY updated_at DESC LIMIT ?`
      )
      .all(limit) as Array<{ id: string; title: string; status: PostStatus; updated_at: string }>;

    return posts.map((p) => {
      const destinations = this.getPostDestinations(p.id).map((d) => ({
        platform: d.platform,
        accountName: d.accountName,
      }));
      const variants = this.listVariants(p.id);
      const approvedCount = variants.filter((v) => v.status === "approved").length;
      return {
        id: p.id,
        title: p.title,
        status: p.status,
        updatedAt: p.updated_at,
        destinations,
        variantsTotal: variants.length,
        variantsApproved: approvedCount,
      };
    });
  }

  getDestinationHealthList(): DestinationHealthItem[] {
    const accounts = this.listPlatformAccounts();
    return accounts.map((acc) => {
      const isOrg = acc.accountName.toLowerCase().includes("welz") || acc.accountName.toLowerCase().includes("page");
      const accountType: DestinationHealthItem["accountType"] =
        acc.platform === "whatsapp"
          ? "business_messaging"
          : acc.platform === "instagram"
          ? "professional"
          : isOrg
          ? "organization"
          : "member";

      const capabilities =
        acc.platform === "whatsapp"
          ? ["text", "media", "approved_templates"]
          : acc.platform === "instagram"
          ? ["image", "video/reels", "carousel", "caption"]
          : ["text", "image", "video", "document"];

      const isDev = this.getSetting("dev_mode") === "true";
      const mode = isDev ? "simulated" : "real";

      return {
        accountId: acc.id,
        platform: acc.platform,
        accountName: acc.accountName,
        accountType,
        status: acc.status,
        mode,
        lastVerifiedAt: acc.lastVerifiedAt,
        capabilities,
        statusMessage: isDev
          ? "SIMULATION (Sandbox test mode)"
          : acc.status === "connected"
          ? "Authenticated & verified"
          : "Credentials not configured",
      };
    });
  }

  search(rawQuery: string): SearchResultItem[] {
    const q = rawQuery.trim();
    if (!q) return [];
    const pattern = `%${q}%`;
    const results: SearchResultItem[] = [];

    // Search posts
    const posts = this.db
      .prepare(
        `SELECT id, title, master_content, status
         FROM posts
         WHERE title LIKE ? OR master_content LIKE ?
         ORDER BY updated_at DESC LIMIT 8`
      )
      .all(pattern, pattern) as Array<{ id: string; title: string; master_content: string; status: string }>;

    for (const post of posts) {
      results.push({
        id: post.id,
        type: "post",
        title: post.title,
        subtitle: post.master_content ? post.master_content.slice(0, 100) : "No content",
        linkTo: `/content/${post.id}`,
        badge: post.status.toUpperCase(),
      });
    }

    // Search media
    const media = this.db
      .prepare(
        `SELECT id, filename, category, type
         FROM media
         WHERE filename LIKE ?
         ORDER BY created_at DESC LIMIT 6`
      )
      .all(pattern) as Array<{ id: string; filename: string; category: string; type: string }>;

    for (const m of media) {
      results.push({
        id: m.id,
        type: "media",
        title: m.filename,
        subtitle: `${m.category} · ${m.type}`,
        linkTo: `/media`,
        badge: "MEDIA",
      });
    }

    // Search publishing jobs
    const jobs = this.db
      .prepare(
        `SELECT j.id, p.title as post_title, pa.platform, pa.account_name, j.status
         FROM publishing_jobs j
         INNER JOIN posts p ON p.id = j.post_id
         INNER JOIN platform_accounts pa ON pa.id = j.platform_account_id
         WHERE p.title LIKE ? OR j.platform_content LIKE ?
         ORDER BY j.created_at DESC LIMIT 5`
      )
      .all(pattern, pattern) as Array<{ id: string; post_title: string; platform: string; account_name: string; status: string }>;

    for (const j of jobs) {
      results.push({
        id: j.id,
        type: "job",
        title: `Job: ${j.post_title}`,
        subtitle: `${j.account_name} (${j.platform})`,
        linkTo: `/publishing`,
        badge: j.status.toUpperCase(),
      });
    }

    return results;
  }

  getOverviewData(engineState: AutomationStatusSnapshot["state"]): OverviewData {
    return {
      attention: this.getAttentionItems(),
      preparing: this.getPreparingPosts(),
      upcoming: this.getUpcoming(),
      destinations: this.getDestinationHealthList(),
      activity: this.getRecentActivity(),
      stats: this.getDashboardStats(),
      automation: getAutomationSnapshot(this, engineState),
    };
  }
}

export function getAutomationSnapshot(
  repo: WelzRepository,
  engineState: AutomationStatusSnapshot["state"]
): AutomationStatusSnapshot {
  const queue = repo.listJobs({ status: ["queued", "retrying"] });
  const active = repo.listJobs({ status: ["uploading", "publishing"] });
  const next = queue[0]?.scheduledAt ?? null;
  return {
    state: engineState,
    queueLength: queue.length,
    activeJobs: active.length,
    nextScheduledAt: next,
    lastError: null,
  };
}
