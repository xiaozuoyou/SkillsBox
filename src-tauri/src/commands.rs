use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

use crate::config;
use crate::error::{AppError, AppResult};
use crate::models::*;
use crate::project_link;
use crate::skill_fs;
use crate::vault::{self, skill_abs_path};

pub struct AppCtx {
    pub vault_path: PathBuf,
    /// Serialize registry / skill-tree writes. Network (git clone / ls-remote) runs outside this lock.
    pub vault_io: Arc<Mutex<()>>,
}

impl AppCtx {
    pub fn vault(&self) -> &std::path::Path {
        &self.vault_path
    }
}

pub type SharedCtx = Mutex<AppCtx>;

fn with_vault<F, T>(state: &State<'_, SharedCtx>, f: F) -> AppResult<T>
where
    F: FnOnce(&std::path::Path) -> AppResult<T>,
{
    let guard = state
        .lock()
        .map_err(|_| crate::error::AppError::msg("Internal lock poisoned".to_string()))?;
    f(guard.vault())
}

/// Clone vault path under a short lock — never hold the mutex across git/network I/O.
fn vault_path(state: &State<'_, SharedCtx>) -> AppResult<PathBuf> {
    let guard = state
        .lock()
        .map_err(|_| AppError::msg("Internal lock poisoned".to_string()))?;
    Ok(guard.vault_path.clone())
}

fn vault_io(state: &State<'_, SharedCtx>) -> AppResult<Arc<Mutex<()>>> {
    let guard = state
        .lock()
        .map_err(|_| AppError::msg("Internal lock poisoned".to_string()))?;
    Ok(Arc::clone(&guard.vault_io))
}

/// Run heavy work (git clone / ls-remote / disk) off the async runtime so the UI stays responsive.
async fn run_blocking<T, F>(f: F) -> AppResult<T>
where
    T: Send + 'static,
    F: FnOnce() -> AppResult<T> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| AppError::msg(format!("Background task failed: {e}")))?
}

fn build_app_state(vault: &std::path::Path) -> AppResult<AppState> {
    let reg = vault::load_registry(vault)?;
    let active_count = reg.skills.iter().filter(|s| s.active).count();
    let inactive_count = reg.skills.len().saturating_sub(active_count);
    let default_vault = vault::default_vault_path()?;
    Ok(AppState {
        vault_path: vault.to_string_lossy().to_string(),
        default_vault_path: default_vault.to_string_lossy().to_string(),
        skill_count: reg.skills.len(),
        active_count,
        inactive_count,
        enable_count: reg.enables.len(),
        default_link_mode: LinkMode::Symlink,
    })
}

#[tauri::command]
pub fn get_app_state(state: State<'_, SharedCtx>) -> AppResult<AppState> {
    with_vault(&state, build_app_state)
}

/// Switch vault root. Empty `path` restores the default `~/.skillsbox`.
/// Does not move existing files; points the app at another directory (created if needed).
#[tauri::command]
pub fn set_vault_path(
    app: AppHandle,
    state: State<'_, SharedCtx>,
    request: SetVaultPathRequest,
) -> AppResult<AppState> {
    let default_vault = vault::default_vault_path()?;
    let use_default = request.path.trim().is_empty();
    let new_vault = if use_default {
        default_vault.clone()
    } else {
        config::resolve_vault_path(&request.path)?
    };

    if new_vault.is_file() {
        return Err(AppError::msg(format!(
            "路径已存在且是文件，不能作为 Vault：{}",
            new_vault.display()
        )));
    }

    vault::ensure_vault(&new_vault)?;
    let _ = project_link::repair_symlink_enables(&new_vault);

    let mut app_cfg = config::load_config(&app).unwrap_or_default();
    if use_default || config::paths_equal(&new_vault, &default_vault) {
        app_cfg.vault_path = None;
    } else {
        app_cfg.vault_path = Some(new_vault.to_string_lossy().to_string());
    }
    config::save_config(&app, &app_cfg)?;

    let mut guard = state
        .lock()
        .map_err(|_| AppError::msg("Internal lock poisoned".to_string()))?;
    guard.vault_path = new_vault.clone();
    drop(guard);

    build_app_state(&new_vault)
}

