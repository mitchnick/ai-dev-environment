"""Herdr event hook: one desktop alert per sustained blocked state."""

import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time


def herdr(*args):
    result = subprocess.run(
        [os.environ.get("HERDR_BIN_PATH", "herdr"), *args],
        check=True, capture_output=True, text=True, timeout=5,
    )
    return json.loads(result.stdout)["result"]


def blocked_token(agent):
    if agent.get("agent_status") != "blocked":
        return None
    return [agent.get("terminal_id"), agent.get("state_change_seq")]


def notifier_path():
    installed = shutil.which("terminal-notifier")
    if installed:
        return installed
    candidates = [Path("/opt/homebrew/bin/terminal-notifier"),
                  Path("/usr/local/bin/terminal-notifier")]
    candidates.extend(sorted(Path.home().glob(
        ".rbenv/versions/*/lib/ruby/gems/*/gems/terminal-notifier-*/vendor/"
        "terminal-notifier/terminal-notifier.app/Contents/MacOS/terminal-notifier"
    ), reverse=True))
    for candidate in candidates:
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    raise RuntimeError("terminal-notifier is required for desktop alerts")


def deliver(title, body, group):
    subprocess.run(["/usr/bin/afplay", "/System/Library/Sounds/Ping.aiff"],
                   check=True, capture_output=True, timeout=5)
    subprocess.run([
        notifier_path(), "-title", title, "-message", body,
        "-group", group,
        "-activate", "com.mitchellh.ghostty",
    ], check=True, capture_output=True, text=True, timeout=10)


def handle(event, state_dir, query=herdr, send=deliver, pause=time.sleep):
    data = event.get("data", {})
    if data.get("agent_status") != "blocked":
        return False
    pane_id = data["pane_id"]
    first = query("agent", "get", pane_id)["agent"]
    token = blocked_token(first)
    if token is None:
        return False
    pause(1)
    snapshot = query("api", "snapshot")["snapshot"]
    agent = next((a for a in snapshot["agents"] if a["pane_id"] == pane_id), {})
    if blocked_token(agent) != token:
        return False

    # Lock across event-hook processes. Renames and repeated reports must not ding again.
    socket_path = os.environ.get("HERDR_SOCKET_PATH", "default")
    key = hashlib.sha256(f"{socket_path}:{pane_id}".encode()).hexdigest()[:24]
    state_dir.mkdir(parents=True, exist_ok=True)
    with (state_dir / f"{key}.json").open("a+") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        handle.seek(0)
        previous = handle.read()
        if previous and json.loads(previous) == token:
            return False
        workspace = next((w for w in snapshot["workspaces"]
                          if w["workspace_id"] == agent["workspace_id"]), {})
        tab = next((t for t in snapshot["tabs"] if t["tab_id"] == agent["tab_id"]), {})
        label = agent.get("title") or agent.get("agent", "Agent")
        body = " · ".join(filter(None, [workspace.get("label"), tab.get("label"), pane_id]))
        send(f"{label} needs input", body, f"herdr-attention-{key}")
        handle.seek(0)
        handle.truncate()
        json.dump(token, handle)
    return True


if __name__ == "__main__":
    event = json.loads(os.environ.get("HERDR_PLUGIN_EVENT_JSON", "{}"))
    state_dir = Path(os.environ.get(
        "HERDR_PLUGIN_STATE_DIR", str(Path.home() / ".local/state/herdr-attention")
    ))
    try:
        if handle(event, state_dir):
            print("Delivered needs-input desktop alert")
    except subprocess.CalledProcessError as error:
        # A pane can close between the event and the delayed state check.
        if '"agent_not_found"' not in (error.stderr or ""):
            raise
