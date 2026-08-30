# CL-06: developing a feature (the repo dev loop)

Use this for every Phase 2 roadmap item and any new behavior. It
encodes the development process for this repo; workspace-wide rules
(~/projects/agent-os) still apply on top.

## 1. Scope before code

1. [ ] Read the roadmap item (docs/ROADMAP.md): motivation, evidence,
       done criteria. The done criteria are the contract.
2. [ ] If the item is tagged upstream-dependent ([!] or "investigate
       first"), run CL-07 first; do not build on guessed herdr
       behavior. New empirical findings go to CLAUDE.md ("herdr
       plugin contract" section) and docs/upstream-log.md.
3. [ ] Brainstorm the design decisions the roadmap left open (key
       bindings, config keys, edge cases). Key-binding rule: follow
       tmux/extrakto conventions where one exists (that is this
       plugin's promise); note the chosen bindings for the README
       table before coding.
4. [ ] Check the module map in CLAUDE.md; changes should land in the
       module that owns the concern. New cross-module effects go
       through app.rs (App, Mode, Effect state machine).

## 2. Build test-first

5. [ ] Write failing unit tests in the owning module's tests block
       first. Every module is unit-tested today (128 tests); keep it
       that way. Rendering cannot be unit-tested end-to-end - test
       the logic that feeds ui.rs instead.
6. [ ] Implement the minimal version. ASCII-only edits. No new crate
       dependencies without explicit user confirmation (CLAUDE.md).
7. [ ] `just gate` green.

## 3. Manual TTY verification (required - unit tests cannot see the terminal)

8. [ ] Fixture run in a real terminal: `just run <mode>`; exercise
       the new behavior against fixtures/sample.txt. If the fixture
       lacks content for it, EXTEND fixtures/sample.txt (append
       ASCII lines; never rewrite existing lines - tapes and manual
       tests reference them).
9. [ ] In-herdr run (needed whenever the feature touches herdr
       integration: pane read, send-text, OSC 52, env resolution):
       run the binary in a scratch split with `--pane <source-id>`,
       drive it with `herdr pane send-keys` / `send-text` from
       outside (CLAUDE.md "Manual / driving tests" has the details
       and the pageup/pagedown caveat).
10.[ ] OSC 52 features: verify the copied text actually lands in the
       LOCAL clipboard across the real SSH setup, not just that the
       sequence was written.

## 4. Ship

11.[ ] Update README: key tables, config keys, design notes if the
       architecture note changed.
12.[ ] Rendering or keybinding changed? Regenerate demo GIFs (CL-04)
       in the same change.
13.[ ] Conventional commit(s), one coherent change each, scope =
       module or area (feat(extract): ..., feat(search): ...).
14.[ ] Mark the roadmap item [x] (or [~] with a one-line note of
       what remains) in docs/ROADMAP.md; include that edit in the
       final commit.

Definition of done = roadmap done criteria + gate green + manual TTY
check done + README/demo current + roadmap status updated.