#[tauri::command]
pub fn list_skills(
    state: State<'_, SharedCtx>,
    filter: Option<SkillListFilter>,
) -> AppResult<Vec<SkillListItem>> {
    with_vault(&state, |vault| {
        let reg = vault::load_registry(vault)?;
        let filter = filter.unwrap_or_default();
        let mut items: Vec<SkillListItem> = reg
            .skills
            .iter()
            .filter(|s| match filter {
                SkillListFilter::Active => s.active,
                SkillListFilter::Inactive => !s.active,
                SkillListFilter::All => true,
            })
            .map(|s| {
                let enable_count = reg.enables.iter().filter(|e| e.skill_id == s.id).count();
                let (repo_key, repo_label) = repo_group(&s.source, &s.origin);
                SkillListItem {
                    id: s.id.clone(),
                    name: s.name.clone(),
                    description: s.description.clone(),
                    origin: s.origin.clone(),
                    enable_count,
                    active: s.active,
                    repo_key,
                    repo_label,
                    source: s.source.clone(),
                }
            })
            .collect();
        // Stable order: repo then name
        items.sort_by(|a, b| {
            a.repo_label
                .cmp(&b.repo_label)
                .then_with(|| a.name.cmp(&b.name))
        });
        Ok(items)
    })
}

#[tauri::command]
pub fn set_skill_active(
    state: State<'_, SharedCtx>,
    request: SetSkillActiveRequest,
) -> AppResult<SkillEntry> {
    with_vault(&state, |vault| {
        let mut reg = vault::load_registry(vault)?;
        let entry = reg
            .skills
            .iter_mut()
            .find(|s| s.id == request.skill_id)
            .ok_or_else(|| crate::error::AppError::msg(format!("Skill not found: {}", request.skill_id)))?;
        entry.active = request.active;
        entry.updated_at = skill_fs::now_iso();
        let out = entry.clone();
        vault::save_registry(vault, &reg)?;
        Ok(out)
    })
}

#[tauri::command]
pub fn get_skill(state: State<'_, SharedCtx>, skill_id: String) -> AppResult<SkillDetail> {
    with_vault(&state, |vault| {
        let reg = vault::load_registry(vault)?;
        let entry = vault::find_skill(&reg, &skill_id)?.clone();
        let abs = skill_abs_path(vault, &entry);
        let body = skill_fs::read_skill_md(&abs).unwrap_or_default();
        let enables: Vec<_> = reg
            .enables
            .into_iter()
            .filter(|e| e.skill_id == skill_id)
            .collect();
        Ok(SkillDetail {
            entry,
            body,
            absolute_path: abs.to_string_lossy().to_string(),
            enables,
        })
    })
}

#[tauri::command]
pub fn create_skill(
    state: State<'_, SharedCtx>,
    request: CreateSkillRequest,
) -> AppResult<SkillEntry> {
    with_vault(&state, |vault| {
        skill_fs::create_local_skill(
            vault,
            request.name.trim(),
            request.description.trim(),
            request.body.as_deref(),
        )
    })
}

#[tauri::command]
pub fn delete_skill(
    state: State<'_, SharedCtx>,
    skill_id: String,
    unlink_all: bool,
) -> AppResult<()> {
    with_vault(&state, |vault| {
        skill_fs::delete_skill(vault, &skill_id, unlink_all)
    })
}

#[tauri::command]
pub fn delete_skills_by_repo(
    state: State<'_, SharedCtx>,
    repo_key: String,
    unlink_all: bool,
) -> AppResult<usize> {
    with_vault(&state, |vault| {
        skill_fs::delete_skills_by_repo(vault, repo_key.trim(), unlink_all)
    })
}

