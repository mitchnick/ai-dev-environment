#!/usr/bin/python3
"""Arrange live Herdr panes in the same tab. Never use destructive layout.apply."""

import argparse
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import socket
import sys
import tempfile


class ArrangeError(Exception):
	pass


class Client:
	def __init__(self, path):
		self.path = path

	def call(self, method, params=None):
		with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as connection:
			connection.settimeout(10)
			connection.connect(self.path)
			request = {"id": "herdr-arrange", "method": method, "params": params or {}}
			connection.sendall((json.dumps(request) + "\n").encode())
			with connection.makefile("rb") as stream:
				line = stream.readline(16 * 1024 * 1024)
			if not line.endswith(b"\n"):
				raise ArrangeError(f"{method}: incomplete response")
			response = json.loads(line)
			if "error" in response:
				raise ArrangeError(f"{method}: {response['error']}")
			return response["result"]


def leaves(node):
	if node["type"] == "pane":
		return [node["pane_id"]]
	return leaves(node["first"]) + leaves(node["second"])


def equal_splits(nodes, direction):
	if len(nodes) == 1:
		return nodes[0]
	middle = len(nodes) // 2
	return {
		"type": "split", "direction": direction, "ratio": middle / len(nodes),
		"first": equal_splits(nodes[:middle], direction),
		"second": equal_splits(nodes[middle:], direction),
	}


def grid(ids, columns):
	"""Row-major reading order, built as stacked columns. No pane spans columns."""
	if not ids or len(set(ids)) != len(ids) or columns < 1:
		raise ArrangeError("grid requires unique panes and a positive column count")
	stacks = [
		equal_splits([{"type": "pane", "pane_id": p} for p in ids[i::columns]], "down")
		for i in range(min(columns, len(ids)))
	]
	return equal_splits(stacks, "right")


def same_tree(a, b):
	if a["type"] != b["type"]:
		return False
	if a["type"] == "pane":
		return a["pane_id"] == b["pane_id"]
	return (a["direction"] == b["direction"]
		and abs(a["ratio"] - b["ratio"]) < 0.00001
		and same_tree(a["first"], b["first"])
		and same_tree(a["second"], b["second"]))


def dimensions(node):
	"""Logical column/row spans, independent of pixel sizes and split ratios."""
	if node["type"] == "pane":
		return 1, 1
	left, top = dimensions(node["first"])
	right, bottom = dimensions(node["second"])
	if node["direction"] == "right":
		return left + right, max(top, bottom)
	return max(left, right), top + bottom


def ordered_panes(node):
	"""Read structural rows left-to-right; uneven dividers cannot swap slots."""
	positions = []

	def visit(part, column=0, row=0):
		if part["type"] == "pane":
			positions.append((row, column, part["pane_id"]))
			return
		columns, rows = dimensions(part["first"])
		visit(part["first"], column, row)
		if part["direction"] == "right":
			visit(part["second"], column + columns, row)
		else:
			visit(part["second"], column, row + rows)

	visit(node)
	return [pane for _, _, pane in sorted(positions)]


def equal_width_tree(node):
	"""Keep topology and vertical ratios. Weight horizontal splits by columns."""
	if node["type"] == "pane":
		return dict(node)
	first = equal_width_tree(node["first"])
	second = equal_width_tree(node["second"])
	ratio = node["ratio"]
	if node["direction"] == "right":
		left = dimensions(first)[0]
		right = dimensions(second)[0]
		ratio = left / (left + right)
	return dict(node, first=first, second=second, ratio=ratio)


def single_column_panes(node):
	"""A down split over unequal widths means a pane below spans columns."""
	if node["type"] == "pane":
		return True
	if node["direction"] == "down" and dimensions(node["first"])[0] != dimensions(node["second"])[0]:
		return False
	return single_column_panes(node["first"]) and single_column_panes(node["second"])


def desired_layout(root, mode):
	ids = ordered_panes(root)
	columns = min({"wide": 4, "laptop": 2}[mode], len(ids))
	rows = (len(ids) + columns - 1) // columns
	if dimensions(root) == (columns, rows) and single_column_panes(root):
		return equal_width_tree(root), False
	return grid(ids, columns), True


def ratio_updates(before, after, path=()):
	"""Both trees have the same topology; only unequal ratios need API calls."""
	if before["type"] == "pane":
		return
	if abs(before["ratio"] - after["ratio"]) >= 0.00001:
		yield list(path), after["ratio"]
	yield from ratio_updates(before["first"], after["first"], path + (False,))
	yield from ratio_updates(before["second"], after["second"], path + (True,))


def replay(node):
	"""Split the whole region before subdividing either child."""
	if node["type"] == "pane":
		return
	yield leaves(node["second"])[0], leaves(node["first"])[0], node["direction"], node["ratio"]
	yield from replay(node["first"])
	yield from replay(node["second"])


