# Upstream watch log

Append-only log of CL-07 runs (newest first). Entry template:

    ## YYYY-MM-DD (herdr vX.Y.Z installed, vX.Y.Z latest)
    - changelog: <relevant items or "nothing relevant">
    - discussion #563: <open/answered/closed>
    - copy-mode API sentence: <present/absent>
    - competitors: <changes or "none">
    - empirical contract: <re-verified/skipped (no version change)>
    - archive table: <no trigger / trigger Ax -> action taken>

## 2026-07-23 (A1 decision - keep and reposition; docs-only)

Follow-up to the same-day CL-07 run entry below. The user resolved
archive trigger A1 early, without waiting out the two-week trial:

- decision: KEEP the plugin. The surviving edge is real and daily:
  regex + smartcase incremental search whose Enter lands in the
  plugin's own copy state at the match (no scroll) for refine/yank,
  copycat patterns, extrakto extraction, soft-wrap-aware matching.
  Native (v0.7.4) owns plain browsing and literal lookups - it reads
  the full scrollback, while this plugin is capped at ~1000 lines by
  `herdr pane read`.
- scope: documentation repositioning ONLY. README, website, and
  ROADMAP drop the "fill the gap until native lands, then exit"
  narrative for a coexistence story. No behavior change; all three
  entry points (copy/search/extract) stay; no demo re-record (CL-04
  not triggered); no release forced.
- deferred (possible later 0.2.0, not planned): removing the copy
  entry point; optional --mode pattern entry point.
- archive table: the consumed A1 row is rewritten as a forward
  trigger - native grows regex/pattern search or extraction ->
  re-run the keep/strip/archive decision.

## 2026-07-23 (herdr v0.7.4 installed, v0.7.5 latest; full CL-07 run)

Run triggered by a user-requested roadmap re-analysis. Two stable
releases since the last run: v0.7.4 (2026-07-15), v0.7.5 (2026-07-21).

