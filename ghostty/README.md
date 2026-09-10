# Ghostty

- `config/config` — preferences and host-level keybindings
- `config/aliases.sh` — layout aliases
- `helpers/ghostty-quad` — four-pane layout
- `helpers/ghostty-dual` — two-pane layout

Herdr owns tab, split, and navigation chords; Ghostty keeps clipboard, font-size, app, fullscreen, and inspector bindings.

`Cmd+E` is mapped here to `text:\x1be` so every harness sees Alt+E and opens its model
picker. `Cmd+Shift+E` is deliberately left unbound so the native chord reaches Herdr's
router instead — see [`../herdr/shortcuts/`](../herdr/shortcuts/README.md).

No external extensions are installed.
