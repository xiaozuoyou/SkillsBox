import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  AppState,
  GitRepoRecord,
  GitRepoUpdateStatus,
  EnableRecord,
  ImportPreview,
  ImportResult,
  LinkMode,
  SkillDetail,
  SkillEntry,
  SkillListFilter,
  SkillListItem,
} from "./types";

export function errMsg(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}

export const api = {
  getAppState: () => invoke<AppState>("get_app_state"),

  listSkills: (filter: SkillListFilter = "active") =>
    invoke<SkillListItem[]>("list_skills", { filter }),

  getSkill: (skillId: string) =>
    invoke<SkillDetail>("get_skill", { skillId }),

  createSkill: (request: {
    name: string;
    description: string;
    body?: string | null;
  }) => invoke<SkillEntry>("create_skill", { request }),

  deleteSkill: (skillId: string, unlinkAll: boolean) =>
    invoke<void>("delete_skill", { skillId, unlinkAll }),

  deleteSkillsByRepo: (repoKey: string, unlinkAll: boolean) =>
    invoke<number>("delete_skills_by_repo", { repoKey, unlinkAll }),

  setSkillActive: (skillId: string, active: boolean) =>
    invoke<SkillEntry>("set_skill_active", {
      request: { skillId, active },
    }),

  previewImportFolder: (folderPath: string) =>
    invoke<ImportPreview>("preview_import_folder", {
      request: { folderPath },
    }),

  importFolder: (folderPath: string, overwriteNames: string[] = []) =>
    invoke<ImportResult>("import_skill_folder", {
      request: { folderPath, overwriteNames },
    }),

  previewImportGit: (repoUrl: string) =>
    invoke<ImportPreview>("preview_import_git", {
      request: { repoUrl },
    }),

  importGit: (
    repoUrl: string,
    skillNames: string[] = [],
    overwriteNames: string[] = [],
  ) =>
    invoke<ImportResult>("import_skill_git", {
      request: { repoUrl, skillNames, overwriteNames },
    }),

  listGitRepos: () => invoke<GitRepoRecord[]>("list_git_repos"),

  checkGitRepoUpdate: (repoKey: string) =>
    invoke<GitRepoUpdateStatus>("check_git_repo_update", { repoKey }),

  checkAllGitRepoUpdates: () =>
    invoke<GitRepoUpdateStatus[]>("check_all_git_repo_updates"),

  updateGitRepo: (repoKey: string, overwriteExisting = true) =>
    invoke<ImportResult>("update_git_repo", {
      request: { repoKey, overwriteExisting },
    }),

  enableSkill: (skillId: string, projectPath: string, mode: LinkMode) =>
    invoke("enable_skill", {
      request: { skillId, projectPath, mode },
    }),

  disableSkill: (skillId: string, projectPath: string) =>
    invoke<void>("disable_skill", {
      request: { skillId, projectPath },
    }),

  listProjectEnables: (projectPath: string) =>
    invoke<EnableRecord[]>("list_project_enables", { projectPath }),

  /**
   * Native folder picker via plugin-dialog (async).
   * Do not use a blocking Rust dialog on the IPC thread — freezes Finder on macOS.
   */
  pickFolder: async (title: string): Promise<string | null> => {
    const selected = await open({
      directory: true,
      multiple: false,
      title,
    });
    if (selected == null) return null;
    if (Array.isArray(selected)) return selected[0] ?? null;
    return selected;
  },

  openPath: (path: string) => invoke<void>("open_path", { path }),

  setVaultPath: (path: string) =>
    invoke<AppState>("set_vault_path", { request: { path } }),
};
