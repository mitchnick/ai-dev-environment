# Codex

Sanitized snapshot of the local configuration, captured September 10, 2026.
Local skill discovery and invocation guidance updated September 13, 2026.

## Configuration

- `config/aliases.sh` — `cx` alias, matching the local shell configuration
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

Copy the alias from `config/aliases.sh` into `~/.zshrc`, then reload your shell.
`cx` runs `codex --dangerously-bypass-approvals-and-sandbox`; additional arguments
are passed through, for example `cx resume`. It bypasses approvals and sandboxing.

Merge the preferences you want into `~/.codex/config.toml`. Copy the theme to
`~/.codex/themes/claude-nerd.tmTheme`. For global instructions, copy the contents
of `config/AGENTS.md`, or link `~/.codex/AGENTS.md` to `~/.claude/CLAUDE.md` if
you use that shared file locally.

The shared Cmd+Shift+E shortcut cycles through every supported effort level
with the [managed shortcut patch](patches/README.md), which also restores
Cmd+E's model picker. The launcher follows the installed npm version: after an
upgrade it applies the patch, builds, runs the TUI tests, and activates matching
helpers before starting Codex. `codex update` upgrades npm and does the same
verification. Compatible upgrades need no manual patch reinstall. An incompatible
patch or failed test produces an explicit error and preserves the previous build.
Hook integrations are excluded under this repository's sharing policy.

## Local skills shared with Claude Code

Keep project skills canonical in `.claude/skills/**/SKILL.md`. The local
instruction bridge exposes them to native Codex discovery on `SessionStart`
and `UserPromptSubmit`; it also handles `SubagentStart` when called with that
event. It checks each directory from the working directory through the
repository root, including both endpoints, rather than scanning sibling projects.

- When `.agents/skills` is absent, it creates the relative symlink
  `.agents/skills -> ../.claude/skills`.
- When `.agents/skills` is a real directory, it preserves existing native skills
  and adds `.agents/skills/claude-local -> ../../.claude/skills`.
- Repeated runs preserve a link that already points to the source. Conflicting
  paths are left unchanged and reported; an existing `.agents` symlink is never
  used to write into a shared directory.
- The bridge's manual `--paths` mode only reads instructions. It does not create
  skill links or update hook state.

These are behaviors of the separately installed local bridge. Copying this
snapshot, linking global instructions, or enabling `features.hooks` does not
install that bridge. Its hook definitions, helpers, and tests remain excluded.
For a manual setup, create the applicable relative link above in your own
project after checking existing paths; preserve collisions and avoid linking
through a shared `.agents` directory. Individual skills are also excluded here.

### Invoke and verify

Pulling this repository does not update installed instructions. Merge the
`Local skills in Codex` section from `config/AGENTS.md` into the actual file
loaded as `~/.codex/AGENTS.md`. If it links to `~/.claude/CLAUDE.md`, update
that target while preserving your other local instructions. Start a fresh
Codex session to load the change.

For global Claude skills missing from Codex, add individual relative symlinks
under `~/.agents/skills/` pointing to their directories in `~/.claude/skills/`.
Preserve existing skills with the same name, and skip broken source links.
Avoid linking the entire Claude skills directory back into the agents skills
directory: Claude skills may already link to it. The shared instructions also
allow resolving missing global skills directly from `~/.claude/skills/`.

The [skill slash-menu patch](patches/skills-slash-menu.md) for Codex CLI
0.154.0 exposes every enabled skill from the native catalog in the `/` menu.
Type `/create-pr` or a prefix such as `/cre`; Tab inserts a native `$create-pr`
mention bound to the selected file, and Enter submits it. Existing arguments,
attachments, and other mentions are preserved. Exact `/skill-name arguments`
input also works without choosing a menu item.

Built-in commands keep their names. A skill named `model`, for example, appears
as `/skill:model`; if that name is also taken, another `skill:` prefix is added.
Duplicate skill names use the first enabled entry in catalog order. Disabled
skills are omitted, and catalog refreshes update the menu. No per-skill aliases
or generated prompt files are needed.

Namespaced plugin entries keep their full `/plugin:skill-name` menu label.
Completion uses `$skill-name` with the exact plugin skill path, because this
version's native mention codec does not accept colons in mention names.

This requires the custom CLI binary; it does not change the desktop app or
stock Codex. Stock invocation remains `$skill-name` or `/skills`. The literal
`\skill-name` instruction shorthand remains available as submitted text, without
completion. Updating instructions alone cannot add native slash commands.

Verify discovery and invocation separately:

1. Open Codex in the project and check its native skill catalog. For an
   app-server check, request `skills/list` for the project cwd with
   `forceReload: true`; check both the returned skill names and load errors.
2. Type a skill prefix in the `/` menu and press Tab. Confirm the resulting
   `$skill-name` mention resolves to the intended skill. Dismiss the picker or
   clear the draft without submitting it. Do not execute the PR workflow merely
   to test discovery.
3. For an end-to-end execution check, use a harmless diagnostic skill that only
   returns a marker. Submit `/skill-name` to verify slash invocation; use
   `$skill-name` to compare native invocation. Do not use `create-pr` for
   either execution check.

If the native catalog has not refreshed, start a fresh session. Agents can also
read the original `.claude/skills` metadata and load a matching `SKILL.md` in
full, as the shared instructions require. Reading files directly does not prove
that composer completion or native invocation has refreshed.
