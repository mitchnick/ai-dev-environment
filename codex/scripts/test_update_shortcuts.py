import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("updater", Path(__file__).with_name("update-shortcuts.py"))
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)


class UpdateTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.home = Path(self.temporary.name).resolve()
        self.root = self.home / ".local/share/codex-shortcuts"
        self.root.mkdir(parents=True)
        self.patch = self.home / "shortcuts.patch"
        self.patch.write_text("tested patch")
        self.patch_hash = hashlib.sha256(self.patch.read_bytes()).hexdigest()
        self.patch_mock = patch.object(updater, "PATCH", self.patch)
        self.patch_mock.start()
        self.addCleanup(self.patch_mock.stop)

    def install_fake(self, version, patch_hash=None, device=None):
        binary = self.root / "releases" / version / "bin/codex"
        binary.parent.mkdir(parents=True)
        binary.write_text("verified customized binary")
        binary.with_name("codex-code-mode-host").write_text("matching helper")
        stat = binary.stat()
        fingerprint = [stat.st_ino, stat.st_size, stat.st_mtime_ns]
        manifest_path = self.root / "capabilities.json"
        manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
        manifest[str(binary)] = {
            "version": f"codex-cli {version}",
            "patch_sha256": patch_hash or self.patch_hash,
            "fingerprint": fingerprint if device is None else [device, *fingerprint],
        }
        manifest_path.write_text(json.dumps(manifest))
        current = self.root / "current"
        current.unlink(missing_ok=True)
        current.symlink_to(binary.parent.parent)
        return binary

    def test_current_version_starts_customized_without_network(self):
        binary = self.install_fake("1.0.0")
        with patch.object(updater, "installed_package", return_value=("1.0.0", self.home)):
            self.assertEqual(updater.select(self.home), binary)

    def test_record_from_before_a_reboot_starts_customized(self):
        # Older records hold the device number, which macOS renumbers at boot.
        binary = self.install_fake("1.0.0", device=16777229)
        with patch.object(updater, "installed_package", return_value=("1.0.0", self.home)):
            self.assertEqual(updater.select(self.home), binary)

    def test_npm_upgrade_starts_stock_at_once_and_names_the_rebuild_skill(self):
        previous = self.install_fake("1.0.0")
        with patch.object(updater, "installed_package", return_value=("1.1.0", self.home)), \
                patch.object(updater.subprocess, "run") as subprocess_run, \
                patch("sys.stderr", new_callable=io.StringIO) as stderr:
            self.assertIsNone(updater.select(self.home))
        subprocess_run.assert_not_called()
        self.assertIn("Codex 1.1.0 is running stock", stderr.getvalue())
        self.assertIn(updater.SKILL, stderr.getvalue())
        self.assertEqual((self.root / "current/bin/codex").resolve(), previous)

    def test_patch_change_and_modified_binary_require_validation(self):
        binary = self.install_fake("1.0.0", "old patch")
        self.assertIsNone(updater.current_release(self.root, "1.0.0", self.patch_hash))
        self.assertEqual(updater.current_release(self.root, "1.0.0", "old patch"), binary)
        binary.write_text("unexpected modification")
        self.assertIsNone(updater.current_release(self.root, "1.0.0", "old patch"))

    def test_launch_preserves_arguments_and_removes_old_helper_path(self):
        binary = self.install_fake("1.1.0")
        old_path = str(self.root / "releases/1.0.0/bin")
        with patch.object(updater, "launcher_environment", return_value={"PATH": old_path + ":/usr/bin"}), \
                patch.object(updater.os, "execve") as execute:
            updater.launch(binary, ["resume", "two words"], self.home)
        executable, args, env = execute.call_args.args
        self.assertEqual(executable, binary)
        self.assertEqual(args, [str(binary), "resume", "two words"])
        self.assertEqual(env["PATH"].split(":"), [
            str(self.home / ".local/bin"), str(binary.parent),
            str(binary.parent.parent / "codex-path"), "/usr/bin"])
        self.assertEqual(env["CODEX_MANAGED_BY_NPM"], "1")

    def test_stock_launch_runs_npm_entry_point_without_managed_paths(self):
        old_path = str(self.root / "releases/1.0.0/bin")
        npm = self.home / "node/bin/npm"
        package = self.home / "node/lib/node_modules/@openai/codex"
        with patch.object(updater, "launcher_environment", return_value={"PATH": old_path + ":/usr/bin"}), \
                patch.object(updater, "npm_installation", return_value=(str(npm), {})), \
                patch.object(updater, "npm_package", return_value=package), \
                patch.object(updater.os, "execve") as execute:
            updater.launch(None, ["resume", "two words"], self.home)
        executable, args, env = execute.call_args.args
        self.assertEqual(executable, npm.with_name("node"))
        self.assertEqual(args, [str(npm.with_name("node")), str(package / "bin/codex.js"), "resume", "two words"])
        self.assertEqual(env["PATH"].split(":"), [str(self.home / ".local/bin"), "/usr/bin"])
        self.assertNotIn("CODEX_MANAGED_BY_NPM", env)

    def test_environment_imports_only_selected_value_without_executing_source(self):
        config = self.home / ".codex"
        config.mkdir()
        source = self.home / "project.env"
        source.write_text('export TEST_TOKEN="test value"\nexport UNRELATED_SECRET="excluded"\nexit 1\n')
        (config / "launcher-env.json").write_text(json.dumps({"TEST_TOKEN": str(source)}))
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(updater.launcher_environment(self.home), {"TEST_TOKEN": "test value"})
        with patch.dict(os.environ, {"TEST_TOKEN": "inherited"}, clear=True):
            self.assertEqual(updater.launcher_environment(self.home), {"TEST_TOKEN": "inherited"})

    def test_remembers_owning_npm_across_project_path_changes(self):
        npm = self.home / "node/bin/npm"
        (self.root / "npm.json").write_text(json.dumps({"npm": str(npm)}))
        with patch.object(updater.Path, "home", return_value=self.home), \
                patch.dict(os.environ, {"PATH": "/other/node/bin:/usr/bin"}, clear=True):
            executable, env = updater.npm_installation()
        self.assertEqual(executable, str(npm))
        self.assertEqual(env["PATH"].split(":")[0], str(npm.parent))


if __name__ == "__main__":
    unittest.main()
