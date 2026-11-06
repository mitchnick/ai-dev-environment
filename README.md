# AI Dev Environment

Public, sanitized configuration for an AI coding setup on macOS.

**New machine or agent handoff: start with [SETUP.md](SETUP.md).** Work through it in order for installation, configuration, optional builds, missing integrations, verification, and rollback.

See [Shortcuts](SHORTCUTS.md) for a copyable cheat sheet of Herdr, Ghostty, and Claude Code shortcuts and commands.

| Folder | Contents |
|---|---|
| [`claude-code/`](claude-code/) | Preferences, global instructions, keybindings, aliases, statusline, workflow, plugins |
| [`codex/`](codex/) | Model and reasoning preferences, terminal display, keybindings, theme, aliases, shared global instructions |
| [`pi/`](pi/) | Preferences, keybindings, theme, custom extensions, helpers, npm extensions |
| [`herdr-app/`](herdr-app/) | The Herdr desktop app: settings, keybindings, theme, layout, mods, helper scripts, automations config |
| [`herdr/`](herdr/) | **Legacy** Herdr 0.9.0 TUI: preferences, keybindings, custom plugins, helpers, patches, external plugin |
| [`ghostty/`](ghostty/) | Preferences, keybindings, aliases, split helpers |

## Excluded

- Individual skills except the bundled Jev primitive
- Hooks
- MCP server configuration
- Authentication, tokens, passwords, caches, history, and logs
- Personal account and machine names, such as the Herdr app's [private usage config](herdr-app/README.md#usage-block)

## Use

Copy only the files you want. Review paths and dependencies first.

> `cc` uses `--dangerously-skip-permissions`; `cx` uses `--dangerously-bypass-approvals-and-sandbox`. Do not use these shortcuts unless you accept those risks.
