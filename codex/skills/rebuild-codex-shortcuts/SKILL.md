---
name: rebuild-codex-shortcuts
description: Rebuild the Codex shortcut customizations (Cmd+E model picker, Cmd+Shift+E full effort cycle with Max/Ultra) for the Codex version npm has installed, port the patch if upstream moved, and install the build once every gate passes. Use when the codex launcher says Codex "is running stock, without your shortcuts", after an npm Codex upgrade, or when asked to rebuild, port or reinstall the Codex customizations.
---

# Rebuild Codex shortcuts

When npm brings a new Codex, `codex` starts it stock at once; nobody waits on a
build. This skill brings the customizations to that version: a fresh clone of the
release, the patch (ported when upstream moved), a build, the gate, and the
install. The build counts as done only when every gate passes and the health
check prints `OK`. Until then, stock Codex keeps working.

Run everything from the `ai-dev-environment` checkout
(`~/Projects/ai-dev-environment`). Each step is
`python3 codex/scripts/rebuild-shortcuts.py <step> [ATTEMPT]`. `prepare` prints
the attempt directory as its last line, and every later step takes it.

`build` takes about 15 minutes. `test` takes about 5, compiling the test
binaries included; the suite alone ran in under 3 minutes for 0.164.0. Both can
run longer than a foreground command's time limit: run them in the background
(Claude Code's `run_in_background`, or a Codex background terminal) and wait
for them to exit.

## Steps

1. **Prepare.** `prepare` clones `rust-v<version>`, snapshots npm's helper bundle
   and applies `codex/patches/model-effort.patch`. Exit 0 means the patch applied;
   go to step 3. Exit 2 means it no longer applies; go to step 2.
2. **Port** (only after exit 2). Work in `ATTEMPT/source`, which is a clean
   checkout of the release.
   - Read the whole old patch and the behavior in `codex/patches/README.md`
     (§ Codex model and effort shortcuts, and the 0.155.0 validation list).
     Rebuild each change on the new upstream code, fitting upstream's current
     structure rather than forcing the old hunks:
     - Cmd+E/Alt+E opens the model picker.
     - Cmd+Shift+E/Alt+Shift+E cycles the active model's advertised effort
       levels, Max and Ultra included, and wraps. It preserves the draft,
       cursor, model and saved defaults. Plan mode changes its own override,
       and open popups keep keyboard ownership.
     - The six tests in `chatwidget/tests/personal_shortcuts.rs`.
     - The test-harness repairs: deterministic release-tag snapshot versions,
       and the analytics fixture's bootstrap kept on its mock server.
   - Change no dependencies, and never delete or weaken an upstream test.
   - Iterate with `shortcut-tests ATTEMPT` until the six shortcut tests pass.
   - `save ATTEMPT` writes the port to `codex/patches/model-effort.patch`.
     Then run `prepare` again. The saved patch must apply to a fresh clone, and
     that new attempt is the one you build.
3. **Build.** `build ATTEMPT` formats the TUI crate, then builds the optimized
   release CLI and the debug CLI that the TUI tests use.
4. **Gate.** `test ATTEMPT` runs every check that must pass, in order:
   1. the six personal-shortcut tests;
   2. upstream's full `codex-tui` suite, six tests at a time; a test that fails is
      rerun alone, and one that fails alone fails the gate;
   3. the launcher, installer and rebuild tests (`codex/scripts`, on macOS's
      `/usr/bin/python3`, which runs the launcher);
   4. Herdr's shortcut router tests (`herdr/shortcuts/test_cycle_effort.py`).

   When it passes, it records `ATTEMPT/gate.json` for this exact binary, version
   and patch. If a TUI test fails even alone, find out whether the
   customizations cause it. Clone the same tag unpatched next to the attempt
   and run that one test there. If upstream fails too, stop and report it to
   the person: don't install, and don't skip, filter or weaken the test. If
   only the patched source fails, fix the port (step 2).
5. **Install.** `install ATTEMPT` refuses unless the gate passed for this binary,
   npm still has the attempt's version and the patch is unchanged. It then
   installs the build beside the earlier releases, switches `current`, and runs
   `check-shortcuts.py`, which must print `OK`.
6. **Report.** Give the installed version, any tests that passed only when rerun
   alone, and whether you ported the patch. A ported patch is an uncommitted
   change to `codex/patches/model-effort.patch`; leave it for the person to
   review and commit. New `codex` launches use the build. Running sessions
   keep theirs until they exit and resume.

## Rules

- Never kill, restart or resume a person's running Codex sessions, and never
  modify a directory under `~/.local/share/codex-shortcuts/releases/`.
- Install only through `install`, which checks the gate.
- If npm moves to another version partway through, start again from `prepare`.
- Keep failed attempts under `~/.local/share/codex-shortcuts/builds/` for
  diagnosis.
