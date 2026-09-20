import contextlib
import io
import json
import unittest
from unittest.mock import patch, Mock

import jev


class JevTest(unittest.TestCase):
    def test_request_and_response(self):
        questions = {'team': {'type': 'choice', 'instructions': 'Which team?',
                              'criteria': {'billing': 'Payments', 'other': 'Other'}}}
        response = {'answers': {'team': {'type': 'choice', 'choice': 'billing',
                    'confidence': 0.8, 'probabilities': {'billing': 0.9, 'other': 0.1}}}}
        opener = Mock()
        opener.open.return_value.__enter__ = Mock(return_value=io.StringIO(json.dumps(response)))
        opener.open.return_value.__exit__ = Mock(return_value=False)
        with patch.object(jev, 'api_key', return_value='test-key'), patch.object(jev.urllib.request, 'build_opener', return_value=opener):
            result = jev.evaluate({'text': 'Refund please'}, questions)
        request = opener.open.call_args.args[0]
        self.assertEqual(json.loads(request.data)['state'], {'text': 'Refund please'})
        self.assertEqual(json.loads(request.data)['questions'], questions)
        self.assertEqual(request.get_header('Authorization'), 'Bearer test-key')
        self.assertEqual(result['answers'], response['answers'])

    def test_invalid_answers_fail(self):
        q = {'q': {'type': 'choice', 'criteria': {'yes': 'Yes', 'no': 'No'}}}
        valid = {'type': 'choice', 'choice': 'yes', 'confidence': 0.9,
                 'probabilities': {'yes': 0.95, 'no': 0.05}}
        for changes in ({'choice': 'invented'}, {'confidence': True},
                        {'confidence': float('nan')}, {'probabilities': {'yes': 1}},
                        {'probabilities': {'yes': 0.1, 'no': 0.1}}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                jev.validate_response({'answers': {'q': dict(valid, **changes)}}, q)

    def test_no_is_valid(self):
        jev.validate_response({'answers': {'q': {'type': 'noul', 'noul': 0}}}, {'q': {'type': 'noul'}})

    def test_cli_does_not_send_bad_input(self):
        for args in (['choice', 'Which?', 'same', 'same'], ['score', 'Rate?', 'one'], ['yesno', 'Question?', 'extra']):
            with self.subTest(args=args), patch('sys.argv', ['jev', *args, '--text', 'test']), patch.object(jev, 'api_key') as key, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(jev.main(), 1)
                key.assert_not_called()

    def test_failure_has_no_stdout_or_response_body(self):
        error = jev.urllib.error.HTTPError(jev.ENDPOINT, 401, 'private body', {}, None)
        with patch('sys.argv', ['jev', 'yesno', 'Question?', '--text', 'test']), patch.object(jev, 'evaluate', side_effect=error), contextlib.redirect_stdout(io.StringIO()) as out, contextlib.redirect_stderr(io.StringIO()) as err:
            self.assertEqual(jev.main(), 1)
            self.assertEqual(out.getvalue(), '')
            self.assertNotIn('private body', err.getvalue())


if __name__ == '__main__':
    unittest.main()
