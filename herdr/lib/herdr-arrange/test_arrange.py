import copy
import os
import tempfile
import unittest
from unittest.mock import patch

import arrange as subject


def rectangles(tree, x=0, y=0, width=1, height=1):
	if tree["type"] == "pane":
		return [(tree["pane_id"], x, y, width, height)]
	ratio = tree["ratio"]
	if tree["direction"] == "right":
		return (rectangles(tree["first"], x, y, width * ratio, height)
			+ rectangles(tree["second"], x + width * ratio, y, width * (1 - ratio), height))
	return (rectangles(tree["first"], x, y, width, height * ratio)
		+ rectangles(tree["second"], x, y + height * ratio, width, height * (1 - ratio)))


def leaf(pane):
	return {"type": "pane", "pane_id": pane}


def split(direction, ratio, first, second):
	return {"type": "split", "direction": direction, "ratio": ratio, "first": first, "second": second}


def asymmetric_grid(ids):
	# IDs are specified in intended visual-slot order, not pixel-sorted order.
	a, b, c, d = map(leaf, ids)
	return split("right", 0.72, split("down", 0.65, a, c), split("down", 0.4, b, d))


class FakeClient:
	def __init__(self, count=5):
		self.ids = [f"w1:p{i}" for i in range(count)]
		self.original = subject.grid(self.ids, count)
		self.root = self.original
		self.calls = []
		self.zoomed = False
		self.focus = self.ids[-1]
		self.export_count = 0
		self.fail_move = None
		self.moves = 0
		self.tabs = {pane: "w1:t1" for pane in self.ids}
		self.switch_tab = False

	def call(self, method, params=None):
		params = params or {}
		self.calls.append((method, copy.deepcopy(params)))
		if method == "pane.current":
			return {"pane": {"pane_id": self.focus, "tab_id": "w2:t1" if self.switch_tab and self.moves else "w1:t1"}}
		if method == "layout.export":
			self.export_count += 1
			return {"layout": {"root": copy.deepcopy(self.root), "tab_id": "w1:t1", "workspace_id": "w1", "focused_pane_id": self.focus, "zoomed": self.zoomed}}
		if method == "pane.layout":
			return {"layout": {"panes": [{"pane_id": p, "rect": {"x": x, "y": y}} for p, x, y, _, _ in rectangles(self.original)]}}
		if method == "layout.set_split_ratio":
			node = self.root
			for second in params["path"]:
				node = node["second" if second else "first"]
			node["ratio"] = params["ratio"]
			return {}
		if method == "pane.zoom":
			self.zoomed = False
			self.focus = params["pane_id"]
			return {}
		if method == "pane.move":
			self.moves += 1
			if self.moves == self.fail_move:
				return {"move_result": {"changed": False, "reason": "zoomed_tab"}}
			pane = params["pane_id"]
			dest = params["destination"]
			tab = "w1:t2" if dest["type"] == "new_tab" else dest["tab_id"]
			assert self.tabs[pane] != tab, "never move into the same tab"
			assert not params["focus"], "intermediate moves must not take focus"
			self.tabs[pane] = tab
			return {"move_result": {"changed": True, "pane": {"pane_id": pane, "tab_id": tab}}}
		if method == "pane.focus":
			self.focus = params["pane_id"]
			return {}
		raise AssertionError(method)


