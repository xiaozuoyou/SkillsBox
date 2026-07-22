import { useEffect, useMemo, useState } from "react";
import { useT } from "../i18n/context";
import type { ImportPreview, ImportPreviewItem } from "../lib/types";

type ImportTab = "folder" | "git";
type Step = "form" | "conflicts";

interface Props {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onPickFolder: () => Promise<string | null>;
  onPreviewFolder: (folderPath: string) => Promise<ImportPreview>;
  onPreviewGit: (repoUrl: string) => Promise<ImportPreview>;
  onImportFolder: (folderPath: string, overwriteNames: string[]) => void;
  onImportGit: (repoUrl: string, overwriteNames: string[]) => void;
}

export function ImportModal({
  open,
  busy,
  onClose,
  onPickFolder,
  onPreviewFolder,
  onPreviewGit,
  onImportFolder,
  onImportGit,
}: Props) {
  const t = useT();
  const [tab, setTab] = useState<ImportTab>("git");
  const [step, setStep] = useState<Step>("form");
  const [folderPath, setFolderPath] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [previewItems, setPreviewItems] = useState<ImportPreviewItem[]>([]);
  /** Names the user chose to overwrite */
  const [overwrite, setOverwrite] = useState<Set<string>>(new Set());
  const [previewBusy, setPreviewBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTab("git");
      setStep("form");
      setFolderPath("");
      setGitUrl("");
      setPreviewItems([]);
      setOverwrite(new Set());
      setPreviewBusy(false);
    }
  }, [open]);

  const conflicts = useMemo(
    () => previewItems.filter((i) => i.exists),
    [previewItems],
  );

  if (!open) return null;

  const runPreview = async () => {
    setPreviewBusy(true);
    try {
      const preview =
        tab === "git"
          ? await onPreviewGit(gitUrl.trim())
          : await onPreviewFolder(folderPath.trim());
      if (preview.conflictCount > 0) {
        setPreviewItems(preview.items);
        setOverwrite(new Set());
        setStep("conflicts");
      } else {
        // No conflicts — import all new
        if (tab === "git") onImportGit(gitUrl.trim(), []);
        else onImportFolder(folderPath.trim(), []);
      }
    } finally {
      setPreviewBusy(false);
    }
  };

  const confirmWithDecisions = () => {
    const names = [...overwrite];
    if (tab === "git") onImportGit(gitUrl.trim(), names);
    else onImportFolder(folderPath.trim(), names);
  };

  const toggleOverwrite = (name: string) => {
    setOverwrite((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAllOverwrite = () => {
    setOverwrite(new Set(conflicts.map((c) => c.name)));
  };

  const selectAllSkip = () => {
    setOverwrite(new Set());
  };

  const formDisabled = busy || previewBusy;
  const canPreview =
    tab === "git" ? Boolean(gitUrl.trim()) : Boolean(folderPath.trim());

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !formDisabled) onClose();
      }}
    >
      <div className="modal-card modal-card--wide">
        {step === "form" ? (
          <>
            <div className="modal-head">
              <h3 id="import-modal-title">{t("import.title")}</h3>
              <p className="modal-desc muted">{t("import.desc")}</p>
            </div>
            <div className="modal-fields">
              <div className="tabs" role="tablist" style={{ margin: 0 }}>
                <button
                  type="button"
                  role="tab"
                  className={`tab${tab === "git" ? " active" : ""}`}
                  aria-selected={tab === "git"}
                  disabled={formDisabled}
                  onClick={() => setTab("git")}
                >
                  {t("import.tabGit")}
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`tab${tab === "folder" ? " active" : ""}`}
                  aria-selected={tab === "folder"}
                  disabled={formDisabled}
                  onClick={() => setTab("folder")}
                >
                  {t("import.tabFolder")}
                </button>
              </div>

              {tab === "git" ? (
                <>
                  <p className="muted small" style={{ margin: 0 }}>
                    {t("import.gitHint")} <code>git</code>
                    {t("import.gitHintEnd")}
                  </p>
                  <div className="field">
                    <label htmlFor="import-git">{t("import.repoUrl")}</label>
                    <input
                      id="import-git"
                      value={gitUrl}
                      onChange={(e) => setGitUrl(e.target.value)}
                      placeholder="https://github.com/org/skills.git"
                      disabled={formDisabled}
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="muted small" style={{ margin: 0 }}>
                    {t("import.folderHint")} <code>SKILL.md</code>
                    {t("import.folderHintMid")}
                  </p>
                  <div className="field">
                    <label htmlFor="import-folder">{t("import.folderPath")}</label>
                    <div className="row">
                      <input
                        id="import-folder"
                        value={folderPath}
                        onChange={(e) => setFolderPath(e.target.value)}
                        placeholder="/path/to/skills"
                        disabled={formDisabled}
                      />
                      <button
                        type="button"
                        className="btn"
                        disabled={formDisabled}
                        onClick={async () => {
                          const p = await onPickFolder();
                          if (p) setFolderPath(p);
                        }}
                      >
                        {t("common.browse")}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                disabled={formDisabled}
                onClick={onClose}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={formDisabled || !canPreview}
                onClick={() => void runPreview().catch(() => {})}
              >
                {previewBusy
                  ? tab === "git"
                    ? t("import.cloning")
                    : t("import.scanning")
                  : t("import.submit")}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-head">
              <h3 id="import-modal-title">{t("import.conflictTitle")}</h3>
              <p className="modal-desc muted">
                {t("import.conflictDesc", { count: conflicts.length })}
              </p>
            </div>
            <div className="modal-fields">
              <div className="conflict-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={selectAllSkip}
                >
                  {t("import.skipAll")}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={selectAllOverwrite}
                >
                  {t("import.overwriteAll")}
                </button>
              </div>
              <ul className="conflict-list">
                {conflicts.map((c) => {
                  const checked = overwrite.has(c.name);
                  return (
                    <li key={c.name}>
                      <label className="conflict-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busy}
                          onChange={() => toggleOverwrite(c.name)}
                        />
                        <span className="conflict-item-body">
                          <span className="conflict-name">{c.name}</span>
                          {c.description ? (
                            <span className="muted small conflict-desc">
                              {c.description}
                            </span>
                          ) : null}
                          <span className="muted small">
                            {checked
                              ? t("import.willOverwrite")
                              : t("import.willSkip")}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="muted small" style={{ margin: 0 }}>
                {t("import.conflictNewHint", {
                  count: previewItems.filter((i) => !i.exists).length,
                })}
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setStep("form")}
              >
                {t("import.back")}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={confirmWithDecisions}
              >
                {busy ? t("import.importing") : t("import.confirmImport")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
