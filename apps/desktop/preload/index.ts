import { contextBridge, ipcRenderer } from "electron";
import type {
  ActivityItem,
  AutomationStatusSnapshot,
  CreatePostInput,
  DashboardStats,
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
  PublishingJobRecord,
  SchedulePublishInput,
  SearchResultItem,
  UpdatePostInput,
  UpcomingItem,
} from "@welz/shared";

export interface WelzApi {
  getMeta: () => Promise<{
    version: string;
    devMode: boolean;
    dataRoot: string;
    onboardingComplete: boolean;
  }>;
  settings: {
    get: () => Promise<{
      timezone: string;
      devMode: boolean;
      automationPaused: boolean;
      dataRoot: string;
    }>;
    set: (payload: {
      devMode?: boolean;
      timezone?: string;
      dataRoot?: string;
    }) => Promise<string | null>;
  };
  onboarding: { complete: () => Promise<boolean> };
  overview: {
    get: () => Promise<OverviewData>;
  };
  search: {
    query: (term: string) => Promise<SearchResultItem[]>;
  };
  dashboard: {
    get: () => Promise<{
      stats: DashboardStats;
      activity: ActivityItem[];
      upcoming: UpcomingItem[];
      automation: AutomationStatusSnapshot;
    }>;
  };
  posts: {
    list: (status?: PostStatus) => Promise<
      Array<PostRecord & { destinations: PlatformAccountRecord[]; media: MediaRecord[] }>
    >;
    get: (id: string) => Promise<PostRecord | null>;
    create: (input: CreatePostInput) => Promise<PostRecord>;
    update: (input: UpdatePostInput) => Promise<PostRecord>;
    delete: (id: string) => Promise<boolean>;
    duplicate: (id: string) => Promise<PostRecord>;
    reuse: (id: string) => Promise<PostRecord>;
    latestDraft: () => Promise<PostRecord | null>;
    setDestinations: (postId: string, accountIds: string[]) => Promise<PlatformAccountRecord[]>;
    prepareVariants: (postId: string) => Promise<PostVariantRecord[]>;
    approveVariants: (postId: string) => Promise<PostVariantRecord[]>;
    listVariants: (postId: string) => Promise<PostVariantRecord[]>;
    getMedia: (postId: string) => Promise<MediaRecord[]>;
    setMedia: (postId: string, mediaIds: string[]) => Promise<MediaRecord[]>;
  };
  variants: {
    update: (id: string, content: string) => Promise<PostVariantRecord>;
    reset: (postId: string, platform: Platform) => Promise<PostVariantRecord>;
  };
  publish: {
    schedule: (input: SchedulePublishInput) => Promise<PublishingJobRecord[]>;
  };
  jobs: {
    list: (filter?: { status?: JobStatus[]; postId?: string }) => Promise<PublishingJobRecord[]>;
    retry: (jobId: string) => Promise<PublishingJobRecord | null>;
    cancel: (jobId: string) => Promise<PublishingJobRecord | null>;
  };
  history: { list: () => Promise<PlatformResultRecord[]> };
  platforms: {
    list: () => Promise<PlatformAccountRecord[]>;
    status: (accountId: string) => Promise<{
      connected: boolean;
      mode: string;
      accountType?: string;
      capabilities: string[];
      message: string;
      lastVerifiedAt: string | null;
      health: string;
      requiresConfig?: boolean;
      configRequirements?: string[];
    }>;
    test: (accountId: string) => Promise<{
      ok: boolean;
      message: string;
      details?: Record<string, unknown>;
    }>;
    connect: (accountId: string) => Promise<{
      ok: boolean;
      message: string;
      account: PlatformAccountRecord | null;
    }>;
    disconnect: (accountId: string) => Promise<PlatformAccountRecord | null>;
    verifyLive: (payload: { accountId: string; content?: string }) => Promise<{
      ok: boolean;
      mode: string;
      externalPostId?: string;
      errorCode?: string;
      error?: string;
      responseMeta?: Record<string, unknown>;
    }>;
  };
  oauth: {
    status: () => Promise<{
      linkedin: { configured: boolean; clientId?: string };
      instagram: { configured: boolean; appId?: string };
      whatsapp: { configured: boolean; phoneId?: string };
    }>;
    saveConfig: (payload: {
      platform: Platform;
      clientId?: string;
      clientSecret?: string;
      appId?: string;
      appSecret?: string;
      phoneId?: string;
      token?: string;
      wabaId?: string;
    }) => Promise<{ ok: boolean; message: string }>;
    start: (platform: Platform) => Promise<{ ok: boolean; message: string; authUrl?: string }>;
    onPlatformsUpdated: (cb: (account: PlatformAccountRecord) => void) => () => void;
  };
  automation: {
    pause: () => Promise<AutomationStatusSnapshot>;
    resume: () => Promise<AutomationStatusSnapshot>;
    status: () => Promise<AutomationStatusSnapshot>;
    onState: (cb: (data: unknown) => void) => () => void;
    onJob: (cb: (data: unknown) => void) => () => void;
  };
  media: {
    list: (category?: MediaCategory) => Promise<MediaRecord[]>;
    upload: () => Promise<MediaRecord[]>;
    delete: (id: string) => Promise<boolean>;
    rename: (id: string, filename: string) => Promise<MediaRecord>;
    usage: (mediaId: string) => Promise<number>;
  };
  calendar: {
    range: (
      startIso: string,
      endIso: string
    ) => Promise<
      Array<{
        scheduleId: string;
        postId: string;
        postTitle: string;
        scheduledAt: string;
        timezone: string;
      }>
    >;
  };
  dialog: { chooseDataRoot: () => Promise<string | null> };
}

