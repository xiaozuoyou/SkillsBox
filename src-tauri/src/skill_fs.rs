use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::thread;

use walkdir::WalkDir;

use crate::error::{AppError, AppResult};
use crate::models::{
    normalize_repo_key, repo_label_from_key, DiscoveredSkill, GitRepoRecord,
    GitRepoUpdateStatus, ImportPreview, ImportPreviewItem, SkillEntry, SkillOrigin,
    SkillSource, SourceType,
};
use crate::vault::{self, SKILLS_DIR};
use std::collections::HashSet;

/// Skill name: 2–64 chars, lowercase alnum + hyphen, starts/ends alnum.
pub fn validate_skill_name(name: &str) -> AppResult<()> {
    let bytes = name.as_bytes();
    if bytes.len() < 2 || bytes.len() > 64 {
        return Err(AppError::msg(
            "Skill name must be 2–64 characters".to_string(),
        ));
    }
    let first = bytes[0];
    let last = bytes[bytes.len() - 1];
    if !first.is_ascii_alphanumeric() || !last.is_ascii_alphanumeric() {
        return Err(AppError::msg(
            "Skill name must start and end with a letter or digit".to_string(),
        ));
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        return Err(AppError::msg(
            "Skill name may only contain lowercase letters, digits, and hyphens"
                .to_string(),
        ));
    }
    Ok(())
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

#[derive(Debug, Default)]
pub struct Frontmatter {
    pub name: Option<String>,
    pub description: Option<String>,
}

/// Parse YAML frontmatter between --- fences; ignore body.
pub fn parse_skill_md(content: &str) -> Frontmatter {
    let mut fm = Frontmatter::default();
    let trimmed = content.trim_start_matches('\u{feff}');
    if !trimmed.starts_with("---") {
        // No frontmatter: first paragraph as description
        let first = trimmed.lines().find(|l| !l.trim().is_empty()).unwrap_or("");
        if !first.is_empty() {
            fm.description = Some(first.trim_start_matches('#').trim().to_string());
        }
        return fm;
    }
    let rest = &trimmed[3..];
    let end = match rest.find("\n---") {
        Some(i) => i,
        None => return fm,
    };
    let yaml_str = &rest[..end];
    if let Ok(value) = serde_yaml::from_str::<serde_yaml::Value>(yaml_str) {
        if let Some(map) = value.as_mapping() {
            if let Some(n) = map.get(serde_yaml::Value::from("name")) {
                if let Some(s) = n.as_str() {
                    fm.name = Some(s.to_string());
                }
            }
            if let Some(d) = map.get(serde_yaml::Value::from("description")) {
                if let Some(s) = d.as_str() {
                    fm.description = Some(s.to_string());
                } else if let Some(s) = d.as_mapping() {
                    // folded description sometimes as multi-line; try to_string
                    let _ = s;
                }
            }
            // Handle description as folded scalar already as_str
            if fm.description.is_none() {
                if let Some(d) = map.get(serde_yaml::Value::from("description")) {
                    if let Ok(s) = serde_yaml::to_string(d) {
                        let s = s.trim().trim_start_matches('\'').trim_end_matches('\'').trim();
                        if !s.is_empty() && s != "null" && s != "~" {
                            fm.description = Some(s.to_string());
                        }
                    }
                }
            }
        }
    }
    fm
}

pub fn read_skill_md(skill_dir: &Path) -> AppResult<String> {
    let p = skill_dir.join("SKILL.md");
    Ok(fs::read_to_string(p)?)
}

pub fn write_skill_md(skill_dir: &Path, name: &str, description: &str, body: &str) -> AppResult<()> {
    fs::create_dir_all(skill_dir)?;
    let desc = description.replace('\n', " ");
    let content = format!(
        "---\nname: {name}\ndescription: {desc}\n---\n\n{body}\n"
    );
    fs::write(skill_dir.join("SKILL.md"), content)?;
    Ok(())
}

pub fn default_skill_body(name: &str) -> String {
    format!(
        "# {name}\n\n## When to use\n\nDescribe when this skill should run.\n\n## Steps\n\n1. ...\n"
    )
}

pub fn create_local_skill(
    vault: &Path,
    name: &str,
    description: &str,
    body: Option<&str>,
) -> AppResult<SkillEntry> {
    validate_skill_name(name)?;
    let mut reg = vault::load_registry(vault)?;
    if vault::skill_id_exists(&reg, name) {
        return Err(AppError::msg(format!("Skill already exists: {name}")));
    }
    let skill_dir = vault.join(SKILLS_DIR).join(name);
    if skill_dir.exists() {
        return Err(AppError::msg(format!(
            "Skill directory already exists: {}",
            skill_dir.display()
        )));
    }
    let body = body
        .map(|s| s.to_string())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| default_skill_body(name));
    write_skill_md(&skill_dir, name, description, &body)?;
    let now = now_iso();
    let entry = SkillEntry {
        id: name.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        origin: SkillOrigin::Local,
        source: None,
        path: format!("{SKILLS_DIR}/{name}"),
        tags: vec![],
        active: true,
        created_at: now.clone(),
        updated_at: now,
    };
    reg.skills.push(entry.clone());
    vault::save_registry(vault, &reg)?;
    Ok(entry)
}

