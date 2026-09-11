# Native effort cycling for Codex 0.154.0

`effort-cycle-v0.154.0.patch` adds Alt+Shift+E and Super+Shift+E to the main
Codex chat surface. Herdr forwards Cmd+Shift+E as Alt+Shift+E.

The shortcut walks the active model's advertised effort levels, including Max
and Ultra, then wraps to its lowest level. For gpt-6-astra this is
Low → Medium → High → xHigh → Max → Ultra → Low. Ultra also enables Codex's
proactive multi-agent behavior. The patch retains Codex's Ultra concurrency
warning, respects modal input, and changes the current session only. In Plan
mode it changes the active Plan override. The draft, cursor, model, and saved
defaults are preserved. Native Alt+, and Alt+. retain their upstream behavior.

## Build

Pinned upstream: `rust-v0.154.0`, commit
`6b9826e3aa83b1a5947db50f4332cb9c65f1b340`, Rust 1.95.0.

```sh
git clone --depth 1 --branch rust-v0.154.0 https://github.com/openai/codex.git codex-effort
cd codex-effort
git apply /path/to/ai-dev-environment/codex/patches/effort-cycle-v0.154.0.patch
cd codex-rs
CARGO_BUILD_JOBS=3 CARGO_PROFILE_RELEASE_LTO=false \
  CARGO_PROFILE_RELEASE_DEBUG=0 CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16 \
  cargo build --release -p codex-cli --bin codex
```

The release tag stamps `Cargo.toml` with 0.154.0 but leaves workspace packages
in `Cargo.lock` at 0.0.0. Cargo updates those local package versions on the first
build; third-party versions stay pinned. Subsequent builds can use `--locked`.

Follow upstream `AGENTS.md` for formatting and tests. The patch includes tests
for all levels and transport aliases, wrapping, draft/cursor preservation,
modal handling, key release, a single-level model, and Plan scope.

Validation on macOS: all 17 effort-related tests pass. A real PTY verified the
six-level gpt-6-astra cycle, legacy/Kitty/Super encodings, and draft/cursor
preservation without submitting a prompt. The broader TUI checks pass 4,317 of
4,318 tests across the full run and focused reruns, with six additional tests
skipped. This validation unsets the runner's `NO_COLOR=1` and temporarily aligns
30 reviewed upstream snapshots to the release version. One upstream inline
snapshot still has a two-space padding difference caused by replacing version
0.0.0 with 0.154.0; it is outside the shortcut path. These version adjustments
are not included in the patch. The Python router and usage collector tests pass.

## Install

Save the installed native `codex` executable beside itself as
`codex-stock-0.154.0`, then replace `codex` with the built executable. On macOS,
ad-hoc sign the replacement with `codesign --force --sign - <path>`.
For an npm installation, replace the native executable under the platform
package's `vendor/<target>/bin/` directory; preserve the npm launcher and all
sibling helper binaries, including `codex-code-mode-host`.

Install the shared router from `herdr/shortcuts/`. When upgrading a running
installation, write the PIDs of its existing stock Codex processes as a JSON
array to `~/.config/herdr/shortcuts/codex-effort-pending.json`. Those processes
keep the old Alt+. route until restarted, avoiding a stray E in an old draft.
The router removes this temporary file once those processes exit.

Exit and resume Codex once to activate the native handler. No Herdr or Ghostty
restart is needed. A Codex update may replace the patch; rebase and rebuild
against the new release before reinstalling. Roll back by restoring the saved
native executable and the previous router together.

This patch implements effort cycling only. Cmd+E's model picker remains a
separate, unavailable customization; use `/model` in stock Codex.
