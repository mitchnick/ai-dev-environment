# Herdr

Needs input gets one ding and desktop popup. Finished work stays in the sidebar, with **no ding and no popup**. This export targets Herdr 0.9.0 on macOS with Ghostty.

## Inventory

- `config/config.toml` — preferences and all keybindings
- `helpers/` — agent-view, tab-movement, and pane-arrangement launchers
- [`lib/herdr-arrange/`](lib/herdr-arrange/README.md) — arranger library, unit tests, and optional isolated integration tests
- [`extensions/custom/herdr-attention/`](extensions/custom/herdr-attention/README.md) — blocked-only notification plugin and tests
- [`agent-detection/`](agent-detection/README.md) — Claude screen spinner override and synthetic regression checks
- `patches/` — native search/scrollback patch, optional [machine header styling](patches/machine-headers-v0.9.0.md), and a [pinned usage section](patches/usage-section-v0.9.0.md)
- `shortcuts/` — shared Cmd+E / Cmd+Shift+E model and effort shortcuts, and the
  router that dispatches them per agent. See [`shortcuts/README.md`](shortcuts/README.md)

## Custom builds

The optional [machine header patch](patches/machine-headers-v0.9.0.md) targets
Herdr 0.9.0 at upstream commit `b99002ac99b09e00b4ca692436cb15a6b0d676f1`.
Expanded headers use `palette.surface1` (charcoal `#363537`), bold
`palette.subtext0` labels (`#bab6c0`), and `palette.overlay1` disclosure arrows
(`#8b888f`) in the supplied Monokai Pro Spectrum theme. Active collapsed machines
retain `active_row_bg`. It removes the leading header space and extra workspace
indent while preserving worktree nesting, connection badges, compact mode, and hit targets.

This is a client source patch requiring Rust 1.96.1, Just, and Zig 0.15.2.
No config override is needed: the palette already contains these colors.
Follow the guide to build and install, then use the sidebar **menu → detach**
and run `~/.local/bin/herdr` to reattach. The prefix detach shortcut did not work
in the verified setup. No server restart or remote-machine installation is needed.
Review and rebase the patch after updates.

The optional [usage-section patch and installation guide](patches/usage-section-v0.9.0.md)
applies **on top of the machine-header patch at the same pinned commit**. It adds
`[ui.sidebar.usage]`: account-wide usage reported as workspace metadata renders
once, directly under the last workspace row, using only the local machine's
`$custom` tokens. Its header uses the same `surface1` background, bold `subtext0`
label, and `overlay1` arrow as a machine header. Clicking collapses the block,
and the choice persists in client shell preferences. The block stays in place
while workspaces scroll and uses at most half the spaces body. Empty rows are
the default and disable it, preserving stock behavior.

Both patches require Rust **1.96.1** (selected by `rust-toolchain.toml`), Just,
and Zig **0.15.2**. Homebrew's `zig@0.15` is keg-only: set
`ZIG="$(brew --prefix zig@0.15)/bin/zig"`. Follow the usage guide to apply both
patches, build, test, and install to a new executable path before pointing
`~/.local/bin/herdr` at it. Copying over an existing executable can invalidate its
ad-hoc signature and cause silent macOS SIGKILL; use a new path or delete the old
custom executable first. Then merge the guide's generic config example and
move usage rows out of `[ui.sidebar.spaces]` to avoid duplicates. A separate token
provider is required; the example contains no live configuration.

Install the patched build together with the config change. Stock binaries report
`unknown config key ui.sidebar.usage; ignoring key`; the key is ignored, not
fatal. An older running server also reports it when next parsing config, even
after the launcher is replaced. Loading the client needs only sidebar
**menu → detach** and relaunch, with no server restart. Clearing the older
server's diagnostic requires separately moving that process to the patched
executable. Upstream may add pinned sidebar sections: rebase both patches after
each Herdr update, or retire the usage patch when upstream can pin a configured
token block. Compatibility beyond the pinned version is not established.

- `extensions/custom/herdr-copy-search/`
- `extensions/custom/herdr-pane-mover/`

## External extensions

