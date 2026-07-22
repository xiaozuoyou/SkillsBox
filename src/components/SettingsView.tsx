import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Update } from "@tauri-apps/plugin-updater";
import type { ThemePreference } from "../hooks/useTheme";
import { listRegisteredLocales, type LocalePreference } from "../i18n";
import { useI18n } from "../i18n/context";
import { APP_NAME, APP_VERSION, REPO_URL } from "../lib/constants";
import { checkForAppUpdate, installAppUpdate } from "../lib/updater";
import type { AppState } from "../lib/types";
import logoUrl from "../assets/logo.png";

export type SettingsSection = "general" | "about";

interface Props {
  appState: AppState | null;
  vaultPathDraft: string;
  vaultSaveBusy: boolean;
  themePreference: ThemePreference;
  onThemePreferenceChange: (v: ThemePreference) => void;
  onVaultPathDraftChange: (v: string) => void;
  onBack: () => void;
  onPickVaultFolder: () => Promise<void>;
  /** Commit draft path (auto-save on blur / after browse). */
  onCommitVaultPath: () => void;
  onResetVaultPath: () => void;
  onOpenVaultInFinder: () => void;
  onError: (msg: string) => void;
}

export function SettingsView({
  appState,
  vaultPathDraft,
  vaultSaveBusy,
  themePreference,
  onThemePreferenceChange,
  onVaultPathDraftChange,
  onBack,
  onPickVaultFolder,
  onCommitVaultPath,
  onResetVaultPath,
  onOpenVaultInFinder,
  onError,
}: Props) {
  const { t, preference: localePreference, setPreference: setLocalePreference } =
    useI18n();
  const [section, setSection] = useState<SettingsSection>("general");
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [updateStatusKind, setUpdateStatusKind] = useState<
    "idle" | "ok" | "info" | "error" | "progress"
  >("idle");
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);

  const onCheckAppUpdate = async () => {
    if (updateBusy) return;
    setUpdateBusy(true);
    setUpdateStatus(null);
    setUpdateStatusKind("idle");
    setPendingUpdate(null);
    setDownloadPct(null);
    try {
      const update = await checkForAppUpdate();
      if (!update) {
        setUpdateStatus(t("settings.updateUpToDate"));
        setUpdateStatusKind("ok");
        return;
      }
      setPendingUpdate(update);
      setUpdateStatus(
        t("settings.updateAvailable", {
          version: update.version,
          current: update.currentVersion,
        }),
      );
      setUpdateStatusKind("info");
    } catch (e) {
      // Surface via toast only — no in-card error banner below the actions.
      onError(typeof e === "string" ? e : e instanceof Error ? e.message : String(e));
      setUpdateStatus(null);
      setUpdateStatusKind("idle");
    } finally {
      setUpdateBusy(false);
    }
  };

  const onInstallAppUpdate = async () => {
    if (!pendingUpdate || updateBusy) return;
    setUpdateBusy(true);
    setDownloadPct(0);
    setUpdateStatus(t("settings.updateDownloading"));
    setUpdateStatusKind("progress");
    try {
      await installAppUpdate(pendingUpdate, ({ downloaded, total }) => {
        if (total && total > 0) {
          setDownloadPct(Math.min(100, Math.round((downloaded / total) * 100)));
        }
      });
      // relaunch exits the process; if we return, something unexpected happened
      setUpdateStatus(t("settings.updateInstalled"));
      setUpdateStatusKind("ok");
    } catch (e) {
      onError(typeof e === "string" ? e : e instanceof Error ? e.message : String(e));
      setUpdateStatus(null);
      setUpdateStatusKind("idle");
      setDownloadPct(null);
      setUpdateBusy(false);
    }
  };

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: "system", label: t("theme.system") },
    { value: "light", label: t("theme.light") },
    { value: "dark", label: t("theme.dark") },
  ];

  // Built from LOCALE_REGISTRY — new languages appear here automatically.
  const languageOptions: { value: LocalePreference; label: string }[] = [
    { value: "system", label: t("language.system") },
    ...listRegisteredLocales().map((loc) => ({
      value: loc.code as LocalePreference,
      label: loc.nativeName,
    })),
  ];

  return (
    <section className="view view-split view-settings" id="view-settings">
      <aside className="sidebar settings-sidebar">
        <div className="settings-nav-top">
          <button type="button" className="settings-back" onClick={onBack}>
            <svg
              className="settings-back-icon"
              viewBox="0 0 16 16"
              width="13"
              height="13"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 3.25 5.25 8 10 12.75" />
            </svg>
            <span>{t("settings.back")}</span>
          </button>
        </div>
        <nav className="settings-nav" aria-label={t("settings.navAria")}>
          <button
            type="button"
            className={`settings-nav-item${section === "general" ? " active" : ""}`}
            onClick={() => setSection("general")}
          >
            <svg
              className="settings-nav-icon"
              viewBox="0 0 16 16"
              width="15"
              height="15"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.45"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="8" cy="8" r="2" />
              <path d="M8 2.2v1.3M8 12.5v1.3M2.2 8h1.3M12.5 8h1.3M3.85 3.85l.92.92M11.23 11.23l.92.92M12.15 3.85l-.92.92M4.77 11.23l-.92.92" />
            </svg>
            <span>{t("settings.general")}</span>
          </button>
          <button
            type="button"
            className={`settings-nav-item${section === "about" ? " active" : ""}`}
            onClick={() => setSection("about")}
          >
            <svg
              className="settings-nav-icon"
              viewBox="0 0 16 16"
              width="15"
              height="15"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.45"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="8" cy="8" r="5.5" />
              <path d="M8 7.25v4" />
              <circle cx="8" cy="5.1" r="0.7" fill="currentColor" stroke="none" />
            </svg>
            <span>{t("settings.about")}</span>
          </button>
        </nav>
      </aside>
      <div className="detail settings-content">
        {section === "general" ? (
          <div className="settings-panel">
            <header className="settings-panel-header">
              <h2>{t("settings.general")}</h2>
            </header>

            <section className="settings-card" aria-label={t("settings.general")}>
              <div className="settings-row">
                <div className="settings-row-head">
                  <div className="settings-row-copy">
                    <div className="settings-row-title">{t("theme.label")}</div>
                    <span className="settings-field-hint">{t("theme.hint")}</span>
                  </div>
                  <div
                    className="theme-segment"
                    role="radiogroup"
                    aria-label={t("theme.aria")}
                  >
                    {themeOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={themePreference === opt.value}
                        className={`theme-segment-btn${
                          themePreference === opt.value ? " active" : ""
                        }`}
                        onClick={() => onThemePreferenceChange(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row-head">
                  <div className="settings-row-copy">
                    <div className="settings-row-title">{t("language.label")}</div>
                    <span className="settings-field-hint">{t("language.hint")}</span>
                  </div>
                  <div
                    className="theme-segment"
                    role="radiogroup"
                    aria-label={t("language.aria")}
                  >
                    {languageOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={localePreference === opt.value}
                        className={`theme-segment-btn${
                          localePreference === opt.value ? " active" : ""
                        }`}
                        onClick={() => setLocalePreference(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="settings-card" aria-label={t("settings.dataPath")}>
              <div className="settings-field">
                <div className="settings-row-title">{t("settings.dataPath")}</div>
                <span className="settings-field-hint">
                  {t("settings.dataPathHint")} <code>~/…</code>
                  {t("settings.dataPathTilde")}
                </span>
                <div className="settings-path-row">
                  <input
                    className="settings-path-input"
                    value={vaultPathDraft}
                    onChange={(e) => onVaultPathDraftChange(e.target.value)}
                    onBlur={() => onCommitVaultPath()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder={appState?.defaultVaultPath ?? "~/.skillsbox"}
                    spellCheck={false}
                    autoComplete="off"
                    disabled={vaultSaveBusy}
                  />
                  <button
                    type="button"
                    className="btn settings-card-btn"
                    disabled={vaultSaveBusy}
                    onClick={() => void onPickVaultFolder()}
                  >
                    {t("common.browse")}
                  </button>
                </div>
              </div>

              <p className="settings-stats">
                {t("settings.stats", {
                  total: appState?.skillCount ?? 0,
                  active: appState?.activeCount ?? 0,
                  inactive: appState?.inactiveCount ?? 0,
                  enables: appState?.enableCount ?? 0,
                })}
              </p>

              <div className="settings-card-actions">
                <button
                  type="button"
                  className="btn settings-card-btn"
                  disabled={
                    vaultSaveBusy ||
                    !appState ||
                    appState.vaultPath === appState.defaultVaultPath
                  }
                  onClick={onResetVaultPath}
                >
                  {t("settings.resetPath")}
                </button>
                <button
                  type="button"
                  className="btn settings-card-btn"
                  onClick={onOpenVaultInFinder}
                >
                  {t("settings.openInFinder")}
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="settings-panel settings-about">
            <header className="settings-panel-header">
              <h2>{t("settings.aboutTitle", { name: APP_NAME })}</h2>
            </header>

            <section className="settings-card">
              <div className="about-brand">
                <img
                  src={logoUrl}
                  width={52}
                  height={52}
                  alt=""
                  className="about-logo"
                />
                <div>
                  <p className="about-name">{APP_NAME}</p>
                  <p className="settings-field-hint">
                    {t("settings.version", { version: APP_VERSION })}
                  </p>
                </div>
              </div>
              <p className="settings-about-blurb">
                {t("settings.aboutBlurb")} <code>.agents/skills</code>.
              </p>
            </section>

            <section
              className="settings-card settings-card-update"
              aria-label={t("settings.updateSection")}
            >
              <div className="settings-update-block">
                <div className="settings-update-head">
                  <div className="settings-update-copy">
                    <div className="settings-row-title">
                      {t("settings.updateSection")}
                    </div>
                    <p className="settings-update-version">
                      {t("settings.version", { version: APP_VERSION })}
                      {pendingUpdate ? (
                        <span className="settings-update-version-new">
                          → {pendingUpdate.version}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="settings-update-toolbar">
                    <button
                      type="button"
                      className="btn settings-card-btn"
                      disabled={updateBusy}
                      onClick={() => void onCheckAppUpdate()}
                    >
                      {updateBusy && !pendingUpdate
                        ? t("settings.updateChecking")
                        : t("settings.checkUpdate")}
                    </button>
                    {pendingUpdate ? (
                      <button
                        type="button"
                        className="btn primary settings-card-btn"
                        disabled={updateBusy}
                        onClick={() => void onInstallAppUpdate()}
                      >
                        {updateBusy
                          ? downloadPct != null
                            ? t("settings.updateProgress", { pct: downloadPct })
                            : t("settings.updateDownloading")
                          : t("settings.installUpdate", {
                              version: pendingUpdate.version,
                            })}
                      </button>
                    ) : null}
                  </div>
                </div>

                {updateBusy && downloadPct != null ? (
                  <div
                    className="settings-update-progress"
                    role="progressbar"
                    aria-valuenow={downloadPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="settings-update-progress-bar"
                      style={{ width: `${downloadPct}%` }}
                    />
                  </div>
                ) : null}

                {updateStatus ? (
                  <div
                    className={`settings-update-status settings-update-status--${updateStatusKind}`}
                    role="status"
                  >
                    <span
                      className="settings-update-status-dot"
                      aria-hidden="true"
                    />
                    <div className="settings-update-status-body">
                      <p className="settings-update-status-msg">{updateStatus}</p>
                      {pendingUpdate?.body && updateStatusKind === "info" ? (
                        <p className="settings-update-notes">
                          {pendingUpdate.body}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="settings-card settings-card-open-source">
              <div className="settings-oss-block">
                <div className="settings-row-title">{t("settings.openSource")}</div>
                <p className="settings-field-hint">{t("settings.sourceAndIssues")}</p>
                <button
                  type="button"
                  className="settings-repo-link"
                  title={REPO_URL}
                  onClick={() => {
                    void openUrl(REPO_URL).catch((e) =>
                      onError(typeof e === "string" ? e : String(e)),
                    );
                  }}
                >
                  <span className="settings-repo-url">{REPO_URL}</span>
                  <svg
                    className="settings-repo-external"
                    viewBox="0 0 16 16"
                    width="13"
                    height="13"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6.5 3.5H3.75A1.25 1.25 0 0 0 2.5 4.75v7.5c0 .69.56 1.25 1.25 1.25h7.5c.69 0 1.25-.56 1.25-1.25V9.5" />
                    <path d="M9 2.5h4.5V7" />
                    <path d="M7.5 8.5 13.5 2.5" />
                  </svg>
                </button>
                <p className="settings-field-hint settings-oss-stack">
                  {t("settings.stackNote")}
                </p>
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
