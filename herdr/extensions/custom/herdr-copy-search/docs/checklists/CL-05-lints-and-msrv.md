# CL-05: verify MSRV and tighten lints stepwise

Context: Cargo.toml gained [lints.rust]/[lints.clippy] tables and
`rust-version = "1.74"` on 2026-07-07. That day (commit a3acc36) the
1.74 floor was VERIFIED to build - source + locked deps compile on
1.74.0 - so it is an enforced floor now. Still outstanding: `cargo msrv
find` (the true-minimum bisect, step 2 below) was not run, and the CI
msrv job (step 4) remains commented out. The lint set is deliberately
conservative; this checklist finishes the MSRV story (true minimum + CI
enforcement) and optionally tightens lints.

Part 1 - verify MSRV:
1. [ ] Install: `cargo install cargo-msrv --locked` (or download from
       https://github.com/foresterre/cargo-msrv/releases).
2. [ ] `cargo msrv find` (it bisects toolchains; needs network to
       download them). Note the result.
3. [ ] Set `rust-version` in Cargo.toml to max(found, "1.74") and
       remove the "unverified" comment next to it.
4. [ ] Enable the msrv job in .github/workflows/ci.yml (a commented
       block exists): uncomment it and set its toolchain to the same
       value. The comment in the job says to keep the two in sync.
5. [ ] `just gate` green, push, CI green including msrv job.
       Commit: `build: verify MSRV at <version>`.

Part 2 - tighten lints (optional, stepwise; stop at any point):
1. [ ] One group at a time, add to [lints.clippy] in Cargo.toml:
       `pedantic = { level = "warn", priority = -1 }`
       then `just gate`. clippy runs with -D warnings, so every new
       finding is a hard error.
2. [ ] Triage each finding:
       - fix it if the fix is local and obviously safe
       - allow the single lint with a line like
         `too_many_lines = "allow"` UNDER the pedantic line if the
         lint fights this codebase's style (e.g. TUI functions are
         long by nature)
       - if a fix would change behavior, STOP; that is feature work,
         route it through CL-06 instead
3. [ ] Hard rules: never blanket-allow at crate level in source files
       (#![allow]); keep all lint policy in Cargo.toml so it stays
       reviewable in one place. Never allow `unwrap_used` style lints
       just to enable a group.
4. [ ] `just gate` green. Commit: `build: enable clippy pedantic
       (with N targeted allows)`.

Formatter policy (already decided, do not revisit): rustfmt defaults,
no rustfmt.toml. If a future rustfmt release changes defaults and the
gate breaks, run `cargo fmt`, review the diff, commit as
`style: rustfmt <version> reformat`.

Done criteria: rust-version verified and enforced in CI; lint policy
lives entirely in Cargo.toml; gate green.