class Tests(unittest.TestCase):
	def test_grid_counts_geometry_and_order(self):
		for columns in [2, 4]:
			for count in range(1, 41):
				with self.subTest(columns=columns, count=count):
					ids = [f"p{i}" for i in range(count)]
					tree = subject.grid(ids, columns)
					self.assertEqual(sorted(subject.leaves(tree)), sorted(ids))
					self.assertEqual(subject.ordered_panes(tree), ids)
					self.assertTrue(subject.single_column_panes(tree))
					used = min(columns, count)
					placed = {pane: box for pane, *box in rectangles(tree)}
					for i, pane in enumerate(ids):
						row, col = divmod(i, used)
						# Every pane is one column wide; extra rows fill left columns.
						column_count = len(ids[col::used])
						x, y, width, height = placed[pane]
						self.assertAlmostEqual(x, col / used)
						self.assertAlmostEqual(width, 1 / used)
						self.assertAlmostEqual(y, row / column_count)
						self.assertAlmostEqual(height, 1 / column_count)

	def test_invalid_grid(self):
		for ids, columns in [([], 4), (["a", "a"], 4), (["a"], 0)]:
			with self.assertRaises(subject.ArrangeError):
				subject.grid(ids, columns)

	def test_replay_parents_precede_children(self):
		self.assertEqual(list(subject.replay(subject.grid(["a", "b", "c", "d", "e"], 4))), [
			("c", "a", "right", 0.5), ("b", "a", "right", 0.5),
			("e", "a", "down", 0.5), ("d", "c", "right", 0.5),
		])

	def test_comparison_ignores_leaf_metadata_and_float_noise(self):
		a = subject.grid(["a", "b"], 2)
		b = copy.deepcopy(a)
		b["ratio"] += 1e-8
		b["first"]["cwd"] = "/tmp"
		self.assertTrue(subject.same_tree(a, b))
		b["ratio"] = 0.4
		self.assertFalse(subject.same_tree(a, b))

	def run_fake(self, client, mode="laptop", save=lambda snapshot: None):
		# Model the exported result after the moves, while validating move topology
		# independently through the real-session tests.
		original_call = client.call
		def call(method, params=None):
			if method == "layout.export" and client.export_count:
				client.root = subject.grid(client.ids, 2 if mode == "laptop" else 4)
			return original_call(method, params)
		client.call = call
		return subject.arrange(client, mode, save_recovery=save)

	def test_same_tab_and_focus_survive(self):
		client = FakeClient()
		saved = []
		result = self.run_fake(client, save=lambda s: saved.append(copy.deepcopy(s)))
		self.assertEqual(result, {"tab": "w1:t1", "panes": 5, "mode": "laptop", "changed": True})
		self.assertEqual(set(client.tabs.values()), {"w1:t1"})
		self.assertIn(("pane.focus", {"pane_id": "w1:p4"}), client.calls)
		self.assertEqual(saved[0]["root"], client.original)
		self.assertFalse(any(method in ["layout.apply", "pane.close", "tab.close"] for method, _ in client.calls))

	def test_does_not_steal_focus_after_user_switches_tab(self):
		client = FakeClient()
		client.switch_tab = True
		self.run_fake(client)
		self.assertFalse(any(method == "pane.focus" for method, _ in client.calls))

	def test_noop_move_stops_and_keeps_recovery(self):
		client = FakeClient()
		client.fail_move = 2
		saved = []
		with self.assertRaisesRegex(subject.ArrangeError, "no change"):
			self.run_fake(client, save=lambda s: saved.append(s))
		self.assertEqual(client.moves, 2)
		self.assertEqual(len(saved), 1)
		self.assertFalse(any(method.endswith(".close") for method, _ in client.calls))

	def test_zoom_is_cleared_before_moves(self):
		client = FakeClient()
		client.zoomed = True
		self.run_fake(client)
		methods = [method for method, _ in client.calls]
		self.assertLess(methods.index("pane.zoom"), methods.index("pane.move"))

	def test_single_pane_is_noop(self):
		client = FakeClient(1)
		self.assertFalse(subject.arrange(client, "wide")["changed"])
		self.assertEqual(client.moves, 0)

	def test_repeat_shortcut_is_noop(self):
		client = FakeClient()
		client.original = client.root = subject.grid(client.ids, 2)
		self.assertFalse(subject.arrange(client, "laptop")["changed"])
		self.assertEqual(client.moves, 0)

	def test_uneven_dividers_do_not_swap_bottom_slots(self):
		for left_height, right_height in [(0.65, 0.4), (0.2, 0.8), (0.9, 0.1)]:
			tree = asymmetric_grid(["A", "B", "C", "D"])
			tree["first"]["ratio"], tree["second"]["ratio"] = left_height, right_height
			self.assertEqual(subject.ordered_panes(tree), ["A", "B", "C", "D"])
			self.assertEqual(subject.dimensions(tree), (2, 2))
			wide, reflow = subject.desired_layout(tree, "wide")
			self.assertTrue(reflow)
			self.assertEqual(subject.ordered_panes(wide), ["A", "B", "C", "D"])

	def test_compatible_grid_changes_only_widths_in_place(self):
		client = FakeClient(4)
		client.original = asymmetric_grid(client.ids)
		client.root = copy.deepcopy(client.original)
		saved = []
		subject.arrange(client, "laptop", save_recovery=lambda tree: saved.append(tree))
		self.assertEqual(client.moves, 0)
		self.assertEqual(client.root["ratio"], 0.5)
		self.assertEqual(client.root["first"], client.original["first"])
		self.assertEqual(client.root["second"], client.original["second"])
		updates = [params for method, params in client.calls if method == "layout.set_split_ratio"]
		self.assertEqual(updates, [{"tab_id": "w1:t1", "path": [], "ratio": 0.5}])
		self.assertEqual(saved[0]["root"], client.original)
		self.assertFalse(subject.arrange(client, "laptop")["changed"])

	def test_three_nested_columns_become_thirds_without_moving(self):
		client = FakeClient(3)
		a, b, c = map(leaf, client.ids)
		client.root = split("right", 0.7, a, split("right", 0.3, b, c))
		subject.arrange(client, "wide")
		self.assertEqual(client.moves, 0)
		self.assertEqual(subject.leaves(client.root), client.ids)
		for _, _, _, width, _ in rectangles(client.root):
			self.assertAlmostEqual(width, 1 / 3)

	def test_row_heights_survive_width_equalization(self):
		a, b, c, d = map(leaf, ["A", "B", "C", "D"])
		tree = split("down", 0.3, split("right", 0.8, a, b), split("right", 0.2, c, d))
		result, reflow = subject.desired_layout(tree, "laptop")
		self.assertFalse(reflow)
		self.assertEqual(result["ratio"], 0.3)
		self.assertEqual(result["first"]["ratio"], 0.5)
		self.assertEqual(result["second"]["ratio"], 0.5)
		self.assertEqual(subject.leaves(result), ["A", "B", "C", "D"])

	def test_partial_column_grid_keeps_slots_when_it_fits(self):
		a, b, c, d, e = map(leaf, ["A", "B", "C", "D", "E"])
		tree = split("right", 0.6, split("down", 0.7, a, e), split("right", 0.8, b, split("right", 0.3, c, d)))
		result, reflow = subject.desired_layout(tree, "wide")
		self.assertFalse(reflow)
		self.assertEqual(subject.leaves(result), ["A", "E", "B", "C", "D"])
		self.assertEqual(result["first"]["ratio"], 0.7)
		for _, _, _, width, _ in rectangles(result):
			self.assertAlmostEqual(width, 0.25)
		laptop, reflow = subject.desired_layout(tree, "laptop")
		self.assertTrue(reflow)
		self.assertEqual(subject.ordered_panes(laptop), ["A", "B", "C", "D", "E"])

	def test_zoomed_compatible_grid_does_not_reflow(self):
		client = FakeClient(4)
		client.root = asymmetric_grid(client.ids)
		client.zoomed = True
		subject.arrange(client, "laptop", pane_id=client.ids[0])
		self.assertEqual(client.moves, 0)
		self.assertFalse(client.zoomed)
		self.assertEqual(client.focus, client.ids[-1])
		self.assertEqual(subject.ordered_panes(client.root), client.ids)

	def test_unzoom_alone_preserves_uneven_row_heights(self):
		client = FakeClient(4)
		client.root = asymmetric_grid(client.ids)
		client.root["ratio"] = 0.5
		before = copy.deepcopy(client.root)
		client.zoomed = True
		self.assertTrue(subject.arrange(client, "laptop", pane_id=client.ids[0])["changed"])
		self.assertEqual(client.focus, client.ids[-1])
		self.assertEqual(client.root, before)
		self.assertFalse(any(method in ["pane.move", "layout.set_split_ratio"] for method, _ in client.calls))

	def test_ratio_update_failure_never_falls_back_to_moves(self):
		client = FakeClient(4)
		client.root = asymmetric_grid(client.ids)
		original_call = client.call
		def failing_call(method, params=None):
			if method == "layout.set_split_ratio":
				raise subject.ArrangeError("injected failure")
			return original_call(method, params)
		client.call = failing_call
		with self.assertRaisesRegex(subject.ArrangeError, "injected failure"):
			subject.arrange(client, "laptop")
		self.assertEqual(client.moves, 0)

	def test_lock_rejects_overlap(self):
		with tempfile.TemporaryDirectory() as folder:
			path = os.path.join(folder, "lock")
			with subject.session_lock(path):
				with self.assertRaises(subject.ArrangeError):
					with subject.session_lock(path):
						self.fail("overlapping operation entered")

	def test_requires_explicit_target_and_socket(self):
		with patch.dict(os.environ, {}, clear=True):
			with self.assertRaises(SystemExit) as failure:
				subject.main(["wide"])
			self.assertEqual(failure.exception.code, 2)
			with self.assertRaises(SystemExit) as failure:
				subject.main(["wide", "--focused"])
			self.assertEqual(failure.exception.code, 2)


if __name__ == "__main__":
	unittest.main()
