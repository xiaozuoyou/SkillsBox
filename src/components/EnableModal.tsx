import { useEffect, useState, type ReactNode } from "react";
import { useT } from "../i18n/context";
import type { LinkMode } from "../lib/types";

interface Props {
  open: boolean;
  /** Single skill name, or summary for batch */
  subjectLabel: string;
  description?: ReactNode;
  defaultMode: LinkMode;
  busy: boolean;
  confirmLabel?: string;
  onClose: () => void;
  onPickFolder: () => Promise<string | null>;
  onConfirm: (projectPath: string, mode: LinkMode) => void;
}

export function EnableModal({
  open,
  subjectLabel,
  description,
  defaultMode,
  busy,
  confirmLabel,
  onClose,
  onPickFolder,
  onConfirm,
}: Props) {
  const t = useT();
  const [path, setPath] = useState("");
  const [mode, setMode] = useState<LinkMode>(defaultMode);

  useEffect(() => {
    if (open) {
      setPath("");
      setMode(defaultMode);
    }
  }, [open, defaultMode]);

  if (!open) return null;

  const primaryLabel = confirmLabel ?? t("enable.confirmEnable");

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enable-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal-card">
        <div className="modal-head">
          <h3 id="enable-modal-title">{t("enable.title")}</h3>
          <p className="modal-desc">
            {description ?? (
              <>
                {t("enable.defaultDescStart")} <strong>{subjectLabel}</strong>{" "}
                {t("enable.defaultDescEnd")} <code>.agents/skills</code>{" "}
                {t("enable.defaultDescDir")}
              </>
            )}
          </p>
        </div>
        <div className="modal-fields">
          <div className="field">
            <label htmlFor="enable-project-path">{t("enable.projectRoot")}</label>
            <div className="row">
              <input
                id="enable-project-path"
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/path/to/project"
                autoComplete="off"
              />
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={async () => {
                  const p = await onPickFolder();
                  if (p) setPath(p);
                }}
              >
                {t("common.browse")}
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="enable-mode">{t("enable.linkMode")}</label>
            <select
              id="enable-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as LinkMode)}
              disabled={busy}
            >
              <option value="symlink">{t("enable.modeSymlink")}</option>
              <option value="copy">{t("enable.modeCopy")}</option>
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy || !path.trim()}
            onClick={() => onConfirm(path.trim(), mode)}
          >
            {busy ? t("enable.processing") : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
