#!/usr/bin/env python3
"""Launch the tested customized Codex for npm's installed version, or stock Codex until it is rebuilt."""
import functools
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shlex
import shutil
import subprocess
import sys

SCRIPTS = Path(__file__).resolve().parent
PATCH = SCRIPTS.parent / "patches/model-effort.patch"
SKILL = "rebuild-codex-shortcuts"


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


@functools.lru_cache(maxsize=None)
def npm_package():
    npm, env = npm_installation()
    root = subprocess.check_output([npm, "root", "-g"], text=True, env=env).strip()
    return Path(root) / "@openai/codex"


def installed_package():
    package = npm_package()
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
        # Older records lead with st_dev, which macOS renumbers at boot; compare the rest.
        if (record["version"] == f"codex-cli {version}"
                and record.get("patch_sha256") == patch_hash
                and record["fingerprint"][-3:] == [stat.st_ino, stat.st_size, stat.st_mtime_ns]
                and (binary.parent / "codex-code-mode-host").is_file()):
            return binary
    except (OSError, KeyError, ValueError, TypeError):
        pass
    return None


def select(home):
    """Return the tested customized executable for npm's version, or None to start stock Codex."""
    root = home.resolve() / ".local/share/codex-shortcuts"
    version, _vendor = installed_package()
    binary = current_release(root, version, hashlib.sha256(PATCH.read_bytes()).hexdigest())
    if not binary:
        print(f"[codex customizations] Codex {version} is running stock, without your shortcuts. "
              f"To rebuild them, ask an agent to run the {SKILL} skill.", file=sys.stderr, flush=True)
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


def launch(binary, args, home=None):
    home = home or Path.home()
    env = launcher_environment(home)
    # An existing Codex session may have prepended its old bundle to PATH.
    releases = home / ".local/share/codex-shortcuts/releases"
    paths = [entry for entry in env.get("PATH", "").split(os.pathsep)
             if not Path(entry).is_relative_to(releases)]
    if binary is None:
        # npm's own entry point chooses the stock executable and its environment.
        executable = Path(npm_installation()[0]).with_name("node")
        argv = [str(executable), str(npm_package() / "bin/codex.js"), *args]
        env["PATH"] = os.pathsep.join([str(home / ".local/bin"), *paths])
    else:
        bundle = binary.parent.parent
        executable, argv = binary, [str(binary), *args]
        env["PATH"] = os.pathsep.join([str(home / ".local/bin"), str(bundle / "bin"),
                                       str(bundle / "codex-path"), *paths])
        env["CODEX_MANAGED_BY_NPM"] = "1"
    os.execve(executable, argv, env)


def main():
    args = sys.argv[1:]
    try:
        if args == ["update"]:
            npm, env = npm_installation()
            run([npm, "install", "-g", "@openai/codex@latest"], env=env)
            binary = select(Path.home())
            print(subprocess.check_output([str(binary), "--version"], text=True).strip() + " with your shortcuts"
                  if binary else f"Codex {installed_package()[0]} installed; it runs stock until rebuilt.")
        else:
            launch(select(Path.home()), args)
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"[codex customizations] Launch failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
