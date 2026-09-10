"""Live order regressions with explicit, independently specified pane slots."""
import arrange


def from_spec(spec, panes):
	if isinstance(spec, str):
		return {"type": "pane", "pane_id": panes[spec]}
	direction, ratio, first, second = spec
	return {"type": "split", "direction": direction, "ratio": ratio,
		"first": from_spec(first, panes), "second": from_spec(second, panes)}


def verify(client, folder, workspace, drain=lambda: None):
	asymmetric = ("right", 0.72, ("down", 0.65, "A", "C"), ("down", 0.4, "B", "D"))
	asymmetric_equal = ("right", 0.5, ("down", 0.65, "A", "C"), ("down", 0.4, "B", "D"))
	columns_four = ("right", 0.5, ("right", 0.5, "A", "B"), ("right", 0.5, "C", "D"))
	partial = ("right", 0.6, ("down", 0.7, "A", "E"), ("right", 0.8, "B", ("right", 0.3, "C", "D")))
	partial_equal = ("right", 0.25, ("down", 0.7, "A", "E"), ("right", 1 / 3, "B", ("right", 0.5, "C", "D")))
	# Expected trees are literal fixtures, not sorted live rectangles or output
	# from desired_layout. C must stay bottom-left, even when D starts higher.
	cases = [
		("uneven columns: keep bottom slots", asymmetric, "laptop", asymmetric_equal, False, False),
		("uneven columns: wide reads A B C D", asymmetric, "wide", columns_four, True, False),
		("nested thirds without pane moves", ("right", 0.7, "A", ("right", 0.3, "B", "C")), "wide",
			("right", 1 / 3, "A", ("right", 0.5, "B", "C")), False, False),
		("row heights remain 30/70", ("down", 0.3, ("right", 0.8, "A", "B"), ("right", 0.2, "C", "D")), "laptop",
			("down", 0.3, ("right", 0.5, "A", "B"), ("right", 0.5, "C", "D")), False, False),
		("partial columns keep spanning panes", partial, "wide", partial_equal, False, False),
		("partial grid reflows A B C D E", partial, "laptop",
			("right", 0.5, ("down", 1 / 3, "A", ("down", 0.5, "C", "E")), ("down", 0.5, "B", "D")), True, False),
		("zoomed uneven grid keeps bottom slots", asymmetric, "laptop", asymmetric_equal, False, True),
	]
	for label, source, mode, expected, reflow, zoom in cases:
		created = client.call("tab.create", {"workspace_id": workspace, "cwd": str(folder), "label": label, "focus": True})
		tab = created["tab"]["tab_id"]
		anchor = client.call("layout.export", {"tab_id": tab})["layout"]["root"]["pane_id"]
		panes = {}

		def build(spec, pane):
			if isinstance(spec, str):
				panes[spec] = pane
				return
			direction, ratio, first, second = spec
			new = client.call("pane.split", {"target_pane_id": pane, "direction": direction, "ratio": ratio, "focus": False, "cwd": str(folder)})["pane"]["pane_id"]
			build(first, pane)
			build(second, new)

		build(source, anchor)
		active = panes["C"]
		client.call("pane.focus", {"pane_id": active})
		if zoom:
			client.call("pane.zoom", {"pane_id": active, "mode": "on"})

		def identities():
			return {symbol: (client.call("pane.get", {"pane_id": pane})["pane"]["terminal_id"],
				client.call("pane.process_info", {"pane_id": pane})["process_info"]["shell_pid"]) for symbol, pane in panes.items()}

		before = identities()
		tabs_before = [t["tab_id"] for t in client.call("tab.list")["tabs"]]
		calls = []

		class Audited:
			def call(self, method, params=None):
				calls.append(method)
				drain()
				return client.call(method, params)

		arrange.arrange(Audited(), mode, pane_id=anchor)
		actual = client.call("layout.export", {"tab_id": tab})["layout"]
		assert arrange.same_tree(actual["root"], from_spec(expected, panes)), label
		assert ("pane.move" in calls) == reflow, label
		assert all(m not in calls for m in ["layout.apply", "pane.close", "tab.close"]), label
		assert actual["focused_pane_id"] == active, label
		assert actual["zoomed"] is False, label
		assert identities() == before, label
		assert [t["tab_id"] for t in client.call("tab.list")["tabs"]] == tabs_before, label
		assert arrange.arrange(Audited(), mode, pane_id=anchor)["changed"] is False, label
		print("PASS order regression:", label, flush=True)
