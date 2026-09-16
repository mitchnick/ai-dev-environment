"""Exercise real fzf in a PTY, with browser and clipboard commands intercepted."""
import fcntl
import os
from pathlib import Path
import pty
import select
import shutil
import signal
import struct
import tempfile
import termios
import time
import unittest

ROOT = Path(__file__).parent.resolve()

@unittest.skipUnless(shutil.which('fzf'), 'fzf required for picker integration')
class PickerTest(unittest.TestCase):
    def run_picker(self, key):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            url = 'https://example.test/a_(b)?one=1&two=2'
            listing = root/'list.tsv'
            listing.write_text(f'url\t{url}\t  1  {url}\n')
            result = root/'result'
            for name, script in [('pbcopy', 'cat > "$OPENR_TEST_RESULT"'), ('open', 'printf "%s" "$1" > "$OPENR_TEST_RESULT"')]:
                p=root/name;p.write_text('#!/bin/sh\n'+script+'\n');p.chmod(0o755)
            pid, fd = pty.fork()
            if pid == 0:
                os.environ.update(TERM='xterm-256color', PATH=str(root)+':'+os.environ['PATH'],
                                  HOME=str(root), OPENR_LIST=str(listing), OPENR_CWD=directory,
                                  HERDR_PLUGIN_ROOT=str(ROOT), OPENR_TEST_RESULT=str(result),
                                  FZF_DEFAULT_OPTS='', FZF_DEFAULT_OPTS_FILE='/dev/null')
                os.execv('/bin/zsh', ['zsh', str(ROOT/'bin/pane-pick')])
            try:
                fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', 30, 120, 0, 0))
                output=b''; deadline=time.monotonic()+8; sent=False;status=None
                while time.monotonic()<deadline:
                    if select.select([fd],[],[],0.1)[0]:
                        try:output+=os.read(fd,65536)
                        except OSError:break
                    if b'example.test' in output and not sent:
                        os.write(fd,key);sent=True
                    ended,status=os.waitpid(pid,os.WNOHANG)
                    if ended:break
                else:
                    self.fail('Picker did not exit: '+repr(output[-500:]))
                if status is None or not ended:
                    _,status=os.waitpid(pid,0)
                self.assertEqual(os.waitstatus_to_exitcode(status),0,repr(output[-500:]))
                for _ in range(30):
                    if result.exists():break
                    time.sleep(.05)
                self.assertEqual(result.read_text(),url)
                self.assertFalse(listing.exists(), 'Temporary list must be removed')
            finally:
                os.close(fd)
                try:os.kill(pid,signal.SIGKILL);os.waitpid(pid,0)
                except ProcessLookupError:pass

    def test_copy(self):self.run_picker(b'\x19')
    def test_open(self):self.run_picker(b'\r')

if __name__ == '__main__':unittest.main()
