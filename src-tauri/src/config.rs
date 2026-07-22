use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

const CONFIG_FILE: &str = "config.json";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    /// Custom vault root. When null/absent, use `~/.skillsbox`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vault_path: Option<String>,
}

pub fn config_path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| AppError::msg(format!("Cannot resolve app config dir: {e}")))?;
    Ok(dir.join(CONFIG_FILE))
}

pub fn load_config(app: &AppHandle) -> AppResult<AppConfig> {
    let path = config_path(app)?;
    if !path.is_file() {
        return Ok(AppConfig::default());
    }
    let raw = fs::read_to_string(&path)?;
    let cfg: AppConfig = serde_json::from_str(&raw)?;
    Ok(cfg)
}

pub fn save_config(app: &AppHandle, cfg: &AppConfig) -> AppResult<()> {
    let path = config_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let raw = serde_json::to_string_pretty(cfg)?;
    fs::write(&path, raw)?;
    Ok(())
}

/// Expand `~` / `~/…` and normalize to absolute path.
pub fn resolve_vault_path(input: &str) -> AppResult<PathBuf> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(AppError::msg("Vault 路径不能为空".to_string()));
    }

    let expanded = if trimmed == "~" {
        home_dir()?
    } else if let Some(rest) = trimmed.strip_prefix("~/") {
        home_dir()?.join(rest)
    } else if trimmed.starts_with('~') {
        return Err(AppError::msg(
            "不支持的路径写法，请使用绝对路径或 ~/…".to_string(),
        ));
    } else {
        PathBuf::from(trimmed)
    };

    if !expanded.is_absolute() {
        return Err(AppError::msg(
            "请使用绝对路径（或 ~/…）".to_string(),
        ));
    }

    // Best-effort canonicalize if exists; otherwise keep absolute form.
    Ok(fs::canonicalize(&expanded).unwrap_or(expanded))
}

fn home_dir() -> AppResult<PathBuf> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
        .ok_or_else(|| AppError::msg("无法解析用户主目录".to_string()))
}

pub fn paths_equal(a: &Path, b: &Path) -> bool {
    let ca = fs::canonicalize(a).unwrap_or_else(|_| a.to_path_buf());
    let cb = fs::canonicalize(b).unwrap_or_else(|_| b.to_path_buf());
    ca == cb
}
