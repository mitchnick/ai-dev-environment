# Shared model and effort shortcuts

Shared chords for Claude Code, Codex, and Pi:

| Chord | Action |
| --- | --- |
| `Cmd+E` | Open the model and effort picker (Codex requires a custom build) |
| `Cmd+Shift+E` | Advance reasoning effort for the current model, wrapping to its lowest supported level |

Both preserve the draft, the cursor, and the selected model, and both change the
current session only — never the startup default.

## How the two chords travel

They take deliberately different routes.

**`Cmd+E` is a terminal keystroke.** Ghostty maps it to `ESC e` (`text:\x1be`),
which every harness reads as Alt+E and binds to its own picker. No router
involved.

**`Cmd+Shift+E` is a Herdr command.** Ghostty leaves the chord unbound so the
native Super chord reaches Herdr, which runs `cycle-effort.py`. That matters
because the harnesses do not agree on what the key should do:

- **Codex** with the [0.154.0 effort patch](../../codex/patches/README.md)
  and **Pi** cycle effort natively, so the router forwards `alt+shift+e`.
  Codex includes the model's advertised Max and Ultra levels. Ultra also
  enables proactive multi-agent behavior.
- **Claude Code** has no effort-cycling action at all. Its
  `modelPicker:increaseEffort` exists only *inside* the open picker, so a
  forwarded keystroke has nothing to bind to. The router instead calls an
  adapter that drives the picker (see below).

Herdr exports `HERDR_ACTIVE_PANE_ID` captured at the keypress, so the router
acts on the pane that was focused then, even if focus moves while it runs. It
also exports `HERDR_BIN_PATH`, which matters because Herdr runs custom commands
detached with a minimal `PATH`.

## Install

From the repository root:

```sh
mkdir -p ~/.config/herdr/shortcuts ~/.local/bin
cp herdr/shortcuts/*.py ~/.config/herdr/shortcuts/
cp claude-code/custom/shortcuts/claude-cycle-effort ~/.local/bin/
chmod +x ~/.local/bin/claude-cycle-effort
(cd ~/.config/herdr/shortcuts && python3 -m unittest discover -p 'test_*.py')
herdr server reload-config
```

Then add the `cmd+shift+e` block from [`../config/config.toml`](../config/config.toml)
and the `super+e` keybind from [`../../ghostty/config/config`](../../ghostty/config/config).

The config's `command` uses an absolute interpreter on purpose. Adjust
`/usr/bin/python3` if your Python lives elsewhere; a bare `python3` may not
resolve under Herdr's minimal `PATH`, and the binding then fails silently.

Requires Python 3 and Herdr 0.9.0 or newer. Codex must be restarted once after
installing its native patch. The router needs no daemon or server restart.

## Per-harness setup

**Claude Code** needs no keybinding change — `cmd+e`/`meta+e` are already mapped
to `chat:modelPicker` in [`../../claude-code/config/keybindings.json`](../../claude-code/config/keybindings.json).
Install `claude-cycle-effort` for the `Cmd+Shift+E` half.

**Pi** needs [`../../pi/extensions/custom/model-effort-shortcuts/`](../../pi/extensions/custom/model-effort-shortcuts/)
for the picker, plus the `app.thinking.cycle` aliases in
[`../../pi/config/keybindings.json`](../../pi/config/keybindings.json). Run
`/reload` in existing sessions.

**Codex 0.154.0** needs the included [native effort patch](../../codex/patches/README.md).
Stock Codex's Alt+. action stops before Max/Ultra and cannot wrap. Build and
install the patch, then exit and resume Codex. Existing stock processes listed
in the installer's temporary `codex-effort-pending.json` retain the old Alt+.
route until restarted. `Cmd+E` still requires the separate unpublished model
picker patch; use `/model`.

## The Claude Code adapter

`claude-cycle-effort` exists because Claude Code cannot cycle effort on its own.
It drives the real picker through Herdr: open it, press `right` once, confirm
with `s` ("this session only").

One right-arrow is the entire cycle because `modelPicker:increaseEffort` already
wraps — `xhigh → max → ultracode → low`. There is no level arithmetic and no
state file.

It is written to be safe to bind to a key that fires at arbitrary moments:

- Nothing is sent unless the pane hosts a Claude agent whose current model
  actually exposes an effort level.
- It no-ops if any picker or dialog already owns the pane, so it can never
  confirm someone else's dialog or accept a model the user had navigated to.
- It confirms only after *observing* the effort change; otherwise it escapes
  out and leaves the session as it found it.
- It re-checks the pane's agent identity before confirming, and its cleanup
  never sends keys to a replacement agent.
- Rapid presses queue rather than drop, so each press advances one step.

`ultracode` is skipped by default. It is not a deeper effort level — it is
`xhigh` plus dynamic multi-agent workflows, which changes cost and behaviour.
Pass `--allow-ultracode` to include it.

Exit codes: `0` advanced, `2` not applicable (nothing changed), `3` presses
queued too deep, `4` bad arguments or a failed send. Treat `2` as a normal
no-op, not an error.

## Known limits

- **Short panes.** Below roughly 30 rows Claude Code truncates its picker and
  drops the effort row. The adapter detects that, zooms the pane, cycles, and
  unzooms — about 2 s extra and a brief visible zoom.
- **Herdr only.** The shared `Cmd+Shift+E` chord needs Herdr's router. Outside
  Herdr, Codex can use its native `Alt+.` / `Alt+,` shortcuts and Pi can use
  `Shift+Tab`. The Claude adapter needs a Herdr pane.
- **Session scope.** The level resets when the session ends. Pass
  `--scope default` to persist it as the new default instead.
- The adapter reads the rendered pane, so a future Claude Code UI change can
  break detection. It fails closed: it stops rather than sending blind keys.
