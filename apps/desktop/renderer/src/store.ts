import { create } from "zustand";

interface Toast {
  id: string;
  message: string;
  tone?: "default" | "error";
}

export type ActiveDrawer =
  | null
  | "drafts"
  | "connections"
  | "activity"
  | "media"
  | "settings"
  | "schedule"
  | "automate"
  | "preview"
  | "customize";

interface AppStore {
  devMode: boolean;
  onboardingComplete: boolean;
  timezone: string;
  setDevMode: (v: boolean) => void;
  setOnboardingComplete: (v: boolean) => void;
  setTimezone: (tz: string) => void;

  // Global cockpit UI state
  activeDrawer: ActiveDrawer;
  setActiveDrawer: (drawer: ActiveDrawer) => void;
  connectedCount: number;
  setConnectedCount: (count: number) => void;
  autosaveStatus: string;
  setAutosaveStatus: (status: string) => void;

  toasts: Toast[];
  pushToast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  devMode: false,
  onboardingComplete: true,
  timezone: "Asia/Kolkata",
  setDevMode: (v) => set({ devMode: v }),
  setOnboardingComplete: (v) => set({ onboardingComplete: v }),
  setTimezone: (tz) => set({ timezone: tz }),

  activeDrawer: null,
  setActiveDrawer: (drawer) => set({ activeDrawer: drawer }),
  connectedCount: 0,
  setConnectedCount: (count) => set({ connectedCount: count }),
  autosaveStatus: "Saved",
  setAutosaveStatus: (status) => set({ autosaveStatus: status }),

  toasts: [],
  pushToast: (message, tone = "default") =>
    set((s) => ({
      toasts: [...s.toasts, { id: crypto.randomUUID(), message, tone }],
    })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function getWelz() {
  if (!window.welz) {
    throw new Error("WELZ API unavailable — run inside Electron.");
  }
  return window.welz;
}

export function formatDateTime(iso: string, timezone = "Asia/Kolkata"): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
