# Machine headers for Herdr 0.9.0

Optional client source patch against upstream commit `b99002ac99b09e00b4ca692436cb15a6b0d676f1` (Herdr v0.9.0).

Expanded machine headers use `palette.surface1` (`#363537` in the exported
Monokai Pro Spectrum theme), bold `palette.subtext0` labels (`#bab6c0`), and
`palette.overlay1` disclosure arrows (`#8b888f`). Disabled machine labels retain
their existing muted styling. The active collapsed machine uses `active_row_bg`. The leading header
space and extra two-column workspace indent are removed. Worktree nesting remains intact.
Connection badges, collapse targets, and the compact sidebar retain their behavior.
No new config override is needed; these colors already exist in the exported palette.
The final charcoal styling has been visually confirmed and approved. It supersedes
the earlier light-gray build.

## Rebuild

Dependencies: Git, Rust 1.96.1 via rustup, Just, and Zig 0.15.2. The upstream
`rust-toolchain.toml` selects Rust 1.96.1. On macOS, install `zig@0.15` with
Homebrew; set `ZIG` to its executable because the formula is keg-only.

From this export's repository root, copy only the patch and guide:

```sh
mkdir -p "$HOME/.config/herdr/patches"
cp herdr/patches/machine-headers-v0.9.0.patch \
  herdr/patches/machine-headers-v0.9.0.md "$HOME/.config/herdr/patches/"
```

Create a separate clean upstream checkout at the exact base commit:

```sh
mkdir -p "$HOME/Projects"
git clone --branch v0.9.0 --single-branch https://github.com/herdrdev/herdr.git \
  "$HOME/Projects/herdr-machine-headers-source"
cd "$HOME/Projects/herdr-machine-headers-source"
git checkout --detach b99002ac99b09e00b4ca692436cb15a6b0d676f1
```

From that checkout's root:

```sh
git apply --check "$HOME/.config/herdr/patches/machine-headers-v0.9.0.patch"
git apply "$HOME/.config/herdr/patches/machine-headers-v0.9.0.patch"
export PATH="$HOME/.cargo/bin:$PATH"
export ZIG="$(brew --prefix zig@0.15)/bin/zig"
cargo fmt --check
just build
cargo test --release --locked --bin herdr client::shell::tests::endpoints
git apply --reverse --check "$HOME/.config/herdr/patches/machine-headers-v0.9.0.patch"
```

The direct Cargo test command works without cargo-nextest. Install the tested
`target/release/herdr` under `~/.local/bin/herdr-machine-headers-charcoal-0.9.0`.
Preserve the stock executable before changing `~/.local/bin/herdr` to a symlink
to the custom executable. If an earlier custom build exists, preserve it separately
as well; do not replace the stock backup with a custom build.

Keep the server and panes running. In the existing client, use the sidebar
**menu → detach**, then run `~/.local/bin/herdr` to reattach with the new client.
The prefix detach shortcut did not work in the verified setup. Do not stop the
server to load this change; `reload-config` cannot load compiled rendering changes.

The custom and stock executables share protocol 22 and endpoint generation 1.
This patch changes only the client renderer and its existing test expectations.
It does not require a remote-machine installation or a server restart.

Validation for this version: release build, `cargo fmt --check`, forward and reverse
patch checks, and all 27 endpoint/sidebar tests. The exported patch reproduces the
validated source at the pinned base. These checks do not establish compatibility
with later upstream versions.

## Maintenance

Herdr updates can replace the custom executable link. Review and rebase this
patch against each new version before rebuilding. Do not reapply the old patch
blindly. Retire it if upstream provides equivalent styling and spacing settings.

Colors follow existing theme tokens, so later theme changes apply to these headers.
For rollback, repoint the launcher at the preserved stock executable and reattach.
