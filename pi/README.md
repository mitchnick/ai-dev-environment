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

## Runtime and installation paths

Pi 0.85.1 requires Node 22.19 or newer. On Apple Silicon Homebrew installs,
install `helpers/pi` into `~/.local/bin` (ahead of Homebrew and nvm on PATH)
to use the Homebrew Node runtime even when a project selects an older Node.
Set `PI_NODE_BIN` and `PI_CLI_PATH` for a different installation layout.

Merge `config/settings.json` into `~/.pi/agent/settings.json` and
`config/keybindings.json` into `~/.pi/agent/keybindings.json`, retaining local
packages, credentials, skills, and other settings. `enabledModels` can be
narrowed locally for each machine's provider access; keep those restrictions
out of the shared export. The UI preferences in
`config/runtime-settings.json` belong at **`~/.pi/settings.json`**, where
`pi-claude-code-ui` reads them; they do not belong inside `agent/`.
Copy custom extensions to `~/.pi/agent/extensions/` and themes to
`~/.pi/agent/themes/`. Keep local instruction additions when installing the
shared instructions. Source `config/shell-wrapper.zsh` from your shell config.

`pi-update` runs regression tests from the installed agent directory, or
`PI_CODING_AGENT_DIR`, and requires Bun. The socket cancellation tests pass on
Bun 1.4.2; Bun 1.2.13 can hang waiting for a mock socket to close.

The export includes no provider credentials. Use `/login` in Pi for the
configured providers before expecting the default model and delegated models
to work. `pi auth check --provider PROVIDER --no-refresh --json` checks readiness
without printing credentials. Run `/reload` in existing Pi sessions to load
new extensions and keybindings.
