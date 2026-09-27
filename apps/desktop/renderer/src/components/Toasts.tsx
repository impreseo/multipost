import { useEffect } from "react";
import { useAppStore } from "../store";

export function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    const t = setTimeout(() => dismiss(latest.id), 4500);
    return () => clearTimeout(t);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast${toast.tone === "error" ? " toast-error" : ""}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
