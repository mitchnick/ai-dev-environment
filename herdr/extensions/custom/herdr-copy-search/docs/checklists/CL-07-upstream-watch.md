# CL-07: upstream watch (herdr) and archive decision

Run this: quarterly; before starting any Phase 2 roadmap item; or
after updating herdr past a minor version. Takes ~15 minutes. Record
every run in docs/upstream-log.md (append a dated entry, template at
the bottom of that file) - even "no change" runs, so staleness is
visible.

## Collect facts

1. [ ] Installed vs latest herdr:
       `herdr --version`
       `curl -s https://api.github.com/repos/ogulcancelik/herdr/releases/latest | grep tag_name`
2. [ ] Changelog scan since the last logged version:
       https://github.com/ogulcancelik/herdr/blob/main/CHANGELOG.md
       Search for: "copy mode", "search", "plugin", "pane read",
       "clipboard", "OSC". Note anything relevant.
3. [ ] Native search release status. History: Discussion #563 was
       folded into issue #1230, which merged literal smartcase
       `/` `?` `n` `N` search + match highlighting to master on
       2026-07-10 (UNRELEASED at that date).
       https://github.com/ogulcancelik/herdr/issues/1230
       Check whether a STABLE release now includes it; the first one
       that does STARTS the A1 two-week native trial (roadmap
       archive table).
4. [ ] Copy-mode plugin API: fetch https://herdr.dev/docs/plugins/.
       The old sentinel sentence ("No API exists for extending or
       overriding copy mode") was removed in a 2026-07 docs reorg
       WITHOUT any API shipping. New sentinel: the docs still say
       "Runtime action registration and native non-terminal plugin
       UI are not part of plugin v1" and still describe no way to
       extend or override copy mode. If that statement disappears or
       a copy-mode extension API appears, evaluate trigger A2 in the
       roadmap archive table.
5. [ ] Competitor check: any plugin doing scrollback SEARCH (not just
       visible-screen hints)?
       - https://github.com/rmarganti/herdr-pluck (recent releases?)
       - https://github.com/yigitkonur/awesome-herdr (new entries in
         copy/search category)
       - https://github.com/topics/herdr-plugin sorted by recently
         updated
6. [ ] Tracked upstream issues - state changes?
       #680 (copy mode follows live output), #970 (vim word
       boundaries), #1000 (CJK glyph stops), #1125 (floating popup
       panes for plugins; successor of the closed-not-planned
       #785/#812), #893 + #1174 (plugin registry clobber /
       persistence across sessions).

## Re-verify empirical contract (only if herdr version changed)

These facts are load-bearing, undocumented upstream, and may silently
change (they live in CLAUDE.md "herdr plugin contract"):
7. [ ] pane read line cap: in a pane, `seq 3000`, then
       `herdr pane read --pane <id> --lines 3000 --format text | wc -l`
       Expect ~1000. If it changed, update CLAUDE.md and consider the
       buffer.rs implications (larger reads = perf check).
8. [ ] OSC 52 grace period still needed: temporarily lower the sleep
       in osc52.rs to 0 in a scratch build, yank inside herdr, check
       whether the clipboard still receives it. If herdr now flushes
       synchronously, the 200 ms sleep can go (roadmap note).
9. [ ] Overlay behavior: does the overlay still cover only the
       focused pane and restore focus+zoom on close?

## Decide

10.[ ] Walk the Archive conditions table in docs/ROADMAP.md (A1-A5)
       against the facts above. Outcomes:
       - no trigger: log "no change", done
       - trigger A1/A2/A3: STOP, present the evidence to the user
         with a recommendation (archive / port / strip down). Never
         archive without the user's explicit decision.
       - trigger A4: pin the last working herdr version in README,
         tell the user
11.[ ] New herdr features that UNBLOCK roadmap items (e.g. OSC 133 /
       prompt marks exposure for F7, popup surfaces for extract):
       update the item's status in docs/ROADMAP.md from [!] and tell
       the user it is now buildable.
12.[ ] Append the dated entry to docs/upstream-log.md, commit:
       `docs(upstream): watch run YYYY-MM-DD`.