/// Robust recursive copy of a skill directory (destination must not exist).
pub fn copy_skill_tree(src: &Path, dst: &Path) -> AppResult<()> {
    if dst.exists() {
        return Err(AppError::msg(format!(
            "Destination already exists: {}",
            dst.display()
        )));
    }
    copy_skill_tree_into(src, dst)
}

/// Copy skill tree into `dst`, creating it. Caller must ensure `dst` is empty or absent.
fn copy_skill_tree_into(src: &Path, dst: &Path) -> AppResult<()> {
    fs::create_dir_all(dst)?;
    for entry in WalkDir::new(src).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let rel = path.strip_prefix(src).unwrap_or(path);
        if rel.as_os_str().is_empty() {
            continue;
        }
        // Never copy .git into vault skill dirs
        if rel.components().any(|c| c.as_os_str() == ".git") {
            continue;
        }
        let target = dst.join(rel);
        if path.is_dir() {
            fs::create_dir_all(&target)?;
        } else if path.is_file() {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(path, &target)?;
        }
    }
    Ok(())
}

/// Replace an existing skill directory with a fresh copy from `src`.
pub fn replace_skill_tree(src: &Path, dst: &Path) -> AppResult<()> {
    if dst.exists() {
        fs::remove_dir_all(dst)?;
    }
    copy_skill_tree_into(src, dst)
}

/// Discover skill dirs: either the path itself has SKILL.md, or immediate/nested children.
pub fn discover_skills_in_tree(root: &Path) -> AppResult<Vec<(PathBuf, Frontmatter)>> {
    let mut found = Vec::new();
    if root.join("SKILL.md").is_file() {
        let content = read_skill_md(root)?;
        found.push((root.to_path_buf(), parse_skill_md(&content)));
        return Ok(found);
    }
    for entry in WalkDir::new(root)
        .max_depth(6)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.file_name().and_then(|n| n.to_str()) != Some("SKILL.md") {
            continue;
        }
        let dir = path.parent().unwrap_or(path).to_path_buf();
        // skip .git
        if dir.components().any(|c| c.as_os_str() == ".git") {
            continue;
        }
        let content = fs::read_to_string(path)?;
        found.push((dir, parse_skill_md(&content)));
    }
    Ok(found)
}

