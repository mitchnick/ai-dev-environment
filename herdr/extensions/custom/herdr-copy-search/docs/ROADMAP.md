# Roadmap

Goal: the best beyond-native-search experience on herdr - regex +
pattern search, token extraction, and match actions layered over the
native copy mode, which owns plain browsing and literal search since
v0.7.4 (A1 decision 2026-07-23: keep and reposition, not exit).
Eventual exit is still governed by "Archive conditions" at the bottom.

Provenance: researched 2026-07-07 (herdr v0.7.1) from upstream
trackers, tmux/zellij/wezterm/kitty ecosystems, and community threads;
refreshed 2026-07-10 (full CL-07 run, herdr v0.7.3 latest tag) and
2026-07-23 (full CL-07 run, herdr v0.7.5 latest; native search
RELEASED in v0.7.4 -> A1 triggered and resolved same day: keep +
reposition; see docs/upstream-log.md). Every
claim cites its source. Re-verify time-sensitive facts with
docs/checklists/CL-07-upstream-watch.md before acting on them.

How to use this file: pick the highest unfinished item whose
dependencies are done, follow its checklist (docs/checklists/), meet
the done criteria, run `just gate`, commit, mark the item done here.
Feature work follows docs/checklists/CL-06-feature-development.md.

Status legend: [ ] todo, [x] done, [~] partial/in progress,
[!] blocked upstream.

## Positioning (why this plugin should exist at all)

