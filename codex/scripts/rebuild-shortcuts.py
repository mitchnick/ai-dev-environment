#!/usr/bin/env python3
"""Rebuild the Codex shortcut customizations for npm's installed version, one checked step at a time.

The rebuild-codex-shortcuts skill runs these in order:
  prepare                  clone the release, snapshot npm's helpers, apply the patch
  save ATTEMPT             write a port made in ATTEMPT's source back to the patch
  shortcut-tests ATTEMPT   run only the personal shortcut tests (while porting)
  build ATTEMPT            build the release CLI and the debug CLI the TUI tests use
  test ATTEMPT             the gate: every check that must pass before installing
  install ATTEMPT          install the gated build and run the health check
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

SCRIPTS = Path(__file__).resolve().parent
REPO = SCRIPTS.parent.parent
SYSTEM_PYTHON = "/usr/bin/python3"  # The launcher and Herdr's router run on macOS's Python.
BUILD_JOBS = 6
# Upstream's suite runs one test per CPU; under that load its 60-second timeouts trip.
TEST_THREADS = 6
SHORTCUT_TESTS = "test(/personal_shortcuts::/)"


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / file)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


updater = module("updater", "update-shortcuts.py")
installer = module("installer", "install-shortcuts.py")
run = updater.run


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def build_environment(root):
    env = os.environ.copy()
    env.pop("NO_COLOR", None)
    env.update({
        "PATH": str(Path.home() / ".cargo/bin") + os.pathsep + env.get("PATH", ""),
        "CARGO_TARGET_DIR": str(root / "target"),
        "CARGO_BUILD_JOBS": str(BUILD_JOBS),
        "CARGO_PROFILE_RELEASE_DEBUG": "0",
        "CARGO_PROFILE_RELEASE_LTO": "false",
        "CARGO_PROFILE_RELEASE_CODEGEN_UNITS": "16",
        "CARGO_PROFILE_DEV_DEBUG": "0",
        "CARGO_PROFILE_TEST_DEBUG": "0",
    })
    for command in ("cargo", "just", "cargo-nextest"):
        if not shutil.which(command, path=env["PATH"]):
            raise RuntimeError(f"Missing build prerequisite: {command}")
    return env


def prepare(root):
    version, vendor = updater.installed_package()
    attempts = root / "builds"
    attempts.mkdir(parents=True, exist_ok=True)
    # Keep every attempt for diagnosis. Never reset a person's source checkout.
    attempt = Path(tempfile.mkdtemp(prefix=f"{version}-", dir=attempts))
    # Snapshot helpers before the long build so concurrent npm updates cannot mix versions.
    shutil.copytree(vendor, attempt / "vendor")
    source = attempt / "source"
    run(["git", "clone", "--depth", "1", "--branch", f"rust-v{version}",
         "https://github.com/openai/codex.git", source])
    (attempt / "attempt.json").write_text(json.dumps({"version": version}) + "\n")
    try:
        run(["git", "apply", "--check", updater.PATCH], cwd=source)
    except subprocess.CalledProcessError:
        print(f"[codex customizations] The patch does not apply to {version}. Port it in {source}, "
              "then save and prepare again.", file=sys.stderr)
        print(attempt)
        return 2
    run(["git", "apply", updater.PATCH], cwd=source)
    shutil.copyfile(updater.PATCH, attempt / "customizations.patch")
    print(attempt)
    return 0


def save(attempt):
    source = attempt / "source"
    # The build rewrites Cargo.lock's workspace versions; that is not a customization.
    run(["git", "add", "-A", "--", ".", ":(exclude)codex-rs/Cargo.lock"], cwd=source)
    diff = subprocess.check_output(["git", "diff", "--cached", "--binary"], cwd=source)
    if not diff:
        raise RuntimeError("The source has no changes to save")
    updater.PATCH.write_bytes(diff)
    print(f"Saved {updater.PATCH}. Prepare again to apply it to a fresh clone.")


def build(attempt, root):
    rust = attempt / "source/codex-rs"
    env = build_environment(root)
    run(["cargo", "fmt", "-p", "codex-tui", "--", "--config", "imports_granularity=Item"], cwd=rust, env=env)
    # Ship an optimized CLI; upstream TUI snapshots assume debug-mode commands.
    run(["cargo", "build", "--release", "-p", "codex-cli"], cwd=rust, env=env)
    run(["cargo", "build", "-p", "codex-cli"], cwd=rust, env=env)


def tui_tests(attempt, env, *args):
    command = ["just", "test", "-p", "codex-tui", "--status-level", "fail", *args]
    print("[codex customizations] " + " ".join(command), file=sys.stderr, flush=True)
    return subprocess.run(command, cwd=attempt / "source", env=env, stdout=sys.stderr).returncode


def failures(attempt):
    report = ET.parse(attempt / "source/codex-rs/target/nextest/local/junit.xml").getroot()
    return sorted({case.get("name") for case in report.iter("testcase")
                   if case.find("failure") is not None or case.find("error") is not None})


def shortcut_tests(attempt, root):
    if tui_tests(attempt, build_environment(root), "-E", SHORTCUT_TESTS):
        raise RuntimeError("The personal shortcut tests failed")


def gate(attempt, root):
    env = build_environment(root)
    print("[codex customizations] Gate 1/4: personal shortcut tests", file=sys.stderr)
    shortcut_tests(attempt, root)
    print("[codex customizations] Gate 2/4: the TUI suite", file=sys.stderr)
    if tui_tests(attempt, env, "--test-threads", str(TEST_THREADS)):
        failed = failures(attempt)
        if not failed:
            raise RuntimeError("The TUI suite failed without naming a failed test")
        print(f"[codex customizations] Rerunning {len(failed)} failed tests one at a time", file=sys.stderr)
        if tui_tests(attempt, env, "--test-threads", "1", "-E", " | ".join(f"test(={name})" for name in failed)):
            raise RuntimeError("These TUI tests fail even alone: " + ", ".join(failures(attempt)))
        print("[codex customizations] Passed alone: " + ", ".join(failed), file=sys.stderr)
    print("[codex customizations] Gate 3/4: launcher, installer and rebuild tests", file=sys.stderr)
    run([SYSTEM_PYTHON, "-B", "-m", "unittest", "discover", "-s", SCRIPTS])
    print("[codex customizations] Gate 4/4: Herdr shortcut router tests", file=sys.stderr)
    run([SYSTEM_PYTHON, "-B", "-m", "unittest", "discover", "-s", REPO / "herdr/shortcuts",
         "-p", "test_cycle_effort.py"])
    record = {"version": json.loads((attempt / "attempt.json").read_text())["version"],
              "patch_sha256": sha256(attempt / "customizations.patch"),
              "binary_sha256": sha256(root / "target/release/codex")}
    installer.atomic_text(attempt / "gate.json", json.dumps(record, indent=2) + "\n")
    print(f"Gate passed for Codex {record['version']}. Install with: install {attempt}")


def install(attempt, root, home):
    try:
        record = json.loads((attempt / "gate.json").read_text())
    except FileNotFoundError:
        raise RuntimeError("This attempt has not passed the gate; run test first") from None
    binary = root / "target/release/codex"
    version, _vendor = updater.installed_package()
    if record["binary_sha256"] != sha256(binary):
        raise RuntimeError("The release binary changed after its gate; build and test this attempt again")
    if record["version"] != version:
        raise RuntimeError(f"npm now has Codex {version}; start again from prepare")
    if record["patch_sha256"] != sha256(updater.PATCH):
        raise RuntimeError("The patch changed after its gate; start again from prepare")
    installer.atomic_text(root / "npm.json", json.dumps({"npm": updater.npm_installation()[0]}) + "\n")
    installer.install(binary, attempt / "vendor", home, patch_hash=record["patch_sha256"])
    run([SYSTEM_PYTHON, SCRIPTS / "check-shortcuts.py"])


def main():
    args = sys.argv[1:]
    home = Path.home().resolve()
    root = home / ".local/share/codex-shortcuts"
    steps = {
        "save": save,
        "shortcut-tests": lambda attempt: shortcut_tests(attempt, root),
        "build": lambda attempt: build(attempt, root),
        "test": lambda attempt: gate(attempt, root),
        "install": lambda attempt: install(attempt, root, home),
    }
    try:
        if args == ["prepare"]:
            return prepare(root)
        if len(args) == 2 and args[0] in steps:
            steps[args[0]](Path(args[1]).resolve())
            return 0
    except (OSError, ValueError, RuntimeError, ET.ParseError, subprocess.CalledProcessError) as error:
        print(f"[codex customizations] {args[0]} failed: {error}", file=sys.stderr)
        return 1
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
