import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, protocol } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  openDatabase,
  WelzRepository,
  getAutomationSnapshot,
  type WelzDatabase,
} from "@welz/database";
import { AutomationEngine } from "@welz/automation";
import { PlatformRegistry } from "@welz/platform-core";
import {
  CreatePostInputSchema,
  SchedulePublishInputSchema,
  UpdatePostInputSchema,
  type MediaCategory,
  type PostStatus,
} from "@welz/shared";

import { OAuthManager } from "./oauth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let db: WelzDatabase | null = null;
let repo: WelzRepository | null = null;
let engine: AutomationEngine | null = null;
let oauthManager: OAuthManager | null = null;

function getUserDataRoot(): string {
  const custom = repo?.getSetting("data_root");
  return custom ?? app.getPath("userData");
}

function ensureDirs(): { dbPath: string; mediaPath: string } {
  const root = getUserDataRoot();
  const mediaPath = path.join(root, "media");
  fs.mkdirSync(mediaPath, { recursive: true });
  const dbPath = path.join(root, "welz-publisher.sqlite");
  return { dbPath, mediaPath };
}

function isDevSimulation(): boolean {
  return repo?.getSetting("dev_mode") === "true";
}

function broadcast(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send(channel, payload);
    } catch {
      /* ignore if closed during transmission */
    }
  }
}

function initServices(): void {
  const { dbPath } = ensureDirs();
  db = openDatabase(dbPath);
  repo = new WelzRepository(db);
  repo.ensureDefaultPlatformAccounts();
  if (repo.getSetting("onboarding_complete") !== "true") {
    repo.setSetting("onboarding_complete", "false");
  }
  if (!repo.getSetting("timezone")) {
    repo.setSetting("timezone", "Asia/Kolkata");
  }
  const registry = new PlatformRegistry(isDevSimulation(), (ref) => getSecret(ref));
  engine = new AutomationEngine(repo, registry, (event) => {
    if (event.type === "state") {
      broadcast("automation:state", event.data);
    }
    if (event.type === "job") {
      broadcast("jobs:updated", event.data);
    }
  });
  engine.recoverOnStartup();
  if (repo.getSetting("automation_paused") !== "true") {
    engine.start();
  } else {
    engine.pause();
  }

  oauthManager = new OAuthManager(
    repo,
    (ref, val) => storeSecret(ref, val),
    (ref) => getSecret(ref),
    (acc) => {
      broadcast("platforms:updated", acc);
    }
  );
}

function storeSecret(reference: string, value: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    repo?.log("auth", "warn", "OS encryption unavailable; secret not stored");
    return false;
  }
  const encrypted = safeStorage.encryptString(value);
  const secretsDir = path.join(getUserDataRoot(), "secrets");
  fs.mkdirSync(secretsDir, { recursive: true });
  fs.writeFileSync(path.join(secretsDir, `${reference}.bin`), encrypted);
  return true;
}

function getSecret(reference: string): string | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }
    const secretsDir = path.join(getUserDataRoot(), "secrets");
    const filePath = path.join(secretsDir, `${reference}.bin`);
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    return safeStorage.decryptString(buf);
  } catch (err) {
    repo?.log("auth", "error", `Failed to decrypt secret for ${reference}`);
    return null;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    title: "WELZ Publisher",
    backgroundColor: "#08090b",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  protocol.registerFileProtocol("welz-media", (request, callback) => {
    try {
      const encoded = request.url.replace("welz-media://local/", "");
      const filePath = decodeURIComponent(encoded);
      callback({ path: filePath });
    } catch {
      callback({ error: -2 });
    }
  });
  initServices();
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  mainWindow = null;
  engine?.pause();
  db?.close();
  if (process.platform !== "darwin") app.quit();
});

