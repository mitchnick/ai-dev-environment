#!/usr/bin/env python3
"""Generate a short Herdr pane title from the first prompt in an agent session."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time

MODEL = os.environ.get("HERDR_AUTO_LABEL_MODEL", "openai-codex/gpt-5.6-luna")
SYSTEM_PROMPT = """Return only a lowercase one- or two-word kebab-case label for the functional area of work in the prompt.
Never include the project name. Prefer concrete nouns such as auth-redirect, pane-labels, tests, deployment, or billing.
Do not explain the answer. Do not use punctuation other than one optional hyphen."""
STATE_ROOT = Path(tempfile.gettempdir()) / f"herdr-auto-label-{os.getuid()}"
MAX_PROMPT_CHARS = 6000
LOCK_STALE_SECONDS = 120


def active() -> bool:
    return (
        os.environ.get("HERDR_ENV") == "1"
        and bool(os.environ.get("HERDR_PANE_ID"))
        and shutil.which("herdr") is not None
    )


def metadata_source(harness: str) -> str:
    return f"herdr:auto-label:{harness}"


def agent_source(harness: str) -> str:
    return f"herdr:{harness}"


def state_dir(harness: str, session_id: str, pane_id: str) -> Path:
    digest = hashlib.sha256(f"{harness}\0{session_id}\0{pane_id}".encode()).hexdigest()[:24]
    return STATE_ROOT / digest


def remove_tree(path: Path) -> None:
    if not path.exists():
        return
    for child in path.iterdir():
        if child.is_dir():
            remove_tree(child)
        else:
            child.unlink(missing_ok=True)
    path.rmdir()


# herdr 0.8.0 silently drops --title when --applies-to-source names a session it
# tracks by id rather than by path. Claude reports its session id, pi reports a
# transcript path, so the guard works for pi and breaks the title for claude.
# reset() already clears the title on SessionStart/SessionEnd, so dropping the
# guard here costs nothing.
APPLIES_TO_SOURCE_HARNESSES = {"pi"}


def report_title(harness: str, pane_id: str, label: str | None) -> bool:
    command = [
        "herdr",
        "pane",
        "report-metadata",
        pane_id,
        "--source",
        metadata_source(harness),
        "--agent",
        harness,
    ]
    if harness in APPLIES_TO_SOURCE_HARNESSES:
        command.extend(["--applies-to-source", agent_source(harness)])
    if label is None:
        command.extend(["--clear-title", "--clear-token", "auto_label"])
    else:
        command.extend(["--title", label, "--token", f"auto_label={label}"])

    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=5, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return False
    return result.returncode == 0


def reset(harness: str, session_id: str) -> int:
    if not active() or not session_id:
        return 0
    pane_id = os.environ["HERDR_PANE_ID"]
    path = state_dir(harness, session_id, pane_id)
    try:
        remove_tree(path)
    except OSError:
        pass
    report_title(harness, pane_id, None)
    return 0


def launch(harness: str, session_id: str, prompt: str) -> int:
    if not active() or not session_id or not prompt.strip() or shutil.which("pi") is None:
        return 0

    pane_id = os.environ["HERDR_PANE_ID"]
    path = state_dir(harness, session_id, pane_id)
    done_file = path / "done"
    lock_dir = path / "running"
    path.mkdir(parents=True, exist_ok=True)

    if done_file.exists():
        return 0

    if lock_dir.exists():
        try:
            if time.time() - lock_dir.stat().st_mtime <= LOCK_STALE_SECONDS:
                return 0
            remove_tree(lock_dir)
        except OSError:
            return 0

    try:
        lock_dir.mkdir()
    except FileExistsError:
        return 0

    try:
        worker = subprocess.Popen(
            [sys.executable, __file__, "worker", harness, session_id, pane_id, str(path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            text=True,
            start_new_session=True,
            close_fds=True,
        )
        assert worker.stdin is not None
        worker.stdin.write(prompt[:MAX_PROMPT_CHARS])
        worker.stdin.close()
    except Exception:
        try:
            remove_tree(lock_dir)
        except OSError:
            pass
    return 0


def clean_label(output: str) -> str | None:
    lines = output.strip().splitlines()
    if not lines:
        return None
    candidate = lines[0].strip().strip("`*_ ").lower()
    candidate = re.sub(r"\s+", "-", candidate)
    if len(candidate) > 32:
        return None
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)?", candidate):
        return None
    return candidate


def worker(harness: str, session_id: str, pane_id: str, path: Path, prompt: str) -> int:
    lock_dir = path / "running"
    done_file = path / "done"
    pi = shutil.which("pi")
    if pi is None:
        return 0

    command = [
        pi,
        "-p",
        "--model",
        MODEL,
        "--thinking",
        "off",
        "--no-session",
        "--no-tools",
        "--no-extensions",
        "--no-skills",
        "--no-prompt-templates",
        "--no-themes",
        "--no-context-files",
        "--system-prompt",
        SYSTEM_PROMPT,
    ]

    try:
        result = subprocess.run(
            command,
            input=prompt,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if result.returncode != 0:
            return 0
        label = clean_label(result.stdout)
        if label is None:
            return 0

        if os.environ.get("HERDR_AUTO_LABEL_DRY_RUN") == "1":
            print(label)
            published = True
        else:
            published = report_title(harness, pane_id, label)

        if published:
            done_file.write_text(label + "\n", encoding="utf-8")
        return 0
    finally:
        try:
            remove_tree(lock_dir)
        except OSError:
            pass


def read_hook_input() -> dict:
    try:
        return json.load(sys.stdin)
    except (json.JSONDecodeError, OSError):
        return {}


def main() -> int:
    action = sys.argv[1] if len(sys.argv) > 1 else ""

    if action == "claude-prompt":
        data = read_hook_input()
        if data.get("agent_id"):
            return 0
        # Claude Code sends the text as "prompt"; keep "user_prompt" for older builds.
        prompt = data.get("prompt") or data.get("user_prompt") or ""
        return launch("claude", str(data.get("session_id") or ""), str(prompt))

    if action == "claude-session":
        data = read_hook_input()
        if data.get("agent_id"):
            return 0
        return reset("claude", str(data.get("session_id") or ""))

    if action == "launch" and len(sys.argv) == 4:
        return launch(sys.argv[2], sys.argv[3], sys.stdin.read())

    if action == "reset" and len(sys.argv) == 4:
        return reset(sys.argv[2], sys.argv[3])

    if action == "worker" and len(sys.argv) == 6:
        return worker(sys.argv[2], sys.argv[3], sys.argv[4], Path(sys.argv[5]), sys.stdin.read())

    print("usage: herdr-auto-label.py claude-prompt|claude-session|launch HARNESS SESSION|reset HARNESS SESSION", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
