use crate::error::AppError;
use crate::workspace::{self, WorkspaceInfo};

#[tauri::command]
pub fn open_workspace(path: String) -> Result<WorkspaceInfo, AppError> {
    workspace::open(&path)
}