#[tauri::command]
pub fn import_skill_folder(
    state: State<'_, SharedCtx>,
    request: ImportFolderRequest,
) -> AppResult<skill_fs::ImportResult> {
    with_vault(&state, |vault| {
        skill_fs::import_from_folder(
            vault,
            PathBuf::from(&request.folder_path).as_path(),
            Some(&request.folder_path),
            SourceType::Folder,
            None,
            &request.overwrite_names,
            None,
        )
    })
}

#[tauri::command]
pub fn preview_import_folder(
    state: State<'_, SharedCtx>,
    request: PreviewImportFolderRequest,
) -> AppResult<ImportPreview> {
    with_vault(&state, |vault| {
        skill_fs::preview_import_folder(vault, PathBuf::from(&request.folder_path).as_path())
    })
}

/// Legacy list of discovered skills (no conflict flags). Prefer `preview_import_folder`.
#[tauri::command]
pub fn list_folder_skills(folder_path: String) -> AppResult<Vec<DiscoveredSkill>> {
    skill_fs::preview_folder_skills(PathBuf::from(folder_path).as_path())
}

#[tauri::command]
pub async fn import_skill_git(
    state: State<'_, SharedCtx>,
    request: ImportGitRequest,
) -> AppResult<skill_fs::ImportResult> {
    let vault = vault_path(&state)?;
    let url = request.repo_url.trim().to_string();
    let names = request.skill_names;
    let overwrite = request.overwrite_names;
    run_blocking(move || skill_fs::import_from_git(&vault, &url, &names, &overwrite)).await
}

#[tauri::command]
pub async fn preview_import_git(
    state: State<'_, SharedCtx>,
    request: PreviewImportGitRequest,
) -> AppResult<ImportPreview> {
    let vault = vault_path(&state)?;
    let url = request.repo_url.trim().to_string();
    run_blocking(move || skill_fs::preview_import_git(&vault, &url)).await
}

#[tauri::command]
pub async fn list_git_repos(state: State<'_, SharedCtx>) -> AppResult<Vec<GitRepoRecord>> {
    let vault = vault_path(&state)?;
    run_blocking(move || skill_fs::list_git_repos(&vault)).await
}

#[tauri::command]
pub async fn check_git_repo_update(
    state: State<'_, SharedCtx>,
    repo_key: String,
) -> AppResult<GitRepoUpdateStatus> {
    let vault = vault_path(&state)?;
    let io = vault_io(&state)?;
    let key = repo_key.trim().to_string();
    // Network ls-remote runs inside, then registry write — hold io only around the whole
    // check so concurrent updates don't clobber last_checked_at / remote_commit.
    run_blocking(move || {
        let _guard = io
            .lock()
            .map_err(|_| AppError::msg("Vault I/O lock poisoned".to_string()))?;
        skill_fs::check_git_repo_update(&vault, &key)
    })
    .await
}

#[tauri::command]
pub async fn check_all_git_repo_updates(
    state: State<'_, SharedCtx>,
) -> AppResult<Vec<GitRepoUpdateStatus>> {
    let vault = vault_path(&state)?;
    let io = vault_io(&state)?;
    run_blocking(move || {
        let _guard = io
            .lock()
            .map_err(|_| AppError::msg("Vault I/O lock poisoned".to_string()))?;
        skill_fs::check_all_git_repo_updates(&vault)
    })
    .await
}

/// Update a git repo: clone runs without the vault lock so multiple repos can download
/// in parallel; import into the vault is serialized via `vault_io`.
#[tauri::command]
pub async fn update_git_repo(
    state: State<'_, SharedCtx>,
    request: UpdateGitRepoRequest,
) -> AppResult<skill_fs::ImportResult> {
    let vault = vault_path(&state)?;
    let io = vault_io(&state)?;
    let key = request.repo_key.trim().to_string();
    let overwrite = request.overwrite_existing;

    // 1) Resolve repo URI (brief registry read under lock).
    let (uri, overwrite_names) = {
        let vault = vault.clone();
        let io = Arc::clone(&io);
        let key = key.clone();
        run_blocking(move || {
            let _guard = io
                .lock()
                .map_err(|_| AppError::msg("Vault I/O lock poisoned".to_string()))?;
            skill_fs::resolve_git_repo_update(&vault, &key, overwrite)
        })
        .await?
    };

    // 2) Network clone — no vault lock; concurrent updates of different repos OK.
    let (tmp, commit) = {
        let uri = uri.clone();
        run_blocking(move || skill_fs::clone_git_repo_tmp(&uri)).await?
    };

    // 3) Import into vault under lock, then clean temp.
    run_blocking(move || {
        let _guard = io
            .lock()
            .map_err(|_| AppError::msg("Vault I/O lock poisoned".to_string()))?;
        skill_fs::import_cloned_git_repo(
            &vault,
            &tmp,
            &uri,
            &overwrite_names,
            commit.as_deref(),
        )
    })
    .await
}

