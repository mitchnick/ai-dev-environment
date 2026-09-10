# Pi

## Configuration

- `config/settings.json` — agent preferences and package list; skills and MCPs removed
- `config/runtime-settings.json` — TUI runtime preferences
- `config/keybindings.json` — custom keybindings
- `config/themes/claude-monokai.json` — custom theme
- `config/AGENTS.md` — link to the shared Claude/Pi global instructions
- `config/shell-wrapper.zsh` — update wrapper

## Custom builds

Source is in `extensions/custom/`:

- Claude compatibility layer
- Herdr focus, state, label, and cursor integration
- Claude-style footer
- Image generation
- Session archive
- Aliases and clear command
- Model and effort shortcuts — Pi's half of the shared cross-harness chords
  (see [`../herdr/shortcuts/`](../herdr/shortcuts/README.md))

Supporting commands are in `helpers/`.

## External extensions

See [`EXTERNAL-EXTENSIONS.md`](EXTERNAL-EXTENSIONS.md).
