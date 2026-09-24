#!/usr/bin/env python3
"""Verify the managed launcher, binary integrity, and matching helper bundle."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

root = Path.home() / ".local/share/codex-shortcuts"
try:
    binary = (root / "current/bin/codex").resolve(strict=True)
    manifest = json.loads((root / "capabilities.json").read_text())
    record = manifest[str(binary)]
    stat = binary.stat()
    assert record["fingerprint"] == [stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns], "Binary changed since installation"
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == record["sha256"], "Binary checksum mismatch"
    assert (binary.parent / "codex-code-mode-host").is_file(), "Missing code-mode helper"
    launcher = Path.home() / ".local/bin/codex"
    assert Path(shutil.which("codex") or "") == launcher, "PATH selects another Codex; put ~/.local/bin before npm"
    assert subprocess.check_output([str(launcher), "--version"], text=True).strip() == record["version"], "Launcher version mismatch"
    print(f'OK: {record["version"]}; managed model/effort shortcuts')
    print(binary)
except (OSError, KeyError, ValueError, AssertionError) as error:
    print(f"FAIL: {error}", file=sys.stderr)
    sys.exit(1)
