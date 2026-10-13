#!/usr/bin/env python3
"""Follow installed npm Codex upgrades while preserving tested personal shortcuts."""
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import re
import shlex
import shutil
import subprocess
import sys
import tempfile

SCRIPTS = Path(__file__).resolve().parent
PATCH = SCRIPTS.parent / "patches/model-effort.patch"


def run(args, cwd=None, env=None):
    print("[codex customizations] " + " ".join(map(str, args)), file=sys.stderr, flush=True)
    subprocess.run(list(map(str, args)), cwd=cwd, env=env, check=True, stdout=sys.stderr)


def npm_installation():
    location = Path.home() / ".local/share/codex-shortcuts/npm.json"
    npm = json.loads(location.read_text())["npm"] if location.exists() else shutil.which("npm")
    if not npm:
        raise RuntimeError("npm is missing from PATH; restore the Node/npm installation")
    env = os.environ.copy()
    env["PATH"] = str(Path(npm).parent) + os.pathsep + env.get("PATH", "")
    return npm, env


def installed_package():
    npm, env = npm_installation()
    root = subprocess.check_output([npm, "root", "-g"], text=True, env=env).strip()
    package = Path(root) / "@openai/codex"
    version = json.loads((package / "package.json").read_text())["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?", version):
        raise RuntimeError(f"Unsupported npm Codex version: {version!r}")
    target = {"arm64": "aarch64-apple-darwin", "x86_64": "x86_64-apple-darwin"}.get(platform.machine())
    if sys.platform != "darwin" or not target:
        raise RuntimeError("This custom Codex installer currently supports macOS only")
    candidates = list(package.glob(f"node_modules/@openai/codex-*/vendor/{target}"))
    candidates += list(package.glob(f"vendor/{target}"))
    if len(candidates) != 1:
        raise RuntimeError("Cannot locate exactly one matching npm Codex helper bundle")
    return version, candidates[0]


def current_release(root, version, patch_hash):
    try:
        binary = (root / "current/bin/codex").resolve(strict=True)
        record = json.loads((root / "capabilities.json").read_text())[str(binary)]
        stat = binary.stat()
        if (record["version"] == f"codex-cli {version}"
                and record.get("patch_sha256") == patch_hash
                and record["fingerprint"] == [stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns]
                and (binary.parent / "codex-code-mode-host").is_file()):
            return binary
    except (OSError, KeyError, ValueError, TypeError):
        pass
    return None


def build(version, vendor, root, patch_hash, home):
    # Keep failed attempts for diagnosis. Never reset a person's source checkout.
    attempts = root / "builds"
    attempts.mkdir(exist_ok=True)
    attempt = Path(tempfile.mkdtemp(prefix=f"{version}-", dir=attempts))
    source = attempt / "source"
    patch = attempt / "customizations.patch"
    shutil.copyfile(PATCH, patch)
    if hashlib.sha256(patch.read_bytes()).hexdigest() != patch_hash:
        raise RuntimeError("Customizations changed before the build; rerun codex")
    run(["git", "clone", "--depth", "1", "--branch", f"rust-v{version}",
         "https://github.com/openai/codex.git", source])
    run(["git", "apply", "--check", patch], cwd=source)
    run(["git", "apply", patch], cwd=source)
    # Snapshot helpers before the long build so concurrent npm updates cannot mix versions.
    helpers = attempt / "vendor"
    shutil.copytree(vendor, helpers)
    env = os.environ.copy()
    env.pop("NO_COLOR", None)
    env.update({
        "PATH": str(home / ".cargo/bin") + os.pathsep + env.get("PATH", ""),
        "CARGO_TARGET_DIR": str(root / "target"),
        "CARGO_BUILD_JOBS": "6",
        "CARGO_PROFILE_RELEASE_DEBUG": "0",
        "CARGO_PROFILE_RELEASE_LTO": "false",
        "CARGO_PROFILE_RELEASE_CODEGEN_UNITS": "16",
        "CARGO_PROFILE_DEV_DEBUG": "0",
        "CARGO_PROFILE_TEST_DEBUG": "0",
    })
    for command in ("cargo", "just"):
        if not shutil.which(command, path=env["PATH"]):
            raise RuntimeError(f"Missing build prerequisite: {command}")
    rust = source / "codex-rs"
    run(["cargo", "fmt", "-p", "codex-tui", "--", "--config", "imports_granularity=Item"], cwd=rust, env=env)
    # Ship an optimized CLI; upstream TUI snapshots assume debug-mode commands.
    run(["cargo", "build", "--release", "-p", "codex-cli"], cwd=rust, env=env)
    run(["cargo", "build", "-p", "codex-cli"], cwd=rust, env=env)
    run(["just", "test", "-p", "codex-tui", "--status-level", "fail"], cwd=source, env=env)
    binary = root / "target/release/codex"
    if installed_package()[0] != version:
        raise RuntimeError("npm changed again during the build; rerun codex to build that version")
    if hashlib.sha256(PATCH.read_bytes()).hexdigest() != patch_hash:
        raise RuntimeError("Customizations changed during the build; rerun codex")
    spec = importlib.util.spec_from_file_location("installer", SCRIPTS / "install-shortcuts.py")
    installer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(installer)
    installer.atomic_text(root / "npm.json", json.dumps({"npm": npm_installation()[0]}) + "\n")
    installer.install(binary, helpers, home, patch_hash=patch_hash)


