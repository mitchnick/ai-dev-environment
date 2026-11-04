# Skill commands in Codex CLI 0.154.0

`skills-slash-menu-v0.154.0.patch` adds enabled skills to the native `/` menu.
Type `/skill-name` or a prefix, then press Tab to complete or Enter to submit.
Completion inserts the existing `$skill-name` mention with its exact skill
path. Direct `/skill-name arguments` submissions use the same path, including
queued prompts. Arguments, attachments, and other mention bindings survive
completion. `$` and `/skills` continue to work.

The menu follows the native skill catalog: project, global, system, and plugin
skills are eligible. Disabled skills are omitted. Duplicate names use the first
enabled catalog entry. Built-in and service-tier names remain reserved; a
conflicting skill uses `/skill:name`, repeating `skill:` if needed to avoid
another collision. Catalog updates refresh the menu. Plain-text editors and
leading-space literal prompts retain their existing behavior.

Namespaced plugin entries keep their full `/plugin:skill-name` menu label.
Completion uses `$skill-name` with the exact plugin skill path, because this
version's native mention codec does not accept colons in mention names.

## Build

Use the same upstream `rust-v0.154.0` tag and Rust 1.95.0 as the
[effort-cycle patch](README.md). Apply both patches from the checkout root:

```sh
git apply /path/to/ai-dev-environment/codex/patches/effort-cycle-v0.154.0.patch
git apply /path/to/ai-dev-environment/codex/patches/skills-slash-menu-v0.154.0.patch
cd codex-rs
just fmt
just test -p codex-tui
CARGO_BUILD_JOBS=3 CARGO_PROFILE_RELEASE_LTO=false \
  CARGO_PROFILE_RELEASE_DEBUG=0 CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16 \
  cargo build --release -p codex-cli --bin codex
```

The patches touch separate behavior and can also be applied independently.
The release tag's workspace lockfile and version snapshot caveats are described
in the effort-cycle notes.

## Validation

The 11 focused slash-skill tests pass, including the rendered menu snapshot,
completion, direct submission, queuing, arguments, mention and image retention,
catalog refresh, disabled skills, plugin names, collisions, and literal inputs.
The full TUI run passed 4,300 tests, failed 29, and skipped six. Every failure
matches the upstream version-snapshot failures recorded during the effort-cycle
build; none exercises the new slash-skill code. Those upstream snapshots were
left unchanged. Both patches were also checked together against a clean
upstream index.

The installed binary passed real-terminal completion checks for all 50 unique
enabled skill names in the local catalog, plus `/model` and the `$` picker,
without submitting any skill workflows. It also passed the effort-cycle check:
all six levels, wrapping, and draft/cursor preservation continue to work.

## Install and rollback

Back up the currently installed native executable, then replace it with the
new build. For npm installations, preserve the JavaScript launcher and sibling
helper executables. On macOS, ad-hoc sign the replacement before installing it.
Exit and resume Codex to load the new executable; running sessions retain the
old menu. Restore the saved executable to roll back.

This changes the terminal CLI only. Copying shared instructions cannot add
native menu items, and updating Codex may overwrite the custom binary. Rebase,
test, and rebuild this patch before installing a newer version.
