# herdr-copy-search - repo constitution for agents

Rust binary implementing a herdr plugin: copycat-style regex/pattern
search and extrakto-style token extraction over pane scrollback, with
a tmux-style copy mode for refining and yanking matches, copying via
OSC 52 (herdr >= 0.7.4 has native literal copy-mode search; this
plugin covers what native does not). User-facing usage lives in
README.md; this file is the development contract.

Workspace-wide procedure (routing, checklists, commit rules) comes
from `../agent-os/INDEX.md`. This file only adds repo-specific facts.

## Quick facts (verified 2026-07-09)

- Published: PUBLIC GitHub repo `qq88976321/herdr-copy-search`, branch
  `master`, tags v0.1.1..v0.1.3 on origin. CI and release workflows are
  VERIFIED green (CI on master; the v0.1.3 release attached binaries +
  git-cliff notes); only `.github/workflows/pages.yml` stays UNVERIFIED
  (GitHub Pages not enabled yet, site 404).
- Branching: develop on `dev`; merge to `master` only when stable.
  `herdr plugin install` pulls from master by default, so master must
  stay installable at all times. Releases (`just release`, USER-ONLY)
  are cut on master.
- Toolchain: `cargo` from rustup (`~/.cargo/bin/cargo`), `just` via
  mise. Rust edition 2021. Only 4 crates: base64, crossterm, regex,
  unicode-width. Do not add dependencies without user confirmation.
  Dev tools installed out-of-band (NOT Cargo deps): cargo-release,
  git-cliff (CHANGELOG.md, config in cliff.toml).
- `herdr-plugin.toml` is the plugin manifest; its `version` must stay
  in lockstep with Cargo.toml (release.toml automates this - never
  bump either by hand).

## Commands

```
just gate      # THE quality gate: fmt --check, clippy -D warnings,
               #   cargo test, cargo build --release. Run before
               #   every commit; all four must pass.
just build     # debug build
just test      # unit tests only
just run mode  # manual run against fixtures/sample.txt (needs a
               #   real terminal; do not run headless)
just link      # register checkout as linked herdr plugin + build
just release   # cargo-release: gate, bump, sync manifest, regenerate
               #   CHANGELOG.md (git-cliff), commit, tag. USER-ONLY:
               #   run it only when the user asks for a release. It
               #   creates a commit and a local tag.
```

## Docs map

- docs/ROADMAP.md - evidence-based roadmap (researched 2026-07-07),
  feature ranking, upstream-blocked items, ARCHIVE CONDITIONS. Pick
  work from here; keep item statuses current.
- docs/checklists/CL-01..CL-07 - literal procedures: publish, CI
  verification, releases, demo recording (vhs), lints/MSRV, the
  feature dev loop, upstream watch. Follow them exactly.
- docs/upstream-log.md - dated CL-07 run log; append, never rewrite.
- demo/*.tape - vhs scripts that regenerate the README GIFs; any
  rendering or keybinding change must regenerate GIFs (CL-04).

## Module map (src/)

- main.rs     entrypoint: CLI args (--mode --input --pane --lines
              --height), terminal setup, event loop
- app.rs      application state machine (App, Mode, Effect)
- buffer.rs   line buffer, display-width positions (Pos)
- click.rs    multi-click press tracker (single/double/triple counting)
- ansi.rs     ANSI escape sequence parser
- motion.rs   vim-style motions (w b e, paragraphs, g G ...)
- search.rs   incremental regex search (invalid regex -> literal)
- patterns.rs predefined copycat-style patterns (url, file, sha ...)
- extract.rs  extrakto-style token picker (bottom popup)
- lineedit.rs single-line editor shared by search prompt and extract
- osc52.rs    OSC 52 clipboard write to /dev/tty
- herdr.rs    herdr CLI integration (pane read, context env)
- config.rs   flat-TOML plugin config parser
- ui.rs       rendering

## herdr plugin contract (empirically verified, herdr 0.7.x)

These facts are NOT in the official herdr docs; they were verified
against herdr 0.7.1 on 2026-07-06/07. Trust them over intuition.

- `herdr pane read` is capped server-side at ~1000 lines (999 for
  recent-unwrapped) regardless of --lines; content is the newest tail.
- `herdr pane read --source visible --format text` returns screen
  rows with trailing blank rows trimmed; interior blanks are kept.
- The two reads disagree on trailing whitespace: `recent-unwrapped
  --format text` (logical lines) trims each line's trailing spaces,
  but `recent --format ansi` (wrapped rows) keeps them (e.g. a shell
  prompt's `> ` cell). Verified on herdr 0.7.3, 2026-07-08. Soft-wrap
  alignment (buffer.rs mark_soft_wraps) must compare trailing-trimmed
  text or a single padded row makes alignment fail and drops every
  soft_wrap flag - which silently disables wrapped-word joining for
  motions/selection/search on the live pane path.
- `[[panes]].command` argv[0] resolves via PATH only; relative paths
  fail even though the process cwd is the plugin root. Wrap with
  `sh -c 'exec "$HERDR_PLUGIN_ROOT/..."'` (see herdr-plugin.toml).
- Inside a plugin pane, HERDR_PANE_ID is the overlay pane itself; the
  source pane is `focused_pane_id` in HERDR_PLUGIN_CONTEXT_JSON. For
  `[[keys.command]]` bindings herdr sets HERDR_ACTIVE_PANE_ID to the
  invoking pane. Action env (`plugin action invoke`) gets
  HERDR_PANE_ID = the focused (source) pane.
- OSC 52 written to /dev/tty is forwarded to the outer terminal, but
  the process must sleep ~200ms before exiting or the write is lost
  (osc52.rs implements this grace period - keep it).
- `herdr plugin pane open --target-pane X` is rejected for
  placement=overlay. A plugin overlay renders FULL-WINDOW, not confined
  to the focused pane's rect: `--placement overlay` and `zoomed` look
  identical (TTY-verified 2026-07-07). No pane-scoped floating overlay
  exists in 0.7.1; `split`/`tab` open a separate pane/tab instead. The
  opening view is anchored to the source pane's visible screen so it
  still LOOKS in-place.
- Pane borders are one global boolean: `[ui] pane_borders` (default
  true) draws split-pane dividers AND the frame around the plugin
  overlay; `false` removes both (no thin-line or overlay-only middle
  ground; `[theme] accent` only colors the border when on). A
  borderless in-place look needs pane_borders=false, which best suits
  one-pane-per-tab layouts.
- `herdr pane send-keys` rejects pageup/pagedown names; send raw
  sequences via `send-text "$(printf '\033[5~')"` (5=PgUp, 6=PgDn).
  Two esc keys sent back-to-back may be parsed as one.

## Manual / driving tests

The binary needs a real TTY. Headless `cargo run` will not exercise
rendering; unit tests (`just test`) cover logic only. To drive the
real thing inside herdr: run the binary in a scratch split with
`--pane <source-pane-id>` (overlay panes cannot be targeted), then
use `herdr pane send-keys` / `send-text` from outside.

## Conventions

- Conventional Commits, ASCII-only edits, MIT license.
- Scope names in commits follow the module or area: feat(extract),
  feat(input), feat(ui), feat(app), chore ... (see git log).
- fixtures/sample.txt and fixtures/sample.ansi are the standing test
  inputs; extend them rather than adding ad-hoc fixture files.
