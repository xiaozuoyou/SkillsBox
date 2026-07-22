use std::fs;
use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};
use crate::models::{EnableRecord, LinkMode};
use crate::skill_fs::{copy_skill_tree, now_iso};
use crate::vault::{self, skill_abs_path};

const AGENTS_SKILLS: &str = ".agents/skills";

pub fn project_skill_target(project: &Path, skill_id: &str) -> PathBuf {
    project.join(".agents").join("skills").join(skill_id)
}

fn canonicalize_project(project: &Path) -> AppResult<PathBuf> {
    if !project.is_dir() {
        return Err(AppError::msg(format!(
            "Project path is not a directory: {}",
            project.display()
        )));
    }
    Ok(fs::canonicalize(project).unwrap_or_else(|_| project.to_path_buf()))
}

/// Ensure target is exactly `<project>/.agents/skills/<skill_id>`.
pub fn assert_safe_target(project: &Path, skill_id: &str, target: &Path) -> AppResult<()> {
    if skill_id.contains('/') || skill_id.contains('\\') || skill_id.contains("..") {
        return Err(AppError::msg("Invalid skill id for path safety".to_string()));
    }
    let expected = project_skill_target(project, skill_id);
    let t = target.to_string_lossy().replace('\\', "/");
    let e = expected.to_string_lossy().replace('\\', "/");
    if t != e && !t.ends_with(&format!("/.agents/skills/{skill_id}")) {
        return Err(AppError::msg(format!(
            "Refusing unsafe target path: {} (expected under .agents/skills/{skill_id})",
            target.display()
        )));
    }
    Ok(())
}

pub fn enable_skill(
    vault: &Path,
    skill_id: &str,
    project_path: &str,
    mode: LinkMode,
) -> AppResult<EnableRecord> {
    let mut reg = vault::load_registry(vault)?;
    let entry = vault::find_skill(&reg, skill_id)?.clone();
    let project = canonicalize_project(Path::new(project_path))?;
    let target = project_skill_target(&project, skill_id);
    assert_safe_target(&project, skill_id, &target)?;

    if reg.enables.iter().any(|e| {
        e.skill_id == skill_id && Path::new(&e.project_path) == project.as_path()
    }) {
        return Err(AppError::msg(
            "Skill already enabled for this project".to_string(),
        ));
    }

    if target.exists() || target.symlink_metadata().is_ok() {
        return Err(AppError::msg(format!(
            "Target already exists: {}. Disable or remove it first.",
            target.display()
        )));
    }

    let agents_dir = project.join(".agents").join("skills");
    fs::create_dir_all(&agents_dir)?;

    let src = skill_abs_path(vault, &entry);
    if !src.join("SKILL.md").is_file() {
        return Err(AppError::msg(format!(
            "Vault skill missing SKILL.md: {}",
            src.display()
        )));
    }

    match mode {
        LinkMode::Symlink => {
            create_symlink(&src, &target)?;
        }
        LinkMode::Copy => {
            copy_skill_tree(&src, &target)?;
        }
    }

    let record = EnableRecord {
        skill_id: skill_id.to_string(),
        project_path: project.to_string_lossy().to_string(),
        target_path: target.to_string_lossy().to_string(),
        mode,
        enabled_at: now_iso(),
    };
    reg.enables.push(record.clone());
    vault::save_registry(vault, &reg)?;
    Ok(record)
}

fn create_symlink(src: &Path, dst: &Path) -> AppResult<()> {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(src, dst)?;
        Ok(())
    }
    #[cfg(not(unix))]
    {
        let _ = (src, dst);
        Err(AppError::msg(
            "Symlink is only supported on macOS/Linux in this version. Use copy mode."
                .to_string(),
        ))
    }
}

/// After vault relocation, rewrite broken project symlinks to point at the new vault paths.
pub fn repair_symlink_enables(vault: &Path) -> AppResult<usize> {
    let reg = vault::load_registry(vault)?;
    let mut fixed = 0usize;
    for en in &reg.enables {
        if !matches!(en.mode, LinkMode::Symlink) {
            continue;
        }
        let Ok(entry) = vault::find_skill(&reg, &en.skill_id) else {
            continue;
        };
        let src = skill_abs_path(vault, entry);
        if !src.join("SKILL.md").is_file() {
            continue;
        }
        let target = Path::new(&en.target_path);
        let meta = target.symlink_metadata();
        let needs_fix = match meta {
            Ok(m) if m.file_type().is_symlink() => {
                let current = fs::read_link(target).ok();
                current.as_ref() != Some(&src)
            }
            Ok(_) => false, // real dir/file (copy) — leave alone
            Err(_) => true, // missing / broken
        };
        if !needs_fix {
            continue;
        }
        if target.symlink_metadata().is_ok() {
            let _ = remove_project_link(&en.target_path);
        }
        if let Some(parent) = target.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if create_symlink(&src, target).is_ok() {
            fixed += 1;
        }
    }
    Ok(fixed)
}

pub fn remove_project_link(target_path: &str) -> AppResult<()> {
    let target = Path::new(target_path);
    // Safety: must live under .agents/skills/
    let s = target.to_string_lossy().replace('\\', "/");
    if !s.contains("/.agents/skills/") {
        return Err(AppError::msg(format!(
            "Refusing to delete path outside .agents/skills: {target_path}"
        )));
    }
    if !target.exists() && target.symlink_metadata().is_err() {
        return Ok(());
    }
    let meta = target.symlink_metadata()?;
    if meta.file_type().is_symlink() || meta.is_file() {
        fs::remove_file(target)?;
    } else if meta.is_dir() {
        fs::remove_dir_all(target)?;
    }
    Ok(())
}

pub fn disable_skill(vault: &Path, skill_id: &str, project_path: &str) -> AppResult<()> {
    let mut reg = vault::load_registry(vault)?;
    let project = canonicalize_project(Path::new(project_path)).unwrap_or_else(|_| {
        PathBuf::from(project_path)
    });

    let idx = reg.enables.iter().position(|e| {
        e.skill_id == skill_id
            && (Path::new(&e.project_path) == project.as_path()
                || e.project_path == project_path)
    });

    let Some(idx) = idx else {
        return Err(AppError::msg(
            "No enable record for this skill and project".to_string(),
        ));
    };

    let record = reg.enables.remove(idx);
    assert_safe_target(
        Path::new(&record.project_path),
        skill_id,
        Path::new(&record.target_path),
    )?;
    remove_project_link(&record.target_path)?;
    vault::save_registry(vault, &reg)?;
    Ok(())
}

pub fn list_enables_for_project(
    vault: &Path,
    project_path: &str,
) -> AppResult<Vec<EnableRecord>> {
    let reg = vault::load_registry(vault)?;
    let project = Path::new(project_path);
    Ok(reg
        .enables
        .into_iter()
        .filter(|e| {
            Path::new(&e.project_path) == project || e.project_path == project_path
        })
        .collect())
}

#[allow(dead_code)]
pub fn agents_skills_rel() -> &'static str {
    AGENTS_SKILLS
}
