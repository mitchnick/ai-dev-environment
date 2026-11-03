# Claude Code

## Configuration

- `config/settings.json` — preferences and permissions; hooks and MCPs removed
- `config/keybindings.json` — custom keybindings
- `config/CLAUDE.md` — global instructions shared with Pi and Codex
- `config/aliases.sh` — `cc` alias

## Custom builds

- `custom/statusline/` — statusline and Herdr-aware labeling. The labeler needs the
  legacy Herdr TUI's `HERDR_*` variables, which Herdr app terminals do not set
- `custom/workflows/deep-research-lean.js` — cost-routed research workflow
- `custom/shortcuts/claude-cycle-effort` — advances reasoning effort by driving the
  model picker, since Claude Code exposes no effort-cycling action. Part of the legacy
  shared shortcuts in [`../herdr/shortcuts/`](../herdr/shortcuts/README.md). The Herdr
  app uses its port, [`../herdr-app/bin/claude-cycle-effort-hc`](../herdr-app/README.md)

## External extensions

See [`EXTERNAL-EXTENSIONS.md`](EXTERNAL-EXTENSIONS.md).
