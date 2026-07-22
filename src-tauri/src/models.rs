use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SkillOrigin {
    Local,
    Import,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SourceType {
    Folder,
    Git,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSource {
    #[serde(rename = "type")]
    pub source_type: SourceType,
    pub uri: String,
    /// Git commit SHA at import / last update (git sources only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub commit: Option<String>,
}

/// Tracked remote git repository that skills were imported from.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoRecord {
    /// Stable key from [`normalize_repo_key`].
    pub key: String,
    /// Original clone URL.
    pub uri: String,
    pub label: String,
    /// Commit recorded at last successful import/update.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub commit: Option<String>,
    /// Last `ls-remote` HEAD (if checked).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remote_commit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_checked_at: Option<String>,
    pub last_imported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreviewItem {
    /// Resolved skill id that would be used.
    pub name: String,
    pub description: String,
    /// True if this id already exists in the vault.
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub items: Vec<ImportPreviewItem>,
    pub conflict_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoUpdateStatus {
    pub key: String,
    pub uri: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_commit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remote_commit: Option<String>,
    pub update_available: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_checked_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub origin: SkillOrigin,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<SkillSource>,
    /// Relative path under vault root, e.g. `skills/my-commit`
    pub path: String,
    #[serde(default)]
    pub tags: Vec<String>,
    /// Whether this skill appears in the main library list.
    /// Disabled skills stay in the vault but only show on the "已禁用" page.
    #[serde(default = "default_true")]
    pub active: bool,
    pub created_at: String,
    pub updated_at: String,
}

fn default_true() -> bool {
    true
}

/// Grouping key + short label for a skill's source repository.
pub fn repo_group(source: &Option<SkillSource>, origin: &SkillOrigin) -> (String, String) {
    match source {
        Some(s) => {
            let key = normalize_repo_key(&s.uri);
            let label = repo_label_from_key(&key, &s.uri, &s.source_type);
            (key, label)
        }
        None => {
            if matches!(origin, SkillOrigin::Local) {
                ("local".to_string(), "本地创建".to_string())
            } else {
                ("unknown".to_string(), "未知来源".to_string())
            }
        }
    }
}

pub fn normalize_repo_key(uri: &str) -> String {
    let mut u = uri.trim().to_string();
    if u.ends_with('/') {
        u.pop();
    }
    if u.ends_with(".git") {
        u.truncate(u.len() - 4);
    }
    // git@github.com:owner/repo -> github.com/owner/repo
    if let Some(rest) = u.strip_prefix("git@") {
        if let Some((host, path)) = rest.split_once(':') {
            return format!("{host}/{path}").to_lowercase();
        }
    }
    // https://github.com/owner/repo
    if let Some(rest) = u
        .strip_prefix("https://")
        .or_else(|| u.strip_prefix("http://"))
    {
        return rest.trim_end_matches('/').to_lowercase();
    }
    u.to_lowercase()
}

pub fn repo_label_from_key(key: &str, original: &str, source_type: &SourceType) -> String {
    // Prefer owner/repo for github-like hosts
    let parts: Vec<&str> = key.split('/').filter(|p| !p.is_empty()).collect();
    if parts.len() >= 2 {
        let host = parts[0];
        if host.contains("github") || host.contains("gitlab") || host.contains("gitee") {
            return format!("{}/{}", parts[parts.len() - 2], parts[parts.len() - 1]);
        }
        if parts.len() >= 2 && !key.starts_with('/') && !original.starts_with('/') {
            // still show last two segments for other hosts
            if host.contains('.') {
                return format!("{}/{}", parts[parts.len() - 2], parts[parts.len() - 1]);
            }
        }
    }
    if matches!(source_type, SourceType::Folder) {
        std::path::Path::new(original)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(original)
            .to_string()
    } else {
        original.to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LinkMode {
    Symlink,
    Copy,
}

impl Default for LinkMode {
    fn default() -> Self {
        Self::Symlink
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnableRecord {
    pub skill_id: String,
    pub project_path: String,
    pub target_path: String,
    pub mode: LinkMode,
    pub enabled_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Registry {
    pub version: u32,
    pub vault_path: String,
    #[serde(default)]
    pub skills: Vec<SkillEntry>,
    #[serde(default)]
    pub enables: Vec<EnableRecord>,
    /// Git remotes that have been imported (for update checks).
    #[serde(default)]
    pub git_repos: Vec<GitRepoRecord>,
}

impl Registry {
    pub fn new(vault_path: impl Into<String>) -> Self {
        Self {
            version: 1,
            vault_path: vault_path.into(),
            skills: Vec::new(),
            enables: Vec::new(),
            git_repos: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillListItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub origin: SkillOrigin,
    pub enable_count: usize,
    pub active: bool,
    /// Stable key for grouping (repo URL / folder path / "local").
    pub repo_key: String,
    /// Human-readable group label (e.g. `mattpocock/skills`).
    pub repo_label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<SkillSource>,
}

/// How to filter skills in list_skills.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum SkillListFilter {
    #[default]
    Active,
    Inactive,
    All,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDetail {
    pub entry: SkillEntry,
    pub body: String,
    pub absolute_path: String,
    pub enables: Vec<EnableRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub vault_path: String,
    /// Factory default (`~/.skillsbox`), for “恢复默认” UI.
    pub default_vault_path: String,
    pub skill_count: usize,
    pub active_count: usize,
    pub inactive_count: usize,
    pub enable_count: usize,
    pub default_link_mode: LinkMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetVaultPathRequest {
    /// Absolute path or `~/…`. Empty string resets to default `~/.skillsbox`.
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetSkillActiveRequest {
    pub skill_id: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSkillRequest {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnableSkillRequest {
    pub skill_id: String,
    pub project_path: String,
    #[serde(default)]
    pub mode: LinkMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisableSkillRequest {
    pub skill_id: String,
    pub project_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportFolderRequest {
    pub folder_path: String,
    /// Skill ids to overwrite when they already exist. Others with conflicts are skipped.
    #[serde(default)]
    pub overwrite_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportGitRequest {
    pub repo_url: String,
    /// If empty, import all discovered skills (subject to name conflicts).
    #[serde(default)]
    pub skill_names: Vec<String>,
    /// Skill ids to overwrite when they already exist. Others with conflicts are skipped.
    #[serde(default)]
    pub overwrite_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewImportFolderRequest {
    pub folder_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewImportGitRequest {
    pub repo_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGitRepoRequest {
    pub repo_key: String,
    /// When true, overwrite all skills that already exist from this repo.
    /// New skills from the remote are always imported.
    #[serde(default = "default_true")]
    pub overwrite_existing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredSkill {
    pub name: String,
    pub description: String,
    pub relative_path: String,
}
