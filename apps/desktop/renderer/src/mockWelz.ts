export function installBrowserWelzMock(): void {
  if (typeof window === "undefined" || (window as any).welz) return;

  const mockAccounts: any[] = [
    {
      id: "acc_ig",
      platform: "instagram",
      accountName: "WELZ",
      status: "connected",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "acc_li",
      platform: "linkedin",
      accountName: "Personal",
      status: "connected",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "acc_wa",
      platform: "whatsapp",
      accountName: "WELZ Channel",
      status: "connected",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  (window as any).welz = {
    getMeta: async () => ({
      version: "0.1.0",
      devMode: true,
      dataRoot: "/mock",
      onboardingComplete: true,
    }),
    settings: {
      get: async () => ({
        timezone: "Asia/Kolkata",
        devMode: true,
        automationPaused: false,
        dataRoot: "/mock",
      }),
      set: async () => null,
    },
    onboarding: { complete: async () => true },
    overview: {
      get: async () => ({
        todayPosts: 0,
        scheduledCount: 0,
        failedCount: 0,
        publishedWeek: 0,
        recentActivity: [],
      }),
    },
    search: { query: async () => [] },
    dashboard: {
      get: async () => ({
        stats: { scheduled: 0, publishedThisMonth: 0, failedLast7Days: 0, activeAutomations: 0 },
        activity: [],
        upcoming: [],
        automation: { paused: false, nextRunAt: null, activeRules: 0, runningSince: null },
      }),
    },
    posts: {
      list: async () => [],
      get: async () => null,
      create: async (inp: any) => ({
        id: "post_1",
        title: inp.title || "Untitled post",
        masterContent: inp.masterContent || "",
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      update: async (inp: any) => ({
        id: inp.id,
        title: inp.title,
        masterContent: inp.masterContent,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      delete: async () => true,
      duplicate: async () => ({} as any),
      reuse: async () => ({} as any),
      latestDraft: async () => null,
      setDestinations: async () => mockAccounts,
      prepareVariants: async () => [],
      approveVariants: async () => [],
      listVariants: async () => [],
      getMedia: async () => [],
      setMedia: async () => [],
    },
    variants: {
      update: async () => ({} as any),
      reset: async () => ({} as any),
    },
    publish: {
      schedule: async () => [],
    },
    jobs: {
      list: async () => [],
      retry: async () => null,
      cancel: async () => null,
    },
    history: { list: async () => [] },
    platforms: {
      list: async () => mockAccounts,
      status: async () => ({
        connected: true,
        mode: "simulation",
        capabilities: ["text", "images"],
        message: "Connected",
        lastVerifiedAt: new Date().toISOString(),
        health: "ok",
      }),
      verify: async () => ({ connected: true, message: "OK" }),
      connect: async () => true,
      disconnect: async () => true,
    },
    media: {
      list: async () => [],
      upload: async () => [],
      get: async () => null,
      delete: async () => true,
      update: async () => ({} as any),
    },
    calendar: { get: async () => [] },
    automation: {
      rules: { list: async () => [] },
      status: async () => ({ paused: false, nextRunAt: null, activeRules: 0, runningSince: null }),
      triggerNow: async () => false,
      pause: async () => true,
      resume: async () => true,
    },
    system: {
      openPath: async () => {},
      openExternal: async () => {},
      exportData: async () => ({ posts: 0, media: 0, jobs: 0, history: 0 }),
      importData: async () => false,
    },
  };
}