- UPDATE 2026-07-23: herdr native copy-mode search is RELEASED -
  v0.7.4 stable (2026-07-15) ships #1230 (which closed Discussion
  #563). Native search remains literal-only smartcase `/` `?` with
  `n`/`N` and match highlighting - no regex, no patterns, no
  extract, no jump/open/paste actions - and has an open highlight
  bug (#1667). No upstream issue asks for regex/pattern search as
  of 2026-07-23.
- DECISION 2026-07-23 (user; resolves archive trigger A1 early,
  without waiting out the two-week trial): KEEP the plugin,
  reposition the docs to a coexistence story. Plain-copy browsing
  and literal lookups are conceded to native copy mode (it reads
  the full scrollback; this plugin is capped at ~1000 lines by
  `herdr pane read`). The plugin's edge - the next bullet - stays;
  entry points and behavior are unchanged; the change is
  documentation only (README, website, this file).
- This plugin's surviving edge is therefore everything AROUND raw
  search: regex + smartcase, copycat-style patterns, extrakto-style
  extraction, soft-wrap-aware matching, and actions on a match (jump,
  open, paste-through). Phase 2 is re-ranked to invest only there;
  copy-mode motion parity is permanently out of scope (see the
  Phase 2 posture note).
- Among 305 repos tagged `herdr-plugin` (2026-07-23; was 136 on
  2026-07-10), still no other plugin does scrollback regex search
  with in-place highlighting. Neighbors are visible-screen only:
  rmarganti/herdr-pluck and hotchpotch/herdr-tiny-fingers
  (thumbs/fingers-style hints), iurysza/termscope (open visible
  files/links), RooseveltAdvisors/herdr-leap (EasyMotion-style
  jump + copy).
- The core design (keyboard-driven selection over scrollback) matches
  the single most-demanded capability in neighboring ecosystems:
  zellij "keyboard select and copy" issue #947 (88 reactions) and
  word-boundary selection #1258 (147 reactions), wezterm copy-mode
  motions #4471 (21 reactions).

So: unique niche, real demand, and an upstream that absorbed the
raw-search half (#1230, shipped v0.7.4). Optimize for usefulness now,
low maintenance cost, and deliberate coexistence with native; exit
only via the archive conditions.

## Phase 0 - publish and trust

| ID | Item | Effort | Checklist |
|----|------|--------|-----------|
| P0.1 | [~] Publish to GitHub (public; CI green + v0.1.3 binaries; clean-config install pending) | S | CL-01 |
| P0.2 | [x] AI-assistance disclosure in README | S | - |
| P0.3 | [ ] Submit to awesome-herdr | S | CL-01 |

- P0.1: public repo, topics (`herdr-plugin`, `herdr`, `copy-mode`,
  `tmux`, `rust`, `terminal`), description, verify
  `herdr plugin install <owner>/herdr-copy-search` works end to end.
  Done when: install-from-GitHub works on a clean machine/config.
  STATUS 2026-07-09: repo is public (qq88976321), CI green, v0.1.3
  release with binaries; only the clean-config install check remains.
- P0.2: soft disclosure, per 2025-2026 community norms research:
  backlash targets unreviewed, un-owned code, not AI assistance
  itself (see RedMonk "AI slopageddon" 2026-02; Ghostty is itself
  heavily AI-assisted with a strict disclosure policy). The respected
  pattern (Simon Willison) is: state AI assistance + human review +
  daily personal use + support expectations. Wording lives in
  README "Status" section. Avoid the phrase "vibe coded".
- P0.3: PR to yigitkonur/awesome-herdr after P0.1. Done when listed.
- License note: herdr is dual AGPL-3.0/commercial; this plugin is a
  separate MIT work that drives the `herdr` CLI as a subprocess and
  links nothing from it, so MIT remains correct.

## Phase 1 - engineering foundation

| ID | Item | Effort | Depends | Checklist |
|----|------|--------|---------|-----------|
| P1.1 | [x] CI pipeline (green on GitHub, run on 0ea3661) | S | P0.1 | CL-02 |
| P1.2 | [x] Release artifacts workflow (v0.1.3 attached linux + macOS binaries) | S | P1.1 | CL-03 |
| P1.3 | [~] Lints + MSRV (MSRV 1.74 verified locally 2026-07-07; CI msrv job still commented out) | S | - | CL-05 |
| P1.4 | [x] Reproducible README demos (MP4 recorded in a real herdr session, embedded) | M | - | CL-04 |
| P1.5 | [x] Dev process documented | S | - | CL-06 |
| P1.6 | [x] Changelog via git-cliff (release notes generated on the v0.1.3 release) | S | P1.2 | CL-03 |

- P1.1: .github/workflows/ci.yml mirrors `just gate` (fmt, clippy
  -D warnings, test+build on ubuntu+macos, --locked) plus cargo-audit.
  Chosen stack per 2026 idioms: actions/checkout@v4,
  dtolnay/rust-toolchain, Swatinem/rust-cache@v2,
  taiki-e/install-action. Deliberately NOT cargo-dist (its steward
  axo wound down; treat as risky). Done when: all jobs green on
  GitHub and the UNVERIFIED header comment is removed. MET 2026-07-09:
  CI run on 0ea3661 = success; UNVERIFIED header dropped in this sync.
- P1.2: .github/workflows/release.yml attaches linux/macos binaries
  to the GitHub Release on a v* tag via
  taiki-e/upload-rust-binary-action. Note: plugin installs build from
  source (herdr-plugin.toml [[build]]), so release binaries are a
  convenience, not the install path. Versioning stays local
  (cargo-release; `just release`, USER-ONLY per CLAUDE.md).
- P1.3: Cargo.toml [lints.rust]/[lints.clippy] tables (RFC 3389
  style) with a conservative set that passes the gate today;
  rust-version = "1.74" is an UNVERIFIED floor (the [lints] table
  itself needs cargo >= 1.74) - CL-05 verifies with cargo-msrv and
  enables the msrv CI job. Formatter: rustfmt defaults, no
  rustfmt.toml (bat/fd/zoxide convention). Track stable in CI, no
  rust-toolchain.toml pin.
- P1.4: vhs tapes (demo/*.tape) drive the binary against
  fixtures/sample.txt in a plain terminal - keystrokes-as-code, so an
  AI agent can regenerate the clips after any UI change (this is how
  ratatui maintains its example GIFs). Done when: clips generated,
  embedded in README, and regeneration procedure verified once.
  DONE 2026-07-08: switched GIF->MP4, recorded inside a real herdr
  session; regeneration via docker vhs (CL-04).
- P1.5: CL-06 encodes the repo dev loop (TDD, gate, manual TTY test,
  demo regeneration, conventional commit).
- P1.6: cliff.toml drives git-cliff (a dev tool, not a Cargo dep) to
  derive a Keep-a-Changelog CHANGELOG.md from the Conventional Commits
  the repo already mandates. The cargo-release release-hook regenerates
  it per release; release.yml curates the GitHub Release body from it
  (orhun/git-cliff-action). VERIFIED 2026-07-09: the git-cliff
  release-notes job ran on the v0.1.3 release and attached the notes.

## Phase 2 - features, ranked by evidence

Evidence = reaction-weighted demand across tmux/copycat/extrakto/
thumbs/fingers/zellij/wezterm/kitty trackers (details in Evidence
appendix). Follow CL-06 for every item. Ordering within the phase is
a recommendation; re-rank freely on personal need - the only real
user is the author.

Posture (user decision 2026-07-10, after upstream #1230; made
permanent by the A1 decision 2026-07-23): invest only in
capabilities native search will NOT cover - regex, patterns,
extract, actions, copy ergonomics. Copy-mode motion parity (f/F/t/T,
`;`/`,`, numeric counts, W/B/E motions, marks, `*`/`#`, H/M/L,
zt/zz/zb, block selection - all currently absent) is permanently
OUT OF SCOPE: native owns plain copy-mode ergonomics; this plugin's
Normal mode exists to refine and yank matches.
Recommended order among open items, by differentiation value / cost:
F2 > F6 > F11 > F3 > F12 > F13 > F14 > F15 > F16 > F17.

| ID | Item | Effort | Evidence rank |
|----|------|--------|---------------|
| F1 | [x] User-defined patterns via plugin config | M | #2 |
| F2 | [ ] Extract: jump-to-match (land in copy mode at the token) | S/M | #11 |
| F3 | [ ] Open actions: file:line in $EDITOR, URL in browser | M/L | #4 |
| F4 | [x] Search across soft-wrap boundaries | M | #10 |
| F5 | [x] Word text objects (viw/vaw/viW/vaW) | S | #1 gap |
| F6 | [ ] Extract: multi-select (Tab-mark several tokens) | S/M | #13 |
| F7 | [!] Copy last command output / prompt jump (OSC 133) | L | #5 |
| F8 | [x] Smartcase toggle in search (`S`) | S | weak |
| F9 | [x] Mode-row polish: accent badge + idle key hint | S/M | author req |
| F10 | [ ] Overlay reflow: rewrap logical lines to the overlay width | L | future/UX |
| F11 | [ ] Pattern capture-group copy (yank only group 1) | S | copycat #64 |
| F12 | [ ] Copy joins soft-wraps + optional trailing-space trim | S/M | tmux #4995 |
| F13 | [ ] Paste-through: send selection/match to source pane | S | extrakto #91 |
| F14 | [ ] More built-in patterns (uuid, ipv6, hex color, ...) | S | thumbs/fingers |
| F15 | [ ] Seed search/extract query from pane selection | S/M | extrakto #114 |
| F16 | [ ] Search history + explicit literal toggle | S | tmux parity |
| F17 | [ ] Extract config polish (min len, suffix, granularity) | S | extrakto #67 |
| F18 | [x] Mouse gestures: drag / double-click WORD / triple-click line, OSC 52 copy on release | S/M | author req |
| R1 | [x] Panic audit: none in non-test code; TUI panic-safe | S | robustness |

TTY-verified 2026-07-09 (driven in a real herdr session via `herdr pane
send-keys`, asserted with `herdr pane read`): F1 - custom `pattern_j`
shows in the menu as `[j]` and activates (regex ran, 1 match) while
`pattern_u = ""` removed `[u]rl`; F5 - `iw` reverse-selects exactly the
inner word (indicator flips to VISUAL); F8 - a lowercase search matched
case-insensitively (smartcase on, 5 hits) then dropped to case-sensitive
on `S` (4 hits, "smartcase: off"); F9 - the badge renders themed + bold
and the idle hint dim. F9 demos already show the styled row (re-recorded
2026-07-08, after the styling landed), so no GIF regen was needed. The
OSC 52 -> LOCAL clipboard leg is the one check left to the user (the
clipboard lives on the workstation, not reachable from here).

TTY-verified 2026-07-31 by the user (mouse input cannot be driven by
`herdr pane send-keys`, so a human clicked): F18 - drag, double-click
and triple-click each select and land in the LOCAL clipboard on release,
the mode row reports `copied N chars`, the selection stays highlighted
and the overlay stays open. The 400ms MULTI_CLICK_WINDOW survives
herdr's PTY forwarding over SSH, so the constant needs no widening.

- F1: every mature tool converged on user regexes in config (extrakto
  redirects all pattern requests to its config; wezterm
  quick_select_patterns; kitty hints custom regex; thumbs #44;
  fingers #19). Design constraint: config.rs is a flat-TOML parser
  (no arrays, stops at first [table]); use flat keys, e.g.
  `pattern_j = "regex"` adds pattern with menu key `j`, and
  `pattern_u = ""` disables a default. Done when: custom pattern
  usable from menu and alt+key, defaults overridable, README table
  updated, unit tests for parsing and menu.
- F2: from the extract list, a key (e.g. ctrl+j) jumps into copy mode
  with the cursor on that token's position instead of inserting or
  copying - "navigate to the found string, in context" (extrakto
  #130), "jump into the selected position instead of just yanking"
  (thumbs #146). Both modes already share the buffer, which makes
  this cheap here and impossible for most competitors. Done when:
  round trip extract -> copy mode -> refine selection -> yank works
  and is in the README key table.
- F3: the killer action in kitty hints is "open file at line in
  $EDITOR"; tmux-open and extrakto #15/#20 show the same demand.
  Design questions to settle first (see CL-06 brainstorm step): the
  overlay cannot exec $EDITOR itself for the source pane - likely
  `herdr pane send-text` of an editor command, or a config-defined
  opener command; also check herdr link handlers as the URL path.
  New material 2026-07-10: `[[link_handlers]]` (herdr 0.7.0+) route
  ctrl-clicked URLs to a plugin action (HERDR_PLUGIN_CLICKED_URL),
  and termscope / herdr-fzf-url prove openers are viable in-ecosystem.
  Done when: pattern/extract pick can open in editor/browser with a
  config-defined command, documented caveats.
- F4: [DONE] real demand: tmux #966, copycat #59/#94, zellij #2853.
  Search now matches over logical (soft-wrap joined) lines and maps
  hits back to inclusive buffer positions, so a URL split across two
  display rows is one findable, yankable match (search.rs `run` +
  `Match { start, end }` span + `Buffer::logical_span`). Done as part
  of the same soft-wrap-awareness pass that also made copy-mode word
  motions (w/b/e) and word text objects (iw/aw) treat a wrapped word
  as one unit (motion.rs `advance`/`retreat`/`word_object`). Unit
  tests cover the row mapping (search.rs, motion.rs, app.rs yank).
  Remaining soft-wrap gap tracked as F10 (visual reflow).
- F5: wezterm #4471 (21 reactions) asks for exactly this in a copy
  mode. We have w/b/e motions already; add viw/vaw/viW/vaW. Done
  when: text objects work in charwise selection + tests.
- F6: thumbs multi-select is praised; fingers #169. Tab marks
  multiple tokens in extract, Enter/copy acts on all (joined by
  newline or space; decide in brainstorm). Done when: multi-pick
  insert and copy work + README updated.
- F7: BLOCKED-ish: needs prompt marks. Investigate first (CL-07 item)
  whether `herdr pane read --source detection` or any OSC 133
  exposure exists; tmux/zellij/kitty all grew this class of feature
  (tmux #3102, zellij #899, kitty show_last_command_output). If herdr
  exposes nothing, leave blocked; do NOT try to parse prompts
  heuristically.
- F8: weak evidence (no high-reaction ask found); do only if it
  personally itches. Default should be smartcase if built.
- F9: the persistent bottom mode row (ui.rs: the `[copy]`/`[search]`
  badge, the pattern menu / transient messages, and the right-side
  indicator) reads plain today. Make it look intentional and, space
  permitting, teach the keys. Origin: author noticed it after herdr
  `pane_borders = false` removed the overlay frame (see In-place
  section) and the bare mode row became the only chrome. Sub-goals:
  - Style the badge/indicator to sit against the pane deliberately
    (dim/reverse bar or a subtle accent) instead of default text.
    "Follow theme color" needs a CL-07 investigation first: the plugin
    renders via crossterm and is NOT handed herdr's theme; check whether
    any HERDR env exposes theme colors. If not, fall back to
    terminal-adaptive styling (reverse-video bar / standard 16-color
    accents / honor NO_COLOR) so it matches whatever terminal theme the
    user runs, rather than hardcoding catppuccin.
  - Contextual keybinding hint: a compact, mode-aware cheat strip (copy
    mode vs search prompt vs pattern menu vs extract) showing the few
    most useful keys, only when width allows; consider a `?` toggle for
    a fuller hint line so the default stays uncluttered. Settle the hint
    set + toggle key in the CL-06 brainstorm.
  - Constraints: keep it single-line (the reserved mode row that
    content_rows() already excludes); truncate hints to display width
    (reuse the ui.rs width clipping); do not break the char-space span
    merge or the OSC 52 path. Rendering change -> regenerate demo GIFs
    (CL-04).
  - Done when: badge/indicator styled and a mode-aware hint shows within
    width limits (and/or `?` toggles it); README notes it; unit tests
    cover the hint-string selection + truncation (rendering itself is
    TTY-verified).
- F10: future research, raised alongside F4. The overlay renders the
  frozen source-pane rows, which are wrapped at the SOURCE pane's
  width; a plugin overlay is full-window, so a word soft-wrapped in a
  narrow pane still shows a visual break mid-screen even though logic
  (navigation, selection, copy, search) now treats it as one word
  (F4). Fully removing the visual break means rewrapping the logical
  lines to the overlay width. This is a large change: it must remap
  every position, per-char style, selection, and search highlight to
  the new layout, and it deliberately breaks the current "the overlay
  looks like the frozen pane" principle and the visible-read view
  anchor (see In-place section). Investigate feasibility and whether
  the payoff beats the layout complexity before committing. Do NOT
  start without a CL-06 brainstorm; the logic-only fix (F4) already
  removes the correctness pain, leaving this as pure visual polish.
- F11: when a pattern regex contains a capture group, highlight and
  yank only group 1 instead of the whole match (copycat #64 asks for
  exactly this; tmux-thumbs ships it). Applies to built-in and
  user-defined patterns; menu unchanged. Enables "match the line,
  copy the ID" patterns. Done when: a `pattern_<key>` with a group
  copies only the group, README notes it, tests cover group vs
  no-group regexes.
- F12: copying a selection that spans soft-wrapped rows should join
  the wrap (no injected newline) and optionally trim trailing pad
  spaces; tmux itself gets this wrong (tmux #4995 wrap newlines +
  padding, #4399 padding cells). Verify current behavior first:
  search-match yanks already use logical spans (F4), but charwise
  `v` and linewise `V` selections over a wrapped row may not. Done
  when: a wrapped URL copies as one line, pad spaces are not copied
  (or a config key controls trimming), tests.
- F13: a key sends the current selection/match INTO the source pane
  instead of the clipboard ("copy and paste immediately": extrakto
  #91/#101, fingers `:paste:`, thumbs upcase). The extract insert
  path (`herdr pane send-text`, main.rs) already does this; extend
  it to copy/search mode. Decide the key in the CL-06 brainstorm.
  Done when: paste-through works from copy mode, README key table
  updated.
- F14: extend patterns.rs with the classes thumbs/fingers ship that
  we lack: uuid, ipv6, hex color, 0x hex number, docker image ref,
  markdown-link URL (thumbs/fingers READMEs; copycat #57 is a
  20-comment idea thread, #149 asks to disable single defaults -
  `pattern_<key> = ""` already covers disabling). Menu width is the
  constraint: only high-value classes get menu slots, the rest stay
  reachable via `alt+<key>`. Done when: new patterns + tests +
  README table updated.
- F15: pre-fill the search prompt / extract query from the source
  pane's active selection: plugin docs state HERDR_PLUGIN_CONTEXT_JSON
  carries "selected text" (UNVERIFIED empirically - CL-07-style check
  first: is the field populated for action invocations?). Same ask as
  extrakto #114 (seed with cursor word), but herdr's context JSON
  could make it cleaner than the tmux version. Done when: invoking
  the plugin with an active selection seeds the query, documented.
- F16: session-scoped search history (Up/Down in the search prompt
  walks prior queries; the single `saved_pattern` slot in app.rs
  becomes a list) plus an explicit literal-mode toggle to complement
  regex (tmux has search-forward-text as a separate literal command;
  invalid-regex-falls-back-to-literal already covers half). Done
  when: history navigation + literal toggle + indicator hint + tests.
- F17: flat-TOML keys for extract ergonomics: min token length
  (hardcoded 3 today, extract.rs MIN_TOKEN_LEN), insert suffix
  (extrakto #67/#97 ask for separator config), default granularity
  word vs line (extrakto #72). Done when: keys parsed + applied +
  README config table updated.
- R1: audit unwrap/expect/panic in non-test code paths; each site
  either becomes an error path or gets a comment stating why it
  cannot fail. TUI must never panic mid-alt-screen (leaves the
  terminal broken).

## Phase 3 - distribution and polish

| ID | Item | Effort | Depends |
|----|------|--------|---------|
| P3.1 | [~] README media embedded (MP4 from P1.4; inline play needs Pages, site 404) | S | P1.4 |
| P3.2 | [ ] Install path verified from GitHub + version badge (deps met, now unblocked) | S | P0.1, P1.1 |
| P3.3 | [ ] Optional: announce (herdr Discussions, r/commandline) | S | P3.1 |
| P3.4 | [~] User-facing docs site (Zensical, GitHub Pages); authored + built, Pages not enabled (site 404) | M | P0.1, P1.4 |

P3.3 is optional and only after P0-P2 core items feel solid; an
announcement invites users, users invite support expectations - the
disclosure section sets those expectations first.

- P3.4: website/ holds a Zensical (Material-for-MkDocs team) project -
  Home/Install/Modes, sourced from the README author voice - deployed
  by .github/workflows/pages.yml. Unlike the README, the site can play
  the demo/*.mp4 clips inline. Deploy stays UNVERIFIED: the repo is now
  public but GitHub Pages is NOT enabled yet (site 404). Enable once via
  Settings -> Pages -> Source: GitHub Actions, then confirm a green run.

## In-place search (no separate pane/layout) - status: PARTIALLY UNBLOCKED (v0.7.4 popup)

The wish: search like native copy mode, no overlay pane. As of herdr
v0.7.1 the plugin docs state "No API exists for extending or
overriding copy mode in v1", and plugin surfaces are panes
(placement: overlay/split/tab/zoomed). Overlay is already the least
disruptive: it covers only the focused pane and restores focus and
zoom on close; this plugin additionally anchors the opening view to
the pane's visible screen so it LOOKS in-place.

Mitigation found 2026-07-07 (herdr 0.7.1): setting `[ui] pane_borders =
false` in the user's herdr config removes the frame herdr draws around
the overlay, closing most of the remaining visual gap (verified: the
"ring" disappears). Caveat: it is a herdr-global, user-side setting, so
split-pane dividers also lose their borders. This does not make the
plugin truly in-place (still a pane), but the borderless overlay is
close enough that the author accepted it; worth noting in the README as
a recommended herdr setting. True in-place stays upstream-blocked below.

Unblock triggers (checked by CL-07):
- native `/` `?` search ships in herdr copy mode (merged to master
  2026-07-10 via #1230, unreleased) -> see Archive conditions instead
- a copy-mode extension/override API ships -> port this plugin's
  search into it (major version)
- floating/popup plugin surfaces ship (upstream #1125) -> SHIPPED in
  v0.7.4 (2026-07-15): `placement = "popup"` opens a session-modal
  floating terminal popup with optional width/height (cells or
  percentage), one popup per session, tiled layout untouched. Caveat:
  it is session-modal, NOT pane-scoped - it will not anchor over the
  focused pane the way the current overlay's frozen-screen trick does,
  so it is not automatically "true in-place" for copy mode. NEXT (needs
  a TTY session): characterize popup for this plugin - does herdr draw
  a border around it (and does `[ui] pane_borders = false` still
  matter)? does the plugin manifest `[[panes]]` accept it? where does
  it anchor and at what default size? Verdict likely: strong fit for
  EXTRACT (bottom-popup picker, today full-window) and possibly for a
  compact search prompt; weaker fit for full copy mode, which wants the
  pane's own content under the cursor. A1 is resolved (2026-07-23:
  all modes stay), so this characterization can proceed at the next
  TTY session.

## Continuous - upstream watch

Run docs/checklists/CL-07-upstream-watch.md quarterly, or before
starting any Phase 2 item, or when herdr updates beyond a patch
release. Log findings in docs/upstream-log.md. Last full CL-07 run:
2026-07-23 (herdr v0.7.5 latest, v0.7.4 installed; native search
RELEASED in v0.7.4 -> A1 triggered; RESOLVED same day: keep +
reposition - see the log entries). Next attention points:
(1) upgrading to v0.7.5 requires re-running `just link` (BREAKING
#1174: plugins are now user-global, 0.7.3-era session installs are
dropped); (2) the empirical contract re-verify is DUE (0.7.3 ->
0.7.4 jump, skipped 2026-07-23 for lack of a TTY session) plus
characterizing the new popup placement. Empirical facts that can
silently change: the ~1000-line pane read cap (undocumented upstream),
OSC 52 forwarding timing (the 200 ms exit grace), overlay placement
behavior, plugin manifest schema.

## Archive conditions

This repo exists to fill an upstream gap. Archive it without regret
when the gap closes. Decision table - evaluate during CL-07 runs:

| # | Condition | How to check | Action |
|---|-----------|--------------|--------|
| A1 | herdr STABLE release grows regex or pattern search, or token extraction, in native copy mode | herdr CHANGELOG + copy-mode docs during CL-07 runs. History: the original A1 (native literal `/` `?` search) fired via v0.7.4 and was RESOLVED 2026-07-23 - keep + reposition docs, see upstream-log | Re-run the keep/strip/archive decision against the then-remaining edge. USER decision - never archive without it |
| A2 | Copy-mode extension API ships | CL-07 step 4 sentinel: plugins docs stop saying runtime action registration / native plugin UI are outside v1, or a copy-mode extension API appears (the old "No API exists..." sentence was removed 2026-07 in a docs reorg, no API shipped) | Either port (new major) or archive in favor of a native-integrated successor |
| A3 | Another maintained plugin reaches scrollback-search parity | awesome-herdr + `herdr-plugin` topic search | Archive, link to it from README |
| A4 | herdr breaks the plugin contract (pane read semantics, overlay placement) and fixing costs more than the plugin is worth | CI red + CL-07 | Pin last working herdr version in README, mark maintenance-only; archive if unused |
| A5 | Author has not used it for 6 months | be honest | Archive |

Archive procedure: set repo archived on GitHub, add a final README
banner naming the reason and the replacement, tag a final release.

## Evidence appendix

herdr upstream (verified 2026-07-07, herdr v0.7.1):
- repo: https://github.com/ogulcancelik/herdr (13.2k stars, created
  2026-03, stable releases every 1-2 weeks + near-daily previews)
- native copy mode: issue #231 (shipped); no native search: no `/`
  `?` in config docs key tables, no search subcommand in CLI ref
- search demand: https://github.com/ogulcancelik/herdr/discussions/563
  (open, unanswered, no maintainer commitment, no upstream ROADMAP)
- no copy-mode plugin API: https://herdr.dev/docs/plugins/ ("No API
  exists for extending or overriding copy mode in v1")
- adjacent upstream issues: #680 copy-mode follows live output, #970
  vim word boundaries, #1000 CJK glyph stops, #785/#812 floating
  surfaces, #893 plugin registry clobber, #978 --lines 0 empty
- OSC 52: forwarded from pane children (#30); herdr itself prefers
  native clipboard tools then OSC 52 (#333)
- competitor: https://github.com/rmarganti/herdr-pluck (visible-only
  hints); list: https://github.com/yigitkonur/awesome-herdr
- HN launch thread: https://news.ycombinator.com/item?id=48714802

herdr upstream refresh (2026-07-10, v0.7.3 latest tag; full log in
docs/upstream-log.md):
- native search MERGED, unreleased:
  https://github.com/ogulcancelik/herdr/issues/1230 (literal
  smartcase `/` `?` `n` `N` + highlighting + cross-line w/b/e;
  Discussion #563 closed into it; #1263 word-motion follow-up closed
  same day)
- floating surfaces: #1125 "Temporary floating popup panes for
  plugins" (open, 9 reactions) supersedes #785/#812 (closed
  not_planned); plugin registry: #893 + #1174 (3 reactions)
- plugin-usable API surfaces: v0.7.2 pane scroll metrics +
  pane.scroll_changed, `herdr terminal session observe`/`control`,
  session.snapshot, `herdr api schema`; v0.7.0 [[link_handlers]]
  (HERDR_PLUGIN_CLICKED_URL); docs claim context JSON carries
  selected text + clicked URL (unverified, F15)
- competitors (all visible-screen only): rmarganti/herdr-pluck
  (unchanged), hotchpotch/herdr-tiny-fingers and iurysza/termscope
  (both new, updated 2026-07-09); `herdr-plugin` topic at 136 repos
- OSC 133 / prompt marks: still nothing upstream (F7 stays blocked)

herdr upstream refresh (2026-07-23, v0.7.5 latest, v0.7.4 installed;
full log in docs/upstream-log.md):
- native search RELEASED: v0.7.4 stable (2026-07-15) ships #1230
  (literal smartcase `/` `?` `n` `N` + highlighting + cross-line
  w/b/e); A1 trial running. Open native-search bug: #1667 (highlight
  does not cover the full match). No upstream regex/pattern-search
  ask exists yet.
- popup surfaces SHIPPED: #1125 closed via v0.7.4 - plugin panes can
  use `placement = "popup"` (session-modal float, width/height in
  cells or percent, singleton per session); see the In-place section
  for the pending TTY characterization.
- v0.7.5 BREAKING #1174: plugins are user-global now (re-link after
  upgrade); #893 registry clobber fixed 2026-07-15. New `[[startup]]`
  plugin hooks (unneeded here). `herdr config check` flags unknown
  keys.
- competitors: still none doing scrollback search; new visible-only
  neighbors RooseveltAdvisors/herdr-leap, malone-c/herdr-keybind-
  search; `herdr-plugin` topic at 305 repos (was 136). Still not
  listed in awesome-herdr (P0.3 open).
- OSC 133 / prompt marks: still nothing upstream (F7 stays blocked)

Cross-ecosystem demand (reaction counts as of 2026-07-07):
- keyboard selection: zellij #1258 (147), #947 (88), #2989; tmux #140
  (28); wezterm #4471 (21)
- custom patterns: extrakto #95 (closed-not-planned -> config);
  thumbs #44; fingers #19, #117; wezterm quick_select_patterns docs;
  kitty hints docs
- open/file:line actions: extrakto #15, #20, #130; zellij #2527 (16);
  wezterm #5534 (9); tmux-plugins/tmux-open; kitty hints docs
- OSC 133 / last-command-output: tmux #3064, #3102, #5237; zellij
  #899 (17), #4414; kitty show_last_command_output
- OSC 52 pain: zellij #3013 (28), #2647 (31); tmux wiki Clipboard
- navigate-with-highlights gap: tmux #972 (open); copycat #69, #127
- incremental search: copycat #70 (10); tmux #895 (14)
- perf on large scrollback: thumbs #88; copycat #129 (13), #123
- wrapped-line matching: tmux #966; copycat #59, #94; zellij #2853 (13)
- jump-to-match: thumbs #146; extrakto #130; roosta/tmux-fuzzback
- multi-select: fingers #169; thumbs README
- insert/copy/paste flow: extrakto #2; wezterm quickselect docs
  (lowercase copies, uppercase copies+pastes)
- weak evidence (deprioritized): case toggle, rectangular selection

Cross-ecosystem additions (swept 2026-07-10, feeding F11-F17):
- capture-group copy: copycat #64; tmux-thumbs README (built-in)
- copy joins wraps / no padding: tmux #4995, #4399; tab handling
  #4201 (44 comments)
- paste-through: extrakto #91, #101; fingers `:paste:`; thumbs
  upcase commands
- pattern classes + management: thumbs/fingers README class lists;
  copycat #57 (20-comment idea thread), #149 (disable a default)
- seed query from cursor word/selection: extrakto #114
- search history / literal mode: tmux search-forward-text (builtin
  literal variant); copycat #70 already cited for incremental
- extract token/config ergonomics: extrakto #67, #97 (separators),
  #72 (default filter = lines)
- cross-pane scrollback source: extrakto #63, #36; copycat #128
  (deferred: reads are per-pane, UX unclear)
- prompt stripping: copycat #132 (deferred: needs OSC 133 = F7)
- perf narrative: copycat #129 "slow" (13 reactions), #123 ripgrep
  proposal - Rust regex is a ready-made selling point for README

AI disclosure norms:
- policy catalog: https://github.com/melissawm/open-source-ai-contribution-policies
- curl policy: https://github.com/curl/curl/blob/master/docs/CONTRIBUTE.md
- the respected disclosure pattern: https://simonwillison.net/2026/May/6/vibe-coding-and-agentic-engineering/
- backlash analysis: https://redmonk.com/kholterhoff/2026/02/03/ai-slopageddon-and-the-oss-maintainers/

Tooling choices:
- vhs: https://github.com/charmbracelet/vhs (+ vhs-action; ratatui
  regenerates its example GIFs this way)
- CI idioms: https://rustprojectprimer.com/ci/github.html
- release binaries: https://github.com/taiki-e/upload-rust-binary-action
- cargo-dist avoided: renamed to dist 2024-10, steward axo wound down
  (axo.dev parked for sale 2026)
