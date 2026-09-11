# Usage section for Herdr 0.9.0

Optional client source [patch](usage-section-v0.9.0.patch). Apply it **on top of**
the [machine-header patch](machine-headers-v0.9.0.md), against upstream commit
`b99002ac99b09e00b4ca692436cb15a6b0d676f1` (v0.9.0).

## Behavior and configuration

Account-wide usage arrives as workspace metadata tokens from a separate provider.
Stock Herdr displays configured tokens inside workspace rows, which can repeat
the usage block once per connected machine. This patch adds `[ui.sidebar.usage]`
to display those tokens once in the expanded sidebar.

Merge this generic example into `~/.config/herdr/config.toml` **after installing
the patched executable**. Replace the custom token names with names reported by
your provider; the example contains no live values or provider configuration.

```toml
[ui.sidebar.usage]
label = "usage"
rows = [
  [{ token = "$usage_window", fg = "#8b888f", dim = true }, { token = "$usage_percent", fg = "#7bd88f" }],
]
```

- Rows use the same token syntax and styling as `[ui.sidebar.spaces]`, but only
  `$custom` tokens resolve. Built-in workspace tokens are ignored.
- The block sits directly under the last workspace row and stays in place while
  the workspace list scrolls. A full list pushes it down to the spaces footer,
  with room for the block reserved above the footer.
- Its header matches a machine header: `surface1` background, bold `subtext0`
  label, and `overlay1` disclosure arrow. Clicking it collapses or expands the
  block; `usage_collapsed` persists in client shell preferences.
- Only the local machine's workspace tokens are read, even with several machines
  connected. Use consistent values if the same token appears on multiple local
  workspaces; this is not an aggregation of their usage.
- Empty `rows` (the default) disables the section, preserving stock behavior.
  Rows whose tokens are all absent disappear; no resolved rows means no block.
- The block, including its header, takes at most half the available spaces body.
  Extra rows are clipped; the compact sidebar is unchanged.

Move usage token rows out of `[ui.sidebar.spaces]` when enabling this section;
the patch does not remove existing workspace-row configuration automatically.
The usage provider and its credentials are not part of this patch. Without
reported tokens, the example displays nothing.

## Rebuild

Dependencies: Git, Rust **1.96.1** via rustup, Just, and Zig **0.15.2**.
The pinned upstream `rust-toolchain.toml` selects Rust 1.96.1. On macOS, Homebrew's
`zig@0.15` is keg-only, so `ZIG` must point at its executable. Check the version
before building; a different Zig release is not validated here.

From this export's repository root, copy only the two patches and their guides:

```sh
mkdir -p "$HOME/.config/herdr/patches"
cp herdr/patches/machine-headers-v0.9.0.patch \
  herdr/patches/machine-headers-v0.9.0.md \
  herdr/patches/usage-section-v0.9.0.patch \
  herdr/patches/usage-section-v0.9.0.md "$HOME/.config/herdr/patches/"
```

Create a separate clean checkout at the exact base commit. Choose another unused
checkout path if this one already exists; do not apply either patch twice.

```sh
mkdir -p "$HOME/Projects"
git clone --branch v0.9.0 --single-branch https://github.com/herdrdev/herdr.git \
  "$HOME/Projects/herdr-usage-section-source"
cd "$HOME/Projects/herdr-usage-section-source"
git checkout --detach b99002ac99b09e00b4ca692436cb15a6b0d676f1
git apply --check "$HOME/.config/herdr/patches/machine-headers-v0.9.0.patch"
git apply "$HOME/.config/herdr/patches/machine-headers-v0.9.0.patch"
git apply --check "$HOME/.config/herdr/patches/usage-section-v0.9.0.patch"
git apply "$HOME/.config/herdr/patches/usage-section-v0.9.0.patch"
export PATH="$HOME/.cargo/bin:$PATH"
export ZIG="$(brew --prefix zig@0.15)/bin/zig"
"$ZIG" version
cargo fmt --check
just build
cargo test --release --locked --bin herdr client::shell
cargo test --release --locked --bin herdr config::sidebar
git apply --reverse --check "$HOME/.config/herdr/patches/usage-section-v0.9.0.patch"
```

