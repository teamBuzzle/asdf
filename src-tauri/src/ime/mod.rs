//! Native IME input for the terminal.
//!
//! WebKit does not deliver usable composition events for Hangul, so the same
//! xterm.js code that composes correctly under Chromium loses characters under
//! WKWebView. Tauri pins WKWebView on macOS, so the fix cannot live in the
//! webview — it has to intercept the keystroke before WebKit sees it.
//!
//! The interception is deliberately narrow. A local key monitor runs ahead of
//! the responder chain; when the active input source is not a CJK one the event
//! is handed straight back and xterm keeps its own, well-tested handling of
//! arrows, control sequences and everything else. Only while a CJK source is
//! active does the event go through AppKit's own text input machinery instead.

#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "macos")]
pub use macos::install;

#[cfg(not(target_os = "macos"))]
pub fn install<R: tauri::Runtime>(_window: &tauri::WebviewWindow<R>) -> Result<(), String> {
    // Windows uses WebView2 (Chromium) and composes correctly on its own.
    Ok(())
}
