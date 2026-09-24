# Codex model and effort shortcuts

`model-effort-v0.155.0.patch` restores Cmd+E (model picker) and Cmd+Shift+E
(effort cycle) on official `rust-v0.155.0`, commit `f0a1b8f08`.
The older `effort-cycle-v0.154.0.patch` is retained for that release only.

The cycle walks the active model's advertised levels, including Max and Ultra,
then wraps. It preserves the draft, cursor, model, and saved defaults. Plan
mode changes its own override. Open popups retain keyboard ownership. Ultra
retains the upstream warning and behavior; it is not just a display label.

Ghostty sends Alt+E for Cmd+E. Herdr's shared router sends Alt+Shift+E for
Cmd+Shift+E only to a recognized managed executable. Native Super chords and
legacy ESC E also work. Stock sessions receive Alt+. (increase only, no full
wrapping); use `/model` to choose advanced levels in those sessions.

## Why the update broke it

On September 18, 2026, npm upgraded Codex from 0.154.0 to 0.155.0 and replaced
the native executable link used by the previous installer. The custom key
handler disappeared, while the router continued sending its key.

The new installer owns `~/.local/bin/codex` and stores complete, version-matched
native bundles under `~/.local/share/codex-shortcuts/releases/`. npm owns neither
location. `current` selects the tested release, and a capability manifest lets
the router recognize its running processes. Missing metadata, an unknown
executable, or a changed executable falls back to the upstream key. No PID
migration file or background watcher is needed.

**Tradeoff:** npm can update stock Codex, but the managed launcher stays on its
last tested release until a new patch is built, tested, and installed. This
prevents silent shortcut loss; it does not automatically port patches.

## Build and install (macOS)

Set `AI_ENV_REPO` to this repository's absolute path, then:

```sh
npm install -g @openai/codex@0.155.0
git clone --depth 1 --branch rust-v0.155.0 https://github.com/openai/codex.git "$HOME/Projects/codex-shortcuts-0.155.0"
cd "$HOME/Projects/codex-shortcuts-0.155.0"
git apply --check "$AI_ENV_REPO/codex/patches/model-effort-v0.155.0.patch"
git apply "$AI_ENV_REPO/codex/patches/model-effort-v0.155.0.patch"
cd codex-rs
export PATH="$HOME/.cargo/bin:$PATH"
just fmt
CARGO_PROFILE_RELEASE_DEBUG=0 CARGO_PROFILE_RELEASE_LTO=false \
  CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16 CARGO_BUILD_JOBS=6 \
  cargo build --release -p codex-cli
# Follow the checkout's AGENTS.md, including its TUI suite:
env -u NO_COLOR CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0 \
  CARGO_BUILD_JOBS=6 just test -p codex-tui
```

Use the checkout's pinned Rust 1.95.0. Release-tag builds normalize workspace
versions in Cargo.lock; follow upstream's lockfile instructions. The patch
keeps test snapshots on the development version while the release binary
reports 0.155.0. It changes no dependencies.

Identify the matching platform's `vendor/<target>` directory under the npm
package (Apple Silicon example below). The installer checks version equality,
copies the entire helper bundle including `codex-code-mode-host`, signs the
custom executable, and atomically switches `current`. Do not run it until the
custom build's tests pass; it cannot establish keyboard behavior from a version
string alone.

```sh
AI_ENV_CODEX_VENDOR="$(npm root -g)/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin"
python3 "$AI_ENV_REPO/codex/scripts/install-shortcuts.py" \
  --binary "$PWD/target/release/codex" --vendor "$AI_ENV_CODEX_VENDOR"
cp "$AI_ENV_REPO/herdr/shortcuts/"*.py "$HOME/.config/herdr/shortcuts/"
export PATH="$HOME/.local/bin:$PATH"
rehash
python3 "$AI_ENV_REPO/codex/scripts/check-shortcuts.py"
```

Keep `~/.local/bin` before npm in your shell startup configuration, after nvm
initialization. Existing sessions retain their loaded executable: save drafts,
exit normally, and run `codex resume` (or `cx resume`) once. Herdr and Ghostty
need no restart. Do not kill running sessions to install this.

## Verify and upgrade

```sh
python3 codex/scripts/check-shortcuts.py
python3 -B -m unittest discover -s codex/scripts -v
python3 -B -m unittest discover -s herdr/shortcuts -p test_cycle_effort.py -v
```

The installer regression test simulates npm replacing its binary and verifies
that the managed command and matching helper still work. Router tests cover
managed/stock sessions, a replaced executable, missing/corrupt metadata,
detection failures, and correct pane routing. The health check verifies PATH,
the selected release, its checksum, and the helper's presence.

For a new Codex release: install stock npm, use a fresh source checkout for the
same tag, rebase the patch, run formatting and the TUI suite, verify the actual
terminal cycle, and run the installer with matching helpers. If any check fails,
leave `current` pointing at the previous working release. Release directories
are never overwritten, so existing sessions keep their recognized identity.

To inspect/run the npm version without changing the managed launcher:

```sh
node "$(npm root -g)/@openai/codex/bin/codex.js" --version
node "$(npm root -g)/@openai/codex/bin/codex.js" resume
```

