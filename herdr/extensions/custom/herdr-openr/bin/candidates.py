#!/usr/bin/env python3
"""Read only the selected session; preserve URLs absent from rendered pane text."""
import argparse
import collections
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def transcript_path(pane):
    sid = pane.get('agent_session', {}).get('value', '')
    if not re.fullmatch(r'[a-fA-F0-9-]{36}', sid):
        return None
    if pane.get('agent') == 'codex':
        root = Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex')))
        for folder in ('sessions', 'archived_sessions'):
            match = next((root / folder).glob(f'**/*-{sid}.jsonl'), None)
            if match:
                return match
    elif pane.get('agent') == 'claude':
        root = Path(os.environ.get('CLAUDE_CONFIG_DIR', str(Path.home() / '.claude'))) / 'projects'
        slug = re.sub(r'[^a-zA-Z0-9-]', '-', pane.get('cwd', ''))
        exact = root / slug / f'{sid}.jsonl'
        if exact.is_file():
            return exact
        return next(root.glob(f'*/{sid}.jsonl'), None)
    return None


def messages(path, limit=1000):
    with path.open() as stream:
        rows = collections.deque(stream, maxlen=limit)
    for row in rows:
        try:
            record = json.loads(row)
        except ValueError:  # a running agent may be halfway through a write
            continue
        if record.get('type') == 'response_item':
            message = record.get('payload', {})
            if message.get('type') != 'message':
                continue
        elif record.get('type') == 'assistant':
            message = record.get('message', {})
        else:
            continue
        if message.get('role') != 'assistant':
            continue
        for part in message.get('content', []):
            if part.get('type') in ('text', 'output_text'):
                yield part.get('text', '')
            elif part.get('type') == 'tool_use':
                args = part.get('input', {})
                yield args.get('file_path', args.get('notebook_path', ''))


def urls(text):
    # Balanced parentheses are legal URL characters; strip only unmatched closers.
    for match in re.finditer(r'https?://[^\s<>"`\x00-\x1f]+', text):
        url = match.group().rstrip('.,;:!?')
        while url and (url[-1] == "'" or any(
            url.endswith(close) and url.count(close) > url.count(opening)
            for opening, close in [('(', ')'), ('[', ']'), ('{', '}')]
        )):
            url = url[:-1]
        if url:
            yield url


def candidates(texts, cwd, links_only=False):
    seen = set()
    for text in reversed(list(texts)):
        for url in urls(text):
            if url not in seen:
                seen.add(url)
                yield 'url', url
        if links_only:
            continue
        without_urls = re.sub(r'https?://\S+', '', text)
        for match in re.finditer(r'(?:[\w~./@-]+/[\w./@-]+|[\w@-]+\.[\w]+)(?::\d+)?', without_urls):
            target = match.group()
            name = re.sub(r':\d+$', '', target)
            path = Path(name).expanduser()
            if not path.is_absolute():
                path = Path(cwd) / path
            if path.exists() and not str(path).startswith('/dev/'):
                resolved = str(path.resolve())
                if resolved not in seen:
                    seen.add(resolved)
                    yield 'file', target


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pane', required=True)
    parser.add_argument('--cwd', required=True)
    parser.add_argument('--mode', choices=['auto', 'links', 'visible', 'transcript'], default='auto')
    parser.add_argument('--lines', type=int, default=1000)
    args = parser.parse_args()
    herdr = os.environ.get('HERDR_BIN_PATH', 'herdr')
    result = subprocess.run([herdr, 'pane', 'get', args.pane], check=True, capture_output=True, text=True)
    pane = json.loads(result.stdout)['result']['pane']
    path = transcript_path(pane) if args.mode != 'visible' else None
    if path:
        texts = list(messages(path, args.lines))
    elif args.mode == 'transcript':
        sys.exit('No local Claude or Codex transcript for this pane')
    else:
        result = subprocess.run([herdr, 'pane', 'read', args.pane, '--source', 'visible', '--format', 'text'], check=True, capture_output=True, text=True)
        texts = [result.stdout]
    for number, (kind, target) in enumerate(candidates(texts, args.cwd, args.mode == 'links'), 1):
        target = target.replace('\t', ' ').replace('\n', ' ')
        print(f'{kind}\t{target}\t{number:3}  {target}')


if __name__ == '__main__':
    main()
