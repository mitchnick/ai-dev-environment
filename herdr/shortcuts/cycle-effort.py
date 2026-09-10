#!/usr/bin/env python3
"""Route the shared effort key to the pane captured by Herdr at keypress time."""

import argparse
import json
import os
from pathlib import Path
import subprocess


def cycle(pane_id, herdr, run=subprocess.run):
    result = run(
        [herdr, "agent", "get", pane_id],
        check=True, capture_output=True, text=True, timeout=5,
    )
    agent = json.loads(result.stdout)["result"]["agent"]
    if agent["pane_id"] != pane_id:
        raise RuntimeError("Herdr returned a different pane")
    kind = agent.get("agent")
    if kind == "claude":
        command = [str(Path.home() / ".local/bin/claude-cycle-effort"), "--pane", pane_id]
    elif kind in ("codex", "pi"):
        command = [herdr, "agent", "send-keys", pane_id, "alt+shift+e"]
    else:
        return
    # The Claude adapter owns its bounded waits and cleanup. Killing it here
    # could leave its temporary picker or zoom in place.
    result = run(command, check=False)
    if result.returncode not in ((0, 2) if kind == "claude" else (0,)):
        raise subprocess.CalledProcessError(result.returncode, command)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pane", default=os.environ.get("HERDR_ACTIVE_PANE_ID"))
    args = parser.parse_args()
    if not args.pane:
        parser.error("Herdr must supply HERDR_ACTIVE_PANE_ID, or pass --pane")
    cycle(args.pane, os.environ.get("HERDR_BIN_PATH", "herdr"))


if __name__ == "__main__":
    main()