const api: WelzApi = {
  getMeta: () => ipcRenderer.invoke("app:getMeta"),
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (payload) => ipcRenderer.invoke("settings:set", payload),
  },
  onboarding: {
    complete: () => ipcRenderer.invoke("onboarding:complete"),
  },
  overview: {
    get: () => ipcRenderer.invoke("overview:get"),
  },
  search: {
    query: (term) => ipcRenderer.invoke("search:global", term),
  },
  dashboard: {
    get: () => ipcRenderer.invoke("dashboard:get"),
  },
  posts: {
    list: (status) => ipcRenderer.invoke("posts:list", status),
    get: (id) => ipcRenderer.invoke("posts:get", id),
    create: (input) => ipcRenderer.invoke("posts:create", input),
    update: (input) => ipcRenderer.invoke("posts:update", input),
    delete: (id) => ipcRenderer.invoke("posts:delete", id),
    duplicate: (id) => ipcRenderer.invoke("posts:duplicate", id),
    reuse: (id) => ipcRenderer.invoke("posts:reuse", id),
    latestDraft: () => ipcRenderer.invoke("posts:latestDraft"),
    setDestinations: (postId, accountIds) =>
      ipcRenderer.invoke("posts:destinations", postId, accountIds),
    prepareVariants: (postId) => ipcRenderer.invoke("posts:prepareVariants", postId),
    approveVariants: (postId) => ipcRenderer.invoke("posts:approveVariants", postId),
    listVariants: (postId) => ipcRenderer.invoke("posts:variants", postId),
    getMedia: (postId) => ipcRenderer.invoke("posts:media", postId),
    setMedia: (postId, mediaIds) => ipcRenderer.invoke("posts:setMedia", postId, mediaIds),
  },
  variants: {
    update: (id, content) => ipcRenderer.invoke("variants:update", id, content),
    reset: (postId, platform) => ipcRenderer.invoke("variants:reset", postId, platform),
  },
  publish: {
    schedule: (input) => ipcRenderer.invoke("publish:schedule", input),
  },
  jobs: {
    list: (filter) => ipcRenderer.invoke("jobs:list", filter),
    retry: (jobId) => ipcRenderer.invoke("jobs:retry", jobId),
    cancel: (jobId) => ipcRenderer.invoke("jobs:cancel", jobId),
  },
  history: {
    list: () => ipcRenderer.invoke("history:list"),
  },
  platforms: {
    list: () => ipcRenderer.invoke("platforms:list"),
    status: (accountId) => ipcRenderer.invoke("platforms:status", accountId),
    test: (accountId) => ipcRenderer.invoke("platforms:test", accountId),
    connect: (accountId) => ipcRenderer.invoke("platforms:connect", accountId),
    disconnect: (accountId) => ipcRenderer.invoke("platforms:disconnect", accountId),
    verifyLive: (payload) => ipcRenderer.invoke("platforms:verifyLive", payload),
  },
  oauth: {
    status: () => ipcRenderer.invoke("oauth:status"),
    saveConfig: (payload) => ipcRenderer.invoke("oauth:saveConfig", payload),
    start: (platform) => ipcRenderer.invoke("oauth:start", platform),
    onPlatformsUpdated: (cb) => {
      const listener = (_: unknown, data: unknown) => cb(data as PlatformAccountRecord);
      ipcRenderer.on("platforms:updated", listener);
      return () => ipcRenderer.removeListener("platforms:updated", listener);
    },
  },
  automation: {
    pause: () => ipcRenderer.invoke("automation:pause"),
    resume: () => ipcRenderer.invoke("automation:resume"),
    status: () => ipcRenderer.invoke("automation:status"),
    onState: (cb) => {
      const listener = (_: unknown, data: unknown) => cb(data);
      ipcRenderer.on("automation:state", listener);
      return () => ipcRenderer.removeListener("automation:state", listener);
    },
    onJob: (cb) => {
      const listener = (_: unknown, data: unknown) => cb(data);
      ipcRenderer.on("jobs:updated", listener);
      return () => ipcRenderer.removeListener("jobs:updated", listener);
    },
  },
  media: {
    list: (category) => ipcRenderer.invoke("media:list", category),
    upload: () => ipcRenderer.invoke("media:upload"),
    delete: (id) => ipcRenderer.invoke("media:delete", id),
    rename: (id, filename) => ipcRenderer.invoke("media:rename", id, filename),
    usage: (mediaId) => ipcRenderer.invoke("media:usage", mediaId),
  },
  calendar: {
    range: (start, end) => ipcRenderer.invoke("calendar:range", start, end),
  },
  dialog: {
    chooseDataRoot: () => ipcRenderer.invoke("dialog:chooseDataRoot"),
  },
};

contextBridge.exposeInMainWorld("welz", api);

declare global {
  interface Window {
    welz: WelzApi;
  }
}