fn resolve_import_id(_reg: &crate::models::Registry, preferred: &str) -> AppResult<String> {
    let id = preferred
        .chars()
        .map(|c| {
            if c.is_ascii_uppercase() {
                c.to_ascii_lowercase()
            } else if c.is_ascii_alphanumeric() || c == '-' {
                c
            } else if c == '_' || c == ' ' {
                '-'
            } else {
                '-'
            }
        })
        .collect::<String>();
    let id = id.trim_matches('-').to_string();
    if id.len() < 2 {
        return Err(AppError::msg(format!(
            "Could not derive a valid skill id from '{preferred}'"
        )));
    }
    // may still fail validate if weird; try soft fix
    let mut candidate = id;
    if validate_skill_name(&candidate).is_err() {
        // strip leading/trailing non-alnum already done; pad
        if candidate.len() < 2 {
            candidate = format!("sk-{candidate}");
        }
        validate_skill_name(&candidate)?;
    }
    // Caller decides skip vs error when id already exists.
    Ok(candidate)
}

/// Result of an import batch.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: Vec<SkillEntry>,
    /// Newly written over existing local skills.
    pub overwritten: Vec<SkillEntry>,
    pub skipped: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_repo: Option<GitRepoRecord>,
}

fn make_source(
    uri: Option<&str>,
    source_type: &SourceType,
    commit: Option<&str>,
) -> Option<SkillSource> {
    uri.map(|u| SkillSource {
        source_type: source_type.clone(),
        uri: u.to_string(),
        commit: commit.map(|c| c.to_string()),
    })
}

fn upsert_git_repo(
    reg: &mut crate::models::Registry,
    repo_url: &str,
    commit: Option<&str>,
) -> GitRepoRecord {
    let key = normalize_repo_key(repo_url);
    let label = repo_label_from_key(&key, repo_url, &SourceType::Git);
    let now = now_iso();
    if let Some(existing) = reg.git_repos.iter_mut().find(|r| r.key == key) {
        existing.uri = repo_url.to_string();
        existing.label = label;
        if let Some(c) = commit {
            existing.commit = Some(c.to_string());
            existing.remote_commit = Some(c.to_string());
        }
        existing.last_imported_at = now.clone();
        existing.last_checked_at = Some(now);
        return existing.clone();
    }
    let rec = GitRepoRecord {
        key,
        uri: repo_url.to_string(),
        label,
        commit: commit.map(|c| c.to_string()),
        remote_commit: commit.map(|c| c.to_string()),
        last_checked_at: Some(now.clone()),
        last_imported_at: now,
    };
    reg.git_repos.push(rec.clone());
    rec
}

/// Drop git repo records that no longer have any imported skills.
pub fn prune_git_repos(reg: &mut crate::models::Registry) {
    reg.git_repos.retain(|repo| {
        reg.skills.iter().any(|s| {
            s.source
                .as_ref()
                .map(|src| {
                    matches!(src.source_type, SourceType::Git)
                        && normalize_repo_key(&src.uri) == repo.key
                })
                .unwrap_or(false)
        })
    });
}

