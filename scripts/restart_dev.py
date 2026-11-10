#!/usr/bin/env python3
"""Restart this checkout's Zen build through the Nix dev launcher."""

import os
from pathlib import Path
import shutil
import signal
import sys
import time


def main():
    launcher = shutil.which("zen-dev")
    if not launcher:
        sys.exit("zen-dev is not on PATH; use the Nix-provided dev launcher.")

    root = Path(__file__).resolve().parent.parent
    binaries = {str(path) for path in (root / "engine").glob("obj-*/dist/bin/zen")}

    def browser_pids():
        pids = []
        for process in Path("/proc").glob("[0-9]*"):
            try:
                args = (process / "cmdline").read_bytes().split(b"\0")
                if os.fsdecode(args[0]) in binaries and b"-contentproc" not in args:
                    pids.append(int(process.name))
            except (FileNotFoundError, ProcessLookupError, PermissionError):
                continue
        return pids

    for pid in browser_pids():
        print(f"Stopping Zen (PID {pid})...", flush=True)
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass

    deadline = time.monotonic() + 30
    while browser_pids():
        if time.monotonic() >= deadline:
            sys.exit("Zen did not exit within 30 seconds; restart aborted.")
        time.sleep(0.2)

    print("Starting zen-dev with startup caches purged...", flush=True)
    os.execv(launcher, [launcher, "--purgecaches", *sys.argv[1:]])


if __name__ == "__main__":
    main()
