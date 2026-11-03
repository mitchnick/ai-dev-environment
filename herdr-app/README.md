# Herdr app

The current Herdr setup: the **Herdr desktop app** (`herdr-app`, exported from
0.1.12) with **herdr-core** (`hc`, 0.1.17). It replaces the Herdr 0.9.0 TUI in
[`../herdr/`](../herdr/README.md), which is kept as legacy material. Install it
with [SETUP.md section 6](../SETUP.md#6-install-the-herdr-app-setup); the key
reference is [SHORTCUTS.md](../SHORTCUTS.md).

The app's home is `~/.config/herdr-app/`. Read `herdr-app --skill` and the
`AGENTS.md` the app writes there on every start before changing anything.
`HERDR_APP_HOME` selects another home.

## Inventory

`home/` mirrors `~/.config/herdr-app/` and holds only files the person owns:

| Path | What |
|---|---|
| `home/settings.json` | Theme `monokai-pro-spectrum`, font MesloLGS Nerd Font Mono 14, sounds off, zoom 1, minimum contrast 1 |
| `home/keys.json` | Every key binding: `global`, `terminal` and `layout:main-plus` sections |
| `home/themes/monokai-pro-spectrum.json` | Ghostty's Monokai Pro Spectrum palette, with `accent #8b888f` and `border #363537` |
| `home/layouts/main-plus.json` | A clone of the shipped `main` layout: `tabs-plus` tab bar plus Graph and Automations panels beside Files and Changes |
| `home/mods/tab-move-left`, `tab-move-right` | Move the focused tab one slot (no wrap) |
| `home/mods/pane-next`, `pane-prev` | Cycle focus through the tab's panes in layout order (wraps) |
| `home/mods/pane-mover`, `pane-mover-tabs` | Re-split, swap, or move the focused pane to another tab, space, new tab or new space |
| `home/mods/effort-cycle` | Runs `herdr-app-cycle-effort` detached for the focused terminal |
| `home/mods/arrange-wide`, `arrange-laptop` | Run `herdr-app-arrange wide`/`laptop` on the focused tab; a failure shows as a toast |
| `home/mods/link-picker` | URLs the focused agent mentioned, from `herdr-app-links`; Enter opens, Ctrl+Y copies |
| `home/mods/scrollback-search` | Searches the focused terminal's last 5000 lines (`hc read`); Enter copies the line |
| `home/mods/tabs-plus` | A clone of the shipped `tabs` mod with Graph and Automations buttons, and a `tabs-plus.graph` key command |

`bin/` installs into `~/.local/bin/`. Every script uses `$HOME`/`Path.home()`:

| Script | What |
|---|---|
| `herdr-app-arrange` | Arranges one tab's panes into up to 4 (`wide`) or 2 (`laptop`) equal columns. herdr-app has no split-size command, so it rewrites that tab's tree in herdr-core's `herdr-app` document through `hc connect` JSON-RPC `doc.get`/`doc.set`. Writes are versioned and retried on conflict. It refuses if anything outside the tab or the pane set would change, and keeps the previous document in `~/.local/state/herdr-app-arrange/before.json`. This is not a documented app API, so a format change makes it fail without writing |
| `herdr-app-links` | URLs from the Claude or Codex transcript of the terminal's foreground process, else from its screen and scrollback. Adapted from openr's `candidates.py` (MIT, see [`../herdr/extensions/custom/herdr-openr/`](../herdr/extensions/custom/herdr-openr/LICENSE)) |
| `herdr-app-cycle-effort` | Routes Cmd+Shift+E by the terminal's foreground program: Claude goes to `claude-cycle-effort-hc`, Codex gets `alt+shift+e` (managed shortcuts build) or `alt+.`, Pi gets `alt+shift+e` |
| `claude-cycle-effort-hc` | Steps Claude Code's model picker one effort level, through `hc keys`/`hc read` and `herdr-app do pane.zoom`. Current pickers stop at Max, so from the top it steps back down to the lowest |
| `herdr-app-grid` | `quad`/`dual`: a new tab in the calling terminal's space, split 2x2 or side by side. Exits 3 outside herdr-app so `ghostty-quad`/`ghostty-dual` can fall back to Ghostty |

`automations/automations.yaml` is a starter config for the automations CLI
(`backend: hc`, no automations). It installs to
`~/.config/herdr/plugins/config/dnzzl.automations/automations.yaml`.

### Installed from upstream, not bundled

Pinned in SETUP.md. Both match the exported setup file for file.

| Piece | Source | License |
|---|---|---|
| `mods/git-graph` | [`rabeeh-ta/herdr-git-graph`](https://github.com/rabeeh-ta/herdr-git-graph) at `b70e79571a8bdf3f711f054ba6be81c8ee7ea9bf` (v0.2.0 plus the Graph-heading fix) | MIT |
| `mods/automations` and `~/.local/bin/herdr-automations` | [`DnzzL/herdr-automations`](https://github.com/DnzzL/herdr-automations) v0.11.3 (`983aec905a49e678d8694a9ca70de77ea3f728c5`): `app/mods/automations` and the release's prebuilt binary | MIT |

Mods are trusted code. git-graph runs `git` in the focused repo and asks
GitHub's public releases API for a newer version at most once a day (set
`CHECK = false` in its `update.js` to stop that). The automations panel runs the
`herdr-automations` CLI. The scheduler only runs while `herdr-automations
daemon` is running, which SETUP section 10 offers as an optional LaunchAgent.

### Derived from Herdr

`tabs-plus` and `main-plus` are clones of the app's shipped `tabs` mod and
`main` layout at 0.1.12 (Apache-2.0, [herdrdev/herdr-app](https://github.com/herdrdev/herdr-app)).
Their `cloned_from` field records that. Clones never update with the app.
After a Herdr update, compare them with the new shipped versions and carry
over fixes by hand.

## Not included

- **App-written files.** Never commit or restore these: `AGENTS.md`, `*.d.ts`,
  `icons/`, `frame/`, the shipped mods and layouts (`installed.json` lists them),
  `layouts/.state/`, `view.json`, `shared.json`, `data/`, `seen.json`,
  `installed.json`, `window.json`, `windows.json`, `telemetry/`,
  `update-notes*`, `herdr-app.sock`, `*.error`, `*.reset-*` (the escape hatch),
  `*.old-*` (`layout.reset`), `*.corrupt-*` (an unreadable `shared.json`),
  `*.tmp` and one-off backups. The shipped themes `themes/atom-one-dark.json` and
  `themes/win98.json` and the preview `layouts/win98.svg` are Herdr's too. Each
  mod folder's `gpui-kit.d.ts` and `jsconfig.json` are written by the app as
  well, and are ignored here.
- **Shipped mods.** Never copy them, even whole. Herdr replaces its own mods
  and layouts on every start. One that differs from the shipped files (a
  missing subfolder counts) is moved to `<mod>-edited` and the stock one
  reinstalled. Clone with `mod.clone`/`layout.clone` instead.
- **The sidebar usage widget** (`mods/usage`) is still being built, and its
  account names are personal. The exported `main-plus` leaves out its
  `usage` sidebar block; that is the only difference from the source machine's
  layout.
- **The automations LaunchAgent.** `herdr-automations service install`
  regenerates it with the current shell's `PATH`; it is not a portable file.

## How the key-driven mods work

A key can only run an app command, not a shell command. So each action mod
opens as an invisible 1x1 popup (`mod.open:<name>` in `keys.json`), does its
work in `init`, and closes itself. Every action is gated on `props().overlay`,
so `herdr-app check` (which loads the mod outside an overlay) never acts on
real tabs.

## Copies, not symlinks

The install copies files. In a scratch `HERDR_APP_HOME`:

- A symlinked mod **folder** passes `herdr-app check`, but the app writes
  `gpui-kit.d.ts` (800 KB) and `jsconfig.json` through the link into this
  checkout.
- A symlinked **file** that a mod imports fails with "module `./mover.js`
  resolves outside the application directory". That is also why `mover.js` is
  a real duplicate in `pane-mover` and `pane-mover-tabs`: mods cannot import
  across folders. Edit `pane-mover/mover.js`, then copy it over the other.
- The app rewrites `settings.json` and `keys.json` itself (Settings, and the
  `ctrl-alt-shift-escape` escape hatch that sets `keys.json` aside).

## Updating this export

Copy from a working machine, never the other way round, then review the diff:

```sh
H="$HOME/.config/herdr-app"
cp -p "$H/settings.json" "$H/keys.json" herdr-app/home/
cp -p "$H/themes/monokai-pro-spectrum.json" herdr-app/home/themes/
cp -p "$H/layouts/main-plus.json" herdr-app/home/layouts/
for m in herdr-app/home/mods/*/; do
  m="$(basename "$m")"
  for f in "$H/mods/$m"/*; do
    case "$(basename "$f")" in gpui-kit.d.ts|jsconfig.json) continue ;; esac
    cp -p "$f" "herdr-app/home/mods/$m/"
  done
done
for s in herdr-app/bin/*; do cp -p "$HOME/.local/bin/$(basename "$s")" herdr-app/bin/; done
git diff --stat -- herdr-app
```

Add new mods by name. Then remove the `usage` block from `main-plus.json` again
unless the widget has been exported. Search the diff for home paths, account
names and machine names before committing.
