# Vendored ConPTY

`conpty.dll` and `OpenConsole.exe` from the Windows Terminal project (MIT),
version **1.23.2510.08001**, published by Microsoft as the
`Microsoft.Windows.Console.ConPTY` NuGet package. Both files ship together —
`conpty.dll` launches `OpenConsole.exe` from its own directory, so neither works
alone.

## Why they are here

Windows ships a ConPTY inside `kernel32.dll`, and on Windows 10 it deadlocks on
teardown: `ClosePseudoConsole` never returns while a cloned reader handle is
blocked in `read()`, and the reader only unblocks once the pty closes. The app
then exits leaving an orphaned `conhost.exe` spinning on a full core, one per
terminal session. See #19 for the trace.

portable-pty checks for a sideloaded `conpty.dll` next to the executable before
falling back to the kernel32 one (`src/win/psuedocon.rs`, `load_conpty`), so
placing a current build beside the binary replaces the broken inbox version. This
is the same workaround node-pty and wezterm ship, for the same reason.

`build.rs` copies both files next to the compiled binary so `cargo run` and
`cargo test` pick them up; `tauri.windows.conf.json` bundles them into the
Windows installer only. They are dead weight on macOS and Linux and are not
shipped there.

## Refreshing them

Download the `Microsoft.Windows.Console.ConPTY` package from NuGet, take
`runtimes/win-x64/native/conpty.dll` and `OpenConsole.exe` from it, replace both
files here, and update the version above. Keep the two in step — mixing versions
is not supported upstream.
