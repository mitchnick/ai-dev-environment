# Codex

Sanitized snapshot of the local configuration, captured September 10, 2026.

## Configuration

- `config/config.toml` — model, reasoning effort, approval reviewer, terminal display, keybindings, hook feature preference, and rate-limit notice preference
- `config/themes/claude-nerd.tmTheme` — custom syntax theme referenced by the configuration
- `config/AGENTS.md` — relative link to the shared global instructions in `../claude-code/config/CLAUDE.md` (from this directory)

The shared instructions have been refreshed from the local canonical file, with
the personal home path generalized and a private project reference removed.

## Excluded

- MCP server configuration and connection details
- Local project paths and project trust decisions
- Hook definitions, helper scripts, and trusted hashes; `features.hooks` only records the preference
- Model onboarding counters
- Authentication, API keys, account identifiers, and installation identifiers
- Sessions, history, memories, logs, caches, databases, shell snapshots, and backups
- Individual skills, plugin state, and local command approval rules

## Use

Merge the preferences you want into `~/.codex/config.toml`. Copy the theme to
`~/.codex/themes/claude-nerd.tmTheme`. For global instructions, copy the contents
of `config/AGENTS.md`, or link `~/.codex/AGENTS.md` to `~/.claude/CLAUDE.md` if
you use that shared file locally.

This is a preferences snapshot, not a full installation backup. The local setup
also uses a custom Codex build for model and effort shortcuts; see the
[shared shortcut notes](../herdr/shortcuts/README.md). Hook integrations are
excluded under this repository's sharing policy.
