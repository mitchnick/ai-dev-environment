import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("installer", Path(__file__).with_name("install-shortcuts.py"))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallTest(unittest.TestCase):
    def test_update_isolation_idempotence_and_arguments(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            vendor = home / "npm/vendor"
            (vendor / "bin").mkdir(parents=True)
            stock = vendor / "bin/codex"
            stock.write_text('#!/bin/sh\necho "codex-cli 1.0"\n')
            stock.chmod(0o755)
            (vendor / "bin/codex-code-mode-host").write_text("matching helper")
            binary = home / "tested"
            binary.write_text('#!/bin/sh\nif [ "$1" = --version ]; then echo "codex-cli 1.0"; else printf "%s\\n" "$@"; fi\n')
            binary.chmod(0o755)
            real_run = subprocess.run
            def run(args, **kwargs):
                if args[0] == "codesign":
                    return subprocess.CompletedProcess(args, 0)
                return real_run(args, **kwargs)
            with patch.object(installer.subprocess, "run", side_effect=run):
                installer.install(binary, vendor, home)
                current = (home / ".local/share/codex-shortcuts/current").resolve()
                installer.install(binary, vendor, home)
                self.assertEqual((home / ".local/share/codex-shortcuts/current").resolve(), current)
                # Simulate npm replacing the entire native executable.
                stock.write_text('#!/bin/sh\necho "codex-cli 2.0"\n')
                launcher = home / ".local/bin/codex"
                self.assertEqual(subprocess.check_output([str(launcher), "resume", "two words"], text=True), "resume\ntwo words\n")
                self.assertEqual((current / "bin/codex-code-mode-host").read_text(), "matching helper")
                with self.assertRaises(ValueError):
                    installer.install(binary, vendor, home)
                self.assertEqual((home / ".local/share/codex-shortcuts/current").resolve(), current)
                stock.write_text('#!/bin/sh\necho "codex-cli 1.0"\n')
                (current / "bin/codex").write_text("changed executable")
                with self.assertRaisesRegex(ValueError, "changed"):
                    installer.install(binary, vendor, home)


if __name__ == "__main__":
    unittest.main()
