import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import logoUrl from "./assets/logo.png";
import { CreateModal } from "./components/CreateModal";
import { EnableModal } from "./components/EnableModal";
import {
  CollapseAllIcon,
  ExpandAllIcon,
  RefreshIcon,
  SettingsIcon,
} from "./components/Icons";
import { ImportModal } from "./components/ImportModal";
import { SettingsView } from "./components/SettingsView";
import { SkillDetailPanel } from "./components/SkillDetail";
import { SkillList } from "./components/SkillList";
import { Toast, type ToastState } from "./components/Toast";
import { WindowControls } from "./components/WindowControls";
import { useCollapsedGroups } from "./hooks/useCollapsedGroups";
import { useFavorites } from "./hooks/useFavorites";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useTheme } from "./hooks/useTheme";
import { useI18n } from "./i18n/context";
import { ask } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, errMsg } from "./lib/api";
import { groupByRepo } from "./lib/skills";
import type {
  AppState,
  GitRepoUpdateStatus,
  ImportResult,
  LibraryTab,
  LinkMode,
  SkillDetail,
  SkillListItem,
  ViewName,
} from "./lib/types";

export function App() {
  const { t } = useI18n();
  const [view, setView] = useState<ViewName>("library");
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("all");
  const [appState, setAppState] = useState<AppState | null>(null);
  const [activeSkills, setActiveSkills] = useState<SkillListItem[]>([]);
  const [inactiveSkills, setInactiveSkills] = useState<SkillListItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [enableOpen, setEnableOpen] = useState(false);
  const [enableBusy, setEnableBusy] = useState(false);
  const [enableScope, setEnableScope] = useState<"single" | "favorites">("single");

  const [vaultPathDraft, setVaultPathDraft] = useState("");
  const [vaultSaveBusy, setVaultSaveBusy] = useState(false);
  const [gitUpdates, setGitUpdates] = useState<
    Record<string, GitRepoUpdateStatus>
  >({});
  /** Keys of repos currently checking/updating; `__all__` = bulk check. Multiple keys OK. */
  const [busyRepoKeys, setBusyRepoKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  /** Sync mirror for re-entrant guards (state alone can be stale across rapid clicks). */
  const busyRepoKeysRef = useRef<Set<string>>(new Set());

  const tryMarkRepoBusy = useCallback((key: string): boolean => {
    if (busyRepoKeysRef.current.has(key)) return false;
    busyRepoKeysRef.current.add(key);
    setBusyRepoKeys(new Set(busyRepoKeysRef.current));
    return true;
  }, []);

  const clearRepoBusy = useCallback((key: string) => {
    if (!busyRepoKeysRef.current.has(key)) return;
    busyRepoKeysRef.current.delete(key);
    setBusyRepoKeys(new Set(busyRepoKeysRef.current));
  }, []);

  const { onPointerDown, onDoubleClick } = useSidebarResize();
  const {
    isCollapsed,
    toggle: toggleGroup,
    expandAll,
    collapseAll,
  } = useCollapsedGroups();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { preference: themePreference, setPreference: setThemePreference } =
    useTheme();

  const showToast = useCallback((message: string, kind: ToastState["kind"] = "ok") => {
    setToast({ message, kind });
  }, []);

  const refreshState = useCallback(async () => {
    const s = await api.getAppState();
    setAppState(s);
    setVaultPathDraft(s.vaultPath);
    return s;
  }, []);

  const refreshLists = useCallback(async () => {
    const [active, inactive] = await Promise.all([
      api.listSkills("active"),
      api.listSkills("inactive"),
    ]);
    setActiveSkills(active);
    setInactiveSkills(inactive);
    return { active, inactive };
  }, []);

  /** Auto-save vault path when draft differs from current (blur / browse). */
  const commitVaultPath = useCallback(
    async (rawPath: string) => {
      const next = rawPath.trim();
      if (!next) {
        // Restore last known path if user cleared the field.
        if (appState?.vaultPath) setVaultPathDraft(appState.vaultPath);
        return;
      }
      if (next === (appState?.vaultPath ?? "")) return;
      if (vaultSaveBusy) return;

      const ok = await ask(t("settings.confirmChangePath", { path: next }), {
        title: t("settings.dataPath"),
        kind: "warning",
        okLabel: t("common.confirm"),
        cancelLabel: t("common.cancel"),
      });
      if (!ok) {
        setVaultPathDraft(appState?.vaultPath ?? next);
        return;
      }

      setVaultSaveBusy(true);
      try {
        const s = await api.setVaultPath(next);
        setAppState(s);
        setVaultPathDraft(s.vaultPath);
        await refreshLists();
        setSelectedId(null);
        setDetail(null);
        showToast(t("settings.pathChanged", { path: s.vaultPath }));
      } catch (e) {
        showToast(errMsg(e), "error");
        if (appState?.vaultPath) setVaultPathDraft(appState.vaultPath);
      } finally {
        setVaultSaveBusy(false);
      }
    },
    [appState, vaultSaveBusy, t, refreshLists, showToast],
  );

  const skillsForTab = useCallback(
    (
      tab: LibraryTab,
      active: SkillListItem[],
      inactive: SkillListItem[],
    ): SkillListItem[] => {
      if (tab === "disabled") return inactive;
      if (tab === "favorites") return active.filter((s) => isFavorite(s.id));
      return active;
    },
    [isFavorite],
  );

  const loadDetail = useCallback(
    async (id: string | null) => {
      if (!id) {
        setDetail(null);
        return;
      }
      try {
        const d = await api.getSkill(id);
        setDetail(d);
      } catch (e) {
        setDetail(null);
        showToast(errMsg(e), "error");
      }
    },
    [showToast],
  );

  const bootstrap = useCallback(async () => {
    try {
      await refreshState();
      const { active, inactive } = await refreshLists();
      const list = skillsForTab("all", active, inactive);
      if (list.length && !selectedId) {
        setSelectedId(list[0].id);
        await loadDetail(list[0].id);
      } else if (selectedId) {
        await loadDetail(selectedId);
      }
    } catch (e) {
      showToast(errMsg(e), "error");
    }
  }, [refreshState, refreshLists, skillsForTab, selectedId, loadDetail, showToast]);

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  const visibleSkills = useMemo(
    () => skillsForTab(libraryTab, activeSkills, inactiveSkills),
    [skillsForTab, libraryTab, activeSkills, inactiveSkills],
  );

  const listGroups = useMemo(
    () => groupByRepo(visibleSkills, search),
    [visibleSkills, search],
  );

  const favoriteCount = useMemo(
    () => activeSkills.filter((s) => isFavorite(s.id)).length,
    [activeSkills, isFavorite],
  );

  const goView = async (v: ViewName) => {
    setView(v);
    if (v === "library") {
      try {
        await refreshState();
        const { active, inactive } = await refreshLists();
        const list = skillsForTab(libraryTab, active, inactive);
        const still =
          selectedId && list.some((s) => s.id === selectedId)
            ? selectedId
            : list[0]?.id ?? null;
        setSelectedId(still);
        await loadDetail(still);
      } catch (e) {
        showToast(errMsg(e), "error");
      }
    } else if (v === "settings") {
      try {
        await refreshState();
      } catch (e) {
        showToast(errMsg(e), "error");
      }
    }
  };

  const switchLibraryTab = async (tab: LibraryTab) => {
    setLibraryTab(tab);
    setSearch("");
    try {
      const { active, inactive } = await refreshLists();
      const list = skillsForTab(tab, active, inactive);
      const still =
        selectedId && list.some((s) => s.id === selectedId)
          ? selectedId
          : list[0]?.id ?? null;
      setSelectedId(still);
      await loadDetail(still);
    } catch (e) {
      showToast(errMsg(e), "error");
    }
  };

  const selectSkill = async (id: string) => {
    setSelectedId(id);
    await loadDetail(id);
  };

  const afterMutation = async (preferId?: string | null) => {
    await refreshState();
    const { active, inactive } = await refreshLists();
    const list = skillsForTab(libraryTab, active, inactive);
    let next = preferId ?? selectedId;
    if (next && !list.some((s) => s.id === next)) {
      next = list[0]?.id ?? null;
    }
    if (!next) next = list[0]?.id ?? null;
    setSelectedId(next);
    await loadDetail(next);
  };

  const onToggleFavorite = (skill: SkillListItem) => {
    const was = isFavorite(skill.id);
    toggleFavorite(skill.id);
    showToast(
      was
        ? t("toast.favRemoved", { name: skill.name })
        : t("toast.favAdded", { name: skill.name }),
      was ? "warn" : "ok",
    );
  };

  const onQuickToggleActive = async (skill: SkillListItem) => {
    try {
      await api.setSkillActive(skill.id, !skill.active);
      showToast(
        skill.active
          ? t("toast.disabledNamed", { name: skill.name })
          : t("toast.enabledNamed", { name: skill.name }),
      );
      await afterMutation(skill.id);
    } catch (e) {
      showToast(errMsg(e), "error");
    }
  };

  const onDeleteGroup = async (
    repoKey: string,
    label: string,
    count: number,
  ) => {
    // Use native dialog — window.confirm is unreliable in Tauri WebView,
    // especially right after a context-menu click.
    const ok = await ask(t("confirm.deleteGroup", { label, count }), {
      title: t("confirm.deleteGroupTitle"),
      kind: "warning",
      okLabel: t("repo.deleteRepo"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    try {
      const n = await api.deleteSkillsByRepo(repoKey, true);
      showToast(t("toast.deletedCount", { count: n }));
      await afterMutation(null);
    } catch (e) {
      showToast(errMsg(e), "error");
    }
  };

  const onDeleteSkill = async () => {
    if (!detail) return;
    if (
      !window.confirm(
        t("confirm.deleteSkill", { name: detail.entry.name }),
      )
    ) {
      return;
    }
    try {
      await api.deleteSkill(detail.entry.id, true);
      showToast(t("toast.deletedNamed", { name: detail.entry.name }));
      await afterMutation(null);
    } catch (e) {
      showToast(errMsg(e), "error");
    }
  };

  const onToggleActiveDetail = async () => {
    if (!detail) return;
    try {
      const next = !detail.entry.active;
      await api.setSkillActive(detail.entry.id, next);
      showToast(next ? t("toast.enabled") : t("toast.disabled"));
      await afterMutation(detail.entry.id);
    } catch (e) {
      showToast(errMsg(e), "error");
    }
  };

  const onDisableProject = async (projectPath: string) => {
    if (!detail) return;
    try {
      await api.disableSkill(detail.entry.id, projectPath);
      showToast(t("toast.uninstalled"));
      await loadDetail(detail.entry.id);
      await refreshState();
    } catch (e) {
      showToast(errMsg(e), "error");
    }
  };

  const onCreate = async (data: {
    name: string;
    description: string;
    body: string;
  }) => {
    if (!data.name) {
      showToast(t("toast.needName"), "error");
      return;
    }
    setBusy(true);
    try {
      const entry = await api.createSkill({
        name: data.name,
        description: data.description,
        body: data.body || null,
      });
      showToast(t("toast.created", { name: entry.name }));
      setCreateOpen(false);
      setLibraryTab("all");
      setView("library");
      setSelectedId(entry.id);
      await afterMutation(entry.id);
    } catch (e) {
      showToast(errMsg(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const formatImportResult = (
    res: ImportResult,
  ): { message: string; kind: ToastState["kind"] } => {
    const parts: string[] = [];
    if (res.imported.length > 0) {
      parts.push(t("toast.importCount", { count: res.imported.length }));
    }
    if (res.overwritten?.length > 0) {
      parts.push(t("toast.overwriteCount", { count: res.overwritten.length }));
    }
    if (res.skipped.length > 0) {
      const sep = t("toast.listSep");
      const preview =
        res.skipped.length <= 3
          ? res.skipped.join(sep)
          : t("toast.andMore", {
              names: res.skipped.slice(0, 3).join(sep),
              count: res.skipped.length,
            });
      parts.push(t("toast.skipPreview", { preview }));
    }
    const message = parts.join(t("toast.joinSep")) || t("toast.noChange");
    const changed =
      res.imported.length > 0 || (res.overwritten?.length ?? 0) > 0;
    if (changed && res.skipped.length > 0) return { message, kind: "warn" };
    if (changed) return { message, kind: "ok" };
    if (res.skipped.length > 0) return { message, kind: "warn" };
    return { message, kind: "warn" };
  };

  const applyImportResult = async (res: ImportResult) => {
    const r = formatImportResult(res);
    showToast(r.message, r.kind);
    setImportOpen(false);
    const first =
      res.imported[0]?.id ?? res.overwritten?.[0]?.id ?? null;
    if (first) {
      setLibraryTab("all");
      setView("library");
      setSelectedId(first);
      await afterMutation(first);
    } else {
      await refreshLists();
      await refreshState();
    }
  };

  const onImportFolder = async (
    folderPath: string,
    overwriteNames: string[] = [],
  ) => {
    if (!folderPath) {
      showToast(t("toast.needFolder"), "error");
      return;
    }
    setBusy(true);
    try {
      const res = await api.importFolder(folderPath, overwriteNames);
      await applyImportResult(res);
    } catch (e) {
      showToast(errMsg(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const onImportGit = async (
    repoUrl: string,
    overwriteNames: string[] = [],
  ) => {
    if (!repoUrl) {
      showToast(t("toast.needGitUrl"), "error");
      return;
    }
    setBusy(true);
    try {
      const res = await api.importGit(repoUrl, [], overwriteNames);
      await applyImportResult(res);
    } catch (e) {
      showToast(errMsg(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const onCheckRepoUpdate = async (repoKey: string) => {
    if (
      busyRepoKeysRef.current.has(repoKey) ||
      busyRepoKeysRef.current.has("__all__")
    ) {
      return;
    }
    if (!tryMarkRepoBusy(repoKey)) return;
    try {
      const status = await api.checkGitRepoUpdate(repoKey);
      setGitUpdates((prev) => ({ ...prev, [repoKey]: status }));
      // Status is reflected on the group UI; only surface hard failures.
      if (status.error) {
        showToast(status.error, "error");
      }
    } catch (e) {
      showToast(errMsg(e), "error");
    } finally {
      clearRepoBusy(repoKey);
    }
  };

  const onCheckAllRepoUpdates = async () => {
    if (!tryMarkRepoBusy("__all__")) return;
    try {
      const statuses = await api.checkAllGitRepoUpdates();
      setGitUpdates((prev) => {
        const next = { ...prev };
        for (const s of statuses) {
          next[s.key] = s;
        }
        return next;
      });
      // Results show as badges / update buttons; toast only on failures.
      const failed = statuses.filter((s) => Boolean(s.error));
      if (failed.length > 0) {
        const first = failed[0]?.error ?? t("repo.checkFailed");
        showToast(
          failed.length === 1
            ? first
            : t("toast.checkAllPartial", {
                total: statuses.length,
                updates: statuses.filter((s) => s.updateAvailable).length,
                errors: failed.length,
              }),
          "error",
        );
      }
    } catch (e) {
      showToast(errMsg(e), "error");
    } finally {
      clearRepoBusy("__all__");
    }
  };

  const onUpdateRepo = async (repoKey: string) => {
    // Only block the same repo; other repos can update / download in parallel.
    if (busyRepoKeysRef.current.has(repoKey)) return;
    // Native async dialog — window.confirm is unreliable in Tauri WebView,
    // especially after a context-menu click (same as delete group).
    const ok = await ask(t("confirm.updateRepo"), {
      title: t("confirm.updateRepoTitle"),
      kind: "info",
      okLabel: t("repo.update"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    if (!tryMarkRepoBusy(repoKey)) return;
    showToast(t("repo.updating"), "warn");
    try {
      const res = await api.updateGitRepo(repoKey, true);
      const r = formatImportResult(res);
      showToast(t("toast.repoUpdated", { parts: r.message }), r.kind);
      setGitUpdates((prev) => {
        const next = { ...prev };
        if (next[repoKey]) {
          next[repoKey] = {
            ...next[repoKey],
            updateAvailable: false,
            localCommit: next[repoKey].remoteCommit,
          };
        }
        return next;
      });
      await afterMutation(selectedId);
    } catch (e) {
      showToast(errMsg(e), "error");
    } finally {
      clearRepoBusy(repoKey);
    }
  };

  const onConfirmEnable = async (projectPath: string, mode: LinkMode) => {
    setEnableBusy(true);
    try {
      if (enableScope === "favorites") {
        const list = activeSkills.filter((s) => isFavorite(s.id));
        if (list.length === 0) {
          showToast(t("toast.favoritesEmpty"), "error");
          return;
        }
        let ok = 0;
        let skipped = 0;
        const failures: string[] = [];
        for (const s of list) {
          try {
            await api.enableSkill(s.id, projectPath, mode);
            ok += 1;
          } catch (e) {
            const msg = errMsg(e);
            if (
              msg.includes("already enabled") ||
              msg.includes("already exists") ||
              msg.includes("Target already exists") ||
              msg.includes("已启用")
            ) {
              skipped += 1;
            } else {
              failures.push(`${s.name}: ${msg}`);
            }
          }
        }
        const partSep = t("toast.batchPartSep");
        const parts = [t("toast.batchOk", { count: ok })];
        if (skipped > 0) parts.push(t("toast.batchSkip", { count: skipped }));
        if (failures.length > 0) {
          parts.push(t("toast.batchFail", { count: failures.length }));
          showToast(
            `${parts.join(partSep)}. ${failures[0]}`,
            ok > 0 ? "warn" : "error",
          );
        } else if (skipped > 0 && ok === 0) {
          showToast(t("toast.batchFavOnly", { parts: parts.join(partSep) }), "warn");
        } else if (skipped > 0) {
          showToast(t("toast.batchFavDone", { parts: parts.join(partSep) }), "warn");
        } else {
          showToast(t("toast.batchFavDone", { parts: parts.join(partSep) }), "ok");
        }
        setEnableOpen(false);
        if (selectedId) await loadDetail(selectedId);
        await refreshState();
        return;
      }

      if (!detail) return;
      await api.enableSkill(detail.entry.id, projectPath, mode);
      showToast(t("toast.enabledTo", { path: projectPath }));
      setEnableOpen(false);
      await loadDetail(detail.entry.id);
      await refreshState();
    } catch (e) {
      showToast(errMsg(e), "error");
    } finally {
      setEnableBusy(false);
    }
  };

  const defaultMode: LinkMode = appState?.defaultLinkMode ?? "symlink";
  const inactiveCount = appState?.inactiveCount ?? inactiveSkills.length;
  const activeCount = appState?.activeCount ?? activeSkills.length;

  const hasGitRepos = useMemo(() => {
    const all = [...activeSkills, ...inactiveSkills];
    return all.some((s) => String(s.source?.type ?? "").toLowerCase() === "git");
  }, [activeSkills, inactiveSkills]);

  const detailForTab = (() => {
    if (!detail || !selectedId) return null;
    if (libraryTab === "disabled") {
      return !detail.entry.active ? detail : null;
    }
    return detail.entry.active ? detail : null;
  })();

  const emptyCopy =
    libraryTab === "disabled"
      ? {
          title: t("library.emptyDisabledTitle"),
          hint: t("library.emptyDisabledHint"),
        }
      : libraryTab === "favorites"
        ? {
            title: t("library.emptyFavoritesTitle"),
            hint: t("library.emptyFavoritesHint"),
          }
        : {
            title: t("library.emptyAllTitle"),
            hint: t("library.emptyAllHint"),
          };

  return (
    <div id="app">
      <header className="topbar" data-tauri-drag-region>
        <div className="brand" data-tauri-drag-region>
          <img
            className="brand-mark"
            src={logoUrl}
            width={28}
            height={28}
            alt=""
            draggable={false}
          />
          <div data-tauri-drag-region>
            <h1 data-tauri-drag-region>SkillsBox</h1>
            <p className="subtitle" data-tauri-drag-region>
              {t("app.subtitle")}
            </p>
          </div>
        </div>
        <div className="top-actions">
          <WindowControls />
        </div>
      </header>

      {view === "library" ? (
        <section className="view view-split" id="view-library">
          <aside className="sidebar">
            <div
              className="sidebar-tabs"
              role="tablist"
              aria-label={t("library.tabListAria")}
            >
              <button
                type="button"
                role="tab"
                className={`sidebar-tab${libraryTab === "all" ? " active" : ""}`}
                aria-selected={libraryTab === "all"}
                onClick={() => void switchLibraryTab("all")}
              >
                {t("library.tabAll")}
                <span className="tab-count">{activeCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                className={`sidebar-tab${libraryTab === "favorites" ? " active" : ""}`}
                aria-selected={libraryTab === "favorites"}
                onClick={() => void switchLibraryTab("favorites")}
              >
                {t("library.tabFavorites")}
                <span className="tab-count">{favoriteCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                className={`sidebar-tab${libraryTab === "disabled" ? " active" : ""}`}
                aria-selected={libraryTab === "disabled"}
                onClick={() => void switchLibraryTab("disabled")}
              >
                {t("library.tabDisabled")}
                <span className="tab-count">{inactiveCount}</span>
              </button>
            </div>
            <input
              className="sidebar-search"
              type="search"
              placeholder={t("library.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t("library.searchAria")}
            />
            {listGroups.length > 0 || hasGitRepos ? (
              <div className="sidebar-list-toolbar">
                {listGroups.length > 0 ? (
                  <button
                    type="button"
                    className="btn-ghost-icon"
                    title={
                      listGroups.every((g) => isCollapsed(g.key))
                        ? t("list.expandAll")
                        : t("list.collapseAll")
                    }
                    aria-label={
                      listGroups.every((g) => isCollapsed(g.key))
                        ? t("list.expandAll")
                        : t("list.collapseAll")
                    }
                    onClick={() => {
                      if (listGroups.every((g) => isCollapsed(g.key))) {
                        expandAll();
                      } else {
                        collapseAll(listGroups.map((g) => g.key));
                      }
                    }}
                  >
                    {listGroups.every((g) => isCollapsed(g.key)) ? (
                      <ExpandAllIcon />
                    ) : (
                      <CollapseAllIcon />
                    )}
                  </button>
                ) : null}
                {hasGitRepos ? (
                  <button
                    type="button"
                    className={`btn-ghost-icon${
                      busyRepoKeys.has("__all__") ? " is-spinning" : ""
                    }`}
                    disabled={busyRepoKeys.has("__all__")}
                    title={
                      busyRepoKeys.has("__all__")
                        ? t("repo.checkingAll")
                        : t("repo.checkAllUpdatesTitle")
                    }
                    aria-label={
                      busyRepoKeys.has("__all__")
                        ? t("repo.checkingAll")
                        : t("repo.checkAllUpdatesTitle")
                    }
                    onClick={() => void onCheckAllRepoUpdates()}
                  >
                    <RefreshIcon />
                  </button>
                ) : null}
              </div>
            ) : null}
            {libraryTab === "favorites" ? (
              <div className="sidebar-batch">
                <button
                  type="button"
                  className="btn primary"
                  disabled={favoriteCount === 0}
                  title={
                    favoriteCount === 0
                      ? t("library.enableFavoritesEmptyTitle")
                      : t("library.enableFavoritesTitle", {
                          count: favoriteCount,
                        })
                  }
                  onClick={() => {
                    setEnableScope("favorites");
                    setEnableOpen(true);
                  }}
                >
                  {t("library.enableFavorites")}
                  {favoriteCount > 0 ? (
                    <span className="nav-badge">{favoriteCount}</span>
                  ) : null}
                </button>
              </div>
            ) : null}
            <SkillList
              groups={listGroups}
              selectedId={selectedId}
              tab={libraryTab}
              isCollapsed={isCollapsed}
              isFavorite={isFavorite}
              gitUpdates={gitUpdates}
              busyRepoKeys={busyRepoKeys}
              onToggleGroup={toggleGroup}
              onSelect={(id) => void selectSkill(id)}
              onQuickToggleActive={(s) => void onQuickToggleActive(s)}
              onToggleFavorite={onToggleFavorite}
              onDeleteGroup={(k, l, c) => void onDeleteGroup(k, l, c)}
              onCheckRepoUpdate={(k) => void onCheckRepoUpdate(k)}
              onUpdateRepo={(k) => void onUpdateRepo(k)}
              onOpenRepoInBrowser={(url) => {
                void openUrl(url).catch((e) => showToast(errMsg(e), "error"));
              }}
            />
            <div className="sidebar-footer">
              <div className="sidebar-footer-left">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setCreateOpen(true)}
                >
                  {t("library.create")}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setImportOpen(true)}
                >
                  {t("library.import")}
                </button>
              </div>
              <button
                type="button"
                className="btn btn-icon"
                title={t("common.settings")}
                aria-label={t("common.settings")}
                onClick={() => void goView("settings")}
              >
                <SettingsIcon />
              </button>
            </div>
          </aside>
          <div className="detail-pane">
            <div
              className="sidebar-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label={t("library.resizeSidebar")}
              onPointerDown={onPointerDown}
              onDoubleClick={onDoubleClick}
            />
            <SkillDetailPanel
              detail={detailForTab}
              emptyTitle={emptyCopy.title}
              emptyHint={emptyCopy.hint}
              onEnable={() => {
                setEnableScope("single");
                setEnableOpen(true);
              }}
              onDisableProject={(p) => void onDisableProject(p)}
              onToggleActive={() => void onToggleActiveDetail()}
              onDelete={() => void onDeleteSkill()}
              onOpenPath={() => {
                if (detail)
                  void api
                    .openPath(detail.absolutePath)
                    .catch((e) => showToast(errMsg(e), "error"));
              }}
            />
          </div>
        </section>
      ) : null}

      {view === "settings" ? (
        <SettingsView
          appState={appState}
          vaultPathDraft={vaultPathDraft}
          vaultSaveBusy={vaultSaveBusy}
          themePreference={themePreference}
          onThemePreferenceChange={setThemePreference}
          onVaultPathDraftChange={setVaultPathDraft}
          onBack={() => void goView("library")}
          onPickVaultFolder={async () => {
            try {
              const p = await api.pickFolder(t("settings.pickVaultTitle"));
              if (!p) return;
              setVaultPathDraft(p);
              await commitVaultPath(p);
            } catch (e) {
              showToast(errMsg(e), "error");
            }
          }}
          onCommitVaultPath={() => {
            void commitVaultPath(vaultPathDraft);
          }}
          onResetVaultPath={() => {
            void (async () => {
              const ok = await ask(
                t("settings.confirmResetPath", {
                  path: appState?.defaultVaultPath ?? "~/.skillsbox",
                }),
                {
                  title: t("settings.resetPath"),
                  kind: "warning",
                  okLabel: t("settings.resetPath"),
                  cancelLabel: t("common.cancel"),
                },
              );
              if (!ok) return;
              setVaultSaveBusy(true);
              try {
                const s = await api.setVaultPath("");
                setAppState(s);
                setVaultPathDraft(s.vaultPath);
                await refreshLists();
                setSelectedId(null);
                setDetail(null);
                showToast(t("settings.pathReset"));
              } catch (e) {
                showToast(errMsg(e), "error");
              } finally {
                setVaultSaveBusy(false);
              }
            })();
          }}
          onOpenVaultInFinder={() => {
            if (appState?.vaultPath) {
              void api
                .openPath(appState.vaultPath)
                .catch((e) => showToast(errMsg(e), "error"));
            }
          }}
          onError={(msg) => showToast(msg, "error")}
        />
      ) : null}

      <CreateModal
        open={createOpen}
        busy={busy && createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        onSubmit={(data) => void onCreate(data)}
      />

      <ImportModal
        open={importOpen}
        busy={busy && importOpen}
        onClose={() => !busy && setImportOpen(false)}
        onPickFolder={async () => {
          try {
            return await api.pickFolder(t("import.pickFolder"));
          } catch (e) {
            showToast(errMsg(e), "error");
            return null;
          }
        }}
        onPreviewFolder={async (path) => {
          try {
            return await api.previewImportFolder(path);
          } catch (e) {
            showToast(errMsg(e), "error");
            throw e;
          }
        }}
        onPreviewGit={async (url) => {
          try {
            return await api.previewImportGit(url);
          } catch (e) {
            showToast(errMsg(e), "error");
            throw e;
          }
        }}
        onImportFolder={(path, overwrite) =>
          void onImportFolder(path, overwrite)
        }
        onImportGit={(url, overwrite) => void onImportGit(url, overwrite)}
      />

      <EnableModal
        open={enableOpen}
        subjectLabel={
          enableScope === "favorites"
            ? t("enable.subjectBatch", { count: favoriteCount })
            : (detail?.entry.name ?? "")
        }
        description={
          enableScope === "favorites" ? (
            <>
              {t("enable.batchDescStart")} <strong>{t("enable.batchDescFav")}</strong>
              {t("enable.batchDescMid")}
              <strong>{favoriteCount}</strong>
              {t("enable.batchDescEnd")} <code>.agents/skills</code>
              {t("enable.batchDescSkip")}
            </>
          ) : undefined
        }
        defaultMode={defaultMode}
        busy={enableBusy}
        confirmLabel={
          enableScope === "favorites"
            ? t("enable.confirmBatch", { count: favoriteCount })
            : t("enable.confirmEnable")
        }
        onClose={() => !enableBusy && setEnableOpen(false)}
        onPickFolder={async () => {
          try {
            return await api.pickFolder(t("enable.pickProject"));
          } catch (e) {
            showToast(errMsg(e), "error");
            return null;
          }
        }}
        onConfirm={(path, mode) => void onConfirmEnable(path, mode)}
      />

      {createPortal(
        <Toast toast={toast} onClear={() => setToast(null)} />,
        document.body,
      )}
    </div>
  );
}
