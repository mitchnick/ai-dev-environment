# Ghostty

- `config/config` — preferences and host-level keybindings
- `config/aliases.sh` — layout aliases
- `helpers/ghostty-quad` — four-pane layout (`4x4`)
- `helpers/ghostty-dual` — two-pane layout (`2x2`)

Run from a Herdr app terminal, both helpers open a new Herdr tab split the same way, through
[`herdr-app-grid`](../herdr-app/README.md). Elsewhere `herdr-app-grid` exits 3 and they open a Ghostty window.

Daily work happens in the Herdr desktop app, which binds its own keys ([`../herdr-app/`](../herdr-app/README.md)).
In Ghostty, the legacy Herdr TUI owns tab, split, and navigation chords; Ghostty keeps clipboard, font-size, app, fullscreen, and inspector bindings.

`Cmd+E` is mapped here to `text:\x1be` so every harness sees Alt+E and opens its model
picker. `Cmd+Shift+E` is deliberately left unbound so the native chord reaches the legacy Herdr's
router instead — see [`../herdr/shortcuts/`](../herdr/shortcuts/README.md). The Herdr app binds both itself.

No external extensions are installed.
