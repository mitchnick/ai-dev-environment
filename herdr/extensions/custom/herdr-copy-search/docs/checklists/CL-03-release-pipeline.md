# CL-03: release flow (local bump + GitHub artifacts)

Context: versioning is intentionally LOCAL-first. cargo-release bumps
Cargo.toml, syncs herdr-plugin.toml, regenerates CHANGELOG.md, commits,
and tags (release.toml: publish=false, push=false, pre-release-hook =
just release-hook, which runs the gate then git-cliff). The
.github/workflows/release.yml (authored 2026-07-07, UNVERIFIED until
the first tag push) builds binaries for a pushed v* tag and attaches
them to a GitHub Release whose notes are curated by git-cliff. Release
binaries are a convenience only: `herdr plugin install` builds from
source via herdr-plugin.toml [[build]].

Rules:
- Releases are USER-ONLY: run this checklist only when the user asks
  for a release (CLAUDE.md rule).
- Never edit version fields by hand; cargo-release keeps Cargo.toml
  and herdr-plugin.toml in lockstep.
- git-cliff must be installed (`cargo install git-cliff --locked`, or a
  prebuilt binary from https://github.com/orhun/git-cliff/releases);
  the release-hook fails the release if it is missing. Never hand-edit
  CHANGELOG.md; it is regenerated from Conventional Commits.

Steps:
1. [ ] Working tree clean, on master, CI green on HEAD.
2. [ ] `just release <patch|minor|major>` - runs the release-hook
       (gate + git-cliff CHANGELOG.md refresh), bumps, commits
       (including the refreshed CHANGELOG.md), tags vX.Y.Z locally.
3. [ ] Push: `git push origin master && git push origin vX.Y.Z`.
4. [ ] `gh run list --workflow release.yml --limit 1` and watch it.
       Expect one job per target: x86_64-unknown-linux-gnu,
       x86_64-apple-darwin, aarch64-apple-darwin.
5. [ ] `gh release view vX.Y.Z` shows 3 archives + sha256 checksums,
       and the body is the git-cliff-curated changelog for this tag
       (not GitHub's default auto-notes). Also confirm the release
       commit from step 2 contains the refreshed CHANGELOG.md.
6. [ ] First time only: when green, delete the "STATUS: UNVERIFIED"
       header comment from release.yml. Commit: `ci: mark release
       workflow verified`. If an action rejects an input (all are
       pinned by guess, never executed), read the action README
       (https://github.com/taiki-e/upload-rust-binary-action,
       https://github.com/orhun/git-cliff-action,
       https://github.com/softprops/action-gh-release) and fix; one
       commit. If taiki-e's upload overwrote the curated body, add
       `gh release edit vX.Y.Z --notes-file RELEASE_NOTES.md` after the
       upload job (or reorder so the notes step runs last).
7. [ ] Verify plugin update path: on a machine with the plugin
       installed from GitHub, `herdr plugin install` the new version
       (or the herdr-documented update command if one exists by now)
       and confirm the new version string in
       `herdr plugin list`.

Done criteria: tag on GitHub, release with 3 artifacts, plugin
updates cleanly.
