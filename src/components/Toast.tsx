import { useEffect } from "react";
import { useT } from "../i18n/context";

export type ToastKind = "ok" | "error" | "warn";

export interface ToastState {
  message: string;
  kind: ToastKind;
}

interface Props {
  toast: ToastState | null;
  onClear: () => void;
}

export function Toast({ toast, onClear }: Props) {
  const t = useT();

  useEffect(() => {
    if (!toast) return;
    const ms = toast.kind === "error" ? 5200 : 4200;
    const timer = window.setTimeout(onClear, ms);
    return () => window.clearTimeout(timer);
  }, [toast, onClear]);

  if (!toast) return null;

  return (
    <div
      className={`toast toast--${toast.kind}`}
      role="status"
      aria-live={toast.kind === "error" ? "assertive" : "polite"}
    >
      <p className="toast-msg">{toast.message}</p>
      <button
        type="button"
        className="toast-close"
        aria-label={t("common.closeToast")}
        title={t("common.close")}
        onClick={onClear}
      >
        ×
      </button>
    </div>
  );
}
