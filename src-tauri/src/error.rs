use serde::Serialize;

/// Serialized to the frontend as a discriminated union so `ts-pattern` can
/// match on `kind` exhaustively. Every variant carries a `String` so the
/// TypeScript side sees one `message` type across the whole union.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AppError {
    NotFound(String),
    NotADirectory(String),
    Io(String),
    Terminal(String),
    NoSuchTerminal(String),
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}
