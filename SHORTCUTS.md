# Shortcuts

Copy any section below into a sidebar notepad. These are personal shortcuts and aliases; the other machine needs the corresponding configuration.

The Herdr sections are for the Herdr desktop app with [`herdr-app/home/keys.json`](herdr-app/home/keys.json) installed. The old Herdr 0.9.0 TUI's keys, including its `Ctrl+B` prefix layer, are in [`herdr/config/config.toml`](herdr/config/config.toml) (legacy).

## Herdr — Spaces

```text
Cmd+Alt+1..9 - Switch to space 1-9
Cmd+Alt+Up - Previous space
Cmd+Alt+Down - Next space
Cmd+N - New space
Cmd+Shift+W - Close space
Shift+F2 - Rename space
Cmd+Shift+P / Cmd+G / Cmd+P - Picker: go to a tab, space or agent
```

## Herdr — Tabs

```text
Cmd+1..9 - Switch to tab 1-9
Cmd+Alt+Left - Previous tab
Cmd+Alt+Right - Next tab
Cmd+T - New tab
Cmd+Alt+W - Close tab
Cmd+Shift+T / F2 - Rename tab
Cmd+Alt+Shift+Left - Move tab left
Cmd+Alt+Shift+Right - Move tab right
```

## Herdr — Panes

```text
Cmd+D - Split right
Cmd+Shift+D - Split down
Cmd+W - Close pane
Cmd+Shift+Enter - Zoom pane
Cmd+] - Cycle to next pane
Cmd+[ - Cycle to previous pane
Cmd+Ctrl+Arrows - Focus the pane in that direction
Cmd+Shift+Arrows - Swap with the pane in that direction
Cmd+M - Move pane to another tab
Cmd+Shift+M - Move pane: full menu (re-split, swap, tab, space)
Cmd+Shift+N / double-click its name - Rename pane (empty: its automatic task name)
Cmd+Shift+R - Arrange panes wide (up to 4 columns)
Cmd+Ctrl+R - Arrange panes for a laptop (up to 2 columns)
Resize - Drag the divider between panes
```

## Herdr — Agents, search and links

```text
Cmd+Alt+Shift+Up - Previous agent
Cmd+Alt+Shift+Down - Next agent
Cmd+Shift+E - Cycle reasoning effort in the focused agent
Cmd+E - Model picker (sends Esc+E to the terminal)
Cmd+K - Pick a link the agent mentioned (Enter opens, Ctrl+Y copies)
Cmd+F - Search scrollback (Enter copies the line, Shift+Enter with context)
Cmd+Shift+G - Git graph panel (main-plus layout)
```

## Herdr — App

```text
Cmd+B - Toggle sidebar
Cmd+Shift+L - Switch layout
Cmd+, - Settings
Cmd+/ - Help
Cmd+= / Cmd+- / Cmd+0 - Zoom in / out / reset
Commands - Click "commands" in the status bar for the command palette
Ctrl+Alt+Shift+Escape - Escape hatch: reset keys.json and the layout to Herdr's defaults
```

## Ghostty — Shell aliases and helpers

```text
4x4 - Open 4 panes: a new 2x2 Herdr tab in Herdr, else a Ghostty window
2x2 - Open 2 panes: a new side-by-side Herdr tab in Herdr, else a Ghostty window
be - bundle exec
rs - bundle exec rspec
rc - bundle exec rails console
rr - bundle exec rails routes | grep
mig - bundle exec rails generate migration
dmig - bundle exec rails generate data_migration
gad - bundle exec rails generate administrate:dashboard
```

## Claude Code — Keyboard shortcuts

```text
Ctrl+D - Exit Claude Code
Ctrl+L - Clear terminal screen
Ctrl+G - Open the prompt in your editor (e.g. Vim)
Ctrl+S - Stash your prompt to go back to later
Ctrl+Shift+C - Copy output
Ctrl+R - Search old prompts
```

## Claude Code — Token usage commands

```sh
npx ccusage
npx ccusage@latest monthly
npx ccusage@latest --since "$(date +%Y%m01)"
npx ccusage@latest monthly --since "$(date +%Y%m01)"
```

## Codex — Model and effort

```text
Cmd+E - Open model/effort picker
Cmd+Shift+E - Cycle supported effort levels, including Max/Ultra, and wrap
```

Requires the [managed shortcut build](codex/patches/README.md). Restart/resume
after installation. Stock sessions use increase-only behavior for Cmd+Shift+E.
After an npm upgrade (`codex update`), the launcher starts the new version stock
at once; the `rebuild-codex-shortcuts` skill rebuilds and tests the
customizations for it.
