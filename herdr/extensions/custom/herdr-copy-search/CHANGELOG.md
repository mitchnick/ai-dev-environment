# Changelog

All notable changes to this project are documented in this file.
The format is based on Keep a Changelog, and this project adheres to
Conventional Commits.

## [0.1.5] - 2026-08-04

### Features

- **click**: Multi-click tracker
- **app**: Mouse double/triple click selection
- **app**: Auto-copy on mouse selection release
- **app**: Keep the selection highlighted after a mouse copy

### Documentation

- **readme**: Embed demo GIFs inline so they play on github.com
- **upstream**: Watch run 2026-07-10
- **roadmap**: Re-rank phase 2 for differentiation after upstream #1230
- **upstream**: Watch run 2026-07-23
- **roadmap**: Record A1 trigger and popup unblock from v0.7.4/v0.7.5
- **roadmap**: Record A1 outcome - keep the plugin, reposition docs
- **readme**: Reposition around coexistence with native search
- **site**: Mirror the coexistence repositioning on the website
- Mouse gestures in README/site/roadmap
- **roadmap**: Record the F18 mouse TTY verification

### Build System

- **demo**: Derive README GIFs from mp4 via just gifs

### Miscellaneous

- **meta**: Reword descriptions for the coexistence repositioning

## [0.1.4] - 2026-07-09

### Features

- **input**: Jump by word with Ctrl+Left/Right in the line editor

### Documentation

- **roadmap**: Sync statuses to public + CI/release-green reality
- **roadmap**: Mark F1/F5/F8/F9 done after TTY verification
- Reconcile CLAUDE.md/CL-05/upstream-log with current state

### Testing

- **ui**: Cover mode_hint truncation at a narrow row width

### Continuous Integration

- Drop UNVERIFIED headers now that CI and release are green

### Miscellaneous

- **just**: Add install-remote recipe to smoke-test the published plugin
- **just**: Self-heal link/install-remote so one command switches modes

## [0.1.3] - 2026-07-09

### Features

- **ui**: Accent the mode-row badge and show an idle key hint
- **config**: Add themeable colors parsed from config.toml
- **ui**: Render copy/search chrome from the theme
- **extract**: Theme the extract popup and add a keybind hint
- **app**: Block nested copy-search launches
- **app**: Exit on ctrl-c from copy, search, and pattern menu
- **lineedit**: Align query editing with readline keys
- **extract**: Reorder popup to candidates, hint, separator, input
- **buffer**: Add logical_span helper for soft-wrap groups
- **motion**: Treat soft-wrap boundaries as word continuations
- **motion**: Span word text-objects across soft-wrapped rows
- **search**: Match across soft-wrap boundaries

### Bug Fixes

- **app**: Exit copy mode on Enter when there is nothing to copy
- **buffer**: Tolerate trailing-space mismatch in soft-wrap alignment

### Refactor

- **ui**: Harden the draw-path current-match index
- **ui**: Unify mode badge rendering across modes
- **search**: Make Match a cross-row span

### Documentation

- **readme**: Real install path
- **roadmap**: Add F9 mode-row polish; note pane_borders mitigation
- Record herdr overlay chrome + placement findings
- **readme**: Recommend pane_borders=false; note full-window overlay
- **readme**: Document color config, extract hint, and nested guard
- **demo**: Record copy and extract demos
- **demo**: Switch demos to 2x mp4 with CJK glyphs
- **demo**: Play demos back 20% slower
- Mark F4 done and record overlay reflow as future work
- Record herdr two-read trailing-whitespace asymmetry
- **demo**: Record demos inside a real herdr session
- Bootstrap CHANGELOG.md from git history
- Reference changelog in CL-03, roadmap, and tooling note
- Add MIT LICENSE file
- **site**: Scaffold Zensical project under website/
- Link the docs site from README and roadmap
- Note that refreshing a managed plugin means reinstalling (no separate update in v1)
- **site**: Add repo content actions and GitHub header icon

### Build System

- Verify MSRV at 1.74
- Add cliff.toml for git-cliff changelog generation
- **release**: Regenerate CHANGELOG.md via git-cliff pre-release hook

### Continuous Integration

- Generate GitHub Release notes with git-cliff
- Add GitHub Pages deploy workflow + site justfile recipes

## [0.1.2] - 2026-07-07

### Features

- **input**: Line editor with cursor for prompt and extract query
- **ui**: Persistent bottom mode row in copy/search view
- **app**: Align opening view to the source pane visible screen
- **extract**: Scrollable backdrop (wheel regions, PgUp/PgDn)
- **motion**: Add word/WORD text objects (iw/aw/iW/aW)
- **patterns**: User-defined patterns via plugin config
- **search**: Smartcase, toggled with S

### Documentation

- Add CLAUDE.md repo constitution for agents
- Add evidence-based roadmap, checklists, and upstream watch log
- **demo**: Add vhs tapes and demo-worthy fixture session output
- **readme**: Add status disclosure and roadmap pointers
- Add docs map and scaffolding status to CLAUDE.md

### Build System

- Declare lint policy and unverified MSRV floor in Cargo.toml

### Continuous Integration

- Add unverified GitHub Actions gate and release scaffolding

## [0.1.1] - 2026-07-06

### Features

- **core**: Vi copy-mode core (buffer, search, motion, app)
- **app**: Horizontal scroll follows cursor
- **osc52**: OSC 52 clipboard sequences
- **ui**: Crossterm renderer with match/selection highlighting
- **cli**: Main event loop with copy and search modes
- **herdr**: Pane read, send-text, source pane resolution
- **patterns**: Copycat-style predefined pattern search
- **extract**: Extrakto-style token extraction with fuzzy filter
- **plugin**: Herdr plugin manifest and docs
- **ansi**: SGR parser producing per-char styled lines
- **render**: Carry source pane colors through copy and extract input
- **ui**: Tmux-seamless chrome with transient bottom overlay
- **extract**: Bottom popup over a styled pane backdrop

### Build System

- **release**: Justfile and cargo-release config
