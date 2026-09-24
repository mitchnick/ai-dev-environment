import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("cycle_effort", Path(__file__).with_name("cycle-effort.py"))
router = importlib.util.module_from_spec(spec)
spec.loader.exec_module(router)


class EffortRoutingTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        pending = patch.object(router, "CODEX_CAPABILITIES_PATH", Path(directory.name) / "pending.json")
        pending.start()
        self.addCleanup(pending.stop)

    def test_native_harnesses_receive_only_the_key_in_the_captured_pane(self):
        for kind, key in (("pi", "alt+shift+e"), ("codex", "alt+.")):
            with self.subTest(kind=kind):
                run = Mock(return_value=Mock(returncode=0, stdout=json.dumps({"result": {"agent": {
                    "pane_id": "w1:p9", "agent": kind, "focused": False,
                }}})))
                router.cycle("w1:p9", "/bin/herdr", run)
                self.assertEqual([call.args[0] for call in run.call_args_list], [
                    ["/bin/herdr", "agent", "get", "w1:p9"],
                    ["/bin/herdr", "agent", "send-keys", "w1:p9", key],
                ])

    def test_claude_uses_its_adapter_and_shells_receive_no_input(self):
        for kind in ("claude", "shell", None):
            with self.subTest(kind=kind):
                run = Mock(return_value=Mock(returncode=0, stdout=json.dumps({"result": {"agent": {
                    "pane_id": "w1:p9", "agent": kind,
                }}})))
                router.cycle("w1:p9", "/bin/herdr", run)
                if kind == "claude":
                    self.assertEqual(run.call_args.args[0], [
                        str(Path.home() / ".local/bin/claude-cycle-effort"), "--pane", "w1:p9",
                    ])
                else:
                    self.assertEqual(run.call_count, 1)

    def test_claude_noop_is_normal_but_real_failures_propagate(self):
        agent = Mock(stdout=json.dumps({"result": {"agent": {
            "pane_id": "w1:p9", "agent": "claude",
        }}}))
        run = Mock(side_effect=[agent, Mock(returncode=2)])
        router.cycle("w1:p9", "/bin/herdr", run)
        run = Mock(side_effect=[agent, Mock(returncode=4)])
        with self.assertRaises(subprocess.CalledProcessError):
            router.cycle("w1:p9", "/bin/herdr", run)

    def test_managed_process_and_replaced_binary(self):
        with tempfile.TemporaryDirectory() as directory:
            executable = Path(directory) / "codex"
            executable.write_text("tested executable")
            stat = executable.stat()
            manifest = Path(directory) / "capabilities.json"
            manifest.write_text(json.dumps({str(executable): {"fingerprint": [
                stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns,
            ]}}))
            processes = Mock(stdout=json.dumps({"result": {"process_info": {
                "foreground_processes": [{"pid": 123}],
            }}}))
            for expected in ("alt+shift+e", "alt+."):
                run = Mock(side_effect=[processes, Mock(stdout=str(executable) + "\n")])
                self.assertEqual(router.codex_effort_key("w1:p9", "/bin/herdr", run, manifest), expected)
                executable.write_text("replaced by a package update")

    def test_stock_process_missing_corrupt_manifest_and_detection_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "capabilities.json"
            self.assertEqual(router.codex_effort_key("p", "herdr", Mock(), manifest), "alt+.")
            manifest.write_text("not json")
            self.assertEqual(router.codex_effort_key("p", "herdr", Mock(), manifest), "alt+.")
            manifest.write_text("{}")
            run = Mock(side_effect=subprocess.TimeoutExpired("herdr", 5))
            self.assertEqual(router.codex_effort_key("p", "herdr", run, manifest), "alt+.")
            run = Mock(side_effect=[
                Mock(stdout=json.dumps({"result": {"process_info": {"foreground_processes": [{"pid": 123}]}}})),
                Mock(stdout="/npm/vendor/bin/codex\n"),
            ])
            self.assertEqual(router.codex_effort_key("p", "herdr", run, manifest), "alt+.")

    def test_lookup_failure_or_mismatched_pane_never_sends_keys(self):
        run = Mock(side_effect=subprocess.CalledProcessError(1, "herdr"))
        with self.assertRaises(subprocess.CalledProcessError):
            router.cycle("w1:p9", "/bin/herdr", run)
        self.assertEqual(run.call_count, 1)
        run = Mock(return_value=Mock(stdout=json.dumps({"result": {"agent": {
            "pane_id": "w1:p10", "agent": "codex",
        }}})))
        with self.assertRaises(RuntimeError):
            router.cycle("w1:p9", "/bin/herdr", run)
        self.assertEqual(run.call_count, 1)


if __name__ == "__main__":
    unittest.main()