## Validation on September 18, 2026

On macOS, the 0.155.0 patch passed all **4,595 TUI tests**, with six upstream
skips. This includes all six personal-shortcut tests: picker, terminal encodings,
advanced-level wrapping, modal ownership, single-level models, and Plan scope.
`just fmt` and `just bazel-lock-update` completed. The installer regression and
six router tests passed, including under macOS's system Python used by Herdr.
An isolated PTY using the installed launcher verified High → xHigh → Max →
Ultra → Low → Medium → High and the model picker, preserving an unsent draft.
Live process detection selected the custom key for the managed executable and
the fallback key for the existing stock session. The installed integrity check
and interactive-shell launcher resolution passed.

## Reduced polling (September 19, 2026)

`polling-v0.155.0.patch` applies after the shortcut patch above. It keeps idle
waiting in native code so the model runs less often while commands and agents
are still working:

- Initial shell execution defaults to 30 seconds; an explicit shorter yield
  remains available for starting a background job or an interactive terminal.
- Empty `write_stdin` calls for pipe-backed commands wait at least 60 seconds,
  bounded by `background_terminal_max_timeout`. PTYs retain their five-second
  minimum and non-empty writes retain their interactive timing.
- The JavaScript `wait` tool defaults to 60 seconds. Explicit yields and
  termination remain available.
- Legacy agent waits default to, and have a minimum of, 60 seconds. The
  configuration snapshot sets the same minimum/default for multi-agent v2 and
  a 60-second initial yield for code-mode `exec`, without enabling either
  feature when it would otherwise be disabled.

These are maximum waits before returning control, not sleeps after completion.
The existing process-exit, agent-message, completion, and cancellation paths
remain in use. Progress continues through Codex's existing output events.
An idle command can still return after the deadline; a timeout does not mean
success, and does not terminate the process. Interactive terminals retain
more frequent polling because they may need input.

No Jev calls or credentials are needed for this deterministic path. Semantic
classification of ambiguous output is not included. It would require a
separate evaluated classifier and a decision about which log content to send.
The reported weekly dollar saving has not been verified.

Apply this patch with `git apply --check` and then `git apply`, using the same
0.155.0 checkout and build/install procedure above. Also merge the two feature
tables from `codex/config/config.toml` into the local Codex configuration.
For full Cargo workspace tests, use the repository's Codex-built V8 artifacts.
The default `v8` crate download URL lacks the requested sandbox-enabled archive.
`scripts/codex_package/v8.py` downloads the archive and Rust bindings from the
`openai/codex` release and checks them against the pinned checksum manifest.
Set both `RUSTY_V8_ARCHIVE` and `RUSTY_V8_SRC_BINDING_PATH` to those verified
files, as `.github/actions/setup-rusty-v8/action.yml` does. Do not substitute
the ordinary archive or disable the V8 sandbox. Build `codex-code-mode-host`
and `test_stdio_server` before running core integration tests in isolation.

On macOS, the complete workspace also needs CMake and GStreamer 1.28 or later
available through `pkg-config` (`brew install cmake gstreamer`).

Validation on September 20, 2026: the release build, formatting, patch
application checks, installer regression, and all three polling regression
cases passed. Across the core run and its targeted retry, 4,260 tests passed,
with 26 skipped. The remaining credential-snapshot timeout also reproduces
on the unchanged upstream source in an isolated worktree. The complete
workspace run finished with 18,359 passed, nine failed, two timed out, and
50 skipped. Ten failing cases also fail on unchanged upstream: credential
snapshot discovery, two Seatbelt path checks, two skills-extension snapshots,
the V8 proof-of-concept sandbox feature check, the app-server warning and
thread-revert checks, one zsh subcommand-decline check, and the voice decoder.
The remaining zsh exec-approval-decline case passed when rerun against the
patched source. No polling regression failed, but the full suite is not green.

The source checkout's `tmp/polling-workspace-tests-cmake.log` records the full
run. `tmp/polling-baseline-test.log`, `tmp/polling-workspace-baseline.log`, and
`tmp/polling-workspace-baseline-remaining.log` record upstream comparisons;
`tmp/polling-workspace-zsh-retry.log` records the passing patched retry.
The release executable is built. The previous managed release remains selected,
following the installation gate above; activation requires accepting these
known upstream/environment failures.

### Rollback

Select the previous managed release with the `current` symlink, and remove
the `features.code_mode.default_exec_yield_time_ms`,
`features.multi_agent_v2.min_wait_timeout_ms`, and
`features.multi_agent_v2.default_wait_timeout_ms` overrides. Restart/resume
Codex normally; running sessions retain their loaded executable.

## Shortcut rollback

To return to stock, rename `~/.local/bin/codex` to `codex-shortcuts.disabled`,
run `rehash`, and verify `command -v codex` selects npm. Existing managed sessions
continue working; new stock sessions get the compatible router fallback.
Keep the manifest and release directories while those sessions are alive.
To restore shortcuts, move the launcher back and run the health check.

To select an older managed release, replace the `current` symlink with that
release directory and run the health check before restarting any session.
Do not modify release executables in place.
