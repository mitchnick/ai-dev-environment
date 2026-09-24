#!/usr/bin/env python3
"""Route the shared effort key to the pane captured by Herdr at keypress time."""

import argparse
import json
import os
from pathlib import Path
import subprocess

CODEX_CAPABILITIES_PATH = Path.home() / ".local/share/codex-shortcuts/capabilities.json"


def codex_effort_key(pane_id, herdr, run, capabilities_path=None):
    """Only send the custom key to an identified, unchanged managed executable."""
    path = capabilities_path or CODEX_CAPABILITIES_PATH
    try:
        capabilities = json.loads(path.read_text())
        if not isinstance(capabilities, dict):
            return "alt+."
        result = run(
            [herdr, "pane", "process-info", "--pane", pane_id],
            check=True, capture_output=True, text=True, timeout=5,
        )
        processes = json.loads(result.stdout)["result"]["process_info"]["foreground_processes"]
        for process in processes:
            pid = int(process["pid"])
            if pid <= 0:
                continue
            result = run(["/bin/ps", "-p", str(pid), "-o", "comm="],
                         check=True, capture_output=True, text=True, timeout=5)
            executable = Path(result.stdout.strip())
            record = capabilities.get(str(executable))
            if record:
                stat = executable.stat()
                actual = [stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns]
                if actual == record["fingerprint"]:
                    return "alt+shift+e"
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        pass
    # Stock, old sessions, missing manifest, and failed detection all use the
    # upstream increase shortcut. It stops at the upper bound; it cannot wrap.
    return "alt+."


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