- changelog: MAJOR - v0.7.4 SHIPS native copy-mode search (#1230):
  literal smart-case `/` `?`, repeat `n`/`N`, match highlighting,
  tmux-style cross-line w/b/e word motions. First STABLE release
  with it -> archive trigger A1 STARTS (see below). v0.7.4 also
  ships #1125: floating popup panes usable by plugins
  (placement = "popup", session-modal, optional width/height cell
  or percentage sizing, singleton per session, no tiled-layout
  change) - the in-place item's watch target landed, in
  session-modal (NOT pane-scoped) form. Also v0.7.4: copy mode
  `$`/End now stops at the last visible char (#1405);
  `ui.copy_on_select` toggle. v0.7.5 BREAKING (#1174): installed
  and linked plugins are now global to the user instead of
  per-session; plugins installed under 0.7.3 must be installed or
  linked again (re-run `just link` after upgrading). v0.7.5 also
  adds one-shot plugin `[[startup]]` hooks (not needed here: this
  plugin is stateless) and `herdr config check` now flags unknown
  config keys.
- discussion #563: closed into #1230 since 2026-07-10; the feature
  is now RELEASED. Known wart: #1667 (open, 2026-07-21) reports
  native search highlighting does not cover the full match. No
  upstream issue asks for regex/pattern search yet (searched
  2026-07-23) - the differentiation surface is intact.
- copy-mode API sentence: sentinel PRESENT - the plugins docs still
  say "Runtime action registration and native non-terminal plugin
  UI are not part of plugin v1" and still describe no way to extend
  or override copy mode. A2 not triggered. Plugin pane placements
  are now documented as overlay/popup/split/tab/zoomed.
- competitors: still NO scrollback-search plugin. rmarganti/
  herdr-pluck (12 stars, pushed 2026-07-14) and hotchpotch/
  herdr-tiny-fingers stay visible-screen hints; newer visible-only
  neighbors: RooseveltAdvisors/herdr-leap (EasyMotion-style jump +
  select-to-copy), malone-c/herdr-keybind-search (keybind overlay,
  not pane content). `herdr-plugin` topic: 305 repos (was 136 on
  2026-07-10); the growth is mostly agent-sidebar tooling.
  herdr-copy-search is still NOT listed in awesome-herdr (P0.3
  open). A3 not triggered.
- tracked issues: #1125 closed-shipped (v0.7.4); #1174
  closed-shipped (v0.7.5, breaking); #893 closed-fixed
  (2026-07-15); #680 / #970 / #1000 still open. OSC 133 / prompt
  marks: still nothing upstream; F7 stays [!] blocked.
- empirical contract: DUE (installed herdr moved 0.7.3 -> 0.7.4)
  but SKIPPED this run - no running herdr session on this host and
  steps 7-9 need a real TTY. Next TTY session: re-verify pane read
  cap, OSC 52 grace, overlay behavior, AND characterize the new
  popup placement (border drawn? manifest [[panes]] support?
  sizing? where it anchors relative to the focused pane?).
- archive table: A1 TRIGGERED - v0.7.4 (2026-07-15) is the first
  stable release shipping native search. Per the table: two-week
  native trial (ends ~2026-07-29 counted from the release), then
  the USER decides archive vs strip-to-surviving-modes. Presented
  to the user this run with a recommendation (strip-down likely:
  native is literal-only, no patterns/extract/actions, and has an
  open highlight bug). A2/A3/A4 not triggered.

## 2026-07-10 (herdr v0.7.3 installed, v0.7.3 latest; full CL-07 run)

Full CL-07 run during a roadmap re-analysis (three-way research pass:
repo inventory, tmux-ecosystem sweep, herdr upstream refresh).

- changelog: MAJOR - native copy-mode search is MERGED TO MASTER but
  UNRELEASED (issue #1230, opened 2026-07-09, closed completed
  2026-07-10; latest tag is still v0.7.3). Unreleased CHANGELOG:
  literal smart-case search with `/` and `?`, repeat with `n`/`N`,
  match highlighting, tmux-style cross-line w/b/e word motions.
  Native search is literal-only: no regex, no patterns, no extract,
  no jump/open/paste actions. #1263 (w/b/e should match tmux) closed
  the same day as part of the same work. Also noted from v0.7.2
  (previously unlogged, plugin-relevant): pane scroll metrics +
  `pane.scroll_changed` subscriptions, `herdr terminal session
  observe`/`control` (live ANSI streams), `session.snapshot`,
  `herdr api schema`. Since 0.7.0: `[[link_handlers]]` route
  ctrl-clicked URLs to a plugin action (HERDR_PLUGIN_CLICKED_URL),
  and docs state HERDR_PLUGIN_CONTEXT_JSON carries selected text and
  clicked URL (NOT yet verified empirically; roadmap F15 depends).
- discussion #563: CLOSED - folded by the maintainer into issue
  #1230. The demand thread is resolved by the native feature.
- copy-mode API sentence: ABSENT - but via a docs reorganization,
  NOT an extension API shipping. The plugins doc no longer mentions
  copy mode at all; the nearest statement is now "Runtime action
  registration and native non-terminal plugin UI are not part of
  plugin v1". The old A2 sentinel is dead; CL-07 step 4 rewritten
  this run with a new sentinel. No copy-mode extension API exists.
- competitors: two NEW visible-only tools appeared (updated
  2026-07-09): hotchpotch/herdr-tiny-fingers (tmux-fingers-style
  hints) and iurysza/termscope (open visible files/links). Both are
  visible-screen only. rmarganti/herdr-pluck unchanged (7 stars,
  listed in awesome-herdr). `herdr-plugin` topic now 136 repos (was
  111). The scrollback search + patterns + extract combo still has
  no competitor. herdr-copy-search itself is still NOT listed in
  awesome-herdr (P0.3 open).
- floating surfaces: #785/#812 are closed not_planned; the live
  successor thread is #1125 "Temporary floating popup panes for
  plugins" (open, 9 reactions) - now the watch target for the
  in-place item. Also new: #1174 (plugin installs across sessions,
  3 reactions; sibling of #893).
- OSC 133 / prompt marks: still nothing upstream (shell integration
  covers cwd reporting only); F7 stays [!] blocked.
- empirical contract: skipped (no version change since the 0.7.3
  re-check on 2026-07-08).
- archive table: NO TRIGGER YET, but A1 is now ARMED: #1230 is
  merged but A1 requires a STABLE release. When the next stable tag
  ships with it, start the two-week native trial per A1. A2 not
  triggered (docs reorg, not an API). A3 not triggered (competitors
  are visible-only).
- decision (user, 2026-07-10): differentiation posture - invest only
  in what native search will not do (regex search, patterns,
  extract, jump/open/paste actions, copy ergonomics); FREEZE
  copy-mode motion-parity work (f/F/t/T, counts, marks, `*`/`#`,
  block selection) until the A1 trial has an outcome. ROADMAP
  re-ranked accordingly (F11-F17 added).

## 2026-07-09 (repo public; CI/release verified; herdr 0.7.3)

Ad-hoc verification during a roadmap sync (not a full CL-07 run).
herdr v0.7.3 installed (0.7.1 at the baseline research).

- repo: now a PUBLIC GitHub repo (qq88976321/herdr-copy-search),
  default branch master, tags v0.1.1..v0.1.3 on origin.
- CI: `ci` workflow run on master HEAD (0ea3661) = success (GitHub API).
- release: `release` workflow on v0.1.3 = success; attached linux +
  x86_64/aarch64 macOS binaries + sha256 and git-cliff notes;
  releases/latest = v0.1.3. Historical: the v0.1.2 release run FAILED,
  but v0.1.3 is green, so the pipeline works now.
- pages: NOT enabled (has_pages=false, site 404); P3.4 deploy pending.
- empirical contract: not re-run in full; the 0.7.3 two-read trailing-
  whitespace asymmetry was recorded in CLAUDE.md on 2026-07-08. A full
  CL-07 run is still due before the next Phase-2 item.
- archive table: no trigger.

## 2026-07-07 (UX follow-up - overlay chrome and placement)

Ad-hoc verification while the author trialled the plugin in real herdr
(not a full CL-07 run). herdr v0.7.1.

- pane borders: a single global bool `[ui] pane_borders` (default true)
  draws BOTH split-pane dividers and the frame around the plugin
  overlay. `false` removes both (author confirmed the overlay "ring"
  disappears); no thin-line or overlay-only middle ground, `[theme]
  accent` only colors the border when on. Recommend pane_borders=false
  only for one-pane-per-tab layouts.
- placement: a plugin overlay renders FULL-WINDOW; `--placement overlay`
  and `zoomed` look identical (author TTY-tested). No pane-scoped
  floating overlay in 0.7.1 -> "open inside the current pane only" is an
  upstream gap, same family as in-place (floating/popup surfaces #785,
  #812). `split`/`tab` open a separate pane/tab.
- archive table: no trigger. Reinforces the in-place item's priority
  (author dislikes the framed/full-window overlay; wants true in-place).

## 2026-07-07 (herdr v0.7.1 installed, v0.7.1 latest stable)

Baseline entry from the initial research pass (full details in
docs/ROADMAP.md evidence appendix).

- changelog: copy mode exists (#231); no native search anywhere.
- discussion #563 ("Add / and ? search in copy mode"): open,
  unanswered, no maintainer commitment, no planned label.
- copy-mode API sentence: PRESENT ("No API exists for extending or
  overriding copy mode in v1", https://herdr.dev/docs/plugins/).
- competitors: rmarganti/herdr-pluck = visible-screen hints only; no
  scrollback search plugin found across 111 herdr-plugin repos.
- empirical contract (verified 2026-07-06/07, herdr 0.7.1): pane read
  cap ~1000 lines (999 recent-unwrapped); OSC 52 needs ~200 ms exit
  grace; overlay covers focused pane, restores focus+zoom; details in
  CLAUDE.md "herdr plugin contract".
- archive table: no trigger.
- open questions for next run: does `pane read --source detection`
  expose prompt/command marks (would unblock roadmap F7)? Is there a
  plugin-facing clipboard API that could replace raw OSC 52 writes to
  /dev/tty (would remove the 200 ms sleep and the ~100 KB payload
  truncation risk)? Did #481's socket auth scoping leave pane.read
  unrestricted?
