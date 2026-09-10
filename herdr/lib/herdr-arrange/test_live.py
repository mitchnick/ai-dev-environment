"""Isolated Herdr server + real PTY shortcut tests. Never touches the live session."""
import fcntl
import json
import os
from pathlib import Path
import pty
import select
import shlex
import shutil
import struct
import subprocess
import tempfile
import termios
import time

import arrange
import order_cases

BIN = shutil.which("herdr")
ROOT = Path(__file__).resolve().parents[2]
SCRIPT = str(ROOT / "helpers/herdr-arrange")
if not Path(SCRIPT).is_file():
	SCRIPT = str(ROOT / "bin/herdr-arrange")


def wait_for(check, timeout=10):
	deadline = time.monotonic() + timeout
	while time.monotonic() < deadline:
		if check():
			return
		time.sleep(0.05)
	raise AssertionError("condition timed out")


def main():
	if not BIN or not Path(SCRIPT).is_file():
		raise SystemExit("Install Herdr and keep the arranger wrapper beside its library.")
	folder = Path(tempfile.mkdtemp(prefix="herdr-arrange-live-"))
	name = f"arrange-verify-{os.getpid()}"
	# CLI named sessions resolve here, regardless of HERDR_CONFIG_PATH.
	sock = str(Path.home() / ".config/herdr/sessions" / name / "herdr.sock")
	env = {k: v for k, v in os.environ.items() if not k.startswith("HERDR_")}
	config = folder / "config.toml"
	config.write_text(f'''onboarding = false
[terminal]
default_shell = "/bin/sh"
shell_mode = "non_login"
[server]
headless_cols = 240
headless_rows = 100
[update]
version_check = false
manifest_check = false
[[keys.command]]
key = "cmd+shift+r"
type = "shell"
command = {json.dumps(shlex.quote(SCRIPT) + " wide --focused")}
[[keys.command]]
key = "cmd+ctrl+r"
type = "shell"
command = {json.dumps(shlex.quote(SCRIPT) + " laptop --focused")}
''')
	env["HERDR_CONFIG_PATH"] = str(config)
	env["TERM"] = "xterm-256color"
	log = open(folder / "server.log", "w")
	server = subprocess.Popen([BIN, "--session", name, "server"], env=env, stdout=log, stderr=log)
	client = arrange.Client(sock)
	master = None
	tui = None
	try:
		wait_for(lambda: Path(sock).exists())
		created = client.call("workspace.create", {"cwd": str(folder), "label": "layout test", "focus": True})
		pane = created["root_pane"]["pane_id"]
		tab = created["tab"]["tab_id"]
		workspace = created["workspace"]["workspace_id"]
		ids = [pane]
		sentinel = client.call("tab.create", {"workspace_id": workspace, "cwd": str(folder), "label": "untouched", "focus": False})["tab"]["tab_id"]
		sentinel_before = client.call("layout.export", {"tab_id": sentinel})["layout"]

		def exported():
			return client.call("layout.export", {"tab_id": tab})["layout"]

		def signature():
			return {p: (client.call("pane.get", {"pane_id": p})["pane"]["terminal_id"],
				client.call("pane.process_info", {"pane_id": p})["process_info"]) for p in ids}

		def target(mode):
			# Each added pane starts below the LAST pane. Expected logical order
			# is the known creation order, never recomputed from the implementation.
			return arrange.grid(ids, 4 if mode == "wide" else 2)

		def check_tree(tree):
			assert arrange.same_tree(exported()["root"], tree), "wrong topology or ratio"
			assert exported()["tab_id"] == tab
			assert set(arrange.leaves(exported()["root"])) == set(ids)
			assert len(client.call("tab.list")["tabs"]) == 2, "scratch tab leaked"
			assert client.call("layout.export", {"tab_id": sentinel})["layout"] == sentinel_before

		for count in range(1, 11):
			if count > 1:
				ids.append(client.call("pane.split", {"target_pane_id": ids[-1], "direction": "down", "cwd": str(folder), "focus": False})["pane"]["pane_id"])
			# A live foreground command proves this isn't just recreating shells.
			subprocess.run([BIN, "--session", name, "pane", "run", ids[-1], "sleep 120"], env=env, capture_output=True, check=True)
			time.sleep(0.15)
			before = signature()
			assert all(info["shell_pid"] for _, info in before.values())
			client.call("pane.focus", {"pane_id": ids[-1]})
			for step, mode in enumerate(["wide", "laptop", "wide"]):
				# Adding pane 5 or 9 beneath the last pane already fits the wide
				# dimensions. Keep those slots rather than forcing a row-major tree.
				tree = exported()["root"] if step == 0 and count in (5, 9) else target(mode)
				result = subprocess.run([SCRIPT, mode, "--pane", pane, "--socket", sock], env=env, capture_output=True, text=True)
				assert result.returncode == 0, result.stderr
				check_tree(tree)
				assert signature() == before, "terminal or process identity changed"
				assert exported()["focused_pane_id"] == ids[-1], "active pane changed"
				again = subprocess.run([SCRIPT, mode, "--pane", pane, "--socket", sock], env=env, capture_output=True, text=True, check=True)
				assert json.loads(again.stdout)["changed"] is False, "repeat must be a no-op"
			print(f"PASS {count} panes: wide/laptop/wide, IDs, live PIDs, focus, idempotence, unrelated tab", flush=True)

		client.call("pane.zoom", {"pane_id": pane, "mode": "on"})
		result = subprocess.run([SCRIPT, "laptop", "--pane", pane, "--socket", sock], env=env, capture_output=True, text=True)
		assert result.returncode == 0, result.stderr
		assert exported()["zoomed"] is False
		print("PASS zoomed tab rearranges and unzooms", flush=True)

		# Attach an isolated TUI to verify the real key -> shell -> socket path,
		# including Herdr's injected HERDR_SOCKET_PATH and Kitty modifiers.
		master, slave = pty.openpty()
		fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 100, 240, 0, 0))
		tui = subprocess.Popen([BIN, "--session", name], env=env, stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
		os.close(slave)
		os.set_blocking(master, False)

		def drain():
			while select.select([master], [], [], 0)[0]:
				try:
					data = os.read(master, 65536)
					if not data:
						break
				except BlockingIOError:
					break

		for _ in range(30):
			drain()
			time.sleep(0.1)
		assert tui.poll() is None, "isolated client exited"
		for mode, key in [("wide", b"\x1b[114;10u"), ("laptop", b"\x1b[114;13u")]:
			before = signature()
			tree = target(mode)
			os.write(master, key)
			def ready():
				drain()
				return arrange.same_tree(exported()["root"], tree)
			wait_for(ready)
			check_tree(tree)
			assert signature() == before
			print(f"PASS actual {mode} shortcut through attached PTY client", flush=True)
		order_cases.verify(client, folder, workspace, drain)
		print(f"ALL LIVE TESTS PASSED. Artifacts: {folder}", flush=True)
	finally:
		# Detach the test client first. A stopped server leaves the client in its
		# reconnect screen rather than exiting. Drain PTY output during shutdown.
		if tui and tui.poll() is None:
			os.write(master, b"\x02q")
			for _ in range(100):
				if tui.poll() is not None:
					break
				try:
					drain()
				except OSError:
					break
				time.sleep(0.05)
			if tui.poll() is None:
				# This exact child belongs to the isolated test, never the live TUI.
				tui.terminate()
		# Stop only this test-owned named server and its test-owned sleep processes.
		result = subprocess.run([BIN, "session", "stop", name, "--json"], env=env, capture_output=True, text=True, timeout=10)
		print("Isolated session cleanup:", result.returncode, flush=True)
		server.wait(timeout=10)
		if tui:
			try:
				tui.wait(timeout=5)
			except subprocess.TimeoutExpired:
				# SIGTERM can leave this test-owned client at its reconnect screen.
				# Never find or signal a different Herdr process.
				tui.kill()
				tui.wait(timeout=5)
		if master is not None:
			os.close(master)
		log.close()


if __name__ == "__main__":
	main()
