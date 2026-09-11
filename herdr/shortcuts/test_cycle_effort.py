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
        pending = patch.object(router, "CODEX_PENDING_PATH", Path(directory.name) / "pending.json")
        pending.start()
        self.addCleanup(pending.stop)

    def test_native_harnesses_receive_only_the_key_in_the_captured_pane(self):
        for kind, key in (("pi", "alt+shift+e"), ("codex", "alt+shift+e")):
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

    def test_pre_patch_process_keeps_legacy_key_until_restart(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(router.os, "kill"):
            pending = Path(directory) / "pending.json"
            pending.write_text("[123]")
            run = Mock(return_value=Mock(stdout=json.dumps({"result": {"process_info": {
                "foreground_processes": [{"pid": 123}],
            }}})))
            self.assertEqual(router.codex_effort_key("w1:p9", "/bin/herdr", run, pending), "alt+.")
            run.return_value.stdout = json.dumps({"result": {"process_info": {
                "foreground_processes": [{"pid": 456}],
            }}})
            self.assertEqual(router.codex_effort_key("w1:p9", "/bin/herdr", run, pending), "alt+shift+e")

    def test_restart_guard_removes_itself_after_old_processes_exit(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(router.os, "kill", side_effect=ProcessLookupError):
            pending = Path(directory) / "pending.json"
            pending.write_text("[123]")
            run = Mock()
            self.assertEqual(router.codex_effort_key("w1:p9", "/bin/herdr", run, pending), "alt+shift+e")
            self.assertFalse(pending.exists())
            run.assert_not_called()

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
