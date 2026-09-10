"""Synthetic regex regressions; not an implementation of Herdr's detector."""
from pathlib import Path
import re
import unittest
import tomllib


MANIFEST = tomllib.loads(Path(__file__).with_name("claude.toml").read_text())
RULES = {rule["id"]: rule for rule in MANIFEST["rules"]}
SPINNERS = "*·✢✳✶✻✽"


def matches(pattern, text):
    # These expressions share Python/Rust syntax apart from Unicode escapes.
    pattern = re.sub(r"\\x\{([0-9A-Fa-f]+)\}",
                     lambda match: chr(int(match[1], 16)), pattern)
    return re.search(pattern, text) is not None


class ClaudeSpinnerTest(unittest.TestCase):
    def test_live_turn_frames(self):
        pattern = RULES["live_turn_working"]["any"][1]["line_regex"][0]
        for spinner in SPINNERS:
            for suffix in ["", " (12s · ↓ 50 tokens)"]:
                with self.subTest(spinner=spinner, suffix=suffix):
                    self.assertTrue(matches(pattern, f"{spinner} Thinking…{suffix}"))
        self.assertFalse(matches(pattern, "❯ "))

    def test_background_agent_frames(self):
        pattern = RULES["background_agents_working"]["line_regex"][0]
        for spinner in SPINNERS:
            self.assertTrue(matches(pattern, f"{spinner} Waiting for 2 background agents to finish"))
        self.assertFalse(matches(pattern, "✳ Waiting for 0 background agents to finish"))

    def test_background_mcp_frames(self):
        pattern = RULES["background_mcp_task_working"]["regex"][0]
        for spinner in SPINNERS:
            self.assertTrue(matches(pattern, f"{spinner} Thinking · 2 MCP tasks still running"))
        self.assertFalse(matches(pattern, "  ✳ Thinking · 2 MCP tasks still running"))

    def test_only_three_screen_rules_add_frame(self):
        screen_rules = [rule["id"] for rule in MANIFEST["rules"]
                        if rule["region"] != "osc_title" and r"\x{2733}" in str(rule).replace("\\\\", "\\")]
        self.assertEqual(screen_rules, ["live_turn_working", "background_agents_working",
                                        "background_mcp_task_working"])

    def test_osc_title_idle_is_preserved(self):
        rule = RULES["osc_title_idle"]
        self.assertEqual(rule["state"], "idle")
        self.assertEqual(rule["regex"], [r"^\x{2733} "])
        self.assertTrue(matches(rule["regex"][0], "✳ Claude Code"))
        self.assertFalse(matches(RULES["osc_title_working"]["regex"][0], "✳ Claude Code"))

    def test_idle_and_approval_predicates_remain(self):
        idle = RULES["live_prompt_box"]
        self.assertEqual(idle["state"], "idle")
        self.assertTrue(matches(idle["line_regex"][0], "❯ "))
        blocked = RULES["live_blocked_form"]
        self.assertEqual(blocked["state"], "blocked")
        self.assertGreater(blocked["priority"], RULES["live_turn_working"]["priority"])
        dialog = "Choose an option\nEnter to confirm · Esc to cancel".lower()
        self.assertTrue(all(word in dialog for word in blocked["contains"]))
        self.assertTrue(any(all(word in dialog for word in branch.get("contains", []))
                            for branch in blocked["any"]))


if __name__ == "__main__":
    unittest.main()
