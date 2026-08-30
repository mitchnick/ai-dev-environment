# CL-01: publish this repo to GitHub

Preconditions (STOP and ask the user if any is unmet):
- [ ] The user explicitly asked to publish. Never publish on your own
      initiative; a public push is not reversible in practice.
- [ ] Confirm with the user: repo name (default `herdr-copy-search`),
      owner account, public visibility.
- [ ] README "Status" disclosure section exists (P0.2).
- [ ] `just gate` passes.

Steps:
1. [ ] `gh auth status` succeeds for the intended account.
2. [ ] Create and push (note: local branch is `master`; keep it):
       `gh repo create <owner>/herdr-copy-search --public --source . --push`
       If the command errors on default branch, run
       `git push -u origin master` afterwards and set the default
       branch: `gh repo edit --default-branch master`.
3. [ ] Set metadata:
       `gh repo edit --description "regex and copycat pattern search with extrakto token extraction for herdr scrollback, landing in a tmux-style copy mode (OSC 52)" --add-topic herdr-plugin --add-topic herdr --add-topic copy-mode --add-topic tmux --add-topic terminal --add-topic rust`
       (description updated 2026-07-23 for the coexistence
       repositioning after native search shipped in herdr 0.7.4)
4. [ ] Push existing tags: `git push origin --tags`.
5. [ ] Verify CI: follow CL-02 now (first push just triggered it).
6. [ ] Verify install path on a machine/config where the plugin is
       NOT already linked:
       `herdr plugin install <owner>/herdr-copy-search`
       then open copy mode from a keybinding. If install fails, check
       that herdr-plugin.toml [[build]] ran (needs cargo on PATH) -
       document any missing prerequisite in README Install section.
7. [ ] Update README Install section: replace `<owner>` placeholder
       with the real owner. Commit: `docs(readme): real install path`.
8. [ ] awesome-herdr listing (optional, needs P3-level polish):
       fork https://github.com/yigitkonur/awesome-herdr, add this repo
       under the closest category following that repo's CONTRIBUTING
       format, open a PR. Ask the user before opening the PR.

Done criteria: repo public, CI green, install-from-GitHub verified,
README has no <owner> placeholders.
