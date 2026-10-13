import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
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

    def install_fake(self, version, patch_hash=None):
        binary = self.root / "releases" / version / "bin/codex"
        binary.parent.mkdir(parents=True)
        binary.write_text("verified customized binary")
        binary.with_name("codex-code-mode-host").write_text("matching helper")
        stat = binary.stat()
        manifest_path = self.root / "capabilities.json"
        manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
        manifest[str(binary)] = {
            "version": f"codex-cli {version}",
            "patch_sha256": patch_hash or self.patch_hash,
            "fingerprint": [stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns],
        }
        manifest_path.write_text(json.dumps(manifest))
        current = self.root / "current"
        current.unlink(missing_ok=True)
        current.symlink_to(binary.parent.parent)
        return binary

    def test_current_version_starts_without_build_or_network(self):
        binary = self.install_fake("1.0.0")
        with patch.object(updater, "installed_package", return_value=("1.0.0", self.home)), \
                patch.object(updater, "build") as build:
            self.assertEqual(updater.ensure(self.home), binary)
            build.assert_not_called()

    def test_npm_upgrade_builds_and_selects_matching_custom_release(self):
        previous = self.install_fake("1.0.0")
        def build(version, vendor, root, patch_hash, home):
            self.assertEqual((self.root / "current/bin/codex").resolve(), previous)
            self.install_fake(version, patch_hash)
        with patch.object(updater, "installed_package", return_value=("1.1.0", self.home)), \
                patch.object(updater, "build", side_effect=build) as build_mock:
            binary = updater.ensure(self.home)
            self.assertEqual(binary.parent.parent.name, "1.1.0")
            build_mock.assert_called_once()
        self.assertTrue(previous.exists())

    def test_failed_upgrade_preserves_previous_without_silent_fallback(self):
        previous = self.install_fake("1.0.0")
        with patch.object(updater, "installed_package", return_value=("1.1.0", self.home)), \
                patch.object(updater, "build", side_effect=RuntimeError("patch incompatible")):
            with self.assertRaisesRegex(RuntimeError, "patch incompatible"):
                updater.ensure(self.home)
        self.assertEqual((self.root / "current/bin/codex").resolve(), previous)

    def test_patch_change_and_modified_binary_require_validation(self):
        binary = self.install_fake("1.0.0", "old patch")
        self.assertIsNone(updater.current_release(self.root, "1.0.0", self.patch_hash))
        self.assertEqual(updater.current_release(self.root, "1.0.0", "old patch"), binary)
        binary.write_text("unexpected modification")
        self.assertIsNone(updater.current_release(self.root, "1.0.0", "old patch"))

    def test_second_launcher_rechecks_after_acquiring_build_lock(self):
        previous = self.install_fake("1.0.0")
        newer = self.root / "releases/1.1.0/bin/codex"
        with patch.object(updater, "installed_package", return_value=("1.1.0", self.home)), \
                patch.object(updater, "current_release", side_effect=[None, newer]), \
                patch.object(updater, "build") as build:
            self.assertEqual(updater.ensure(self.home), newer)
            build.assert_not_called()
        self.assertTrue(previous.exists())

    def test_launch_preserves_arguments_and_removes_old_helper_path(self):
        binary = self.install_fake("1.1.0")
        old_path = str(self.root / "releases/1.0.0/bin")
        with patch.object(updater, "launcher_environment", return_value={"PATH": old_path + ":/usr/bin"}), \
                patch.object(updater.os, "execve") as execute:
            updater.launch(binary, ["resume", "two words"])
        executable, args, env = execute.call_args.args
        self.assertEqual(executable, binary)
        self.assertEqual(args, [str(binary), "resume", "two words"])
        self.assertEqual(env["PATH"].split(":"), [
            str(self.home / ".local/bin"), str(binary.parent),
            str(binary.parent.parent / "codex-path"), "/usr/bin"])
        self.assertEqual(env["CODEX_MANAGED_BY_NPM"], "1")

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

    def test_failed_tests_never_call_installer(self):
        vendor = self.home / "vendor"
        vendor.mkdir()
        def run(args, cwd=None, env=None):
            if args[:2] == ["just", "test"]:
                raise subprocess.CalledProcessError(1, args)
        with patch.object(updater, "run", side_effect=run), \
                patch.object(updater.shutil, "which", return_value="/fake/tool"), \
                patch.object(updater.importlib.util, "spec_from_file_location") as installer:
            with self.assertRaises(subprocess.CalledProcessError):
                updater.build("1.1.0", vendor, self.root, self.patch_hash, self.home)
            installer.assert_not_called()


if __name__ == "__main__":
    unittest.main()
