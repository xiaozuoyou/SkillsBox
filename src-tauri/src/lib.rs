mod commands;
mod config;
mod error;
mod models;
mod project_link;
mod skill_fs;
mod vault;

use commands::{init_vault, AppCtx};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            let vault = init_vault(app.handle())?;
            app.manage(Mutex::new(AppCtx {
                vault_path: vault,
                vault_io: std::sync::Arc::new(Mutex::new(())),
            }));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_state,
            commands::list_skills,
            commands::set_skill_active,
            commands::get_skill,
            commands::create_skill,
            commands::delete_skill,
            commands::delete_skills_by_repo,
            commands::import_skill_folder,
            commands::preview_import_folder,
            commands::list_folder_skills,
            commands::import_skill_git,
            commands::preview_import_git,
            commands::list_git_repos,
            commands::check_git_repo_update,
            commands::check_all_git_repo_updates,
            commands::update_git_repo,
            commands::enable_skill,
            commands::disable_skill,
            commands::list_project_enables,
            commands::pick_folder,
            commands::open_path,
            commands::set_vault_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
