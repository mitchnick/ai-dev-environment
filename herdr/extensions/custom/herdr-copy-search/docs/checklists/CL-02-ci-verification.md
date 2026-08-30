# CL-02: verify the CI pipeline on GitHub

Context: .github/workflows/ci.yml was authored 2026-07-07 while the
repo was local-only, so it has never run. It intentionally mirrors
`just gate` plus `cargo audit`. Run this checklist right after the
first push (CL-01) or after any workflow edit.

Steps:
1. [ ] `gh run list --workflow ci.yml --limit 3` shows a run for the
       pushed commit. `gh run watch` until it finishes.
2. [ ] All jobs green: fmt, clippy, test (ubuntu AND macos), audit.
3. [ ] If a job fails, fix forward using this table, one commit per
       fix (`ci: <what>`), and re-run:
       - fmt/clippy/test fails on GitHub but `just gate` passes
         locally: toolchain drift; note local `rustc --version` vs the
         version in the job log. Reproduce locally with
         `rustup update stable` then `just gate`. Fix code, not CI.
       - macos-only test failure: likely a real platform bug (this
         plugin declares macos support). Reproduce is hard without a
         mac; read the failing assert, fix the code, let CI verify.
         Do NOT drop macos from the matrix to make CI green.
       - audit fails with a RUSTSEC advisory: read the advisory. If a
         fixed version exists: `cargo update -p <crate>` and run
         `just gate`. If no fix exists and the advisory does not
         affect how this plugin uses the crate, add it to the ignore
         list in the audit job step with a dated comment and tell the
         user. Never ignore silently.
       - action not found / deprecated runner: check the action's
         repo for the current major tag, bump the single reference.
4. [ ] When green: delete the "STATUS: UNVERIFIED" header comment
       block from ci.yml. Commit: `ci: mark pipeline verified`.
5. [ ] Add the badge to README directly under the H1 title:
       `[![ci](https://github.com/<owner>/herdr-copy-search/actions/workflows/ci.yml/badge.svg)](https://github.com/<owner>/herdr-copy-search/actions/workflows/ci.yml)`
       Commit: `docs(readme): ci badge`.
6. [ ] Optional hardening (ask the user first): add zizmor + actionlint
       as a workflow-lint job; keep it advisory (continue-on-error)
       for the first month.

Done criteria: CI green on master, UNVERIFIED note removed, badge in
README. From now on, the local `just gate` and CI must both pass
before any merge/push; if they ever disagree, trust CI and fix the
local toolchain.
