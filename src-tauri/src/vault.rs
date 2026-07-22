use std::fs;
use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};
use crate::models::{Registry, SkillEntry};
use crate::skill_fs::{parse_skill_md, read_skill_md};

pub const REGISTRY_FILE: &str = "registry.json";
pub const SKILLS_DIR: &str = "skills";

/// Default vault: `~/.skillsbox` (user-visible, easy to backup / open in Finder).
pub fn default_vault_path() -> AppResult<PathBuf> {
    let home = dirs_home().ok_or_else(|| {
        AppError::msg("Could not resolve home directory for ~/.skillsbox".to_string())
    })?;
    Ok(home.join(".skillsbox"))
}

/// Previous home-dir location (mixed case) — migrate once if present.
pub fn legacy_home_vault_mixed_case() -> Option<PathBuf> {
    dirs_home().map(|h| h.join(".SkillsBox"))
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| {
            #[cfg(unix)]
            {
                // fallback: passwd home is overkill; HOME is standard on macOS
                None
            }
            #[cfg(not(unix))]
            {
                std::env::var_os("USERPROFILE").map(PathBuf::from)
            }
        })
}

/// Legacy location from early builds (Tauri app data).
pub fn legacy_app_data_vault(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("vault")
}

/// If the new vault is empty but a legacy vault has data, move it once.
pub fn migrate_from_legacy_if_needed(vault: &Path, legacy: &Path) -> AppResult<()> {
    if !legacy.exists() {
        return Ok(());
    }
    let new_reg = vault.join(REGISTRY_FILE);
    let new_skills = vault.join(SKILLS_DIR);
    let new_has_data = new_reg.is_file()
        || (new_skills.is_dir()
            && fs::read_dir(&new_skills)
                .map(|mut d| d.next().is_some())
                .unwrap_or(false));
    if new_has_data {
        return Ok(());
    }

    let legacy_reg = legacy.join(REGISTRY_FILE);
    let legacy_skills = legacy.join(SKILLS_DIR);
    let legacy_has = legacy_reg.is_file()
        || (legacy_skills.is_dir()
            && fs::read_dir(&legacy_skills)
                .map(|mut d| d.next().is_some())
                .unwrap_or(false));
    if !legacy_has {
        return Ok(());
    }

    fs::create_dir_all(vault)?;
    // Prefer rename (same volume); fall back to recursive copy then leave legacy.
    if legacy_reg.is_file() && !new_reg.exists() {
        if fs::rename(&legacy_reg, &new_reg).is_err() {
            fs::copy(&legacy_reg, &new_reg)?;
        }
    }
    if legacy_skills.is_dir() && !new_skills.exists() {
        if fs::rename(&legacy_skills, &new_skills).is_err() {
            copy_dir_recursive(&legacy_skills, &new_skills)?;
        }
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> AppResult<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if from.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

pub fn ensure_vault(vault: &Path) -> AppResult<Registry> {
    fs::create_dir_all(vault.join(SKILLS_DIR))?;
    let reg_path = vault.join(REGISTRY_FILE);
    if !reg_path.exists() {
        let reg = Registry::new(vault.to_string_lossy());
        save_registry(vault, &reg)?;
        return Ok(reg);
    }
    let mut reg = load_registry(vault)?;
    reg.vault_path = vault.to_string_lossy().to_string();
    reconcile(vault, &mut reg)?;
    save_registry(vault, &reg)?;
    Ok(reg)
}

pub fn load_registry(vault: &Path) -> AppResult<Registry> {
    let reg_path = vault.join(REGISTRY_FILE);
    let raw = fs::read_to_string(&reg_path)?;
    let reg: Registry = serde_json::from_str(&raw)?;
    Ok(reg)
}

pub fn save_registry(vault: &Path, reg: &Registry) -> AppResult<()> {
    let reg_path = vault.join(REGISTRY_FILE);
    let raw = serde_json::to_string_pretty(reg)?;
    fs::write(reg_path, raw)?;
    Ok(())
}

pub fn skill_abs_path(vault: &Path, entry: &SkillEntry) -> PathBuf {
    vault.join(&entry.path)
}

/// Reconcile on-disk skill dirs with registry entries.
fn reconcile(vault: &Path, reg: &mut Registry) -> AppResult<()> {
    let skills_root = vault.join(SKILLS_DIR);
    if !skills_root.exists() {
        return Ok(());
    }

    // Drop registry entries whose directories vanished.
    reg.skills.retain(|s| skill_abs_path(vault, s).join("SKILL.md").is_file());

    // Register orphan directories that have SKILL.md.
    let known: std::collections::HashSet<String> =
        reg.skills.iter().map(|s| s.id.clone()).collect();

    for entry in fs::read_dir(&skills_root)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = match entry.file_name().into_string() {
            Ok(n) => n,
            Err(_) => continue,
        };
        if known.contains(&name) {
            continue;
        }
        let skill_md = path.join("SKILL.md");
        if !skill_md.is_file() {
            continue;
        }
        let content = read_skill_md(&path)?;
        let meta = parse_skill_md(&content);
        let now = crate::skill_fs::now_iso();
        reg.skills.push(SkillEntry {
            id: name.clone(),
            name: meta.name.unwrap_or(name.clone()),
            description: meta.description.unwrap_or_default(),
            origin: crate::models::SkillOrigin::Local,
            source: None,
            path: format!("{SKILLS_DIR}/{name}"),
            tags: vec![],
            active: true,
            created_at: now.clone(),
            updated_at: now,
        });
    }

    // Drop enables that point at missing skills.
    let skill_ids: std::collections::HashSet<String> =
        reg.skills.iter().map(|s| s.id.clone()).collect();
    reg.enables.retain(|e| skill_ids.contains(&e.skill_id));

    Ok(())
}

pub fn find_skill<'a>(reg: &'a Registry, id: &str) -> AppResult<&'a SkillEntry> {
    reg.skills
        .iter()
        .find(|s| s.id == id)
        .ok_or_else(|| AppError::msg(format!("Skill not found: {id}")))
}

pub fn skill_id_exists(reg: &Registry, id: &str) -> bool {
    reg.skills.iter().any(|s| s.id == id)
}
