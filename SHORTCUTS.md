# Shortcuts

Copy any section below into a sidebar notepad. These are personal shortcuts and aliases; the other machine needs the corresponding configuration.

## Herdr — Spaces (workspaces)

```text
Cmd+Alt+1..9 - Switch to workspace 1-9
Cmd+Alt+Up - Previous workspace
Cmd+Alt+Down - Next workspace
Cmd+N - New workspace
Cmd+Shift+W - Close workspace
Cmd+Shift+P - Workspace picker
Cmd+G - Goto
```

## Herdr — Tabs

```text
Cmd+1..9 - Switch to tab 1-9
Cmd+Alt+Left - Previous tab
Cmd+Alt+Right - Next tab
Cmd+T - New tab
Cmd+Alt+W - Close tab
Cmd+Shift+T - Rename tab
Cmd+Alt+Shift+Left - Move tab left
Cmd+Alt+Shift+Right - Move tab right
```

## Herdr — Panes

```text
Cmd+D - Split vertical
Cmd+Shift+D - Split horizontal
Cmd+W - Close pane
Cmd+Shift+Enter - Zoom pane
Cmd+] - Cycle to next pane
Cmd+[ - Cycle to previous pane
Cmd+B - Toggle sidebar
Cmd+Ctrl+R - Resize mode
Cmd+F - Copy mode
Cmd+K - Get a link from output
```

## Ghostty — Shell aliases and helpers

```text
4x4 - Open 4 windows in Ghostty
2x2 - Open 2 windows in Ghostty
be - bundle exec
rs - bundle exec rspec
rc - bundle exec rails console
rr - bundle exec rails routes | grep
mig - bundle exec rails generate migration
dmig - bundle exec rails generate data_migrate
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
The managed build survives npm updates; upgrades are built and tested separately.
