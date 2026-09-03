fn main() {
    #[cfg(windows)]
    vendor_conpty();

    tauri_build::build()
}

/// Puts the vendored ConPTY next to the binary being built.
///
/// portable-pty loads `conpty.dll` from the executable's own directory before
/// falling back to the one in kernel32, and the inbox version on Windows 10
/// deadlocks on teardown. See `vendor/conpty/README.md`. Tests link their own
/// executable under `deps/`, so both directories need a copy.
#[cfg(windows)]
fn vendor_conpty() {
    use std::path::PathBuf;

    let vendor = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("vendor/conpty");
    println!("cargo:rerun-if-changed={}", vendor.display());

    // OUT_DIR is <target>/<profile>/build/<pkg>-<hash>/out.
    let out = PathBuf::from(std::env::var_os("OUT_DIR").expect("OUT_DIR is set"));
    let Some(profile) = out.ancestors().nth(3) else {
        return;
    };

    for dir in [profile.to_path_buf(), profile.join("deps")] {
        if std::fs::create_dir_all(&dir).is_err() {
            continue;
        }
        for file in ["conpty.dll", "OpenConsole.exe"] {
            // A running binary holds its own copy open; leaving the existing one
            // in place is correct, since it is the same build.
            let _ = std::fs::copy(vendor.join(file), dir.join(file));
        }
    }
}
