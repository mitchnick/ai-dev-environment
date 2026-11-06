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
| `home/themes/monokai-pro-spectrum.json` | Ghostty's Monokai Pro Spectrum palette, with `accent #8b888f`, `border #363537` and `working #69676c` (a gray agent spinner in place of yellow) |
| `home/layouts/main-plus.json` | A clone of the shipped `main` layout: `tabs-plus` tab bar plus Graph and Automations panels beside Files and Changes, `workspace-chrome-plus` for the sidebar's top bar, `agents-plus` for the sidebar's agent list and `usage` for the sidebar's Usage block |
| `home/mods/tab-move-left`, `tab-move-right` | Move the focused tab one slot (no wrap) |
| `home/mods/pane-next`, `pane-prev` | Cycle focus through the tab's panes in layout order (wraps) |
| `home/mods/pane-mover`, `pane-mover-tabs` | Re-split, swap, or move the focused pane to another tab, space, new tab or new space |
| `home/mods/effort-cycle` | Runs `herdr-app-cycle-effort` detached for the focused terminal |
| `home/mods/arrange-wide`, `arrange-laptop` | Run `herdr-app-arrange wide`/`laptop` on the focused tab; a failure shows as a toast |
| `home/mods/link-picker` | URLs the focused agent mentioned, from `herdr-app-links`; Enter opens, Ctrl+Y copies |
| `home/mods/scrollback-search` | Searches the focused terminal's last 5000 lines (`hc read`); Enter copies the line |
| `home/mods/tabs-plus` | A clone of the shipped `tabs` mod with Graph (before Changes) and Automations buttons, and `tabs-plus.graph` (Cmd+Shift+G) and `tabs-plus.changes` (Cmd+Shift+H) key commands. Its working spinner turns once every 20000ms instead of 900ms, as in `pane-plus` and `agents-plus` |
| `home/mods/pane-plus` | A clone of the shipped `pane` header. It shows a name typed in Rename pane (the terminal's `pane.name` label) if there is one; else, while an agent runs, the pane's task name (`autoname.task`) in place of "Claude Code" or "Codex". Double-click the name to rename the pane. `main-plus` uses it for every pane header |
| `home/mods/agents-plus` | A clone of the shipped `agents` sidebar list whose working spinner turns once every 20000ms instead of 900ms. Its sort menu opens `agents-plus`, not the shipped mod |
| `home/mods/workspace-chrome-plus` | A clone of the shipped `workspace-chrome` mod that draws the horn (`herdr-horn.svg`) beside "Herdr" instead of Herdr's ram. `main-plus` uses it only for the sidebar's top bar. `herdr-horn.svg` is also the Dock icon: on each start (macOS only) the top bar runs `herdr-app-icon --if-missing` detached, logging to `$TMPDIR/herdr-app-icon.log`, so an update's new bundle gets the horn back. The master copy is kept in OneDrive under `Apps/Herdr` |
| `home/mods/usage` | The sidebar's Usage block: each Claude subscription and OpenAI, from the readings `herdr-usage` keeps on disk; see [Usage block](#usage-block). Its `place` is `none`, so it shows only where a layout puts it |
| `home/mods/rename-pane` | The Rename pane dialog (Cmd+Shift+N, or double-click a header's name): sets or, when empty, removes the focused terminal's `pane.name` label in herdr-core, so the name survives app restarts |

`bin/` installs into `~/.local/bin/`. Every script uses `$HOME`/`Path.home()`:

| Script | What |
|---|---|
| `herdr-app-arrange` | Arranges one tab's panes into up to 4 (`wide`) or 2 (`laptop`) equal columns. herdr-app has no split-size command, so it rewrites that tab's tree in herdr-core's `herdr-app` document through `hc connect` JSON-RPC `doc.get`/`doc.set`. Writes are versioned and retried on conflict. It refuses if anything outside the tab or the pane set would change, and keeps the previous document in `~/.local/state/herdr-app-arrange/before.json`. This is not a documented app API, so a format change makes it fail without writing |
| `herdr-app-links` | URLs from the Claude or Codex transcript of the terminal's foreground process, else from its screen and scrollback. Adapted from openr's `candidates.py` (MIT, see [`../herdr/extensions/custom/herdr-openr/`](../herdr/extensions/custom/herdr-openr/LICENSE)) |
| `herdr-app-cycle-effort` | Routes Cmd+Shift+E by the terminal's foreground program: Claude goes to `claude-cycle-effort-hc`, Codex gets `alt+shift+e` (managed shortcuts build) or `alt+.`, Pi gets `alt+shift+e` |
| `claude-cycle-effort-hc` | Steps Claude Code's model picker one effort level, through `hc keys`/`hc read` and `herdr-app do pane.zoom`. Current pickers stop at Max, so from the top it steps back down to the lowest |
| `herdr-app-grid` | `quad`/`dual`: a new tab in the calling terminal's space, split 2x2 or side by side. Exits 3 outside herdr-app so `ghostty-quad`/`ghostty-dual` can fall back to Ghostty |
| `herdr-app-autoname` | Names panes and tabs from each chat's first message; see [Pane and tab names](#pane-and-tab-names). `install-hooks` adds its Claude Code and Codex hooks |
| `herdr-app-icon` | Builds an `.icns` from the installed `workspace-chrome-plus/herdr-horn.svg` and sets it as Herdr.app's Finder custom icon (Dock, Finder, Cmd+Tab). Only Finder's custom-icon data is written; `Contents/` and the signature are untouched (`codesign --verify` passes, and only `--strict` objects to the Finder info). A Herdr update replaces the bundle and drops the icon; `workspace-chrome-plus` runs `--if-missing` on every app start, which exits at once while the bundle still has its `Icon\r` file. The Dock may show the ram until the app's next start. Needs `rsvg-convert` (`brew install librsvg`) and `swift` |

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

`tabs-plus`, `pane-plus`, `workspace-chrome-plus`, `agents-plus` and `main-plus`
are clones of the app's shipped `tabs`, `pane`, `workspace-chrome` and `agents` mods and `main`
layout at 0.1.12 (Apache-2.0, [herdrdev/herdr-app](https://github.com/herdrdev/herdr-app)).
Their `cloned_from` field records that. Clones never update with the app.
After a Herdr update, compare them with the new shipped versions and carry
over fixes by hand.

The horn in `workspace-chrome-plus/herdr-horn.svg` is the path from
[`Tatendaz/herdr-launcher`](https://github.com/Tatendaz/herdr-launcher)'s
`assets/icon.svg` at `d2d375ccecfe540df370e9b1fbb2c6812dc3c064`, unchanged
except for an added white outline (MIT, see `LICENSE-herdr-horn` beside it).

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
- **Subscription names and machine names.** This repo is public, so
  `~/.claude/usage-accounts/.config.json` stays on the machine, and neither the
  mod nor `herdr-usage` may hard-code what it holds. See [Usage block](#usage-block).
- **The automations LaunchAgent.** `herdr-automations service install`
  regenerates it with the current shell's `PATH`; it is not a portable file.

## Pane and tab names

The first message of each Claude Code, Codex or Pi chat names its pane and tab.
`herdr-app-autoname` sends the message to `openai-codex/gpt-6.1-sol` through
`pi -p` (no tools, extensions or session; the Codex subscription pays) and gets
back a 1-3 word lowercase task name, or nothing for "hi". The call runs in a
detached worker, so prompts are never delayed; names land 5-10 seconds later.

- **Pane:** the terminal gets the label `autoname.task=<name>`, which
  `pane-plus` shows while an agent runs there. In Claude and Pi a new chat
  (`/clear`, `/new`, a new session) clears the task name until its first
  message; Codex keeps the old one until the new chat's first message
  replaces it. A name typed in Rename pane (`pane.name`) always shows
  instead; clear it to get the task name back.
- **Tab:** `<checkout> - <name>` when the git root's folder ends in a number
  and has a numbered sibling (`myapp/app0` beside `app1` gives `app0`; `work/api-1`
  beside `api-2` gives `api-1`), else just `<name>`.
- **Hand-typed names win.** The tab is renamed only while it is unnamed, holds
  a placeholder (`3`, `3 -`, `app3 -`) or still holds the name this script last
  gave it (kept in `~/.local/state/herdr-app-autoname/tabs.json`). Anything
  else was typed by a person and stays until they clear it with `tab.rename`
  and an empty name. Several agents in one tab: the newest chat names it.
- **Only the first message.** Later messages, resumed chats (`--resume`,
  `pi -c`), Claude sub-agents, `hc run` sub-agents and agents nested inside
  another agent's pane (a cross-review `codex exec`, a `claude -p` from a
  tool call) change nothing. A first message with no task leaves things alone
  and the next message gets the chance.

How it finds the pane: Claude Code and Pi pass `HC_TERMINAL_ID` to the hook,
and the hook checks that its agent is that terminal's foreground program.
Interactive Codex runs hooks in its shared app-server daemon with a cleaned
environment, so the worker finds the Codex pane whose screen shows the
prompt, or failing that (a pasted prompt) the one Codex in that folder that
just started working.

The tab name is written to the core's `herdr-app` document with
`doc.get`/`doc.set`, versioned like `herdr-app-arrange`, after checking only
that tab's name changes. Each machine's hook writes its own core, so remote
spaces work once the script, hooks and Pi extension are on that machine.

```sh
herdr-app-autoname try --cwd ~/Projects/myapp/app2 "the webhook double charges"   # names, no changes
herdr-app-autoname status                     # the last 30 decisions
touch ~/.local/state/herdr-app-autoname/debug # also log why a hook did nothing
HERDR_AUTONAME_OFF=1                          # in an agent's environment: skip it
```

`HERDR_AUTONAME_MODEL` picks another Pi model and `HERDR_AUTONAME_PI` another
`pi`. `install-hooks` gives Codex an absolute path, since Codex runs hooks
from its daemon rather than the pane's shell.

## Usage block

The Claude subscription signed in here shows its 5h, 7d and Fable windows. Every
other subscription, and OpenAI, gets one row with its 7d window and reset. Hover
a row for every window, its reset and the reading's age. Numbers turn yellow at
50% and red at 80%. A reading over ten minutes old is stale: its label and any
number under 50% fade. Past a window's reset, the row shows 0%.

`mods/usage` only reads files, so it never touches a credential.
[`pi/helpers/herdr-usage`](../pi/helpers/herdr-usage), run every two minutes by a
LaunchAgent ([SETUP section 10](../SETUP.md#account-usage)), does the fetching:

| File | What |
|---|---|
| `~/.claude/usage-accounts/<email>.json` | The last reading for each Claude subscription |
| `~/.claude/usage-accounts/.active` | The account `claude` runs as on this machine |
| `~/.pi/agent/openai-usage-cache.json` | The last OpenAI reading, through Pi's login |

`/login` swaps one subscription for another here, and each keeps its last
reading, so a subscription signed in nowhere goes stale rather than disappearing.

Short names and other machines come from a private file. Both keys, and the file
itself, are optional. **Keep it on the machine: its contents never belong in this
repo.**

```json
{
  "names": {
    "work@example.com": "work",
    "me@example.com": "personal"
  },
  "hosts": ["my-server"]
}
```

That is `~/.claude/usage-accounts/.config.json`.

- `names`: each email's short name, in the order shown after the signed-in
  subscription. An account it doesn't list still shows once it has a reading,
  named from its email: the domain, or the part before `@` at a public mail
  provider.
- `hosts`: ssh names of machines signed in to another subscription. The usage
  call runs there with that machine's token, so the token never leaves it. Each
  needs key-based ssh, `jq`, `curl` and Claude's login in
  `~/.claude/.credentials.json`. `CLAUDE_USAGE_HOSTS` overrides the list,
  separated by spaces.

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
cp -p "$HOME/.local/bin/herdr-usage" pi/helpers/
git diff --stat -- herdr-app pi/helpers/herdr-usage
```

Add new mods by name. Search the diff for home paths, account names and machine
names before committing.