function registerIpc(): void {
  const r = () => {
    if (!repo || !engine) throw new Error("Services not initialized");
    return { repo, engine };
  };

  ipcMain.handle("app:getMeta", () => ({
    version: app.getVersion(),
    devMode: isDevSimulation(),
    dataRoot: getUserDataRoot(),
    onboardingComplete: repo?.getSetting("onboarding_complete") === "true",
  }));

  ipcMain.handle("settings:get", () => ({
    timezone: repo?.getSetting("timezone") ?? "Asia/Kolkata",
    devMode: isDevSimulation(),
    automationPaused: repo?.getSetting("automation_paused") === "true",
    dataRoot: getUserDataRoot(),
  }));

  ipcMain.handle("settings:set", (_e, payload: { devMode?: boolean; timezone?: string; dataRoot?: string }) => {
    const { repo: repository, engine: eng } = r();
    if (payload.timezone) repository.setSetting("timezone", payload.timezone);
    if (payload.devMode !== undefined) {
      repository.setSetting("dev_mode", payload.devMode ? "true" : "false");
      eng.pause();
      initServices();
    }
    if (payload.dataRoot) {
      repository.setSetting("data_root", payload.dataRoot);
    }
    return repository.getSetting("timezone");
  });

  ipcMain.handle("onboarding:complete", () => {
    repo?.setSetting("onboarding_complete", "true");
    return true;
  });

  ipcMain.handle("overview:get", () => {
    const { repo: repository, engine: eng } = r();
    return repository.getOverviewData(eng.getState());
  });

  ipcMain.handle("search:global", (_e, query: string) => {
    return r().repo.search(query);
  });

  ipcMain.handle("dashboard:get", () => {
    const { repo: repository, engine: eng } = r();
    return {
      stats: repository.getDashboardStats(),
      activity: repository.getRecentActivity(),
      upcoming: repository.getUpcoming(),
      automation: getAutomationSnapshot(repository, eng.getState()),
    };
  });

  ipcMain.handle("posts:list", (_e, status?: PostStatus) => repositoryList(status));
  ipcMain.handle("posts:get", (_e, id: string) => r().repo.getPost(id));
  ipcMain.handle("posts:create", (_e, input: unknown) => {
    const parsed = CreatePostInputSchema.parse(input);
    return r().repo.createPost(parsed);
  });
  ipcMain.handle("posts:update", (_e, input: unknown) => {
    const parsed = UpdatePostInputSchema.parse(input);
    return r().repo.updatePost(parsed);
  });
  ipcMain.handle("posts:delete", (_e, id: string) => {
    r().repo.deletePost(id);
    return true;
  });
  ipcMain.handle("posts:duplicate", (_e, id: unknown) => {
    if (typeof id !== "string" || !id.trim()) throw new Error("Invalid post ID for duplicate");
    return r().repo.duplicatePost(id);
  });
  ipcMain.handle("posts:reuse", (_e, id: unknown) => {
    if (typeof id !== "string" || !id.trim()) throw new Error("Invalid post ID for reuse");
    return r().repo.reusePost(id);
  });
  ipcMain.handle("posts:latestDraft", () => r().repo.getLatestDraft());
  ipcMain.handle("posts:destinations", (_e, postId: unknown, accountIds: unknown) => {
    if (typeof postId !== "string" || !Array.isArray(accountIds)) {
      throw new Error("Invalid arguments for posts:destinations");
    }
    r().repo.setPostDestinations(postId, accountIds as string[]);
    return r().repo.getPostDestinations(postId);
  });
  ipcMain.handle("posts:prepareVariants", (_e, postId: unknown) => {
    if (typeof postId !== "string") throw new Error("Invalid postId");
    return r().repo.prepareVariants(postId);
  });
  ipcMain.handle("posts:approveVariants", (_e, postId: unknown) => {
    if (typeof postId !== "string") throw new Error("Invalid postId");
    r().repo.approveAllVariants(postId);
    return r().repo.listVariants(postId);
  });
  ipcMain.handle("variants:update", (_e, id: unknown, content: unknown) => {
    if (typeof id !== "string" || typeof content !== "string") {
      throw new Error("Invalid variant arguments");
    }
    return r().repo.updateVariant(id, content);
  });
  ipcMain.handle("variants:reset", (_e, postId: unknown, platform: unknown) => {
    if (typeof postId !== "string" || typeof platform !== "string") {
      throw new Error("Invalid variant reset arguments");
    }
    return r().repo.resetVariantToPrepared(postId, platform as "linkedin" | "instagram" | "whatsapp");
  });
  ipcMain.handle("posts:variants", (_e, postId: unknown) => {
    if (typeof postId !== "string") throw new Error("Invalid postId");
    return r().repo.listVariants(postId);
  });
  ipcMain.handle("posts:media", (_e, postId: unknown) => {
    if (typeof postId !== "string") throw new Error("Invalid postId");
    return r().repo.getPostMedia(postId);
  });
  ipcMain.handle("posts:setMedia", (_e, postId: unknown, mediaIds: unknown) => {
    if (typeof postId !== "string" || !Array.isArray(mediaIds)) {
      throw new Error("Invalid setMedia arguments");
    }
    r().repo.setPostMedia(postId, mediaIds as string[]);
    return r().repo.getPostMedia(postId);
  });

  ipcMain.handle("publish:schedule", (_e, input: unknown) => {
    const parsed = SchedulePublishInputSchema.parse(input);
    const jobs = r().repo.createPublishingJobs(parsed);
    r().engine.start();
    return jobs;
  });

  ipcMain.handle("jobs:list", (_e, filter?: { status?: string[]; postId?: string }) =>
    r().repo.listJobs(filter as { status?: import("@welz/shared").JobStatus[]; postId?: string })
  );
  ipcMain.handle("jobs:retry", async (_e, jobId: string) => {
    await r().engine.retryJob(jobId);
    return r().repo.getJob(jobId);
  });

  ipcMain.handle("jobs:cancel", (_e, jobId: string) => {
    const { repo: repository } = r();
    const job = repository.getJob(jobId);
    if (!job) return null;
    if (job.status === "queued" || job.status === "ready" || job.status === "draft") {
      repository.updateJobStatus(jobId, "cancelled");
    }
    return repository.getJob(jobId);
  });

  ipcMain.handle("history:list", () => r().repo.listPlatformResults(200));

  ipcMain.handle("platforms:list", () => r().repo.listPlatformAccounts());

  ipcMain.handle("platforms:status", async (_e, accountId: string) => {
    const { repo: repository } = r();
    const account = repository.getPlatformAccount(accountId);
    if (!account) throw new Error("Account not found");
    const registry = new PlatformRegistry(isDevSimulation(), (ref) => getSecret(ref));
    const adapter = registry.getAdapter(account.platform);
    return adapter.getConnectionStatus(account);
  });

  ipcMain.handle("platforms:test", async (_e, accountId: string) => {
    const { repo: repository } = r();
    const account = repository.getPlatformAccount(accountId);
    if (!account) throw new Error("Account not found");
    const registry = new PlatformRegistry(isDevSimulation(), (ref) => getSecret(ref));
    const adapter = registry.getAdapter(account.platform);
    return adapter.testConnection(account);
  });

  ipcMain.handle("platforms:connect", async (_e, accountId: string) => {
    const { repo: repository } = r();
    const account = repository.getPlatformAccount(accountId);
    if (!account) throw new Error("Account not found");

    if (isDevSimulation()) {
      const registry = new PlatformRegistry(true, (ref) => getSecret(ref));
      const adapter = registry.getAdapter(account.platform);
      const result = await adapter.connect(accountId);
      if (result.ok) {
        const ref = `acct-${accountId}`;
        storeSecret(ref, `token-${accountId}`);
        repository.updatePlatformAccountStatus(accountId, "connected", ref);
      }
      return { ...result, account: repository.getPlatformAccount(accountId) };
    }

    if (!oauthManager) throw new Error("OAuth manager not initialized");
    const result = await oauthManager.startOAuth(account.platform);
    return { ...result, account: repository.getPlatformAccount(accountId) };
  });

  ipcMain.handle("platforms:disconnect", async (_e, accountId: string) => {
    const { repo: repository } = r();
    const account = repository.getPlatformAccount(accountId);
    if (!account) throw new Error("Account not found");
    const registry = new PlatformRegistry(isDevSimulation(), (ref) => getSecret(ref));
    await registry.getAdapter(account.platform).disconnect(accountId);
    repository.updatePlatformAccountStatus(accountId, "disconnected", null);
    return repository.getPlatformAccount(accountId);
  });

  ipcMain.handle("oauth:status", () => {
    return (
      oauthManager?.getConfigStatus() ?? {
        linkedin: { configured: false },
        instagram: { configured: false },
        whatsapp: { configured: false },
      }
    );
  });

  ipcMain.handle("oauth:saveConfig", (_e, payload) => {
    if (!oauthManager) throw new Error("OAuth manager not initialized");
    return oauthManager.saveConfig(payload);
  });

  ipcMain.handle("oauth:start", (_e, platform) => {
    if (!oauthManager) throw new Error("OAuth manager not initialized");
    return oauthManager.startOAuth(platform);
  });

  ipcMain.handle("automation:pause", () => {
    r().engine.pause();
    r().repo.setSetting("automation_paused", "true");
    return getAutomationSnapshot(r().repo, r().engine.getState());
  });

  ipcMain.handle("automation:resume", () => {
    r().repo.setSetting("automation_paused", "false");
    r().engine.resume();
    return getAutomationSnapshot(r().repo, r().engine.getState());
  });

  ipcMain.handle("automation:status", () =>
    getAutomationSnapshot(r().repo, r().engine.getState())
  );

  ipcMain.handle("media:list", (_e, category?: MediaCategory) => r().repo.listMedia(category));
  ipcMain.handle("media:usage", (_e, mediaId: string) => r().repo.mediaUsageCount(mediaId));

  ipcMain.handle("media:upload", async () => {
    const { repo: repository } = r();
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Media", extensions: ["png", "jpg", "jpeg", "gif", "webp", "mp4", "mov"] },
      ],
    });
    if (result.canceled) return [];
    const { mediaPath } = ensureDirs();
    const uploaded = [];
    for (const filePath of result.filePaths) {
      const filename = path.basename(filePath);
      const id = crypto.randomUUID();
      const dest = path.join(mediaPath, `${id}-${filename}`);
      fs.copyFileSync(filePath, dest);
      const stat = fs.statSync(dest);
      const ext = path.extname(filename).toLowerCase();
      const type =
        ext === ".mp4" || ext === ".mov" ? `video/${ext.slice(1)}` : `image/${ext.slice(1) || "jpeg"}`;
      const record = repository.addMedia({
        id,
        filename,
        path: dest,
        type,
        size: stat.size,
        width: null,
        height: null,
        category: "general",
      });
      uploaded.push(record);
    }
    return uploaded;
  });

  ipcMain.handle("media:delete", (_e, id: string) => {
    if (typeof id !== "string" || !id.trim()) {
      throw new Error("Invalid media ID");
    }
    const usage = r().repo.mediaUsageCount(id);
    if (usage > 0) {
      throw new Error(
        `Cannot delete media: asset is currently referenced by ${usage} post(s). Remove references first.`
      );
    }
    const media = r().repo.getMedia(id);
    if (media && fs.existsSync(media.path)) {
      try {
        fs.unlinkSync(media.path);
      } catch {
        /* ignore */
      }
    }
    r().repo.deleteMedia(id);
    return true;
  });

  ipcMain.handle("media:rename", (_e, id: string, filename: string) => {
    if (typeof id !== "string" || typeof filename !== "string" || !filename.trim()) {
      throw new Error("Invalid media rename arguments");
    }
    const sanitized = path.basename(filename.trim());
    return r().repo.renameMedia(id, sanitized);
  });

  ipcMain.handle("calendar:range", (_e, startIso: string, endIso: string) => {
    if (typeof startIso !== "string" || typeof endIso !== "string") {
      throw new Error("Invalid calendar range parameters");
    }
    return r().repo.listScheduledInRange(startIso, endIso);
  });

  ipcMain.handle("dialog:chooseDataRoot", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("shell:openPath", (_e, p: string) => {
    if (typeof p !== "string" || !p.trim()) return;
    const resolved = path.resolve(p);
    const dataRoot = path.resolve(getUserDataRoot());
    if (resolved.startsWith(dataRoot)) {
      return shell.openPath(resolved);
    }
    throw new Error("Access denied: path is outside application data root");
  });
}

function repositoryList(status?: PostStatus) {
  const posts = r().repo.listPosts(status);
  return posts.map((post) => ({
    ...post,
    destinations: r().repo.getPostDestinations(post.id),
    media: r().repo.getPostMedia(post.id),
  }));
}

function r(): { repo: WelzRepository; engine: AutomationEngine } {
  if (!repo || !engine) throw new Error("Services not initialized");
  return { repo, engine };
}
