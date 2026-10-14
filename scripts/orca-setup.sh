#!/usr/bin/env bash
# Sets up a fresh Orca worktree for building Zen without a new `surfer download`.
#
# The main checkout's engine/ is reflink-copied (copy-on-write on btrfs/xfs, so
# it is near-instant and only changed files take disk). Never symlink engine/:
# `surfer import` writes this worktree's patches into it, which would clobber
# the main checkout's build (and the installed zen-custom, which runs from it).
#
# The objdir is deliberately NOT copied: its config.status holds absolute paths
# to the main checkout, so building from a copy writes into the MAIN objdir.
# Run `./mach build` in the worktree for a fresh one.
set -euo pipefail

MAIN="${ZEN_MAIN_CHECKOUT:-${ORCA_ROOT_PATH:-$HOME/Apps/zen}}"
cd "$(dirname "$0")/.."

if [ "$(realpath .)" = "$(realpath "$MAIN")" ]; then
  echo "refusing to run in the main checkout" >&2
  exit 1
fi

copy() { # copy <path> [rsync-style excludes ignored]; reflink or fail loudly
  [ -e "$1" ] && return 0
  [ -e "$MAIN/$1" ] || return 0
  cp -a --reflink=always "$MAIN/$1" "$1"
}

if [ ! -d engine ]; then
  mkdir engine
  # Everything but the objdir, dotfiles included.
  find "$MAIN/engine" -mindepth 1 -maxdepth 1 ! -name 'obj-*' \
    -exec cp -a --reflink=always {} engine/ \;
  # The copy still carries the main checkout's patches; go back to stock
  # Firefox so `surfer import` applies this worktree's.
  echo y | npx surfer reset
fi
copy .surfer
copy node_modules

# engine/zen and engine/browser/**/zen-* are symlinks into src/ with absolute
# paths; repoint them at this worktree.
npx surfer import
npm run ffprefs

# Zen's locale files are copied into engine/, not linked, and `surfer reset`
# wipes them.
cp -r locales/en-US/browser/browser/. engine/browser/locales/en-US/browser/
