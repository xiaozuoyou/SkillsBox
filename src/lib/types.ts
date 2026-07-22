export type ViewName = "library" | "settings";

/** Sidebar list scope inside the library view. */
export type LibraryTab = "all" | "favorites" | "disabled";

export type SkillOrigin = "local" | "import" | "Local" | "Import";
export type LinkMode = "symlink" | "copy";
export type SkillListFilter = "active" | "inactive" | "all";

export interface SkillSource {
  type: "folder" | "git";
  uri: string;
  /** Git commit at last import/update */
  commit?: string | null;
}

export interface GitRepoRecord {
  key: string;
  uri: string;
  label: string;
  commit?: string | null;
  remoteCommit?: string | null;
  lastCheckedAt?: string | null;
  lastImportedAt: string;
}

export interface GitRepoUpdateStatus {
  key: string;
  uri: string;
  label: string;
  localCommit?: string | null;
  remoteCommit?: string | null;
  updateAvailable: boolean;
  lastCheckedAt?: string | null;
  error?: string | null;
}

export interface ImportPreviewItem {
  name: string;
  description: string;
  exists: boolean;
}

export interface ImportPreview {
  items: ImportPreviewItem[];
  conflictCount: number;
}

export interface SkillListItem {
  id: string;
  name: string;
  description: string;
  origin: SkillOrigin;
  enableCount: number;
  active: boolean;
  repoKey: string;
  repoLabel: string;
  source?: SkillSource | null;
}

export interface SkillEntry {
  id: string;
  name: string;
  description: string;
  origin: SkillOrigin;
  source?: SkillSource | null;
  path: string;
  tags: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EnableRecord {
  skillId: string;
  projectPath: string;
  targetPath: string;
  mode: LinkMode;
  enabledAt: string;
}

export interface SkillDetail {
  entry: SkillEntry;
  body: string;
  absolutePath: string;
  enables: EnableRecord[];
}

export interface AppState {
  vaultPath: string;
  /** Factory default (`~/.skillsbox`) */
  defaultVaultPath: string;
  skillCount: number;
  activeCount: number;
  inactiveCount: number;
  enableCount: number;
  defaultLinkMode: LinkMode;
}

export interface ImportResult {
  imported: SkillEntry[];
  overwritten: SkillEntry[];
  skipped: string[];
  gitRepo?: GitRepoRecord | null;
}

export interface SkillGroup {
  key: string;
  label: string;
  items: SkillListItem[];
}
