import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Toasts } from "./components/Toasts";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PublishWorkstationPage } from "./pages/PublishWorkstationPage";
import { ContentPage } from "./pages/ContentPage";
import { ContentDetailPage } from "./pages/ContentDetailPage";
import { MediaPage } from "./pages/MediaPage";
import { CalendarPage } from "./pages/CalendarPage";
import { PublishingPage } from "./pages/PublishingPage";
import { HistoryPage } from "./pages/HistoryPage";
import { PlatformsPage } from "./pages/PlatformsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useAppStore } from "./store";

export function App() {
  const [ready, setReady] = useState(false);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const setOnboardingComplete = useAppStore((s) => s.setOnboardingComplete);

  useEffect(() => {
    void window.welz
      ?.getMeta()
      .then((meta) => {
        setOnboardingComplete(meta.onboardingComplete);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [setOnboardingComplete]);

  if (!ready) {
    return <div className="onboarding">Loading WELZ Publisher…</div>;
  }

  if (!onboardingComplete) {
    return (
      <>
        <OnboardingPage />
        <Toasts />
      </>
    );
  }

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<PublishWorkstationPage />} />
          <Route path="publish" element={<Navigate to="/" replace />} />
          <Route path="compose" element={<Navigate to="/" replace />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="content/:id" element={<ContentDetailPage />} />
          <Route path="media" element={<MediaPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="publishing" element={<PublishingPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="connections" element={<PlatformsPage />} />
          <Route path="platforms" element={<PlatformsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toasts />
    </>
  );
}
