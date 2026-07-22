import { useT } from "../i18n/context";
import type { EnableRecord, LinkMode, SkillListItem } from "../lib/types";

interface Props {
  projectPath: string | null;
  recentProjects: string[];
  enables: EnableRecord[];
  skillsById: Map<string, SkillListItem>;
  linkMode: LinkMode;
  busy: boolean;
  onLinkModeChange: (mode: LinkMode) => void;
  onPickProject: () => void;
  onSelectRecent: (path: string) => void;
  onRemoveRecent: (path: string) => void;
  onClearRecent: () => void;
  onClearProject: () => void;
  onOpenProject: () => void;
  onRemoveSkill: (skillId: string) => void;
  onSelectSkill: (skillId: string) => void;
  selectedSkillId: string | null;
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function ProjectWorkspace({
  projectPath,
  recentProjects,
  enables,
  skillsById,
  linkMode,
  busy,
  onLinkModeChange,
  onPickProject,
  onSelectRecent,
  onRemoveRecent,
  onClearRecent,
  onClearProject,
  onOpenProject,
  onRemoveSkill,
  onSelectSkill,
  selectedSkillId,
}: Props) {
  const t = useT();

  if (!projectPath) {
    return (
      <div className="detail project-workspace">
        <div className="project-empty">
          <h2>{t("project.emptyTitle")}</h2>
          <p className="muted project-empty-hint">
            <span>{t("project.emptyHintLine1")}</span>
            <span>{t("project.emptyHintLine2")}</span>
          </p>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={onPickProject}
          >
            {t("project.choose")}
          </button>
          {recentProjects.length > 0 ? (
            <div className="project-recent">
              <div className="project-recent-head">
                <div className="project-recent-label">{t("project.recent")}</div>
                <button
                  type="button"
                  className="project-recent-clear"
                  disabled={busy}
                  onClick={onClearRecent}
                >
                  {t("project.clearRecent")}
                </button>
              </div>
              <ul className="project-recent-list">
                {recentProjects.map((p) => (
                  <li key={p} className="project-recent-row">
                    <button
                      type="button"
                      className="project-recent-item"
                      disabled={busy}
                      title={p}
                      onClick={() => onSelectRecent(p)}
                    >
                      <span className="project-recent-name">{basename(p)}</span>
                      <span className="project-recent-path">{p}</span>
                    </button>
                    <button
                      type="button"
                      className="project-recent-remove"
                      disabled={busy}
                      title={t("project.removeRecent")}
                      aria-label={t("project.removeRecentNamed", {
                        name: basename(p),
                      })}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveRecent(p);
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const isCopy = (mode: LinkMode | string) =>
    mode === "copy" || mode === "Copy";

  return (
    <div className="detail project-workspace project-workspace--active">
      <header className="project-header">
        <div className="project-header-copy">
          <div className="project-kicker">{t("project.current")}</div>
          <h2 className="project-title" title={projectPath}>
            {basename(projectPath)}
          </h2>
          <p className="project-path" title={projectPath}>
            {projectPath}
          </p>
        </div>
        <div className="project-header-actions">
          <button
            type="button"
            className="btn project-action-btn"
            disabled={busy}
            onClick={onPickProject}
          >
            {t("project.change")}
          </button>
          <button
            type="button"
            className="btn project-action-btn"
            disabled={busy}
            onClick={onOpenProject}
          >
            {t("project.openFolder")}
          </button>
          <button
            type="button"
            className="btn project-action-btn"
            disabled={busy}
            onClick={onClearProject}
          >
            {t("project.clear")}
          </button>
        </div>
      </header>

      <div className="project-toolbar">
        <div className="project-mode-field">
          <span className="project-mode-label" id="project-link-mode-label">
            {t("project.linkMode")}
          </span>
          <div
            className="project-mode-segment"
            role="radiogroup"
            aria-labelledby="project-link-mode-label"
          >
            <button
              type="button"
              role="radio"
              aria-checked={linkMode === "symlink"}
              className={
                linkMode === "symlink"
                  ? "project-mode-seg is-active"
                  : "project-mode-seg"
              }
              disabled={busy}
              onClick={() => onLinkModeChange("symlink")}
            >
              {t("project.modeSymlinkShort")}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={linkMode === "copy"}
              className={
                linkMode === "copy"
                  ? "project-mode-seg is-active"
                  : "project-mode-seg"
              }
              disabled={busy}
              onClick={() => onLinkModeChange("copy")}
            >
              {t("project.modeCopyShort")}
            </button>
          </div>
        </div>
        <p className="project-hint">{t("project.clickHint")}</p>
      </div>

      <section className="project-skills" aria-label={t("project.enabledListAria")}>
        <div className="project-skills-head">
          <h3>{t("project.enabledTitle")}</h3>
          <span className="project-skills-count">{enables.length}</span>
        </div>
        {enables.length === 0 ? (
          <div className="project-skills-empty">
            <p className="muted">{t("project.enabledEmpty")}</p>
          </div>
        ) : (
          <ul className="project-skills-list">
            {enables.map((en) => {
              const skill = skillsById.get(en.skillId);
              const name = skill?.name ?? en.skillId;
              const active = selectedSkillId === en.skillId;
              const copy = isCopy(en.mode);
              return (
                <li
                  key={`${en.skillId}:${en.projectPath}`}
                  className={active ? "is-active" : undefined}
                >
                  <button
                    type="button"
                    className="project-skill-row"
                    onClick={() => onSelectSkill(en.skillId)}
                  >
                    <span className="project-skill-name" title={name}>
                      {name}
                    </span>
                    {copy ? (
                      <span className="project-skill-badge">
                        {t("project.modeCopyShort")}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="project-skill-remove"
                    title={t("project.remove")}
                    aria-label={t("project.removeNamed", { name })}
                    disabled={busy}
                    onClick={() => onRemoveSkill(en.skillId)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
