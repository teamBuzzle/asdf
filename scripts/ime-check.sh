#!/usr/bin/env bash
# Types Korean into a freshly launched build through the real macOS IME and
# checks what the terminal actually received.
#
#   pnpm check:ime
#
# Manual testing was the bottleneck while diagnosing the WebKit composition bug,
# and every fix needed another human round trip. This closes that loop.
#
# Requires: a Korean input source selected, and Accessibility permission for the
# terminal running it. Raw key codes are sent rather than characters, because
# AppleScript maps characters through the *active* layout — asking it to type
# "d" under a Korean layout does not produce the `d` key.
set -uo pipefail

BIN="src-tauri/target/release/asdf"
TRACE="${TMPDIR:-/tmp}/asdf-ime-check.log"
EXPECTED="${1:-안녕하세요}"

# 2-Set Korean: d k s s u d g k t p d y  ->  안녕하세요
KEY_CODES=(2 40 1 1 32 2 5 40 17 35 2 16)

[ -x "$BIN" ] || { echo "build first: pnpm tauri build --no-bundle"; exit 2; }

pkill -f "$BIN" 2>/dev/null
sleep 1
: > "$TRACE"
ASDF_IME_TRACE=1 "$BIN" >"$TRACE" 2>&1 &
sleep 5

PID=$(pgrep -f "$BIN" | head -1)
[ -n "$PID" ] || { echo "app failed to start"; cat "$TRACE"; exit 2; }
cleanup() { kill "$PID" 2>/dev/null; }
trap cleanup EXIT

# System Events cannot focus a bare binary, but orca can, and keystrokes follow.
orca computer get-app-state --app "pid:$PID" --restore-window --no-screenshot --json >/dev/null 2>&1
sleep 2

for code in "${KEY_CODES[@]}"; do
  osascript -e "tell application \"System Events\" to key code $code"
  sleep 0.15
done
# The IME commits the final syllable only when something ends it.
osascript -e 'tell application "System Events" to key code 36'
sleep 2

# Every commit the IME made is what the pty received, in order.
# Distinguish "the IME mangled it" from "no keystroke ever arrived" — the
# second is a harness problem and must not read as a product failure.
KEYDOWNS=$(rg -c "keyDown" "$TRACE" 2>/dev/null || echo 0)
if [ "$KEYDOWNS" = "0" ]; then
  echo "no keystrokes reached the app — harness problem, not an IME result."
  echo "macOS grants Accessibility per application, and synthetic keys are"
  echo "dropped when osascript runs under pnpm/node rather than the terminal."
  echo "Run this directly instead:  bash scripts/ime-check.sh"
  exit 2
fi

RECEIVED=$(rg -o '\[ime\] insertText "(.*)"' -r '$1' "$TRACE" | tr -d '\n' | sed 's/\\r$//')

echo "expected: $EXPECTED"
echo "received: $RECEIVED"
echo "trace:    $TRACE"

case "$RECEIVED" in
  "$EXPECTED"*) echo "PASS"; exit 0 ;;
esac
echo "FAIL"
rg -n '\[ime\]' "$TRACE" | head -14
exit 1
