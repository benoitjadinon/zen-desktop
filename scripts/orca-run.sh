#!/usr/bin/env bash
# Rebuild the front end and (re)launch this worktree's Zen with a throwaway
# profile. Kills every instance of THIS worktree's build first (never the
# installed zen-custom). Launches by absolute path so the kill pattern matches.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
BIN="$ROOT/engine/obj-x86_64-pc-linux-gnu/dist/bin/firefox"
PROFILE="${ZEN_TEST_PROFILE:-/tmp/zen-worktree-profile}"

(cd engine && ./mach build faster < /dev/null > /tmp/zen-worktree-build.log 2>&1)

kill_all() {
  ps -eo pid,args | grep -F "$ROOT/engine/obj-" | grep -v grep \
    | awk -v me="$$" '$1 != me {print $1}' | xargs -r kill -9 2>/dev/null || true
}
kill_all
for _ in $(seq 20); do
  [ -z "$(ps -eo args | grep -F "$ROOT/engine/obj-" | grep -v grep)" ] && break
  sleep 0.5
done
rm -f "$PROFILE/lock" "$PROFILE/.parentlock"
mkdir -p "$PROFILE"
nohup "$BIN" --profile "$PROFILE" --no-remote > /tmp/zen-worktree-run.log 2>&1 &
sleep 15
if ps -eo args | grep -F "$BIN --profile" | grep -v grep > /dev/null; then
  echo "running"
else
  echo "FAILED to start; see /tmp/zen-worktree-run.log" >&2
  exit 1
fi