#[tauri::command]
pub fn enable_skill(
    state: State<'_, SharedCtx>,
    request: EnableSkillRequest,
) -> AppResult<EnableRecord> {
    with_vault(&state, |vault| {
        project_link::enable_skill(
            vault,
            &request.skill_id,
            &request.project_path,
            request.mode,
        )
    })
}

#[tauri::command]
pub fn disable_skill(
    state: State<'_, SharedCtx>,
    request: DisableSkillRequest,
) -> AppResult<()> {
    with_vault(&state, |vault| {
        project_link::disable_skill(vault, &request.skill_id, &request.project_path)
    })
}

#[tauri::command]
pub fn list_project_enables(
    state: State<'_, SharedCtx>,
    project_path: String,
) -> AppResult<Vec<EnableRecord>> {
    with_vault(&state, |vault| {
        project_link::list_enables_for_project(vault, &project_path)
    })
}

/// Prefer frontend `@tauri-apps/plugin-dialog` `open({ directory: true })`.
/// Non-blocking dialog + channel — never call `blocking_pick_folder` on the IPC thread (freezes Finder on macOS).
#[tauri::command]
pub async fn pick_folder(app: AppHandle, title: Option<String>) -> AppResult<Option<String>> {
    let title = title.unwrap_or_else(|| "Select folder".to_string());
    let (tx, rx) = std::sync::mpsc::sync_channel::<Option<String>>(1);
    app.dialog()
        .file()
        .set_title(title)
        .pick_folder(move |folder| {
            let _ = tx.send(folder.map(|p| p.to_string()));
        });
    // Wait on a worker thread; dialog itself runs on the UI/main thread via the plugin.
    Ok(tauri::async_runtime::spawn_blocking(move || rx.recv().ok().flatten()).await.unwrap_or(None))
}

#[tauri::command]
pub fn open_path(app: AppHandle, path: String) -> AppResult<()> {
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| crate::error::AppError::msg(format!("Failed to open path: {e}")))?;
    Ok(())
}

/// Initialize vault on app startup (custom path from app config, else `~/.skillsbox`).
pub fn init_vault(app: &AppHandle) -> AppResult<PathBuf> {
    let default_vault = vault::default_vault_path()?;
    let cfg = config::load_config(app).unwrap_or_default();

    let vault = if let Some(custom) = cfg.vault_path.as_deref().filter(|s| !s.trim().is_empty()) {
        match config::resolve_vault_path(custom) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("[skillsbox] invalid custom vault path, falling back to default: {e}");
                default_vault.clone()
            }
        }
    } else {
        default_vault.clone()
    };

    // One-time migrations only when using the default location.
    if config::paths_equal(&vault, &default_vault) {
        if let Some(mixed) = vault::legacy_home_vault_mixed_case() {
            if mixed != vault {
                vault::migrate_from_legacy_if_needed(&vault, &mixed)?;
            }
        }
        if let Ok(data_dir) = app.path().app_data_dir() {
            let legacy = vault::legacy_app_data_vault(&data_dir);
            vault::migrate_from_legacy_if_needed(&vault, &legacy)?;
        }
    }

    vault::ensure_vault(&vault)?;
    let _ = project_link::repair_symlink_enables(&vault);
    Ok(vault)
}
