# Claude Code

## Configuration

- `config/settings.json` — preferences and permissions; hooks and MCPs removed
- `config/keybindings.json` — custom keybindings
- `config/CLAUDE.md` — global instructions shared with Pi and Codex
- `config/aliases.sh` — `cc` alias

## Custom builds

- `custom/statusline/` — statusline and Herdr-aware labeling
- `custom/workflows/deep-research-lean.js` — cost-routed research workflow
- `custom/shortcuts/claude-cycle-effort` — advances reasoning effort by driving the
  model picker, since Claude Code exposes no effort-cycling action. Part of the shared
  shortcuts in [`../herdr/shortcuts/`](../herdr/shortcuts/README.md)

## External extensions

See [`EXTERNAL-EXTENSIONS.md`](EXTERNAL-EXTENSIONS.md).
