# Shared model and effort shortcuts

Two chords that behave the same way in Claude Code, Codex, and Pi:

| Chord | Action |
| --- | --- |
| `Cmd+E` | Open the model and effort picker |
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

- **Codex** and **Pi** cycle effort natively, so the router just forwards
  `alt+shift+e` to the pane.
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

Requires Python 3 and Herdr 0.9.0 or newer. No daemon, and no restart of any
running agent.

## Per-harness setup

**Claude Code** needs no keybinding change — `cmd+e`/`meta+e` are already mapped
to `chat:modelPicker` in [`../../claude-code/config/keybindings.json`](../../claude-code/config/keybindings.json).
Install `claude-cycle-effort` for the `Cmd+Shift+E` half.

**Pi** needs [`../../pi/extensions/custom/model-effort-shortcuts/`](../../pi/extensions/custom/model-effort-shortcuts/)
for the picker, plus the `app.thinking.cycle` aliases in
[`../../pi/config/keybindings.json`](../../pi/config/keybindings.json). Run
`/reload` in existing sessions.

**Codex** has no plugin surface for this, so it needs a source patch against an
official release: clone the matching `rust-v<version>` tag, apply the patch,
build `-p codex-cli` with Cargo, and swap the binary in beside the stock one so
the original stays runnable. Codex then handles `Cmd+Shift+E`, `Alt+Shift+E`,
and legacy `ESC E` natively, and the router only forwards the key. The patch
itself is version-pinned and is not published here.

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
- **Herdr only.** The adapter drives a Herdr pane; a Claude Code session outside
  Herdr cannot be cycled this way. Codex and Pi cycle natively and are
  unaffected.
- **Session scope.** The level resets when the session ends. Pass
  `--scope default` to persist it as the new default instead.
- The adapter reads the rendered pane, so a future Claude Code UI change can
  break detection. It fails closed: it stops rather than sending blind keys.
