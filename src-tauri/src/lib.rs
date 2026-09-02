mod commands;
mod error;
mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::workspace::open_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
