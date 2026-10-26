import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("rebuild", Path(__file__).with_name("rebuild-shortcuts.py"))
rebuild = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rebuild)

REPORT = '<testsuites><testsuite name="codex-tui">{}</testsuite></testsuites>'


class RebuildTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.home = Path(self.temporary.name).resolve()
        self.root = self.home / ".local/share/codex-shortcuts"
        self.attempt = self.root / "builds/1.1.0-test"
        (self.attempt / "source/codex-rs/target/nextest/local").mkdir(parents=True)
        self.patch = self.home / "shortcuts.patch"
        self.patch.write_text("tested patch")
        (self.attempt / "customizations.patch").write_text("tested patch")
        (self.attempt / "attempt.json").write_text(json.dumps({"version": "1.1.0"}))
        self.binary = self.root / "target/release/codex"
        self.binary.parent.mkdir(parents=True)
        self.binary.write_text("gated build")
        for mock in (patch.object(rebuild.updater, "PATCH", self.patch),
                     patch.object(rebuild, "build_environment", return_value={})):
            mock.start()
            self.addCleanup(mock.stop)

    def report(self, *failed):
        cases = "".join(f'<testcase name="{name}"><failure/></testcase>' for name in failed)
        (self.attempt / "source/codex-rs/target/nextest/local/junit.xml").write_text(REPORT.format(cases))

    def suite(self, *outcomes):
        """Fake each nextest run in turn: (exit status, tests its report lists as failed)."""
        outcomes = iter(outcomes)
        def run(command, **kwargs):
            status, failed = next(outcomes)
            self.report(*failed)
            return subprocess.CompletedProcess(command, status)
        return patch.object(rebuild.subprocess, "run", side_effect=run)

    def gate_record(self, **changes):
        record = {"version": "1.1.0", "patch_sha256": hashlib.sha256(b"tested patch").hexdigest(),
                  "binary_sha256": hashlib.sha256(b"gated build").hexdigest(), **changes}
        (self.attempt / "gate.json").write_text(json.dumps(record))

    def test_gate_reruns_load_failures_alone_and_records_the_build(self):
        with self.suite((0, []), (100, ["a::slow", "b::flaky"]), (0, [])) as nextest, \
                patch.object(rebuild, "run") as run:
            rebuild.gate(self.attempt, self.root)
        rerun = nextest.call_args_list[2].args[0]
        self.assertEqual(rerun[-4:], ["--test-threads", "1", "-E", "test(=a::slow) | test(=b::flaky)"])
        self.assertEqual(run.call_count, 2)
        record = json.loads((self.attempt / "gate.json").read_text())
        self.assertEqual(record["binary_sha256"], hashlib.sha256(b"gated build").hexdigest())

    def test_gate_refuses_tests_that_fail_alone(self):
        with self.suite((0, []), (100, ["a::broken"]), (100, ["a::broken"])), patch.object(rebuild, "run") as run:
            with self.assertRaisesRegex(RuntimeError, "a::broken"):
                rebuild.gate(self.attempt, self.root)
        run.assert_not_called()
        self.assertFalse((self.attempt / "gate.json").exists())

    def test_gate_stops_at_failing_shortcut_tests(self):
        with self.suite((100, ["personal_shortcuts::cycle"])) as nextest:
            with self.assertRaisesRegex(RuntimeError, "personal shortcut"):
                rebuild.gate(self.attempt, self.root)
        self.assertEqual(nextest.call_count, 1)
        self.assertFalse((self.attempt / "gate.json").exists())

    def test_install_refuses_builds_the_gate_did_not_pass(self):
        with patch.object(rebuild.updater, "installed_package", return_value=("1.1.0", self.home)), \
                patch.object(rebuild.installer, "install") as install:
            with self.assertRaisesRegex(RuntimeError, "not passed the gate"):
                rebuild.install(self.attempt, self.root, self.home)
            self.gate_record(binary_sha256="another build")
            with self.assertRaisesRegex(RuntimeError, "binary changed"):
                rebuild.install(self.attempt, self.root, self.home)
            self.gate_record(patch_sha256="another patch")
            with self.assertRaisesRegex(RuntimeError, "patch changed"):
                rebuild.install(self.attempt, self.root, self.home)
            install.assert_not_called()

    def test_install_refuses_after_npm_moves_on(self):
        self.gate_record()
        with patch.object(rebuild.updater, "installed_package", return_value=("1.2.0", self.home)), \
                patch.object(rebuild.installer, "install") as install:
            with self.assertRaisesRegex(RuntimeError, "1.2.0"):
                rebuild.install(self.attempt, self.root, self.home)
        install.assert_not_called()

    def test_install_installs_the_gated_build_and_checks_its_health(self):
        self.gate_record()
        with patch.object(rebuild.updater, "installed_package", return_value=("1.1.0", self.home)), \
                patch.object(rebuild.updater, "npm_installation", return_value=("/node/bin/npm", {})), \
                patch.object(rebuild.installer, "install") as install, patch.object(rebuild, "run") as run:
            rebuild.install(self.attempt, self.root, self.home)
        install.assert_called_once_with(self.binary, self.attempt / "vendor", self.home,
                                        patch_hash=hashlib.sha256(b"tested patch").hexdigest())
        self.assertEqual(run.call_args.args[0][-1], rebuild.SCRIPTS / "check-shortcuts.py")

    def test_prepare_stops_for_porting_when_the_patch_no_longer_applies(self):
        vendor = self.home / "vendor"
        vendor.mkdir()
        def run(args, cwd=None, env=None):
            if args[:3] == ["git", "apply", "--check"]:
                raise subprocess.CalledProcessError(1, args)
        with patch.object(rebuild.updater, "installed_package", return_value=("1.2.0", vendor)), \
                patch.object(rebuild, "run", side_effect=run):
            self.assertEqual(rebuild.prepare(self.root), 2)
        attempt = next((self.root / "builds").glob("1.2.0-*"))
        self.assertFalse((attempt / "customizations.patch").exists())


if __name__ == "__main__":
    unittest.main()
