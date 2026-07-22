import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n/context";
import { gitUriToBrowserUrl, groupGitUri } from "../lib/gitUrl";
import type {
  GitRepoUpdateStatus,
  LibraryTab,
  SkillGroup,
  SkillListItem,
} from "../lib/types";
import { ArchiveIcon, StarIcon, UnarchiveIcon } from "./Icons";

interface Props {
  groups: SkillGroup[];
  selectedId: string | null;
  tab: LibraryTab;
  isCollapsed: (key: string) => boolean;
  isFavorite: (id: string) => boolean;
  gitUpdates?: Record<string, GitRepoUpdateStatus>;
  /** Repo keys currently checking/updating (`__all__` = bulk check). */
  busyRepoKeys?: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  onSelect: (id: string) => void;
  onQuickToggleActive: (skill: SkillListItem) => void;
  onToggleFavorite: (skill: SkillListItem) => void;
  onDeleteGroup: (repoKey: string, label: string, count: number) => void;
  onCheckRepoUpdate?: (repoKey: string) => void;
  onUpdateRepo?: (repoKey: string) => void;
  onOpenRepoInBrowser?: (url: string) => void;
}

function isGitGroup(g: SkillGroup): boolean {
  return g.items.some((s) => {
    const ty = String(s.source?.type ?? "").toLowerCase();
    return ty === "git";
  });
}

interface CtxMenu {
  x: number;
  y: number;
  group: SkillGroup;
  browserUrl: string | null;
}