pub fn import_from_folder(
    vault: &Path,
    folder: &Path,
    source_uri: Option<&str>,
    source_type: SourceType,
    only_names: Option<&[String]>,
    overwrite_names: &[String],
    git_commit: Option<&str>,
) -> AppResult<ImportResult> {
    if !folder.is_dir() {
        return Err(AppError::msg(format!(
            "Not a directory: {}",
            folder.display()
        )));
    }
    let discovered = discover_skills_in_tree(folder)?;
    if discovered.is_empty() {
        return Err(AppError::msg(
            "No SKILL.md found under the selected folder".to_string(),
        ));
    }

    let overwrite: HashSet<String> = overwrite_names.iter().cloned().collect();
    let mut reg = vault::load_registry(vault)?;
    let mut imported = Vec::new();
    let mut overwritten = Vec::new();
    let mut skipped = Vec::new();

    for (dir, meta) in discovered {
        let preferred = meta
            .name
            .clone()
            .or_else(|| {
                dir.file_name()
                    .and_then(|n| n.to_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| "imported-skill".to_string());

        if let Some(filter) = only_names {
            if !filter.is_empty()
                && !filter.iter().any(|n| n == &preferred || meta.name.as_ref() == Some(n))
            {
                let dir_name = dir
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");
                if !filter.iter().any(|n| n == dir_name) {
                    continue;
                }
            }
        }

        let id = match resolve_import_id(&reg, &preferred) {
            Ok(id) => id,
            Err(e) => {
                skipped.push(format!("{preferred} ({e})"));
                continue;
            }
        };

        let exists =
            vault::skill_id_exists(&reg, &id) || vault.join(SKILLS_DIR).join(&id).exists();
        let do_overwrite = exists && overwrite.contains(&id);

        if exists && !do_overwrite {
            skipped.push(id);
            continue;
        }

        let dest = vault.join(SKILLS_DIR).join(&id);
        if do_overwrite {
            if let Err(e) = replace_skill_tree(&dir, &dest) {
                skipped.push(format!("{id} (overwrite failed: {e})"));
                continue;
            }
        } else if let Err(e) = copy_skill_tree(&dir, &dest) {
            skipped.push(format!("{id} (copy failed: {e})"));
            continue;
        }

        let content = match read_skill_md(&dest) {
            Ok(c) => c,
            Err(e) => {
                if !do_overwrite {
                    let _ = fs::remove_dir_all(&dest);
                }
                skipped.push(format!("{id} (read failed: {e})"));
                continue;
            }
        };
        let parsed = parse_skill_md(&content);
        let description = parsed
            .description
            .unwrap_or_else(|| meta.description.clone().unwrap_or_default());
        let display_name = parsed.name.unwrap_or(id.clone());
        let now = now_iso();
        let source = make_source(source_uri, &source_type, git_commit);

        if do_overwrite {
            if let Some(entry) = reg.skills.iter_mut().find(|s| s.id == id) {
                entry.name = display_name;
                entry.description = description;
                entry.origin = SkillOrigin::Import;
                entry.source = source;
                entry.path = format!("{SKILLS_DIR}/{id}");
                entry.updated_at = now;
                overwritten.push(entry.clone());
            } else {
                // Dir existed without registry entry — treat as new
                let entry = SkillEntry {
                    id: id.clone(),
                    name: display_name,
                    description,
                    origin: SkillOrigin::Import,
                    source,
                    path: format!("{SKILLS_DIR}/{id}"),
                    tags: vec![],
                    active: true,
                    created_at: now.clone(),
                    updated_at: now,
                };
                reg.skills.push(entry.clone());
                imported.push(entry);
            }
        } else {
            let entry = SkillEntry {
                id: id.clone(),
                name: display_name,
                description,
                origin: SkillOrigin::Import,
                source,
                path: format!("{SKILLS_DIR}/{id}"),
                tags: vec![],
                active: true,
                created_at: now.clone(),
                updated_at: now,
            };
            reg.skills.push(entry.clone());
            imported.push(entry);
        }
    }

    if imported.is_empty() && overwritten.is_empty() && skipped.is_empty() {
        return Err(AppError::msg(
            "No matching skills to import (filter empty or none found)".to_string(),
        ));
    }

    let git_repo = if matches!(source_type, SourceType::Git) {
        source_uri.map(|uri| upsert_git_repo(&mut reg, uri, git_commit))
    } else {
        None
    };

    if imported.is_empty() && overwritten.is_empty() {
        // All skipped — still ok if we only reported conflicts
        return Ok(ImportResult {
            imported,
            overwritten,
            skipped,
            git_repo,
        });
    }

    vault::save_registry(vault, &reg)?;
    Ok(ImportResult {
        imported,
        overwritten,
        skipped,
        git_repo,
    })
}

fn preview_discovered(
    vault: &Path,
    discovered: Vec<(PathBuf, Frontmatter)>,
) -> AppResult<ImportPreview> {
    let reg = vault::load_registry(vault)?;
    let mut items = Vec::new();
    for (dir, meta) in discovered {
        let preferred = meta
            .name
            .clone()
            .or_else(|| {
                dir.file_name()
                    .and_then(|n| n.to_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| "imported-skill".to_string());
        let name = match resolve_import_id(&reg, &preferred) {
            Ok(id) => id,
            Err(_) => preferred,
        };
        let exists =
            vault::skill_id_exists(&reg, &name) || vault.join(SKILLS_DIR).join(&name).exists();
        items.push(ImportPreviewItem {
            name,
            description: meta.description.unwrap_or_default(),
            exists,
        });
    }
    let conflict_count = items.iter().filter(|i| i.exists).count();
    Ok(ImportPreview {
        items,
        conflict_count,
    })
}

pub fn preview_import_folder(vault: &Path, folder: &Path) -> AppResult<ImportPreview> {
    if !folder.is_dir() {
        return Err(AppError::msg(format!(
            "Not a directory: {}",
            folder.display()
        )));
    }
    let discovered = discover_skills_in_tree(folder)?;
    if discovered.is_empty() {
        return Err(AppError::msg(
            "No SKILL.md found under the selected folder".to_string(),
        ));
    }
    preview_discovered(vault, discovered)
}

pub fn preview_folder_skills(folder: &Path) -> AppResult<Vec<DiscoveredSkill>> {
    let discovered = discover_skills_in_tree(folder)?;
    let root = folder;
    Ok(discovered
        .into_iter()
        .map(|(dir, meta)| {
            let name = meta
                .name
                .clone()
                .or_else(|| {
                    dir.file_name()
                        .and_then(|n| n.to_str())
                        .map(|s| s.to_string())
                })
                .unwrap_or_else(|| "unknown".to_string());
            let relative_path = dir
                .strip_prefix(root)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| dir.to_string_lossy().to_string());
            DiscoveredSkill {
                name,
                description: meta.description.unwrap_or_default(),
                relative_path,
            }
        })
        .collect())
}

fn git_clone_shallow(repo_url: &str, dest: &Path) -> AppResult<()> {
    if dest.exists() {
        let _ = fs::remove_dir_all(dest);
    }
    fs::create_dir_all(dest)?;
    let status = Command::new("git")
        .args(["clone", "--depth", "1", repo_url])
        .arg(dest)
        .output()
        .map_err(|e| AppError::msg(format!("Failed to run git: {e}. Is git installed?")))?;
    if !status.status.success() {
        let stderr = String::from_utf8_lossy(&status.stderr);
        let _ = fs::remove_dir_all(dest);
        return Err(AppError::msg(format!("git clone failed: {stderr}")));
    }
    Ok(())
}

fn git_rev_parse_head(repo_dir: &Path) -> Option<String> {
    let out = Command::new("git")
        .args(["-C"])
        .arg(repo_dir)
        .args(["rev-parse", "HEAD"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

/// Query remote default branch tip without a full clone.
pub fn git_ls_remote_head(repo_url: &str) -> AppResult<String> {
    let out = Command::new("git")
        .args(["ls-remote", repo_url, "HEAD"])
        .output()
        .map_err(|e| AppError::msg(format!("Failed to run git ls-remote: {e}")))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(AppError::msg(format!("git ls-remote failed: {stderr}")));
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    let sha = stdout
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().next())
        .unwrap_or("")
        .trim()
        .to_string();
    if sha.is_empty() {
        return Err(AppError::msg(
            "git ls-remote returned no HEAD commit".to_string(),
        ));
    }
    Ok(sha)
}

fn temp_git_dir() -> PathBuf {
    std::env::temp_dir().join(format!(
        "skillsbox-git-{}",
        chrono::Utc::now().timestamp_millis()
    ))
}

pub fn import_from_git(
    vault: &Path,
    repo_url: &str,
    skill_names: &[String],
    overwrite_names: &[String],
) -> AppResult<ImportResult> {
    let tmp = temp_git_dir();
    git_clone_shallow(repo_url, &tmp)?;
    let commit = git_rev_parse_head(&tmp);
    let only = if skill_names.is_empty() {
        None
    } else {
        Some(skill_names)
    };
    let result = import_from_folder(
        vault,
        &tmp,
        Some(repo_url),
        SourceType::Git,
        only,
        overwrite_names,
        commit.as_deref(),
    );
    let _ = fs::remove_dir_all(&tmp);
    result
}

pub fn preview_import_git(vault: &Path, repo_url: &str) -> AppResult<ImportPreview> {
    let tmp = temp_git_dir();
    git_clone_shallow(repo_url, &tmp)?;
    let discovered = discover_skills_in_tree(&tmp);
    let preview = match discovered {
        Ok(d) if d.is_empty() => {
            let _ = fs::remove_dir_all(&tmp);
            return Err(AppError::msg(
                "No SKILL.md found in the repository".to_string(),
            ));
        }
        Ok(d) => preview_discovered(vault, d),
        Err(e) => {
            let _ = fs::remove_dir_all(&tmp);
            return Err(e);
        }
    };
    let _ = fs::remove_dir_all(&tmp);
    preview
}

pub fn list_git_repos(vault: &Path) -> AppResult<Vec<GitRepoRecord>> {
    let mut reg = vault::load_registry(vault)?;
    // Backfill records from skills that have git source but no registry row.
    let mut changed = false;
    let pairs: Vec<(String, String)> = reg
        .skills
        .iter()
        .filter_map(|s| {
            let src = s.source.as_ref()?;
            if !matches!(src.source_type, SourceType::Git) {
                return None;
            }
            Some((src.uri.clone(), src.commit.clone().unwrap_or_default()))
        })
        .collect();
    for (uri, commit) in pairs {
        let key = normalize_repo_key(&uri);
        if !reg.git_repos.iter().any(|r| r.key == key) {
            let c = if commit.is_empty() {
                None
            } else {
                Some(commit.as_str())
            };
            upsert_git_repo(&mut reg, &uri, c);
            changed = true;
        }
    }
    prune_git_repos(&mut reg);
    if changed {
        vault::save_registry(vault, &reg)?;
    }
    let mut repos = reg.git_repos;
    repos.sort_by(|a, b| a.label.cmp(&b.label));
    Ok(repos)
}

fn commits_equal(local: &str, remote: &str) -> bool {
    let a = local.to_lowercase();
    let b = remote.to_lowercase();
    a == b || a.starts_with(&b) || b.starts_with(&a)
}

pub fn check_git_repo_update(vault: &Path, repo_key: &str) -> AppResult<GitRepoUpdateStatus> {
    // Ensure backfill from skills
    let _ = list_git_repos(vault)?;
    let mut reg = vault::load_registry(vault)?;

    let repo = reg
        .git_repos
        .iter_mut()
        .find(|r| r.key == repo_key)
        .ok_or_else(|| AppError::msg(format!("Git repository not found: {repo_key}")))?;

    let now = now_iso();
    let local = repo.commit.clone();
    match git_ls_remote_head(&repo.uri) {
        Ok(remote) => {
            let update_available = match &local {
                Some(l) => !commits_equal(l, &remote),
                None => true,
            };
            repo.remote_commit = Some(remote.clone());
            repo.last_checked_at = Some(now.clone());
            let status = GitRepoUpdateStatus {
                key: repo.key.clone(),
                uri: repo.uri.clone(),
                label: repo.label.clone(),
                local_commit: local,
                remote_commit: Some(remote),
                update_available,
                last_checked_at: Some(now),
                error: None,
            };
            vault::save_registry(vault, &reg)?;
            Ok(status)
        }
        Err(e) => {
            repo.last_checked_at = Some(now.clone());
            let status = GitRepoUpdateStatus {
                key: repo.key.clone(),
                uri: repo.uri.clone(),
                label: repo.label.clone(),
                local_commit: local,
                remote_commit: repo.remote_commit.clone(),
                update_available: false,
                last_checked_at: Some(now),
                error: Some(e.to_string()),
            };
            let _ = vault::save_registry(vault, &reg);
            Ok(status)
        }
    }
}

/// Concurrent network checks when verifying every tracked git repo.
/// Each `git ls-remote` is I/O-bound; 4 workers is a good balance of speed vs load.
const CHECK_ALL_CONCURRENCY: usize = 3;

/// Check all tracked git repos for remote updates.
/// Runs up to [`CHECK_ALL_CONCURRENCY`] `git ls-remote` calls in parallel, then
/// writes registry metadata once (avoids serial network + per-repo file I/O).
pub fn check_all_git_repo_updates(vault: &Path) -> AppResult<Vec<GitRepoUpdateStatus>> {
    let repos = list_git_repos(vault)?;
    if repos.is_empty() {
        return Ok(vec![]);
    }

    let results: Mutex<Vec<(usize, GitRepoUpdateStatus)>> =
        Mutex::new(Vec::with_capacity(repos.len()));
    let next = AtomicUsize::new(0);
    let n_workers = CHECK_ALL_CONCURRENCY.min(repos.len()).max(1);

    thread::scope(|scope| {
        for _ in 0..n_workers {
            scope.spawn(|| loop {
                let i = next.fetch_add(1, Ordering::Relaxed);
                if i >= repos.len() {
                    break;
                }
                let r = &repos[i];
                let now = now_iso();
                let status = match git_ls_remote_head(&r.uri) {
                    Ok(remote) => {
                        let update_available = match &r.commit {
                            Some(l) => !commits_equal(l, &remote),
                            None => true,
                        };
                        GitRepoUpdateStatus {
                            key: r.key.clone(),
                            uri: r.uri.clone(),
                            label: r.label.clone(),
                            local_commit: r.commit.clone(),
                            remote_commit: Some(remote),
                            update_available,
                            last_checked_at: Some(now),
                            error: None,
                        }
                    }
                    Err(e) => GitRepoUpdateStatus {
                        key: r.key.clone(),
                        uri: r.uri.clone(),
                        label: r.label.clone(),
                        local_commit: r.commit.clone(),
                        remote_commit: r.remote_commit.clone(),
                        update_available: false,
                        last_checked_at: Some(now),
                        error: Some(e.to_string()),
                    },
                };
                results.lock().unwrap().push((i, status));
            });
        }
    });

    let mut pairs = results.into_inner().unwrap_or_default();
    pairs.sort_by_key(|(i, _)| *i);
    let statuses: Vec<GitRepoUpdateStatus> = pairs.into_iter().map(|(_, s)| s).collect();

    // Single registry write after all network checks complete.
    let mut reg = vault::load_registry(vault)?;
    for status in &statuses {
        if let Some(repo) = reg.git_repos.iter_mut().find(|r| r.key == status.key) {
            repo.last_checked_at = status.last_checked_at.clone();
            if status.error.is_none() {
                if let Some(ref remote) = status.remote_commit {
                    repo.remote_commit = Some(remote.clone());
                }
            }
        }
    }
    vault::save_registry(vault, &reg)?;

    Ok(statuses)
}

/// Look up a tracked git repo and the skill ids to overwrite when updating.
pub fn resolve_git_repo_update(
    vault: &Path,
    repo_key: &str,
    overwrite_existing: bool,
) -> AppResult<(String, Vec<String>)> {
    let reg = vault::load_registry(vault)?;
    let repo = reg
        .git_repos
        .iter()
        .find(|r| r.key == repo_key)
        .ok_or_else(|| AppError::msg(format!("Git repository not found: {repo_key}")))?;
    let overwrite_names: Vec<String> = if overwrite_existing {
        reg.skills.iter().map(|s| s.id.clone()).collect()
    } else {
        Vec::new()
    };
    Ok((repo.uri.clone(), overwrite_names))
}

/// Shallow-clone a remote into a temp dir. Safe to run outside the vault I/O lock.
pub fn clone_git_repo_tmp(repo_url: &str) -> AppResult<(PathBuf, Option<String>)> {
    let tmp = temp_git_dir();
    git_clone_shallow(repo_url, &tmp)?;
    let commit = git_rev_parse_head(&tmp);
    Ok((tmp, commit))
}

/// Import skills from an already-cloned temp directory, then remove it.
/// Call under the vault I/O lock.
pub fn import_cloned_git_repo(
    vault: &Path,
    tmp: &Path,
    repo_url: &str,
    overwrite_names: &[String],
    commit: Option<&str>,
) -> AppResult<ImportResult> {
    let result = import_from_folder(
        vault,
        tmp,
        Some(repo_url),
        SourceType::Git,
        None,
        overwrite_names,
        commit,
    );
    let _ = fs::remove_dir_all(tmp);
    result
}

/// Re-clone a tracked git repo and re-import skills (single-threaded convenience path).
/// When `overwrite_existing` is true, any skill id already in the vault is replaced.
#[allow(dead_code)]
pub fn update_git_repo(
    vault: &Path,
    repo_key: &str,
    overwrite_existing: bool,
) -> AppResult<ImportResult> {
    let (uri, overwrite_names) =
        resolve_git_repo_update(vault, repo_key, overwrite_existing)?;
    let (tmp, commit) = clone_git_repo_tmp(&uri)?;
    import_cloned_git_repo(vault, &tmp, &uri, &overwrite_names, commit.as_deref())
}

pub fn delete_skill(vault: &Path, skill_id: &str, unlink_all: bool) -> AppResult<()> {
    let mut reg = vault::load_registry(vault)?;
    let entry = vault::find_skill(&reg, skill_id)?.clone();

    let enables: Vec<_> = reg
        .enables
        .iter()
        .filter(|e| e.skill_id == skill_id)
        .cloned()
        .collect();

    if !enables.is_empty() && !unlink_all {
        return Err(AppError::msg(format!(
            "Skill is enabled in {} project(s). Disable first or pass unlink_all.",
            enables.len()
        )));
    }

    for en in &enables {
        let _ = crate::project_link::remove_project_link(&en.target_path);
    }
    reg.enables.retain(|e| e.skill_id != skill_id);

    let abs = vault::skill_abs_path(vault, &entry);
    if abs.exists() {
        fs::remove_dir_all(&abs)?;
    }
    reg.skills.retain(|s| s.id != skill_id);
    prune_git_repos(&mut reg);
    vault::save_registry(vault, &reg)?;
    Ok(())
}

/// Delete every skill whose repo group key matches (e.g. `github.com/alipay/ai` or `local`).
/// Returns how many skills were removed.
pub fn delete_skills_by_repo(vault: &Path, repo_key: &str, unlink_all: bool) -> AppResult<usize> {
    use crate::models::repo_group;

    let reg = vault::load_registry(vault)?;
    let ids: Vec<String> = reg
        .skills
        .iter()
        .filter(|s| {
            let (key, _) = repo_group(&s.source, &s.origin);
            key == repo_key
        })
        .map(|s| s.id.clone())
        .collect();

    if ids.is_empty() {
        return Err(AppError::msg(format!(
            "No skills found for repository group: {repo_key}"
        )));
    }

    for id in &ids {
        delete_skill(vault, id, unlink_all)?;
    }
    // Prune orphaned git repo records
    let mut reg = vault::load_registry(vault)?;
    prune_git_repos(&mut reg);
    vault::save_registry(vault, &reg)?;
    Ok(ids.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_names() {
        assert!(validate_skill_name("ab").is_ok());
        assert!(validate_skill_name("my-commit").is_ok());
        assert!(validate_skill_name("a").is_err());
        assert!(validate_skill_name("-ab").is_err());
        assert!(validate_skill_name("AB").is_err());
    }

    #[test]
    fn parses_frontmatter() {
        let md = "---\nname: foo\ndescription: bar baz\n---\n\n# Hello\n";
        let fm = parse_skill_md(md);
        assert_eq!(fm.name.as_deref(), Some("foo"));
        assert_eq!(fm.description.as_deref(), Some("bar baz"));
    }
}
