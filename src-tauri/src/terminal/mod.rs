use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;

use crate::error::AppError;

mod shell;
pub use shell::default_shell;

/// One byte chunk of terminal output, addressed to a single session.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Output {
    pub id: u32,
    pub chunk: String,
}

struct Session {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Default)]
pub struct Registry {
    sessions: Mutex<HashMap<u32, Session>>,
    next_id: AtomicU32,
}

impl Registry {
    /// Spawns a shell on a new pty. `on_output` is called from a reader thread
    /// for each chunk, then `on_exit` once when the shell is gone.
    pub fn open<F, E>(
        self: &Arc<Self>,
        cwd: Option<String>,
        cols: u16,
        rows: u16,
        on_output: F,
        on_exit: E,
    ) -> Result<u32, AppError>
    where
        F: Fn(Output) + Send + 'static,
        E: Fn(u32) + Send + 'static,
    {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|err| AppError::Terminal(err.to_string()))?;

        let mut command = CommandBuilder::new(default_shell());
        if let Some(cwd) = cwd {
            command.cwd(cwd);
        }
        // Programs check TERM to decide what escape sequences they may emit.
        // Without it many fall back to a dumb terminal with no colour.
        command.env("TERM", "xterm-256color");

        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|err| AppError::Terminal(err.to_string()))?;
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|err| AppError::Terminal(err.to_string()))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|err| AppError::Terminal(err.to_string()))?;

        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        self.sessions.lock().unwrap().insert(
            id,
            Session {
                master: pair.master,
                writer,
                child,
            },
        );

        let registry = Arc::clone(self);
        std::thread::spawn(move || {
            let mut buffer = [0u8; 8192];
            // A read can split a multi-byte character. Carry the incomplete tail
            // to the next read instead of emitting a replacement character.
            let mut carry: Vec<u8> = Vec::new();
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) | Err(_) => break,
                    Ok(count) => {
                        carry.extend_from_slice(&buffer[..count]);
                        let complete = match std::str::from_utf8(&carry) {
                            Ok(_) => carry.len(),
                            Err(err) => err.valid_up_to(),
                        };
                        if complete > 0 {
                            let chunk = String::from_utf8_lossy(&carry[..complete]).into_owned();
                            carry.drain(..complete);
                            on_output(Output { id, chunk });
                        }
                    }
                }
            }
            registry.sessions.lock().unwrap().remove(&id);
            // Without this the UI keeps showing a live terminal over a dead
            // shell, and typing into it silently does nothing.
            on_exit(id);
        });

        Ok(id)
    }

    pub fn write(&self, id: u32, data: &str) -> Result<(), AppError> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get_mut(&id)
            .ok_or_else(|| AppError::NoSuchTerminal(id.to_string()))?;
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|err| AppError::Terminal(err.to_string()))
    }

    pub fn resize(&self, id: u32, cols: u16, rows: u16) -> Result<(), AppError> {
        let sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get(&id)
            .ok_or_else(|| AppError::NoSuchTerminal(id.to_string()))?;
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|err| AppError::Terminal(err.to_string()))
    }

    pub fn close(&self, id: u32) -> Result<(), AppError> {
        if let Some(mut session) = self.sessions.lock().unwrap().remove(&id) {
            let _ = session.child.kill();
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    #[test]
    fn echoes_what_the_shell_prints() {
        let registry = Arc::new(Registry::default());
        let (tx, rx) = mpsc::channel();
        let id = registry
            .open(
                None,
                80,
                24,
                move |out| {
                    let _ = tx.send(out.chunk);
                },
                |_| {},
            )
            .expect("pty opens");

        registry.write(id, "echo asdf-pty-ok\r").expect("write");

        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        let mut seen = String::new();
        while std::time::Instant::now() < deadline {
            if let Ok(chunk) = rx.recv_timeout(Duration::from_millis(500)) {
                seen.push_str(&chunk);
                if seen.contains("asdf-pty-ok") {
                    break;
                }
            }
        }
        registry.close(id).expect("close");
        assert!(seen.contains("asdf-pty-ok"), "shell output was: {seen:?}");
    }

    #[test]
    fn reports_the_shell_exiting() {
        let registry = Arc::new(Registry::default());
        let (tx, rx) = mpsc::channel();
        let id = registry
            .open(
                None,
                80,
                24,
                |_| {},
                move |id| {
                    let _ = tx.send(id);
                },
            )
            .expect("pty opens");

        registry.write(id, "exit\r").expect("write");

        let exited = rx
            .recv_timeout(Duration::from_secs(10))
            .expect("exit callback fires when the shell ends");
        assert_eq!(exited, id);
    }

    /// Guards the reader thread's UTF-8 carry logic: Hangul is 3 bytes per
    /// syllable, so a chunk boundary lands mid-character sooner or later.
    #[test]
    fn round_trips_hangul() {
        let registry = Arc::new(Registry::default());
        let (tx, rx) = mpsc::channel();
        let id = registry
            .open(
                None,
                80,
                24,
                move |out| {
                    let _ = tx.send(out.chunk);
                },
                |_| {},
            )
            .expect("pty opens");

        registry
            .write(id, "echo 안녕하세요-테스트\r")
            .expect("write");

        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        let mut seen = String::new();
        while std::time::Instant::now() < deadline {
            if let Ok(chunk) = rx.recv_timeout(Duration::from_millis(500)) {
                seen.push_str(&chunk);
                if seen.contains("안녕하세요-테스트") {
                    break;
                }
            }
        }
        registry.close(id).expect("close");
        assert!(seen.contains("안녕하세요-테스트"), "got: {seen:?}");
    }

    #[test]
    fn rejects_unknown_session() {
        let registry = Registry::default();
        let Err(AppError::NoSuchTerminal(id)) = registry.write(999, "x") else {
            panic!("expected NoSuchTerminal");
        };
        assert_eq!(id, "999");
    }
}
