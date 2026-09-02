use serde::Serialize;

/// Serialized to the frontend as a discriminated union so `ts-pattern` can
/// match on `kind` exhaustively.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AppError {
    NotFound(String),
    NotADirectory(String),
    Io(String),
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}
