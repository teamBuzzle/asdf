/// The shell to spawn for a new session.
///
/// Unix honours `$SHELL`, which is what the user actually chose in their account
/// settings. Windows has no such variable, so it prefers PowerShell 7 when it is
/// installed and otherwise falls back to the Windows PowerShell that ships with
/// the OS.
pub fn default_shell() -> String {
    #[cfg(unix)]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_owned())
    }

    #[cfg(windows)]
    {
        if which("pwsh.exe") {
            "pwsh.exe".to_owned()
        } else {
            "powershell.exe".to_owned()
        }
    }
}

#[cfg(windows)]
fn which(program: &str) -> bool {
    std::env::var_os("PATH")
        .map(|paths| std::env::split_paths(&paths).any(|dir| dir.join(program).is_file()))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_a_shell() {
        let shell = default_shell();
        assert!(!shell.is_empty());
        #[cfg(unix)]
        assert!(shell.starts_with('/'), "expected an absolute path: {shell}");
        #[cfg(windows)]
        assert!(shell.ends_with(".exe"), "expected an executable: {shell}");
    }
}
