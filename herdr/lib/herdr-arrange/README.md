# Herdr arrange shortcuts

- **Cmd+Shift+R**: wide, up to four columns.
- **Ctrl+Cmd+R**: laptop, up to two columns.
- **Ctrl+B, then r**: manual resize mode. Its former direct chord now selects laptop layout.

Each shortcut checks the focused tab's logical column and row counts against the selected preset.
If they already fit and no pane spans columns, it only equalizes column widths with `layout.set_split_ratio`.
Pane slots, split topology, row heights and full-height panes stay unchanged. Nested three-column splits become equal thirds, not 50/25/25.

If the dimensions differ, or a pane spans more than one column, it reflows panes in structural row order:
left-to-right, then top-to-bottom. Order comes from the split tree, not pixel coordinates. Uneven divider heights cannot swap
bottom-left and bottom-right panes. A reflowed tab is built as stacked columns, so every pane stays exactly one column wide.
An incomplete last row fills the left columns; the columns it skips hold taller panes. More panes add rows, including above eight in wide mode.
A zoomed tab unzooms without changing the active pane. Repeating an unchanged arrangement does nothing.

Only reflow parks panes in a temporary tab, then moves them back into the original tab. Herdr removes the empty temporary tab.
Reflow can cause a brief flicker; width-only adjustment does not move panes. Terminal processes, pane IDs, tab ID, tab order, labels and active pane survive.
No `layout.apply`, pane-close or tab-close calls are used. `layout.apply` recreates terminals and is not safe here.

## Files

- Launcher: `~/.local/bin/herdr-arrange`
- Implementation and tests: `~/.local/lib/herdr-arrange/`
- Bindings: `~/.config/herdr/config.toml`

In this repository the launcher is `herdr/helpers/herdr-arrange` and the library is
`herdr/lib/herdr-arrange/`. The wrapper resolves `../lib/herdr-arrange` relative to
itself, so the same pair works in the checkout and when installed under `~/.local`.
See the [setup instructions](../../README.md#install-as-one-setup). Requires Python 3
and Herdr 0.9.0+. The wrapper defaults to `/usr/bin/python3`; override with
`HERDR_ARRANGE_PYTHON` when necessary.

## Explicit CLI target

```sh
herdr-arrange wide --pane "$HERDR_PANE_ID"
herdr-arrange laptop --pane "$HERDR_PANE_ID"
```

The shortcut uses `--focused` to target the UI, not stale shell pane environment variables.
`HERDR_SOCKET_PATH` is required; tests can pass `--socket`. The script never guesses which session to modify.

Concurrent invocations for one session are rejected. A recovery snapshot is written before mutation under Python's temporary directory:
`herdr-arrange-<uid>/<socket-hash>-recovery.json`. Errors go beside it in `<socket-hash>-errors.log`.
If Herdr rejects a move or the connection fails, the script stops. Remaining panes stay alive, possibly in the `arranging panes` tab.
Do not close that tab. Move its panes back with Herdr's pane mover. Do not feed the recovery snapshot to `layout.apply`.
Other layout plugins do not share this script's lock; do not run two different layout tools at once.

## Verify

```sh
python3 -B -m unittest discover -s herdr/lib/herdr-arrange -p test_arrange.py -v
HERDR_CONFIG_PATH="$PWD/herdr/config/config.toml" herdr config check
```

Optional integration check: `python3 -B herdr/lib/herdr-arrange/test_live.py`.
The test resolves Herdr from PATH and invokes the adjacent exported wrapper, so it
validates this package rather than an unrelated installed helper. When run from
`~/.local/lib/herdr-arrange`, it instead finds the installed `~/.local/bin` wrapper.
It starts its own named Herdr server and PTY client. It tests 1–10 panes, both layouts, zoom, repeat calls,
unrelated-tab preservation, process identity, and both actual key sequences. `order_cases.py` adds seven asymmetric-layout cases
with literal expected pane slots, including ratio-only updates, spanning panes, thirds, preserved row heights, and zoom.
It stops only its own test session.
Test artifacts and runtime recovery snapshots belong in temporary directories,
never in this public repository.

Existing main-grid, equalize, and editor plugin shortcuts remain unchanged.
