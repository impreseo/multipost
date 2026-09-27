import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "../src/db.js";
import { WelzRepository } from "../src/repository.js";

describe("WelzRepository", () => {
  let dbPath: string;
  let repo: WelzRepository;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `welz-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
    const db = openDatabase(dbPath);
    repo = new WelzRepository(db);
    repo.ensureDefaultPlatformAccounts();
  });

  afterEach(() => {
    try {
      fs.unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
  });

  it("creates and updates posts", () => {
    const post = repo.createPost({ title: "Launch", masterContent: "Hello WELZ" });
    expect(post.status).toBe("draft");
    const updated = repo.updatePost({
      id: post.id,
      masterContent: "Updated",
      status: "ready",
    });
    expect(updated.masterContent).toBe("Updated");
    expect(updated.status).toBe("ready");
  });

  it("prepares variants from destinations", () => {
    const post = repo.createPost({ title: "T", masterContent: "Master text here" });
    const accounts = repo.listPlatformAccounts();
    const linkedIn = accounts.find((a) => a.platform === "linkedin");
    expect(linkedIn).toBeDefined();
    repo.setPostDestinations(post.id, [linkedIn!.id]);
    const variants = repo.prepareVariants(post.id);
    expect(variants.length).toBe(1);
    expect(variants[0].content).toContain("Master");
  });

  it("creates publishing jobs and enforces idempotency", () => {
    const post = repo.createPost({ title: "WELZ Launch", masterContent: "Canonical master content" });
    const accounts = repo.listPlatformAccounts();
    const targetAccount = accounts[0];
    repo.setPostDestinations(post.id, [targetAccount.id]);
    repo.prepareVariants(post.id);
    repo.approveAllVariants(post.id);

    const jobs = repo.createPublishingJobs({
      postId: post.id,
      platformAccountIds: [targetAccount.id],
      mode: "now",
      timezone: "Asia/Kolkata",
    });

    expect(jobs.length).toBe(1);
    expect(jobs[0].status).toBe("queued");
    expect(jobs[0].idempotencyKey).toBeDefined();

    // Verify retrieving by ID
    const retrieved = repo.getJob(jobs[0].id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.postId).toBe(post.id);

    // Verify due jobs query picks it up immediately
    const dueJobs = repo.getDueQueuedJobs(new Date(Date.now() + 1000).toISOString());
    expect(dueJobs.some((j) => j.id === jobs[0].id)).toBe(true);
  });

  it("records platform results and audits publishing history", () => {
    const post = repo.createPost({ title: "Audit Post", masterContent: "Test content" });
    const accounts = repo.listPlatformAccounts();
    const account = accounts[0];
    repo.setPostDestinations(post.id, [account.id]);
    repo.prepareVariants(post.id);
    repo.approveAllVariants(post.id);

    const jobs = repo.createPublishingJobs({
      postId: post.id,
      platformAccountIds: [account.id],
      mode: "now",
      timezone: "Asia/Kolkata",
    });
    const job = jobs[0];

    // Record published result
    repo.recordPlatformResult(job, account.platform, "published", {
      externalPostId: "ext-12345",
      responseMeta: JSON.stringify({ ok: true }),
      simulated: true,
    });

    const history = repo.listPlatformResults(10);
    expect(history.length).toBeGreaterThan(0);
    const entry = history.find((h) => h.jobId === job.id);
    expect(entry).toBeDefined();
    expect(entry?.externalPostId).toBe("ext-12345");
    expect(entry?.simulated).toBe(1);
  });

  it("handles media library additions and usage counting", () => {
    const post = repo.createPost({ title: "Media Post", masterContent: "Has media" });
    const media = repo.addMedia({
      id: "media-uuid-1",
      filename: "welz-banner.png",
      path: "/local/storage/welz-banner.png",
      type: "image/png",
      size: 102400,
      width: 1200,
      height: 630,
      category: "brand",
    });

    expect(media.filename).toBe("welz-banner.png");
    expect(repo.mediaUsageCount(media.id)).toBe(0);

    // Attach to post
    repo.setPostMedia(post.id, [media.id]);
    expect(repo.mediaUsageCount(media.id)).toBe(1);

    const attached = repo.getPostMedia(post.id);
    expect(attached.length).toBe(1);
    expect(attached[0].id).toBe(media.id);
  });

  it("protects media from deletion when in use", () => {
    const post = repo.createPost({ title: "Protected Media Post", masterContent: "Content" });
    const media = repo.addMedia({
      id: "media-protected-1",
      filename: "safe.jpg",
      path: "/safe.jpg",
      type: "image/jpeg",
      size: 50000,
      width: null,
      height: null,
      category: "general",
    });

    repo.setPostMedia(post.id, [media.id]);
    expect(repo.mediaUsageCount(media.id)).toBe(1);

    // Attempt deletion while in use -> must throw error
    expect(() => repo.deleteMedia(media.id)).toThrow("Cannot delete media: asset is currently referenced");

    // Remove reference
    repo.setPostMedia(post.id, []);
    expect(repo.mediaUsageCount(media.id)).toBe(0);

    // Now safe to delete
    repo.deleteMedia(media.id);
    expect(repo.getMedia(media.id)).toBeNull();
  });

  it("replaces historical post with clean independent new draft on reuse", () => {
    const historical = repo.createPost({ title: "Original Q3 Announcement", masterContent: "Historical text" });
    repo.updatePost({ id: historical.id, status: "published" });

    const accounts = repo.listPlatformAccounts();
    repo.setPostDestinations(historical.id, [accounts[0].id]);

    const newDraft = repo.reusePost(historical.id);

    expect(newDraft.id).not.toBe(historical.id);
    expect(newDraft.title).toContain("Original Q3 Announcement (Reused)");
    expect(newDraft.masterContent).toBe("Historical text");
    expect(newDraft.status).toBe("draft");

    // Historical post must remain unchanged
    const originalPost = repo.getPost(historical.id);
    expect(originalPost?.status).toBe("published");
    expect(originalPost?.title).toBe("Original Q3 Announcement");
  });

  it("duplicates posts independently", () => {
    const post = repo.createPost({ title: "Template Post", masterContent: "Base template" });
    const duplicate = repo.duplicatePost(post.id);

    expect(duplicate.id).not.toBe(post.id);
    expect(duplicate.title).toContain("Template Post (Copy)");
    expect(duplicate.masterContent).toBe("Base template");

    // Updating duplicate does not alter original
    repo.updatePost({ id: duplicate.id, title: "Modified Copy" });
    expect(repo.getPost(post.id)?.title).toBe("Template Post");
  });

  it("safely recovers interrupted jobs on startup without duplicate republishing", () => {
    const post = repo.createPost({ title: "Crash Recovery", masterContent: "In flight content" });
    const accounts = repo.listPlatformAccounts();
    repo.setPostDestinations(post.id, [accounts[0].id]);
    repo.prepareVariants(post.id);
    repo.approveAllVariants(post.id);

    const jobs = repo.createPublishingJobs({
      postId: post.id,
      platformAccountIds: [accounts[0].id],
      mode: "now",
      timezone: "Asia/Kolkata",
    });

    const job = jobs[0];

    // Simulate job was in 'uploading' state when app exited
    repo.updateJobStatus(job.id, "uploading");
    repo.recoverInterruptedJobs();
    expect(repo.getJob(job.id)?.status).toBe("queued");

    // Simulate job was in 'publishing' state without remote ID when app terminated
    repo.updateJobStatus(job.id, "publishing");
    repo.recoverInterruptedJobs();
    // Must NOT be queued for blind duplicate re-publish; must be marked failed with recovery error
    const recovered = repo.getJob(job.id);
    expect(recovered?.status).toBe("failed");
    expect(recovered?.error).toContain("Dispatch interrupted");
  });
});
