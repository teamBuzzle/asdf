use std::path::Path;

use serde::Serialize;

use crate::error::AppError;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub path: String,
    pub name: String,
    pub is_git_repo: bool,
}

pub fn open(raw: &str) -> Result<WorkspaceInfo, AppError> {
    let path = Path::new(raw);
    if !path.exists() {
        return Err(AppError::NotFound(raw.to_owned()));
    }
    if !path.is_dir() {
        return Err(AppError::NotADirectory(raw.to_owned()));
    }

    let path = path.canonicalize()?;
    Ok(WorkspaceInfo {
        name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_owned(),
        is_git_repo: path.join(".git").exists(),
        path: path.to_string_lossy().into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_missing_path() {
        let err = open("/definitely/does/not/exist").unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }

    #[test]
    fn rejects_file() {
        let file = std::env::current_exe().unwrap();
        let err = open(file.to_str().unwrap()).unwrap_err();
        assert!(matches!(err, AppError::NotADirectory(_)));
    }

    #[test]
    fn reads_a_directory() {
        let dir = std::env::temp_dir();
        let info = open(dir.to_str().unwrap()).unwrap();
        assert!(!info.name.is_empty());
        assert!(!info.is_git_repo);
    }

    #[test]
    fn detects_a_git_repo() {
        let repo = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
        let info = open(repo.to_str().unwrap()).unwrap();
        assert!(info.is_git_repo);
    }
}
