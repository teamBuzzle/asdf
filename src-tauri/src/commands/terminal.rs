use std::sync::Arc;

use tauri::{Emitter, State, Window};

use crate::error::AppError;
use crate::terminal::Registry;

/// Frontend listens for this and writes the chunk straight into the emulator.
const OUTPUT_EVENT: &str = "terminal://output";
/// Payload is the session id whose shell has ended.
const EXIT_EVENT: &str = "terminal://exit";

#[tauri::command]
pub fn open_terminal(
    window: Window,
    registry: State<'_, Arc<Registry>>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<u32, AppError> {
    let exit_window = window.clone();
    registry.inner().open(
        cwd,
        cols,
        rows,
        move |output| {
            let _ = window.emit(OUTPUT_EVENT, output);
        },
        move |id| {
            let _ = exit_window.emit(EXIT_EVENT, id);
        },
    )
}

#[tauri::command]
pub fn write_terminal(
    registry: State<'_, Arc<Registry>>,
    id: u32,
    data: String,
) -> Result<(), AppError> {
    registry.write(id, &data)
}

#[tauri::command]
pub fn resize_terminal(
    registry: State<'_, Arc<Registry>>,
    id: u32,
    cols: u16,
    rows: u16,
) -> Result<(), AppError> {
    registry.resize(id, cols, rows)
}

#[tauri::command]
pub fn close_terminal(registry: State<'_, Arc<Registry>>, id: u32) -> Result<(), AppError> {
    registry.close(id)
}
