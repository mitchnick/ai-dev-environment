#!/usr/bin/env python3
"""Small, dependency-free TypeSafe decision client. JSON stdout, errors stderr."""

import argparse
import json
import math
import os
from pathlib import Path
import shlex
import sys
import time
import urllib.error
import urllib.request

ENDPOINT = 'https://api.typesafe.ai/v1/systemone'


def api_key():
    key = os.environ.get('TYPESAFE_API_KEY', '').strip()
    if key:
        return key
    path = Path.home() / '.config/jev/env'
    if path.exists():
        for line in path.read_text().splitlines():
            parts = shlex.split(line, comments=True)
            if parts and parts[0] == 'export':
                parts = parts[1:]
            if len(parts) == 1 and parts[0].startswith('TYPESAFE_API_KEY='):
                key = parts[0].split('=', 1)[1].strip()
                if key:
                    return key
    raise ValueError('Set TYPESAFE_API_KEY or add it to ~/.config/jev/env (chmod 600).')


def probability(value):
    return type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 1


def structured(value):
    return isinstance(value, (str, dict, list))


def validate_questions(questions):
    if not isinstance(questions, dict) or not questions:
        raise ValueError('Questions must be a nonempty JSON object.')
    for name, q in questions.items():
        if not name or not isinstance(q, dict) or not structured(q.get('instructions')):
            raise ValueError('Each named question needs instructions (text, object, or array).')
        kind, criteria = q.get('type'), q.get('criteria')
        if kind == 'choice':
            if not isinstance(criteria, dict) or not 1 <= len(criteria) <= 255:
                raise ValueError('Choice criteria must map 1–255 labels to descriptions.')
            if any(not k or not (v is None or structured(v)) for k, v in criteria.items()):
                raise ValueError('Choice labels must be nonempty; descriptions must be text, JSON, or null.')
        elif kind == 'score':
            if not isinstance(criteria, list) or not 2 <= len(criteria) <= 10 or not all(map(structured, criteria)):
                raise ValueError('Score criteria must contain 2–10 ordered descriptions.')
        elif kind == 'noul':
            if criteria is not None and (not isinstance(criteria, dict) or
                    not set(criteria) <= {'true', 'false'} or not all(map(structured, criteria.values()))):
                raise ValueError('Noul criteria may describe true and false.')
        else:
            raise ValueError('Question type must be choice, noul, or score.')


def validate_response(data, questions):
    answers = data.get('answers') if isinstance(data, dict) else None
    if not isinstance(answers, dict) or set(answers) != set(questions):
        raise ValueError('Provider returned missing or unexpected answers.')
    for name, q in questions.items():
        a = answers[name]
        if not isinstance(a, dict) or a.get('type') != q['type']:
            raise ValueError('Provider returned an invalid answer type.')
        if q['type'] == 'noul':
            if not probability(a.get('noul')):
                raise ValueError('Provider returned an invalid yes probability.')
            continue
        if not probability(a.get('confidence')):
            raise ValueError('Provider returned invalid confidence.')
        keys = set(q['criteria']) if q['type'] == 'choice' else {str(i) for i in range(len(q['criteria']))}
        probs = a.get('probabilities')
        if not isinstance(probs, dict) or set(probs) != keys or not all(map(probability, probs.values())) or abs(sum(probs.values()) - 1) > 0.01:
            raise ValueError('Provider returned an invalid probability distribution.')
        if q['type'] == 'choice':
            if not isinstance(a.get('choice'), str) or a['choice'] not in keys:
                raise ValueError('Provider selected an unknown label.')
        else:
            score = a.get('score')
            if type(score) not in (int, float) or not math.isfinite(score) or not 0 <= score <= len(keys) - 1:
                raise ValueError('Provider returned an invalid score.')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def evaluate(state, questions, timeout=10, model='jev-latest'):
    validate_questions(questions)
    payload = json.dumps({'model': model, 'state': state, 'questions': questions}, allow_nan=False).encode()
    request = urllib.request.Request(ENDPOINT, data=payload, headers={
        'Authorization': 'Bearer ' + api_key(), 'Content-Type': 'application/json',
    })
    start = time.monotonic()
    with urllib.request.build_opener(NoRedirect).open(request, timeout=timeout) as response:
        result = json.load(response)
    validate_response(result, questions)
    result['elapsed_ms'] = round((time.monotonic() - start) * 1000)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['choice', 'yesno', 'score', 'batch'])
    parser.add_argument('question', nargs='?', help='Question, or question-map JSON file for batch')
    parser.add_argument('labels', nargs='*', help='Choice labels or ordered score descriptions')
    parser.add_argument('--criteria', help='Choice description-map JSON file (instead of labels)')
    parser.add_argument('--text', help='Input text; otherwise read stdin through EOF')
    parser.add_argument('--input', choices=['text', 'json'], default='text', help='Stdin format (default: text)')
    parser.add_argument('--timeout', type=float, default=10, help='Network timeout seconds; no automatic retries')
    parser.add_argument('--model', default='jev-latest')
    args = parser.parse_args()
    try:
        if not args.question or not math.isfinite(args.timeout) or args.timeout <= 0:
            raise ValueError('Supply a question and a positive finite timeout.')
        if args.text is None and sys.stdin.isatty():
            raise ValueError('Supply --text or pipe input on stdin.')
        if args.text is not None and args.input == 'json':
            raise ValueError('--text accepts literal text; use stdin for --input json.')
        raw = args.text if args.text is not None else sys.stdin.read()
        state = json.loads(raw) if args.input == 'json' else raw
        if not structured(state) or (args.input == 'text' and not raw.strip()):
            raise ValueError('Supply nonempty text or a JSON string, object, or array.')
        if args.criteria and args.mode != 'choice':
            raise ValueError('--criteria applies only to choice.')
        if args.mode == 'batch':
            if args.labels:
                raise ValueError('Batch accepts one question-map file.')
            questions = json.loads(Path(args.question).read_text())
        else:
            q = {'type': 'noul' if args.mode == 'yesno' else args.mode, 'instructions': args.question}
            if args.mode == 'choice':
                if args.criteria and args.labels:
                    raise ValueError('Use labels or --criteria, not both.')
                if len(set(args.labels)) != len(args.labels):
                    raise ValueError('Choice labels must be unique.')
                q['criteria'] = json.loads(Path(args.criteria).read_text()) if args.criteria else {s: s for s in args.labels}
            elif args.mode == 'score':
                q['criteria'] = args.labels
            elif args.labels:
                raise ValueError('Yesno accepts no labels.')
            questions = {'decision': q}
        result = evaluate(state, questions, args.timeout, args.model)
        print(json.dumps(result, ensure_ascii=False, allow_nan=False))
        return 0
    except urllib.error.HTTPError as exc:
        print(f'jev: provider HTTP {exc.code}; no decision returned.', file=sys.stderr)
    except (urllib.error.URLError, TimeoutError):
        print('jev: connection failed or timed out; no decision returned.', file=sys.stderr)
    except (ValueError, OSError) as exc:
        # Provider bodies and credentials are never included in errors.
        message = 'Invalid JSON input or response.' if isinstance(exc, json.JSONDecodeError) else str(exc)
        print('jev: ' + message, file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
