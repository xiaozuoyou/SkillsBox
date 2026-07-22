import { useT } from "../i18n/context";
import { originLabelKey } from "../lib/skills";
import type { LinkMode, SkillDetail as SkillDetailType } from "../lib/types";

interface Props {
  detail: SkillDetailType | null;
  emptyTitle: string;
  emptyHint: string;
  onEnable: () => void;
  onDisableProject: (projectPath: string) => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onOpenPath: () => void;
}

export function SkillDetailPanel({
  detail,
  emptyTitle,
  emptyHint,
  onEnable,
  onDisableProject,
  onToggleActive,
  onDelete,
  onOpenPath,
}: Props) {
  const t = useT();

  if (!detail) {
    return (
      <div className="detail">
        <div className="empty-panel">
          <h2>{emptyTitle}</h2>
          <p>{emptyHint}</p>
        </div>
      </div>
    );
  }

  const { entry, body, absolutePath, enables } = detail;
  const isImport = entry.origin === "import" || entry.origin === "Import";
  const modeLabel = (m: LinkMode) =>
    m === "symlink" || (m as string) === "Symlink" ? "symlink" : "copy";

  return (
    <div className="detail">
      <div className="detail-header">
        <div>
          <h2>{entry.name}</h2>
          <div className="meta-row">
            <span className={`badge${isImport ? " import" : ""}`}>
              {t(originLabelKey(entry.origin))}
            </span>
            {entry.source?.uri ? (
              <span className="badge repo" title={entry.source.uri}>
                {entry.source.uri}
              </span>
            ) : null}
            <span className="badge">
              {entry.active ? t("detail.active") : t("detail.inactive")}
            </span>
            <span className="badge">
              {t("detail.projectCount", { count: enables.length })}
            </span>
          </div>
        </div>
        <div className="detail-actions">
          {entry.active ? (
            <button type="button" className="btn primary" onClick={onEnable}>
              {t("detail.enableToProject")}
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onToggleActive}>
            {entry.active ? t("common.disable") : t("common.enable")}
          </button>
          <button type="button" className="btn" onClick={onOpenPath}>
            {t("detail.openFolder")}
          </button>
          <button type="button" className="btn danger" onClick={onDelete}>
            {t("common.delete")}
          </button>
        </div>
      </div>

      {entry.description ? <p className="desc">{entry.description}</p> : null}
      <p className="muted small">
        <code>{absolutePath}</code>
      </p>

      <h3>{t("detail.skillMd")}</h3>
      <pre className="code-block">{body || t("common.empty")}</pre>

      <h3>{t("detail.enabledProjects")}</h3>
      {enables.length === 0 ? (
        <p className="muted small">{t("detail.noProjects")}</p>
      ) : (
        <ul className="enable-list">
          {enables.map((e) => (
            <li key={`${e.skillId}:${e.projectPath}`}>
              <div>
                <div className="path">{e.projectPath}</div>
                <div className="muted small">
                  {modeLabel(e.mode)} · {e.targetPath}
                </div>
              </div>
              <button
                type="button"
                className="btn danger"
                onClick={() => onDisableProject(e.projectPath)}
              >
                {t("detail.uninstall")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
