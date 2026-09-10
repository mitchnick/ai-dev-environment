import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from notify import handle, notifier_path


class AttentionTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name)
        self.agent = dict(pane_id="w1:p1", workspace_id="w1", tab_id="w1:t1",
                          terminal_id="term1", state_change_seq=12,
                          agent="codex", agent_status="blocked")
        self.snapshot = dict(agents=[self.agent], workspaces=[], tabs=[])
        self.event = {"data": dict(self.agent)}
        self.send = Mock()
        self.pause = Mock()

    def query(self, *args):
        if args[0] == "agent":
            return {"agent": dict(self.agent)}
        return {"snapshot": self.snapshot}

    def run_hook(self):
        return handle(self.event, self.state, self.query, self.send, self.pause)

    def test_completion_and_other_states_are_silent(self):
        for status in ["done", "idle", "working", "unknown"]:
            self.event["data"]["agent_status"] = status
            self.assertFalse(self.run_hook())
        self.send.assert_not_called()
        self.pause.assert_not_called()

    def test_blocked_once_and_new_blocked_cycle_alerts_again(self):
        self.assertTrue(self.run_hook())
        self.assertFalse(self.run_hook())
        self.agent["state_change_seq"] += 1
        self.assertTrue(self.run_hook())
        self.assertEqual(self.send.call_count, 2)

    def test_resolved_or_closed_during_delay_is_silent(self):
        self.pause.side_effect = lambda _: self.snapshot.update(agents=[])
        self.assertFalse(self.run_hook())
        self.send.assert_not_called()

    def test_new_turn_during_delay_does_not_use_old_event(self):
        self.pause.side_effect = lambda _: self.agent.update(state_change_seq=15)
        self.assertFalse(self.run_hook())
        self.send.assert_not_called()

    def test_failed_delivery_can_retry(self):
        self.send.side_effect = RuntimeError("delivery failed")
        with self.assertRaises(RuntimeError):
            self.run_hook()
        self.send.side_effect = None
        self.assertTrue(self.run_hook())

    def test_replaced_occupant_during_delay_is_silent(self):
        self.pause.side_effect = lambda _: self.agent.update(terminal_id="term2")
        self.assertFalse(self.run_hook())
        self.pause.assert_called_once_with(1)
        self.send.assert_not_called()

    def test_resolved_state_during_delay_is_silent(self):
        self.pause.side_effect = lambda _: self.agent.update(agent_status="working")
        self.assertFalse(self.run_hook())
        self.send.assert_not_called()

    def test_notifier_from_path(self):
        with patch("notify.shutil.which", return_value="/example/bin/terminal-notifier"):
            self.assertEqual(notifier_path(), "/example/bin/terminal-notifier")

    def test_homebrew_fallbacks_without_path(self):
        for prefix in ["/opt/homebrew", "/usr/local"]:
            expected = f"{prefix}/bin/terminal-notifier"
            with patch("notify.shutil.which", return_value=None), \
                 patch("notify.Path.glob", return_value=[]), \
                 patch("notify.Path.is_file", autospec=True,
                       side_effect=lambda path: str(path) == expected), \
                 patch("notify.os.access", return_value=True):
                self.assertEqual(notifier_path(), expected)


if __name__ == "__main__":
    unittest.main()
