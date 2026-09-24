#!/usr/bin/env python3
"""Install a tested Codex build outside package-manager ownership (macOS)."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import tempfile


def fingerprint(path):
    stat = path.stat()
    return [stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns]


def atomic_text(path, text, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix=path.name + ".")
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(text)
        os.chmod(name, mode)
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def install(binary, vendor, home):
    binary, vendor = binary.resolve(), vendor.resolve()
    version = subprocess.check_output([str(binary), "--version"], text=True).strip()
    stock = vendor / "bin/codex"
    if subprocess.check_output([str(stock), "--version"], text=True).strip() != version:
        raise ValueError("The tested build and vendor helper bundle must have matching versions")
    if not (vendor / "bin/codex-code-mode-host").is_file():
        raise ValueError("Missing matching codex-code-mode-host")
    root = home / ".local/share/codex-shortcuts"
    launcher = home / ".local/bin/codex"
    marker = "# ai-dev-environment managed Codex launcher"
    if launcher.exists() or launcher.is_symlink():
        if launcher.is_symlink() or marker not in launcher.read_text():
            raise ValueError(f"Preserve the existing launcher before installing: {launcher}")
    digest = hashlib.sha256(binary.read_bytes()).hexdigest()
    release = root / "releases" / (version.removeprefix("codex-cli ") + "-" + digest[:16])
    release.parent.mkdir(parents=True, exist_ok=True)
    manifest_path = root / "capabilities.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    if release.exists():
        native = release / "bin/codex"
        record = manifest.get(str(native), {})
        if hashlib.sha256(native.read_bytes()).hexdigest() != record.get("sha256"):
            raise ValueError("Existing release is unrecognized or changed; do not reuse it")
    if not release.exists():
        with tempfile.TemporaryDirectory(dir=release.parent) as temporary:
            staged = Path(temporary) / "bundle"
            shutil.copytree(vendor, staged)
            shutil.copy2(binary, staged / "bin/codex")
            subprocess.run(["codesign", "--force", "--sign", "-", str(staged / "bin/codex")], check=True)
            os.rename(staged, release)
    native = release / "bin/codex"
    # Never replace a release in place: existing sessions retain their identity.
    manifest[str(native)] = {"fingerprint": fingerprint(native), "version": version,
                             "sha256": hashlib.sha256(native.read_bytes()).hexdigest()}
    atomic_text(manifest_path, json.dumps(manifest, indent=2) + "\n")
    link = root / f"current.{os.getpid()}"
    link.symlink_to(release)
    os.replace(link, root / "current")
    # Resolve current once, so helper paths and executable always use one bundle.
    atomic_text(launcher, "#!/bin/sh\n" + marker + "\n" +
                "bundle=$(cd " + shlex.quote(str(root / "current")) + " && pwd -P) || exit 1\n" +
                'export PATH="$bundle/bin:$bundle/codex-path:$PATH"\n' +
                'exec "$bundle/bin/codex" "$@"\n', 0o755)
    print(f"Installed {version}: {native}")
    print("Restart/resume existing sessions. npm updates do not replace this build.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, required=True, help="Patched executable after tests pass")
    parser.add_argument("--vendor", type=Path, required=True, help="Matching vendor/<target> directory")
    args = parser.parse_args()
    install(args.binary, args.vendor, Path.home())
