import type { WelzRepository } from "@welz/database";
import { nowIso } from "@welz/database";
import type { PlatformRegistry } from "@welz/platform-core";
import type { AutomationEngineState, PublishingJobRecord } from "@welz/shared";

const MAX_ATTEMPTS = 3;

export type EngineEventHandler = (payload: {
  type: "state" | "job" | "log";
  data: unknown;
}) => void;

export class AutomationEngine {
  private state: AutomationEngineState = "ready";
  private timer: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  constructor(
    private readonly repo: WelzRepository,
    private readonly platforms: PlatformRegistry,
    private readonly onEvent?: EngineEventHandler
  ) {}

  start(intervalMs = 5000): void {
    if (this.timer) return;
    this.setState("running");
    this.tick();
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  pause(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.setState("paused");
  }

  resume(): void {
    this.start();
  }

  getState(): AutomationEngineState {
    return this.state;
  }

  recoverOnStartup(): void {
    this.repo.recoverInterruptedJobs();
    this.repo.log("automation", "info", "Recovered interrupted jobs on startup");
  }

  async retryJob(jobId: string): Promise<void> {
    const job = this.repo.getJob(jobId);
    if (!job || job.status !== "failed") return;
    this.repo.updateJobStatus(jobId, "retrying", {
      error: null,
      attemptCount: job.attemptCount,
    });
    await this.processJob(this.repo.getJob(jobId)!);
  }

  private setState(state: AutomationEngineState): void {
    this.state = state;
    this.onEvent?.({ type: "state", data: { state } });
  }

  private async tick(): Promise<void> {
    if (this.processing || this.state === "paused") return;
    this.processing = true;
    try {
      const due = this.repo.getDueQueuedJobs(nowIso());
      for (const job of due) {
        await this.processJob(job);
      }
    } catch (err) {
      this.setState("error");
      this.repo.log("automation", "error", "Engine tick failed", {
        error: String(err),
      });
    } finally {
      this.processing = false;
      if (this.state === "error" && this.timer) {
        /* stay in error until resume */
      } else if (this.timer) {
        this.setState("running");
      }
    }
  }

  private async processJob(job: PublishingJobRecord): Promise<void> {
    const account = this.repo.getPlatformAccount(job.platformAccountId);
    if (!account) {
      this.failJob(job, "Platform account not found.");
      return;
    }

    if (account.status !== "connected") {
      this.failJob(
        job,
        "Account not connected. Reconnect your account from Platforms."
      );
      return;
    }

    if (job.externalPostId && job.status === "published") {
      this.repo.log("automation", "info", "Skipping duplicate publish", {
        jobId: job.id,
      });
      return;
    }

    // Idempotency check: verify if a previous attempt already generated a remote ID
    const existingResults = this.repo.listPlatformResults(200);
    const priorSuccess = existingResults.find(
      (r) => r.jobId === job.id && r.status === "published" && !!r.externalPostId
    );
    if (priorSuccess) {
      this.repo.log("automation", "info", "Reconciled existing remote post; preventing duplicate publish", {
        jobId: job.id,
        externalPostId: priorSuccess.externalPostId,
      });
      this.repo.updateJobStatus(job.id, "published", {
        externalPostId: priorSuccess.externalPostId,
        publishedAt: priorSuccess.createdAt,
        error: null,
      });
      this.repo.syncPostStatusFromJobs(job.postId);
      this.onEvent?.({ type: "job", data: this.repo.getJob(job.id) });
      return;
    }

    const adapter = this.platforms.getAdapter(account.platform);
    const attempt = job.attemptCount + 1;
    if (attempt > MAX_ATTEMPTS) {
      this.failJob(job, "Maximum retry attempts reached.");
      return;
    }

    const startedAt = nowIso();
    this.repo.updateJobStatus(job.id, "uploading", {
      attemptCount: attempt,
      startedAt,
      error: null,
    });
    this.onEvent?.({ type: "job", data: this.repo.getJob(job.id) });

    const media = this.repo.getPostMedia(job.postId);
    const mediaPaths = media.map((m) => m.path);
    const mediaValidation = adapter.validateMedia(mediaPaths);
    if (!mediaValidation.ok) {
      this.failJob(job, `[VALIDATION_ERROR] ${mediaValidation.errors.join(" ")}`);
      return;
    }

    const textValidation = adapter.validatePost(job.platformContent);
    if (!textValidation.ok) {
      this.failJob(job, `[VALIDATION_ERROR] ${textValidation.errors.join(" ")}`);
      return;
    }

    if (media.length > 0) {
      const uploads = await adapter.uploadMedia(
        account,
        media.map((m) => ({ localPath: m.path, mimeType: m.type }))
      );
      if (uploads.some((u) => !u.ok)) {
        const firstErr = uploads.find((u) => !u.ok);
        const uploadErrMsg = firstErr?.errorCode
          ? `[${firstErr.errorCode}] ${firstErr.error}`
          : firstErr?.error ?? "Media upload failed.";
        this.failJob(job, uploadErrMsg);
        return;
      }
    }

    this.repo.updateJobStatus(job.id, "publishing");
    this.onEvent?.({ type: "job", data: this.repo.getJob(job.id) });

    const result = await adapter.publishPost(account, {
      account,
      text: job.platformContent,
      mediaPaths,
      idempotencyKey: job.idempotencyKey,
    });

    if (!result.ok) {
      const formattedError = result.errorCode && !result.error?.startsWith("[")
        ? `[${result.errorCode}] ${result.error || "Publish failed"}`
        : result.error ?? "Publish failed.";

      const isNonRetryable =
        result.errorCode === "AUTH_ERROR" ||
        result.errorCode === "PERMISSION_ERROR" ||
        result.errorCode === "VALIDATION_ERROR" ||
        result.errorCode === "RATE_LIMIT_ERROR";

      const retryable = attempt < MAX_ATTEMPTS && result.mode !== "unavailable" && !isNonRetryable;

      if (retryable) {
        this.repo.updateJobStatus(job.id, "retrying", {
          error: formattedError,
          attemptCount: attempt,
        });
      } else {
        this.failJob(job, formattedError);
      }
      this.repo.recordPlatformResult(job, account.platform, "failed", {
        error: formattedError,
        simulated: result.mode === "simulated",
      });
      this.repo.syncPostStatusFromJobs(job.postId);
      return;
    }

    const publishedAt = nowIso();
    this.repo.updateJobStatus(job.id, "published", {
      externalPostId: result.externalPostId ?? null,
      publishedAt,
      error: null,
      simulated: result.mode === "simulated" ? 1 : 0,
      attemptCount: attempt,
    });
    this.repo.recordPlatformResult(job, account.platform, "published", {
      externalPostId: result.externalPostId,
      responseMeta: result.responseMeta ? JSON.stringify(result.responseMeta) : null,
      simulated: result.mode === "simulated",
    });
    this.repo.syncPostStatusFromJobs(job.postId);
    this.onEvent?.({ type: "job", data: this.repo.getJob(job.id) });
  }

  private failJob(job: PublishingJobRecord, message: string): void {
    this.repo.updateJobStatus(job.id, "failed", { error: message });
    const account = this.repo.getPlatformAccount(job.platformAccountId);
    if (account) {
      this.repo.recordPlatformResult(job, account.platform, "failed", {
        error: message,
      });
    }
    this.repo.syncPostStatusFromJobs(job.postId);
    this.onEvent?.({ type: "job", data: this.repo.getJob(job.id) });
  }
}

export { MAX_ATTEMPTS };