- [`edouard-andrei/herdr-layout-tools`](https://github.com/edouard-andrei/herdr-layout-tools), version 0.4.0, pinned at `826364134071e470f1d54e69b8ab8dfd49972477`

## Install as one setup

Run commands from the repository root. Review and merge with existing files before replacing them. Dependencies: Herdr 0.9.0+, Ghostty, Python 3 (3.11+ for the TOML regression tests), `terminal-notifier`, macOS `afplay` and Ping sound, and Node for pane-mover. Copy-search has its own build instructions.

**Install and enable the [attention plugin](extensions/custom/herdr-attention/README.md#install-before-disabling-built-in-alerts) first.** Verify it is enabled with `herdr plugin list`. The exported config disables built-in delivery and sound; applying it without the plugin also removes needs-input alerts.

Install the helpers and library before adding their shortcuts:

```sh
mkdir -p "$HOME/.local/bin" "$HOME/.local/lib/herdr-arrange"
install -m 755 herdr/helpers/herdr-agent-view herdr/helpers/herdr-move-tab \
  herdr/helpers/herdr-arrange "$HOME/.local/bin/"
cp herdr/lib/herdr-arrange/arrange.py herdr/lib/herdr-arrange/test_arrange.py \
  herdr/lib/herdr-arrange/test_live.py herdr/lib/herdr-arrange/order_cases.py \
  herdr/lib/herdr-arrange/README.md "$HOME/.local/lib/herdr-arrange/"
```

The arranger wrapper locates its library relative to itself and defaults to `/usr/bin/python3`; set `HERDR_ARRANGE_PYTHON` to another interpreter if needed. Other Python helpers use PATH. Herdr shell bindings inherit the server's environment, so ensure required interpreters are available there. Keep the wrapper and library together when upgrading.

The move-menu keys require the exported local pane-mover with its `open-tabs` action. Layout-tools supplies main-grid, equalize, and editor actions:

```sh
herdr plugin link "$PWD/herdr/extensions/custom/herdr-pane-mover"
herdr plugin enable osamahbeig.pane-mover
herdr plugin install edouard-andrei/herdr-layout-tools --ref 826364134071e470f1d54e69b8ab8dfd49972477
herdr plugin enable edi.layout-tools
```

A linked plugin must remain at that path; relink it if the checkout moves. Follow the [shared effort shortcut installation](shortcuts/README.md) for the router and harness adapters before applying its binding. Follow the [detector installation](agent-detection/README.md#install) to copy the Claude override and run `herdr server reload-agent-manifests`.

Once those dependencies are installed and the attention plugin is enabled, merge or copy the config:

```sh
mkdir -p "$HOME/.config/herdr"
cp herdr/config/config.toml "$HOME/.config/herdr/config.toml"
herdr config check
herdr server reload-config
```

No server or agent restart is needed for config or detector reloads. Optional sidebar usage tokens remain empty without a separate provider, which is excluded from this export. Run `~/.local/bin/herdr-agent-view rest` to apply stable space/tab/pane ordering; repeat after a server restart. The agent-view and tab-movement helpers target the default local socket; the arranger requires `HERDR_SOCKET_PATH` or explicit `--socket`.

## Sidebar legend and alerts

These colors are specific to the included Monokai Pro Spectrum theme; other themes can differ.

| Indicator | State | Meaning | Alert |
|---|---|---|---|
| Pink/red filled ● `#fc618d` | `blocked` | Needs input, approval, or a decision | One ding and desktop popup |
| Yellow filled ● `#fce566` | `working` | Running | None |
| Cyan filled ● `#5ad4e6` | `done` | Finished, unseen | Sidebar only |
| Hollow green ○ `#7bd88f` | `idle` | Ready for input, seen | None |
| Gray dot · `#69676c` | `unknown` | State cannot be classified | None |

Normal flow is yellow → cyan → green. Viewing a completed agent's tab marks it seen. Green describes readiness and visibility, not a success verdict. Space and tab circles summarize agents and do not add notification sources.

The plugin waits one second, rechecks the pane occupant and state sequence, and deduplicates each sustained blocked cycle. Focused panes also alert. Clicking a popup activates Ghostty. The delay does not debounce sidebar circles, and standalone terminal BEL is separate from these semantic alerts.

The source setup's popup command exited successfully, but **actual macOS popup presentation has not been visually confirmed**. Notification permissions and Focus settings affect presentation. Export tests mock delivery; they do not verify visible banners or audible sound.

## Navigation and arrangement

The prefix is `Ctrl+B`, followed by the listed key.

| Action | Direct chord | Prefix fallback |
|---|---|---|
| Rename pane | `Cmd+Shift+P` | `Shift+P` |
| Swap pane left/right/up/down | `Cmd+Shift+Arrow` | `Shift+H/L/K/J` |
| Previous/next agent | `Cmd+Alt+Shift+Up/Down` | `Shift+Up/Down` |
| Previous/next tab | `Cmd+Alt+Left/Right` | `P/N` or `Left/Right` |
| Workspace picker | — | `W` |
| Manual resize | — | `R` |
| Arrange wide (up to four columns) | `Cmd+Shift+R` | — |
| Arrange laptop (up to two columns) | `Cmd+Ctrl+R` | — |

Wide/laptop preserve pane processes, tab identity, and pane order. Compatible layouts only equalize column widths; others reflow through a temporary tab. See the [arranger README](lib/herdr-arrange/README.md) for recovery and explicit targeting. Ghostty must pass these native chords to Herdr.

## Detector maintenance and validation

The Claude override adds the `✳` screen spinner frame to three working rules while preserving the OSC title idle rule. Local overrides shadow upstream updates: compare after each Herdr or manifest update, merge new rules, or retire the override when upstream includes the fix. See [maintenance instructions](agent-detection/README.md#maintain-after-updates).

Offline checks against this export:

```sh
python3 -B -m unittest discover -s herdr/extensions/custom/herdr-attention -p test_notify.py -v
python3 -B -m unittest discover -s herdr/lib/herdr-arrange -p test_arrange.py -v
python3 -B -m unittest discover -s herdr/agent-detection -p test_claude.py -v
HERDR_CONFIG_PATH="$PWD/herdr/config/config.toml" herdr config check
```

Individual skills, harness hooks, MCP configuration, authentication, runtime state, and plugin registries remain excluded. Herdr's event handler is packaged with its plugin.