def move(client, pane_id, destination):
	result = client.call("pane.move", {"pane_id": pane_id, "destination": destination, "focus": False})["move_result"]
	if not result["changed"]:
		raise ArrangeError(f"pane.move {pane_id}: no change ({result.get('reason')})")
	if result["pane"]["pane_id"] != pane_id:
		raise ArrangeError("pane ID changed unexpectedly; stopped to preserve remaining panes")
	return result["pane"]["tab_id"]


def destination(tab, anchor, direction, ratio=0.5):
	return {"type": "tab", "tab_id": tab, "target_pane_id": anchor, "split": direction, "ratio": ratio}


def arrange(client, mode, pane_id=None, save_recovery=lambda snapshot: None):
	current = client.call("pane.current")["pane"]
	pane_id = pane_id or current["pane_id"]
	exported = client.call("layout.export", {"pane_id": pane_id})["layout"]
	tab = exported["tab_id"]
	ids = ordered_panes(exported["root"])
	if len(set(ids)) != len(ids):
		raise ArrangeError("layout contains duplicate pane IDs")
	tree, reflow = desired_layout(exported["root"], mode)
	if same_tree(tree, exported["root"]) and not exported["zoomed"]:
		return {"tab": tab, "panes": len(ids), "mode": mode, "changed": False}
	# Write a recovery snapshot before any mutation. Never close panes on failure.
	save_recovery(exported)
	if exported["zoomed"]:
		# Herdr focuses the pane passed to zoom-off, even for an explicit target.
		client.call("pane.zoom", {"pane_id": exported["focused_pane_id"], "mode": "off"})
	if not reflow:
		# Keep every pane in its existing slot, including uneven row heights.
		for path, ratio in ratio_updates(exported["root"], tree):
			client.call("layout.set_split_ratio", {"tab_id": tab, "path": path, "ratio": ratio})
	else:
		# A same-tab move is a no-op. Park non-anchor panes, then replay into the
		# original tab. Keeping one pane there preserves its ID, label and order.
		scratch = None
		for pane in ids[1:]:
			if scratch is None:
				scratch = move(client, pane, {"type": "new_tab", "workspace_id": exported["workspace_id"], "label": "arranging panes"})
			else:
				move(client, pane, destination(scratch, ids[1], "right"))
		for pane, anchor, direction, ratio in replay(tree):
			move(client, pane, destination(tab, anchor, direction, ratio))
		# Herdr removes the empty scratch tab itself. No close commands are sent.
		# Restore the active pane, but don't steal focus if the user changed tabs.
		focused_tab = client.call("pane.current")["pane"]["tab_id"]
		if current["tab_id"] == tab and focused_tab in (tab, scratch):
			client.call("pane.focus", {"pane_id": exported["focused_pane_id"]})
	actual = client.call("layout.export", {"tab_id": tab})["layout"]
	if not same_tree(actual["root"], tree):
		raise ArrangeError("layout verification failed; panes left alive for recovery")
	return {"tab": tab, "panes": len(ids), "mode": mode, "changed": True}


@contextlib.contextmanager
def session_lock(path):
	with open(path, "a") as lock:
		try:
			fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
		except BlockingIOError:
			raise ArrangeError("another layout change is running; try again shortly")
		yield


def main(argv=None):
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("mode", choices=["wide", "laptop"])
	target = parser.add_mutually_exclusive_group(required=True)
	target.add_argument("--pane", help="explicit pane in the tab to arrange")
	target.add_argument("--focused", action="store_true", help="use UI focus; intended for shortcuts")
	parser.add_argument("--socket", default=os.environ.get("HERDR_SOCKET_PATH"))
	args = parser.parse_args(argv)
	if not args.socket:
		parser.error("HERDR_SOCKET_PATH or --socket is required; refusing to guess a session")
	state = Path(tempfile.gettempdir()) / f"herdr-arrange-{os.getuid()}"
	state.mkdir(mode=0o700, exist_ok=True)
	key = hashlib.sha256(args.socket.encode()).hexdigest()[:16]
	recovery = state / f"{key}-recovery.json"

	def save(snapshot):
		with open(recovery, "w") as file:
			json.dump(snapshot, file, indent=2)

	try:
		with session_lock(state / f"{key}.lock"):
			result = arrange(Client(args.socket), args.mode, args.pane, save)
		print(json.dumps(result))
		return 0
	except (ArrangeError, OSError, ValueError, KeyError) as error:
		message = f"herdr-arrange: {error}. Recovery snapshot (if mutation began): {recovery}"
		print(message, file=sys.stderr)
		with open(state / f"{key}-errors.log", "a") as log:
			log.write(message + "\n")
		return 1


if __name__ == "__main__":
	sys.exit(main())
