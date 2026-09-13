# Codex

Sanitized snapshot of the local configuration, captured September 10, 2026.
Local skill discovery and invocation guidance updated September 11, 2026.

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

This is a preferences snapshot, not a full installation backup. The shared
`Cmd+Shift+E` shortcut cycles through every supported effort level with the
included [Codex 0.154.0 patch](patches/README.md). The `Cmd+E` picker needs a
separate custom build; see the
[shared shortcut notes](../herdr/shortcuts/README.md). Hook integrations are
excluded under this repository's sharing policy.

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

With these shared instructions loaded, the preferred shorthand is to submit
the literal text `\create-pr` in the Codex composer. A message beginning with
`\skill-name` and optional arguments tells the agent to resolve that exact
skill name, read its `SKILL.md` in full, and follow it with those arguments.
The agent must report a missing skill instead of guessing. Quoted examples and
questions about the syntax are not invocations.

The shorthand applies to all discovered skills, both project and globally
available skills, including future additions, with optional arguments. No
per-skill aliases or edits are needed. Examples include `\components`,
`\search-docs how do we test background jobs`, and `\asb-positioning`.

This personal shorthand is ordinary text interpreted through instructions;
it has no native command completion. Codex's slash-command parser only treats
a leading forward slash as a command, so a backslash bypasses unknown-command
rejection. No Codex binary or hook-code change was needed for this shorthand.

Native Codex invocation remains `$skill-name`, such as `$create-pr`, or the
`/skills` picker. Claude Code's `/create-pr` is rejected as an unrecognized
Codex command. Discovery and the personal shorthand do not register a
`/create-pr` slash-command alias.

Verify discovery and invocation separately:

1. Open Codex in the project and check its native skill catalog. For an
   app-server check, request `skills/list` for the project cwd with
   `forceReload: true`; check both the returned skill names and load errors.
2. Open `/skills`, or type `$create-pr` and confirm its completion resolves to
   the intended skill. Dismiss the picker or clear the draft without submitting
   it. Do not execute the PR workflow merely to test discovery.
3. For an end-to-end execution check, use a harmless diagnostic skill that only
   returns a marker. Submit `\skill-name` to verify the instruction shorthand;
   use `$skill-name` to verify native invocation. Do not use `create-pr` for
   either execution check.

If the native catalog has not refreshed, start a fresh session. Agents can also
read the original `.claude/skills` metadata and load a matching `SKILL.md` in
full, as the shared instructions require. Reading files directly does not prove
that composer completion or native invocation has refreshed.
