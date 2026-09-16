import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('candidates', Path(__file__).parent / 'bin/candidates.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class CandidatesTest(unittest.TestCase):
    def test_markdown_and_balanced_parentheses(self):
        text = '[docs](https://example.org/wiki/A_(B)) and <https://example.org/a?q=one&b=two>. '
        self.assertEqual(list(m.urls(text)), ['https://example.org/wiki/A_(B)', 'https://example.org/a?q=one&b=two'])

    def test_newest_occurrence_and_links_only(self):
        self.assertEqual(list(m.candidates(['https://a.test https://b.test', 'https://b.test https://c.test'], '.', True)),
                         [('url', 'https://b.test'), ('url', 'https://c.test'), ('url', 'https://a.test')])

    def test_transcripts_exclude_user_tools_and_reasoning(self):
        rows = [
            {'type':'assistant','message':{'role':'assistant','content':[{'type':'text','text':'https://claude.test'}]}},
            {'type':'response_item','payload':{'type':'message','role':'assistant','content':[{'type':'output_text','text':'https://codex.test'}]}},
            {'type':'response_item','payload':{'type':'message','role':'user','content':[{'type':'input_text','text':'https://private.test'}]}},
            {'type':'event_msg','payload':{'type':'task_complete','last_agent_message':'https://duplicate.test'}},
            {'type':'assistant','message':{'role':'assistant','content':[{'type':'thinking','thinking':'https://reasoning.test'}]}}
        ]
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)/'test.jsonl'
            p.write_text('\n'.join(map(json.dumps, rows))+'\n{"partial":')
            self.assertEqual(list(m.messages(p)), ['https://claude.test','https://codex.test'])

    def test_session_resolution(self):
        sid='11111111-2222-3333-4444-555555555555'
        with tempfile.TemporaryDirectory() as d, patch.dict(os.environ, {'CODEX_HOME':d,'CLAUDE_CONFIG_DIR':d}):
            p=Path(d)/'sessions/2026/09/16'/f'rollout-date-{sid}.jsonl'
            p.parent.mkdir(parents=True);p.touch()
            self.assertEqual(m.transcript_path({'agent':'codex','agent_session':{'value':sid}}),p)
            q=Path(d)/'projects/-tmp-demo'/f'{sid}.jsonl'
            q.parent.mkdir(parents=True);q.touch()
            self.assertEqual(m.transcript_path({'agent':'claude','cwd':'/tmp/demo','agent_session':{'value':sid}}),q)
            self.assertIsNone(m.transcript_path({'agent':'codex','agent_session':{'value':'../*'}}))

if __name__ == '__main__':
    unittest.main()