def ensure(home):
    home = home.resolve()
    root = home / ".local/share/codex-shortcuts"
    root.mkdir(parents=True, exist_ok=True)
    patch_hash = hashlib.sha256(PATCH.read_bytes()).hexdigest()
    version, vendor = installed_package()
    binary = current_release(root, version, patch_hash)
    if binary:
        return binary
    print(f"[codex customizations] Preparing Codex {version} with your shortcuts. "
          "The first build for a release can take several minutes.", file=sys.stderr, flush=True)
    with (root / "update.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("[codex customizations] Waiting for another customization build...", file=sys.stderr)
            fcntl.flock(lock, fcntl.LOCK_EX)
        version, vendor = installed_package()
        binary = current_release(root, version, patch_hash)
        if not binary:
            build(version, vendor, root, patch_hash, home)
            binary = current_release(root, version, patch_hash)
        if not binary:
            raise RuntimeError("Build completed without a verified customized release")
        return binary


def launcher_environment(home):
    """Read only explicitly selected literal dotenv values; never execute a shell file."""
    env = os.environ.copy()
    settings = home / ".codex/launcher-env.json"
    if settings.exists():
        for name, source in json.loads(settings.read_text()).items():
            if env.get(name):
                continue
            if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
                raise RuntimeError("Invalid environment variable name in launcher-env.json")
            pattern = re.compile(r"^\s*(?:export\s+)?" + re.escape(name) + r"=(.*)$")
            for line in Path(source).expanduser().read_text().splitlines():
                match = pattern.match(line)
                if match:
                    values = shlex.split(match[1], comments=True)
                    if len(values) == 1:
                        env[name] = values[0]
            if not env.get(name):
                raise RuntimeError(f"No literal value for {name} in its configured environment source")
    return env


def launch(binary, args):
    bundle = binary.parent.parent
    env = launcher_environment(Path.home())
    # An existing Codex session may have prepended its old bundle to PATH.
    releases = bundle.parent
    paths = [entry for entry in env.get("PATH", "").split(os.pathsep)
             if not Path(entry).is_relative_to(releases)]
    launcher_dir = releases.parent.parent.parent / "bin"
    env["PATH"] = os.pathsep.join([str(launcher_dir), str(bundle / "bin"),
                                   str(bundle / "codex-path"), *paths])
    env["CODEX_MANAGED_BY_NPM"] = "1"
    os.execve(binary, [str(binary), *args], env)


def main():
    args = sys.argv[1:]
    try:
        if args == ["update"]:
            npm, env = npm_installation()
            run([npm, "install", "-g", "@openai/codex@latest"], env=env)
        binary = ensure(Path.home())
        if args == ["update"]:
            print(subprocess.check_output([str(binary), "--version"], text=True).strip())
            print("Customizations verified. Restart/resume existing sessions to use this release.")
        else:
            launch(binary, args)
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"[codex customizations] Upgrade failed: {error}", file=sys.stderr)
        print("The previous customized release is preserved at "
              "~/.local/share/codex-shortcuts/current/bin/codex. "
              "Resolve the reported failure and rerun codex; no stock fallback was activated.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
