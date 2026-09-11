#!/usr/bin/env python3
"""Route the shared effort key to the pane captured by Herdr at keypress time."""

import argparse
import json
import os
from pathlib import Path
import subprocess

CODEX_PENDING_PATH = Path(__file__).with_name("codex-effort-pending.json")


def codex_effort_key(pane_id, herdr, run, pending_path=None):
    # Installation records pre-patch processes so the new chord cannot type
    # a stray E into an old session before the user restarts it.
    pending_path = pending_path or CODEX_PENDING_PATH
    try:
        pending = json.loads(pending_path.read_text())
    except FileNotFoundError:
        return "alt+shift+e"
    if pending:
        alive = []
        for pid in pending:
            try:
                os.kill(pid, 0)
                alive.append(pid)
            except ProcessLookupError:
                pass
        if alive:
            result = run(
                [herdr, "pane", "process-info", "--pane", pane_id],
                check=True, capture_output=True, text=True, timeout=5,
            )
            processes = json.loads(result.stdout)["result"]["process_info"]["foreground_processes"]
            if any(process["pid"] in alive for process in processes):
                return "alt+."
        else:
            pending_path.unlink(missing_ok=True)
    return "alt+shift+e"


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
    elif kind == "codex":
        command = [herdr, "agent", "send-keys", pane_id, codex_effort_key(pane_id, herdr, run)]
    elif kind == "pi":
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