Run each step only after the preceding one succeeds. These Cargo test commands
do not require cargo-nextest. The regression guards include
`usage_section_renders_once_from_local_tokens_and_collapses_on_click` in
`src/client/shell/tests/endpoints.rs` and
`usage_section_defaults_to_off_and_parses_custom_token_rows` in
`src/config/sidebar.rs`.

Export validation: both patches apply in order and reverse cleanly at the pinned
base. The reconstructed source matches the local build checkout; formatting,
the release build, all 199 client-shell tests, and all 13 sidebar-config tests
pass there. The generic example passes the patched executable's `config check`.
The install script was rehearsed in a disposable directory, including backup
and refusal to overwrite an existing destination. These checks do not replace
visual testing in your terminal.

## Install and load the client

Install the tested `target/release/herdr` to a **new path**, or delete the old
custom executable before copying. Copying over an existing executable in place
can invalidate its ad-hoc code signature: macOS then kills it with SIGKILL and
no message. The following subshell refuses an existing destination. For another
build, change `herdr_install` to an unused filename before running it.

From the build checkout's root:

```sh
(
  set -eu
  herdr_install="$HOME/.local/bin/herdr-usage-section-0.9.0"
  mkdir -p "$HOME/.local/bin" "$HOME/.local/lib"
  if [ -e "$herdr_install" ] || [ -L "$herdr_install" ]; then
    echo "Choose a new herdr_install path or remove the old custom executable first." >&2
    exit 1
  fi
  install -m 755 target/release/herdr "$herdr_install"
  if [ -e "$HOME/.local/bin/herdr" ] || [ -L "$HOME/.local/bin/herdr" ]; then
    herdr_backup_dir="$(mktemp -d "$HOME/.local/lib/herdr-backup.XXXXXX")"
    cp -pL "$HOME/.local/bin/herdr" "$herdr_backup_dir/herdr"
    echo "Previous executable saved to $herdr_backup_dir/herdr"
  fi
  ln -sfn "$herdr_install" "$HOME/.local/bin/herdr"
)
```

Keep any existing stock and machine-header-only backups separately. The backup
above preserves whichever executable the launcher currently selects; it may
already be custom. Ensure `~/.local/bin` precedes other Herdr installations in
PATH, or use the explicit launcher path below.

Now merge the generic config example, then check it with the patched binary:

```sh
"$HOME/.local/bin/herdr" config check
```

In the existing client, use the sidebar **menu → detach**, then relaunch:

```sh
"$HOME/.local/bin/herdr"
```

A client rendering change needs **no server restart** and no remote-machine
installation. Keep panes running. `reload-config` cannot load compiled renderer
changes.

## Older executables and rollback

A stock or machine-header-only executable reports
`unknown config key ui.sidebar.usage; ignoring key`. The key is ignored, not
fatal, but an older server process prints that diagnostic the next time it
parses config, including a config reload. Install the patched build together
with the config change. Replacing the launcher does not replace an already
running server executable.

Detaching and relaunching is sufficient for the client feature. To clear the
older server's diagnostic as well, move it to the patched executable during a
planned server upgrade or restart; this is separate from loading the client.

For rollback, remove `[ui.sidebar.usage]` from the config, restore any previous
workspace usage rows, repoint `~/.local/bin/herdr` at a preserved executable,
and detach/relaunch. Setting `rows = []` disables the patched block but does
not make the new key recognizable to stock Herdr.

## Maintenance limits

This export is pinned to Herdr 0.9.0 and does not establish compatibility with
later versions. Updates may replace the custom executable link. Rebase **both
patches in order** after a Herdr update, rebuild, and rerun the shell and config
tests before installing. Upstream may add its own pinned sidebar sections;
retire this patch when upstream can pin a configured token block.