export function SkillList({
  groups,
  selectedId,
  tab,
  isCollapsed,
  isFavorite,
  gitUpdates = {},
  busyRepoKeys = new Set(),
  onToggleGroup,
  onSelect,
  onQuickToggleActive,
  onToggleFavorite,
  onDeleteGroup,
  onCheckRepoUpdate,
  onUpdateRepo,
  onOpenRepoInBrowser,
}: Props) {
  const t = useT();
  const [ctx, setCtx] = useState<CtxMenu | null>(null);

  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // Delay so the opening contextmenu event does not immediately dismiss
    const tmr = window.setTimeout(() => {
      window.addEventListener("click", close);
      window.addEventListener("scroll", close, true);
      window.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(tmr);
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [ctx]);

  if (groups.length === 0) {
    const empty =
      tab === "favorites"
        ? t("list.emptyFavorites")
        : tab === "disabled"
          ? t("list.emptyDisabled")
          : t("list.emptyAll");
    return (
      <div className="sidebar-list-area">
        <p className="empty" style={{ padding: "8px 14px" }}>
          {empty}
        </p>
      </div>
    );
  }

  const isDisabledTab = tab === "disabled";

  const openContextMenu = (e: React.MouseEvent, g: SkillGroup) => {
    e.preventDefault();
    e.stopPropagation();
    const uri = groupGitUri(g.items);
    const browserUrl = uri ? gitUriToBrowserUrl(uri) : null;
    // Keep menu inside viewport
    const pad = 8;
    const menuW = 180;
    const menuH = 140;
    let x = e.clientX;
    let y = e.clientY;
    if (x + menuW > window.innerWidth - pad) x = window.innerWidth - menuW - pad;
    if (y + menuH > window.innerHeight - pad) y = window.innerHeight - menuH - pad;
    setCtx({ x, y, group: g, browserUrl });
  };

  return (
    <div className="sidebar-list-area skill-list">
      {groups.map((g) => {
        const collapsed = isCollapsed(g.key);
        const git = isGitGroup(g);
        const status = gitUpdates[g.key];
        const busy =
          busyRepoKeys.has(g.key) || busyRepoKeys.has("__all__");
        const hasUpdate = Boolean(status?.updateAvailable);
        return (
          <div
            key={g.key}
            className={`skill-group${collapsed ? " collapsed" : ""}`}
          >
            <div
              className="skill-group-header"
              onContextMenu={(e) => openContextMenu(e, g)}
            >
              <button
                type="button"
                className="skill-group-toggle"
                onClick={() => onToggleGroup(g.key)}
                aria-expanded={!collapsed}
              >
                <span className="chevron" aria-hidden />
                <span className="repo-name" title={g.label}>
                  {g.label}
                </span>
                {hasUpdate ? (
                  <span className="repo-update-badge">
                    {t("repo.updateAvailable")}
                  </span>
                ) : null}
              </button>
              <div className="skill-group-trailing">
                {git && hasUpdate && onUpdateRepo ? (
                  <div className="repo-actions has-update">
                    <button
                      type="button"
                      className="btn-quick btn-quick-repo"
                      title={t("repo.update")}
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateRepo(g.key);
                      }}
                    >
                      {busy ? "…" : "↓"}
                    </button>
                  </div>
                ) : null}
                <span className="count">{g.items.length}</span>
              </div>
            </div>
            <ul className="skill-group-body">
              {g.items.map((s) => {
                const fav = isFavorite(s.id);
                return (
                  <li
                    key={s.id}
                    className={selectedId === s.id ? "active" : undefined}
                    onClick={() => onSelect(s.id)}
                  >
                    <span className="name" title={s.name}>
                      {s.name}
                    </span>
                    {!isDisabledTab ? (
                      <button
                        type="button"
                        className={`btn-quick btn-quick-fav${fav ? " is-fav" : ""}`}
                        title={fav ? t("list.favRemove") : t("list.favAdd")}
                        aria-label={fav ? t("list.favRemove") : t("list.favAdd")}
                        aria-pressed={fav}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(s);
                        }}
                      >
                        <StarIcon filled={fav} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={
                        isDisabledTab
                          ? "btn-quick btn-quick-enable"
                          : "btn-quick btn-quick-disable"
                      }
                      title={
                        isDisabledTab ? t("common.enable") : t("common.disable")
                      }
                      aria-label={
                        isDisabledTab ? t("common.enable") : t("common.disable")
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickToggleActive(s);
                      }}
                    >
                      {isDisabledTab ? <UnarchiveIcon /> : <ArchiveIcon />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {ctx
        ? createPortal(
            <div
              className="ctx-menu"
              role="menu"
              style={{ left: ctx.x, top: ctx.y }}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            >
              {isGitGroup(ctx.group) && onCheckRepoUpdate ? (
                <button
                  type="button"
                  role="menuitem"
                  className="ctx-menu-item"
                  disabled={
                    busyRepoKeys.has(ctx.group.key) ||
                    busyRepoKeys.has("__all__")
                  }
                  onClick={() => {
                    const key = ctx.group.key;
                    setCtx(null);
                    onCheckRepoUpdate(key);
                  }}
                >
                  {t("repo.checkUpdate")}
                </button>
              ) : null}
              {isGitGroup(ctx.group) &&
              gitUpdates[ctx.group.key]?.updateAvailable &&
              onUpdateRepo ? (
                <button
                  type="button"
                  role="menuitem"
                  className="ctx-menu-item"
                  disabled={busyRepoKeys.has(ctx.group.key)}
                  onClick={() => {
                    const key = ctx.group.key;
                    setCtx(null);
                    onUpdateRepo(key);
                  }}
                >
                  {t("repo.update")}
                </button>
              ) : null}
              {ctx.browserUrl && onOpenRepoInBrowser ? (
                <button
                  type="button"
                  role="menuitem"
                  className="ctx-menu-item"
                  onClick={() => {
                    onOpenRepoInBrowser(ctx.browserUrl!);
                    setCtx(null);
                  }}
                >
                  {t("repo.viewRepo")}
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="ctx-menu-item ctx-menu-item--danger"
                onClick={() => {
                  const g = ctx.group;
                  setCtx(null);
                  // Defer so the menu unmounts before the confirm dialog opens
                  window.setTimeout(() => {
                    onDeleteGroup(g.key, g.label, g.items.length);
                  }, 0);
                }}
              >
                {t("repo.deleteRepo")}
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
