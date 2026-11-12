# Start here: set up this environment on a new Mac

Read this file, then work through sections 1–12 in order. It is the setup entry point for a human or coding agent. Commands assume macOS and zsh. Run each command only after the preceding command succeeds; this is a runbook, not a script to paste wholesale.

The goal is a working Herdr app environment (the Herdr desktop app with herdr-core) with Claude Code, Codex, and Pi, Ghostty as the second terminal, the exported themes and shortcuts, and every included customization either installed and checked or explicitly accounted for. Keep this checkout at a permanent path: the Codex rebuild skill is linked from it.

The old terminal-UI Herdr 0.9.0 (config at `~/.config/herdr/config.toml`, run inside Ghostty) is **legacy**. A new machine does not install it. Its steps are kept, unchanged, in [Appendix L](#appendix-l-legacy-herdr-090-tui) for a machine that still runs it.

**Completion means passing section 11 and producing section 12's handoff.** Copying files alone is not completion. A missing credential, unavailable package, failed check, or untested UI behavior remains a named outstanding item. Do not claim an exact replica when an excluded component is missing.

This guide was audited against the repository on September 17, 2026; the Herdr app sections (3, 6, 7, 10, 11) were added and rehearsed on November 3, 2026. The repository contains configuration and source, not a bootable machine image. Package registries, provider model access, and upstream applications can change. A clean-machine installation and the physical keyboard, sound, and notification checks must still be performed on the destination Mac.

Authoring validation: all 45 shell blocks passed zsh syntax checks; relative documentation links resolved; 12 file-install blocks were rehearsed in a disposable home path containing spaces. That rehearsal verified all 35 tracked Pi extension files, shared instruction links, preservation of existing configs, repeated copies, and symlink backups. The audit also accounted for all 32 configuration/helper/workflow/statusline files, all nine Pi package sources, and every Herdr plugin action. These checks did not install the applications, compile the optional upstream builds, authenticate accounts, or verify physical UI behavior on a clean Mac.

Herdr app rehearsal (November 3, 2026): the shell blocks of section 6, the section 7 Ghostty block and `herdr-app check` loop, the section 4 `.zshenv` snippet, and section 11's offline checks were extracted from this file and run against a clean clone, in a disposable home path containing spaces. All fourteen mods passed `herdr-app check`. The pinned upstream git-graph and automations mods, and the automations binary, came out identical to the source machine's, and the CLI loaded the starter config. Re-running stopped at `settings.json` and `keys.json` for a merge, and backed up the other files once. Every extracted block passed `zsh -n`. The rehearsal did not open the app, switch its layout, install the login service, or press any keys.

## 1. Establish scope and record the machine

Install all five applications and their included runtime files by default. Sections explicitly marked optional cover binary patches, external project plugins, account usage, and archive automation. Record a reason for every optional feature left inactive. Continue independent steps when login or another external prerequisite is pending.

Do not reinstall software that is already compatible. Do not stop existing Herdr servers or agent sessions just to apply configuration. Preserve existing preferences, credentials, skills, project trust, hooks, and MCP connections. Never copy runtime state or credentials into this public checkout.

Use normal `claude` and `codex` commands during setup. The exported `cc` and `cx` aliases bypass permission checks; `cx` also bypasses sandboxing. Install those aliases only if the owner's instructions authorize that behavior. This choice does not block the rest of setup.

From the permanent checkout:

```sh
export AI_ENV_REPO="$(pwd -P)"
test -f "$AI_ENV_REPO/README.md"
test -f "$AI_ENV_REPO/herdr-app/home/keys.json"
sw_vers
uname -m
git rev-parse HEAD
git status --short
```

Record the OS, architecture, repository revision, existing application versions, and intended optional features in a private setup log outside the checkout. Apple Silicon normally uses `/opt/homebrew`; Intel normally uses `/usr/local`. Derive paths from Homebrew and npm rather than copying the source machine's paths. If `CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `PI_CODING_AGENT_DIR`, or `XDG_CONFIG_HOME` is customized, reconcile every destination and helper below first. This runbook's concrete commands use the default home directories.

Version anchors from this export:

| Component | Baseline and constraint |
|---|---|
| Host | macOS; Claude's current native installer documents macOS 13+; individual packages may require newer macOS |
| Node | Pi 0.85.1 requires **22.19.0 or newer** |
| Python | Use Homebrew Python **3.11+** for TOML validation and tests |
| Pi | `@earendil-works/pi-coding-agent@0.85.1`; do not substitute the older package namespace |
| Codex | `@openai/codex@latest`; managed customization port tested on 0.162.1 |
| Herdr app | **0.1.12** with herdr-core (`hc`) **0.1.17** exported; both self-update. macOS builds are **Apple Silicon only** (Intel must build from source) |
| Herdr TUI (legacy) | **0.9.0**; only for [Appendix L](#appendix-l-legacy-herdr-090-tui) |
| Bun | **1.4.2** is the recorded passing runtime for Pi socket tests; 1.2.13 can hang |
| Rust | **1.95.0** for the Codex patch; **1.96.1** for the legacy Herdr patches |
| Zig | **0.15.2** for the legacy Herdr source build; Homebrew `zig@0.15` is keg-only |
| Herdr app extras | `rabeeh-ta/herdr-git-graph` at `b70e795`; `DnzzL/herdr-automations` **v0.11.3** |
| Font | MesloLGS Nerd Font Mono, Nerd Fonts **3.5.0+** for the exported glyphs |

Do not silently downgrade an existing installation to these anchors. Build pinned custom binaries separately. If a pinned version is unavailable, record that limitation and validate the chosen alternative before enabling its dependent feature.

## 2. Install prerequisites and establish PATH

### Back up before writing

Create a private backup directory. Save this path in the setup log; keep using it throughout the run:

```sh
export AI_ENV_BACKUP="$(mktemp -d "$HOME/.ai-dev-environment-backup.XXXXXX")"
chmod 700 "$AI_ENV_BACKUP"
```

Define these helpers in the setup shell. `save_existing` preserves a file or symlink only once. `put_file` installs a regular file without following a destination symlink. `new_config` deliberately stops on an existing destination so it can be merged.

```sh
save_existing() {
  case "$1" in "$HOME"/*) ;; *) echo 'Expected a destination under HOME' >&2; return 1 ;; esac
  local saved="$AI_ENV_BACKUP/${1#"$HOME"/}"
  if { [ -e "$1" ] || [ -L "$1" ]; } && ! { [ -e "$saved" ] || [ -L "$saved" ]; }; then
    mkdir -p "$(dirname "$saved")" || return
    cp -pP "$1" "$saved" || return
  fi
}
put_file() {
  if [ -d "$2" ]; then echo "Expected a file, found directory: $2" >&2; return 1; fi
  save_existing "$2" || return
  mkdir -p "$(dirname "$2")" || return
  local staged
  staged="$(mktemp "$(dirname "$2")/.ai-env-install.XXXXXX")" || return
  cp -pL "$1" "$staged" && mv -f "$staged" "$2"
}
new_config() {
  if [ -e "$2" ] || [ -L "$2" ]; then
    echo "Merge required: $1 -> $2" >&2
    save_existing "$2"
    return 1
  fi
  put_file "$1" "$2"
}
save_existing "$HOME/.zshrc"
save_existing "$HOME/.zprofile"
```

For existing config: back it up, inspect source and destination, merge the selected settings, validate, then continue after the failed `new_config` line. Do not blindly concatenate TOML tables, replace entire JSON arrays, or overwrite local additions. Preserve Claude binding contexts, Pi package entries, and instruction additions. Record files newly created as well as files backed up so rollback can distinguish them. Back up a symlink's resolved target too before deliberately editing through it.

### Tools and shell paths

1. Check `xcode-select -p`. If the command-line tools are absent, run `xcode-select --install` and let the owner finish the macOS installer. Confirm Git and `codesign` work afterward.
2. If Homebrew is absent, use the installer from [brew.sh](https://brew.sh/): download and inspect `https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh`, then run it with Bash. Complete the administrator prompts and its printed shell-environment instructions.
3. Load the correct Homebrew environment into the current shell:

```sh
if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -x /usr/local/bin/brew ]; then
  eval "$(/usr/local/bin/brew shellenv)"
else
  echo 'Install Homebrew before continuing.' >&2
fi
brew --version
brew install git python node jq ripgrep just rustup
brew install --cask ghostty font-meslo-lg-nerd-font
brew install oven-sh/bun/bun
```

Use the installed Node if it meets the minimum. If package availability or an existing version manager prevents these commands, resolve the installation first; do not hide errors. The Herdr app's terminal font comes from `font-meslo-lg-nerd-font`; without it, the app falls back to JetBrains Mono. The legacy Herdr TUI also needs `fzf` and `terminal-notifier` ([Appendix L](#l2-install-its-runtime-dependencies-before-its-config)). `direnv` is optional for image-provider keys; inherited environment variables work without it. VS Code's `code` launcher is needed only if retaining Pi's `externalEditor = "code --wait"`; otherwise select an installed editor.

In `~/.zprofile`, retain Homebrew's `shellenv` line. In `~/.zshrc`, ensure `~/.local/bin` is first on PATH **after** any nvm/mise/other version-manager initialization. Add each line only once:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

Apply that line to the current shell too. For Homebrew rustup:

```sh
export PATH="$HOME/.local/bin:$(brew --prefix rustup)/bin:$PATH"
rustup toolchain install stable
rustup default stable
node --version
npm --version
python3 --version
bun --version
cargo --version
jq --version
fzf --version
```

Preserve an existing Rust default rather than changing it unnecessarily. The version-pinned build sections select their own toolchains. Confirm `python3 -c 'import tomllib'` succeeds. If Bun differs from 1.4.2, use the Pi tests below as a gate and install the recorded version if necessary.

Create destinations:

```sh
mkdir -p "$HOME/Projects" "$HOME/.local/bin" \
  "$HOME/.config/ai-dev-environment" "$HOME/.config/ghostty" \
  "$HOME/.config/herdr-app/mods" "$HOME/.claude/bin" \
  "$HOME/.claude/workflows" "$HOME/.codex/themes" \
  "$HOME/.pi/agent/extensions" "$HOME/.pi/agent/themes"
```


## 3. Install the base applications

### Claude Code

Use the [official native installer](https://code.claude.com/docs/en/setup). Download to a temporary file, inspect it, and execute it:

```sh
curl -fsSL https://claude.ai/install.sh -o "$AI_ENV_BACKUP/claude-install.sh"
```

After inspecting that file:

```sh
bash "$AI_ENV_BACKUP/claude-install.sh"
claude --version
```

The optional footer patch in section 9 assumes the native launcher at `~/.local/bin/claude` and version binaries under `~/.local/share/claude/versions`. An npm installation does not satisfy that patch's layout assumption.

### Codex and Pi

Use one chosen npm installation so the launchers and native helper binaries stay together. Record `command -v node`, `command -v npm`, and `npm root -g` before installing. On a fresh machine, the Homebrew runtime is the simplest match for Pi's wrapper.

```sh
npm install -g @openai/codex@latest
npm install -g --ignore-scripts @earendil-works/pi-coding-agent@0.85.1
codex --version
pi --version
```

The npm version anchors were checked against package metadata while authoring this guide. [Current Codex installation documentation](https://developers.openai.com/codex/cli/) also offers a standalone installer, but this runbook uses npm to preserve the native package layout needed by section 9. [Pi's upstream README](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md) documents its package name and installation.

Capture Pi's runtime paths **before** installing the wrapper:

```sh
export PI_NODE_BIN="$(command -v node)"
export PI_CLI_PATH="$(npm root -g)/@earendil-works/pi-coding-agent/dist/bundle/cli.js"
test -x "$PI_NODE_BIN"
test -f "$PI_CLI_PATH"
"$PI_NODE_BIN" "$PI_CLI_PATH" --version
```

Persist these two resolved absolute paths as quoted exports in `~/.config/ai-dev-environment/shell.zsh` later. Do not make them depend on whichever Node a project happens to select. Version-manager paths must be revised if that runtime is removed. On Intel, the wrapper's `/opt/homebrew` defaults will not work without these overrides.

### Herdr app and herdr-core

The Herdr app is the window: spaces, tabs, panes and mods. herdr-core (`hc`) runs every terminal and agent, and keeps them running when the window closes or updates. macOS releases are **Apple Silicon only**. On an Intel Mac, either [build from source](https://github.com/herdrdev/herdr-app#build-from-source) or record the Herdr app as blocked.

Use [Herdr's own installer](https://github.com/herdrdev/herdr-app#install). It installs `~/Applications/Herdr.app` with its release signature intact and links `~/.local/bin/herdr-app` to it. If no herdr-core is installed yet, it also installs one into `~/.local/bin/herdr-core`, with `hc` beside it. It checks each download's checksum. Download it and inspect it before running:

```sh
curl -fsSL https://releases.herdr.dev/app/install.sh -o "$AI_ENV_BACKUP/herdr-app-install.sh"
```

After inspecting that file:

```sh
sh "$AI_ENV_BACKUP/herdr-app-install.sh"
"$HOME/.local/bin/herdr-app" --version
"$HOME/.local/bin/herdr-core" --version
```

`herdr-app --version` prints the version without opening a window. If herdr-core did not install, the app offers to install it when it opens; [`core/install.sh`](https://github.com/herdrdev/herdr-core#install) installs it the same way. The installer creates `hc` only when no other `hc` exists (some window managers ship one). If `command -v hc` is not `~/.local/bin/hc`, use `herdr-core` by name.

The source machine instead dragged [Herdr.dmg](https://releases.herdr.dev/app/Herdr.dmg) into `/Applications`. That works too: launched from there, the app links `~/.local/bin/herdr-app` itself. A launch from the disk image does not. Never edit or re-sign the bundle.

Both update themselves: the app downloads new releases and, on the first start after an update, updates herdr-core too, with terminals still running. It never updates a herdr-core that a package manager installed.

**Do not open the app yet.** Section 6 installs its files first, so that on the first start the app writes its own files around them. Section 7 opens it once the shell environment is ready. If the app has already been opened on this machine, section 6 stops at `settings.json` and `keys.json` so they can be merged.

## 4. Install shared instructions and Claude Code files

### Shared instructions

```sh
new_config "$AI_ENV_REPO/claude-code/config/CLAUDE.md" "$HOME/.claude/CLAUDE.md"
```

Merge existing personal instructions rather than replacing them. Review these machine-dependent clauses in the installed copy:

- Keenable's executable and its key file are **not included**. Obtain the CLI separately and configure its key privately, or revise the search instructions to an available service. Do not leave an instruction requiring a nonexistent tool.
- The Codex instruction bridge and its hooks are **not included**. Section 10 explains the manual alternative.
- The research workflow requires a Claude build exposing `Workflow` and supported model aliases. Installing its JS does not add that capability. Its prompts request `WebSearch`/`WebFetch`, while the shared instructions direct search through Keenable; reconcile tool policy before use. Never launch a research fan-out just to test setup.

Link each harness to this canonical file. The repository's `codex/config/AGENTS.md` and `pi/config/AGENTS.md` are relative symlinks inside the checkout: **do not copy those symlinks unchanged into HOME**.

For each of `~/.codex/AGENTS.md` and `~/.pi/agent/AGENTS.md`, merge existing content into the canonical instructions first and call `save_existing`. Then replace only the reviewed file/link:

```sh
save_existing "$HOME/.codex/AGENTS.md"
save_existing "$HOME/.pi/agent/AGENTS.md"
ln -sfn "$HOME/.claude/CLAUDE.md" "$HOME/.codex/AGENTS.md"
ln -sfn "$HOME/.claude/CLAUDE.md" "$HOME/.pi/agent/AGENTS.md"
```

### Claude preferences and runtime files

```sh
new_config "$AI_ENV_REPO/claude-code/config/settings.json" "$HOME/.claude/settings.json"
new_config "$AI_ENV_REPO/claude-code/config/keybindings.json" "$HOME/.claude/keybindings.json"
put_file "$AI_ENV_REPO/claude-code/custom/statusline/statusline-command.sh" "$HOME/.claude/statusline-command.sh"
put_file "$AI_ENV_REPO/claude-code/custom/statusline/herdr-auto-label.py" "$HOME/.claude/bin/herdr-auto-label.py"
put_file "$AI_ENV_REPO/claude-code/custom/statusline/claude-footer-oneline.py" "$HOME/.claude/bin/claude-footer-oneline.py"
put_file "$AI_ENV_REPO/claude-code/custom/shortcuts/claude-cycle-effort" "$HOME/.local/bin/claude-cycle-effort"
put_file "$AI_ENV_REPO/claude-code/custom/workflows/deep-research-lean.js" "$HOME/.claude/workflows/deep-research-lean.js"
chmod +x "$HOME/.claude/statusline-command.sh" \
  "$HOME/.claude/bin/herdr-auto-label.py" "$HOME/.claude/bin/claude-footer-oneline.py" \
  "$HOME/.local/bin/claude-cycle-effort"
```

Before launching Claude, edit the installed preferences as needed:

- Remove or adapt `Read(~/Projects/cribbage/**)` and `Bash(langsmith:*)` if irrelevant.
- The OTLP endpoint `http://127.0.0.1:1738` has no collector here. Remove `CLAUDE_CODE_ENABLE_TELEMETRY` and the three `OTEL_*` entries unless restoring that collector separately.
- Do not set `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` in `settings.json`; remove it when merging an existing file. The same switch also stops Claude Code's OSC 7501 status reports, and herdr-core lists agents from those reports, so Claude would never appear in the Herdr app's Agents list. Keep titles off everywhere else (Ghostty, the legacy Herdr) from `~/.zshenv` instead. Run `save_existing "$HOME/.zshenv"`, then add this once:

  ```zsh
  # Herdr app terminals (HC_TERMINAL_ID set) need Claude Code's status reports.
  if [ -z "${HC_TERMINAL_ID:-}" ]; then
    export CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1
  fi
  ```

  Make both changes together, here and when restoring from a backup. With the key still in `settings.json`, Claude never appears as an agent; without the snippet, terminal titles come back in Ghostty. Claude sessions already running keep the old setting until restarted. Section 11 checks that Claude appears as an agent.
- Check support for the selected `model`, `effortLevel`, `modelSettings`, `tui`, and permission mode in the installed Claude version. Choose accessible models; document any substitutions.
- `enabledPlugins` is a preference, not an installer. Disable unresolved plugin entries until section 8 installs them. Leave Telegram disabled.
- Review the permission bypass prompt settings together with the alias decision in section 1. Preserve existing deny rules.

The statusline requires `jq` and Git. `herdr-auto-label.py` is the legacy Herdr 0.9.0 pane labeler and does nothing in the Herdr app, which uses section 6's `herdr-app-autoname` instead; it also requires authenticated Pi access to its configured label model. Copying these files does **not** install the excluded Claude hooks for labels, archive-on-exit, or footer repatching; record those as inactive unless restored from a private source.

## 5. Install Codex preferences

```sh
new_config "$AI_ENV_REPO/codex/config/config.toml" "$HOME/.codex/config.toml"
put_file "$AI_ENV_REPO/codex/config/themes/claude-nerd.tmTheme" "$HOME/.codex/themes/claude-nerd.tmTheme"
```

Keep the shared instruction link from section 4. Check that the configured `gpt-6-astra` model is available to the logged-in account. The `features.hooks = true` preference neither installs hooks nor supplies the instruction bridge. Do not claim skill discovery automation is active merely because this preference is enabled.

For stock Codex, `/model` is the model picker. Section 9 installs the managed patch for Cmd+E and full Cmd+Shift+E cycling. In the Herdr app, section 6's `herdr-app-cycle-effort` automatically selects a compatible effort key for each session.

## 6. Install the Herdr app setup

Everything in this section is copied, never symlinked. [`herdr-app/README.md`](herdr-app/README.md#copies-not-symlinks) records the tests behind that. Install only the owner's files. On its first start the app writes everything else itself: `AGENTS.md`, type files, icons, its shipped mods and layouts, and its state. **Never copy Herdr's shipped mods** (`agents`, `files`, `tabs`, `pane`, `workspace-chrome` and the rest), not even whole folders from another machine. One that differs from the shipped files (a missing subfolder counts) is moved to `<mod>-edited`, and the stock one is reinstalled.

### Helper scripts

```sh
for name in herdr-app-arrange herdr-app-links herdr-app-cycle-effort claude-cycle-effort-hc herdr-app-grid \
    herdr-app-autoname herdr-app-icon herdr-app-servers; do
  put_file "$AI_ENV_REPO/herdr-app/bin/$name" "$HOME/.local/bin/$name" || break
  chmod +x "$HOME/.local/bin/$name"
done
```

They need `python3`, `/usr/sbin/lsof`, `/usr/bin/pbcopy` and `/usr/bin/open`; everything but Python ships with macOS. `herdr-app-servers` also needs `tmux`, and `direnv` for folders with an `.envrc` (`brew install tmux direnv`). The mods call them by their `~/.local/bin` paths, and the scripts find `hc` on `PATH`, then in `~/.local/bin`.

**Codex effort key.** For Codex, Cmd+Shift+E sends the full-cycle `alt+shift+e` only when `~/.local/share/codex-shortcuts/capabilities.json` identifies the running executable as an unchanged managed build. Section 9's managed shortcut installation writes that file. Without it, every Codex session gets `alt+.`, which only increases effort and stops at the top.

### Config, theme, layout and mods

```sh
new_config "$AI_ENV_REPO/herdr-app/home/settings.json" "$HOME/.config/herdr-app/settings.json"
new_config "$AI_ENV_REPO/herdr-app/home/keys.json" "$HOME/.config/herdr-app/keys.json"
while IFS= read -r -d '' source; do
  relative="${source#herdr-app/home/}"
  case "$relative" in settings.json|keys.json) continue ;; esac
  put_file "$AI_ENV_REPO/$source" "$HOME/.config/herdr-app/$relative" || break
done < <(git -C "$AI_ENV_REPO" ls-files -z -- herdr-app/home/)
```

The loop installs the theme, the `main-plus` layout and eighteen mods. Only tracked files are copied, so a `gpui-kit.d.ts` or `jsconfig.json` that a check left in the checkout is skipped. When merging an existing `keys.json`, keep its sections and ask before replacing a key the owner already uses. The `layout:main-plus` section applies only while that layout shows.

`main-plus` needs the `git-graph` and `automations` mods below; until they are installed, its Graph and Automations panels report errors. Its Usage block says "No usage readings yet" until [section 10](#account-usage) starts `herdr-usage`; that is not an error.

### Pane and tab names

`herdr-app-autoname` names each agent's pane, and its tab, from the first message of every Claude Code, Codex and Pi chat. A small model turns the message into a 1–3 word task name. Tabs read `app0 - google login` when the folder is one of several numbered checkouts (`app0`, `app1`, … or `api-1`, `api-2`, …), else `google login`. A tab named by hand keeps its name; one that is unnamed, holds a placeholder (`3`, `3 -`, `app3 -`) or still holds the last generated name follows the newest chat. [`herdr-app/README.md`](herdr-app/README.md#pane-and-tab-names) has the details.

Add its hooks to Claude Code and Codex. It backs up each file, leaves other hooks alone, and does nothing if they are already there:

```sh
"$HOME/.local/bin/herdr-app-autoname" install-hooks
```

Pi gets the `herdr-app-autoname.ts` extension in section 7, and the `pane-plus` header that shows the names came with the mods above, along with `rename-pane` (Cmd+Shift+N) for naming a pane by hand. Names come from `openai-codex/gpt-6.1-sol` through Pi, so they start working once Pi is signed in to the Codex subscription (section 8). Section 11 checks it. Codex lists the new hooks under `/hooks`, where they should read Trusted; approve them there if not. A Codex already running needs a restart to load them; Claude picks them up on its own.

Run the same three steps on every machine whose agents show up in this Herdr: the script, `install-hooks` and the Pi extension. Each machine names its own tabs in its own herdr-core, so the app needs nothing extra for remote spaces.

### Servers panel

`main-plus`'s Servers panel lists the owner's local dev servers, with Start, Stop and Restart for each one and each group. Its list names the owner's projects, folders and ports, so it never comes from this repo. Start it from the example, then replace the example's projects with the owner's:

```sh
new_config "$AI_ENV_REPO/herdr-app/servers.example.json" "$HOME/.config/herdr-app-servers/projects.json"
"$HOME/.local/bin/herdr-app-servers" check
```

`check` lists the groups, and warns about a missing folder or a port two servers share. Until the list exists, the panel says where it goes. [`herdr-app/README.md`](herdr-app/README.md#the-list) describes each field.

The panel's Remote section shows hosted servers from the list's `remote` entries, each up or off with its monthly cost. Leave `remote` out and the section doesn't show. Fly entries need the fly CLI, signed in to the owner's account (`brew install flyctl`, then `fly auth login`, which the owner runs). Then `herdr-app-servers remote` lists each entry and its cost.

On another machine whose spaces show up in this Herdr, install the same CLI and give it a list of that machine's own servers. The panel then shows them under the machine's name. It's optional, and a machine without a list stays out of the panel. Its folders and ports often differ from this machine's, so ask the owner rather than copying this machine's list. Skip `remote` there. [`herdr-app/README.md`](herdr-app/README.md#other-machines) has the commands, which run from this machine through `hc`.

### Git graph, automations panel and CLI

These come from their authors' repositories, pinned to the versions this export was tested with, rather than bundled. Both are MIT. Mods are trusted code with command and network access, so read each repository's README and the mod folder you copy first. git-graph runs `git` in the focused repository, and at most once a day asks GitHub's public releases API whether a newer version exists. Set `CHECK = false` in its `update.js` to stop that. The automations panel runs the `herdr-automations` CLI.

```sh
export AI_ENV_UPSTREAM="$(mktemp -d "${TMPDIR:-/tmp}/ai-env-upstream.XXXXXX")"
git clone --quiet https://github.com/rabeeh-ta/herdr-git-graph "$AI_ENV_UPSTREAM/herdr-git-graph"
git -C "$AI_ENV_UPSTREAM/herdr-git-graph" checkout --quiet --detach b70e79571a8bdf3f711f054ba6be81c8ee7ea9bf
git -c advice.detachedHead=false clone --quiet --depth 1 --branch v0.11.3 \
  https://github.com/DnzzL/herdr-automations "$AI_ENV_UPSTREAM/herdr-automations"
test "$(git -C "$AI_ENV_UPSTREAM/herdr-automations" rev-parse HEAD)" = 983aec905a49e678d8694a9ca70de77ea3f728c5
```

After reviewing them, copy each mod folder whole. If a destination already exists, the `test` stops the copy; compare that folder with upstream instead of overwriting it:

```sh
test ! -e "$HOME/.config/herdr-app/mods/git-graph" &&
  cp -R "$AI_ENV_UPSTREAM/herdr-git-graph/mods/git-graph" "$HOME/.config/herdr-app/mods/git-graph"
test ! -e "$HOME/.config/herdr-app/mods/automations" &&
  cp -R "$AI_ENV_UPSTREAM/herdr-automations/app/mods/automations" "$HOME/.config/herdr-app/mods/automations"
```

The automations CLI's `scripts/install.sh` downloads the release's prebuilt binary into the clone's `bin/` and checks it against the release's `checksums.txt`. With no prebuilt binary for the machine, or a checksum mismatch, it builds from the pinned source instead, which needs Go. Its output says which happened. Install the binary as a copy; the panel looks for it on `PATH`, then in `~/.local/bin`:

```sh
(cd "$AI_ENV_UPSTREAM/herdr-automations" && sh scripts/install.sh)
put_file "$AI_ENV_UPSTREAM/herdr-automations/bin/herdr-automations" "$HOME/.local/bin/herdr-automations"
chmod +x "$HOME/.local/bin/herdr-automations"
"$HOME/.local/bin/herdr-automations" version
new_config "$AI_ENV_REPO/herdr-app/automations/automations.yaml" \
  "$HOME/.config/herdr/plugins/config/dnzzl.automations/automations.yaml"
```

`version` should print `0.11.3`. The starter `automations.yaml` only sets `backend: hc`, which runs automations in the Herdr app, and defines none. Add them with `herdr-automations add` or the panel. That path is the CLI's default config location, the same one the legacy Herdr plugin uses. Nothing runs on a schedule until section 10's optional login service is installed. Remove `$AI_ENV_UPSTREAM` afterwards.

## 7. Install Pi, shell configuration, then activate the terminal stack

### Pi configuration and extensions

```sh
new_config "$AI_ENV_REPO/pi/config/settings.json" "$HOME/.pi/agent/settings.json"
new_config "$AI_ENV_REPO/pi/config/keybindings.json" "$HOME/.pi/agent/keybindings.json"
new_config "$AI_ENV_REPO/pi/config/runtime-settings.json" "$HOME/.pi/settings.json"
put_file "$AI_ENV_REPO/pi/config/themes/claude-monokai.json" "$HOME/.pi/agent/themes/claude-monokai.json"
put_file "$AI_ENV_REPO/pi/helpers/pi" "$HOME/.local/bin/pi"
put_file "$AI_ENV_REPO/pi/helpers/pi-update" "$HOME/.local/bin/pi-update"
put_file "$AI_ENV_REPO/pi/helpers/agent-session-archive" "$HOME/.local/bin/agent-session-archive"
put_file "$AI_ENV_REPO/pi/helpers/herdr-usage" "$HOME/.local/bin/herdr-usage"
chmod +x "$HOME/.local/bin/pi" "$HOME/.local/bin/pi-update" \
  "$HOME/.local/bin/agent-session-archive" "$HOME/.local/bin/herdr-usage"
```

`runtime-settings.json` belongs at `~/.pi/settings.json`, **not** inside `agent/`. Preserve the exact extension directory layout; helpers and tests import adjacent modules. Copy every **tracked** file under `pi/extensions/custom/` to `~/.pi/agent/extensions/`, removing only that source prefix. This includes the JSON configuration, `active-pane-ui/`, `claude-compat/`, `image-generation/`, and `model-effort-shortcuts/` directories:

```sh
while IFS= read -r -d '' source; do
  relative="${source#pi/extensions/custom/}"
  put_file "$AI_ENV_REPO/$source" "$HOME/.pi/agent/extensions/$relative" || break
done < <(git -C "$AI_ENV_REPO" ls-files -z -- pi/extensions/custom/)
new_config "$AI_ENV_REPO/pi/extensions/package.json" "$HOME/.pi/agent/extensions/package.json"
new_config "$AI_ENV_REPO/pi/extensions/package-lock.json" "$HOME/.pi/agent/extensions/package-lock.json"
```

On a fresh installation, install both dependency trees:

```sh
(cd "$HOME/.pi/agent/extensions" && npm ci)
(cd "$HOME/.pi/agent/extensions/claude-compat" && npm ci)
```

If merging an existing root `package.json`, reconcile its lockfile with `npm install` instead; `npm ci` requires matching manifests and lockfiles and replaces that tree's node_modules. Keep the exported `sharp` and Effect overrides unless deliberately validating another set. No `patches/` directory is exported for the `patch-package` postinstall step; do not assume private patches were restored.

Materialize the configured external packages through Pi's package manager as well; `npm ci` above supplies local runtime dependencies, not proof that Pi has enabled every package:

```sh
jq -r '.packages[] | select(type == "string")' "$AI_ENV_REPO/pi/config/settings.json" |
while IFS= read -r package; do
  "$HOME/.local/bin/pi" install "$package" || break
done
"$HOME/.local/bin/pi" list
```

Verify all nine packages in section 8 are listed with no extension-load errors. Unversioned `npm:` entries resolve independently of the local lockfile; record their actual installed versions. Package names alone do not guarantee reproducing the source machine's versions.

Review Pi's installed settings before ordinary use:

- The exported default is `openrouter/stealth/ox-alpha`, but `enabledModels` does not include that default. Authenticate and add it to the scope if available, or choose an available default and align both fields. Do not silently leave an inaccessible default.
- Check every delegated model in `subagents`, not just the main model. The Claude compatibility adapter separately maps haiku/sonnet/opus to Luna/Terra/Sol; inspect that mapping if those models are unavailable.
- Retain or replace `externalEditor` according to the installed editor.
- The image extension registers tools but needs a separate OpenAI API key or Replicate token to execute. ChatGPT/Codex login alone is not an image API key. `direnv` is an optional fallback, not required setup.
- `session-archive.ts` invokes the archive helper automatically on TUI shutdown. Section 10 configures its destinations; disable its Git/QMD activity and default project routing until then.

### Persistent shell environment

Create or merge `~/.config/ai-dev-environment/shell.zsh` after backing it up. Use the **actual paths captured in section 3** for the first two exports:

```zsh
# Replace these two example values with this machine's captured absolute paths.
export PI_NODE_BIN='/opt/homebrew/bin/node'
export PI_CLI_PATH='/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js'
export PATH="$HOME/.local/bin:$PATH"
export AGENT_SESSION_ARCHIVE_FAMILIES='{}'
export AGENT_SESSION_ARCHIVE_NO_GIT=1
export AGENT_SESSION_ARCHIVE_NO_QMD=1
```

The empty archive mapping prevents routing into the source machine's default `cribbage`/`jumpstart` project families. The Git flag also prevents the helper's automatic **push**. Section 10 describes intentional activation.

Install the shell wrapper and aliases as separate files:

```sh
put_file "$AI_ENV_REPO/pi/config/shell-wrapper.zsh" "$HOME/.config/ai-dev-environment/pi-wrapper.zsh"
put_file "$AI_ENV_REPO/ghostty/config/aliases.sh" "$HOME/.config/ai-dev-environment/ghostty-aliases.zsh"
```

Add these lines once, after version-manager initialization in `~/.zshrc`:

```zsh
source "$HOME/.config/ai-dev-environment/shell.zsh"
source "$HOME/.config/ai-dev-environment/pi-wrapper.zsh"
source "$HOME/.config/ai-dev-environment/ghostty-aliases.zsh"
```

If the section 1 alias choice authorized bypass shortcuts, also install `claude-code/config/aliases.sh` and `codex/config/aliases.sh` into this directory and source them once from `~/.zshrc`. Otherwise leave those two aliases inactive and record the choice.

Source the three files in the current shell and run `rehash`. Check `whence -a pi node npm codex claude herdr-app hc`: `pi` should be the shell function backed by `~/.local/bin/pi`, and its wrapper should use the recorded compatible Node regardless of a project's nvm version. Never set `PI_BIN` to `pi-update`, which would recurse. `pi update` deliberately routes through `pi-update` and needs Bun plus the installed tests.

### Ghostty

```sh
new_config "$AI_ENV_REPO/ghostty/config/config" "$HOME/.config/ghostty/config"
put_file "$AI_ENV_REPO/ghostty/helpers/ghostty-dual" "$HOME/.local/bin/ghostty-dual"
put_file "$AI_ENV_REPO/ghostty/helpers/ghostty-quad" "$HOME/.local/bin/ghostty-quad"
chmod +x "$HOME/.local/bin/ghostty-dual" "$HOME/.local/bin/ghostty-quad"
```

Check for a second config under `~/Library/Application Support/com.mitchellh.ghostty/`; consolidate conflicting settings instead of assuming only the XDG file loads. Confirm `~/Projects` exists or change `working-directory`. Check the installed theme and font names in Ghostty. Its exported `keybind = clear` removes default bindings. Tab, split and navigation chords belong to the Herdr app now; in Ghostty itself, use its menus or the layout helpers.

Launch Ghostty. Restart it after font installation; open a new terminal for padding changes. The titlebar is hidden, so there are no traffic-light buttons; Option-drag the frame to move the window. Cmd+Shift+, reloads config, but is not a substitute for opening a new surface when required.

The `ghostty-dual` and `ghostty-quad` helpers (the `2x2` and `4x4` aliases) first try `herdr-app-grid` from section 6. Run in a Herdr app terminal, they open a new tab in that space, split side by side or 2x2. Anywhere else `herdr-app-grid` exits 3 and they open a Ghostty window instead. That fallback uses AppleScript and needs a Ghostty version with those scripting APIs. Let macOS handle any Automation consent. Verify both paths with a scratch directory. The directory is interpolated into AppleScript; use a simple path without embedded quotes or backslashes.

### Start the Herdr app

Open Herdr from Applications, or run `herdr-app` from a shell. A Finder launch loads the login shell's `PATH`, so the shell files above must already be in place. Finish its welcome screens. On this first start the app writes its own files around the ones from section 6. From a shell (a Herdr terminal is fine):

```sh
herdr-app do layout.switch --name main-plus
for mod in tab-move-left tab-move-right pane-next pane-prev pane-mover pane-mover-tabs \
    effort-cycle arrange-wide arrange-laptop link-picker scrollback-search tabs-plus pane-plus rename-pane \
    workspace-chrome-plus agents-plus servers git-graph automations; do
  herdr-app check "$HOME/.config/herdr-app/mods/$mod" || break
done
find "$HOME/.config/herdr-app" -maxdepth 1 -name '*.error' -print
herdr-app status | jq -e '.layout == "main-plus" and (.errors | length) == 0'
jq -e '.theme == "monokai-pro-spectrum" and .font == "MesloLGS Nerd Font Mono"' "$HOME/.config/herdr-app/settings.json"
```

Every check should pass, `find` should print nothing, and both `jq` checks should print `true`. A broken file keeps its last good version running and writes the reason to `<name>.error`, so a working window does not prove a file loaded. If the welcome changed `settings.json`, merge the exported values back; the app applies them live. `ctrl-alt-shift-escape` is the app's escape hatch: it sets the shown layout and `keys.json` aside as `*.reset-<time>` and returns to the stock `main` layout. To recover, restore `keys.json` from the export and switch layouts again.

Herdr.app gets the horn icon in the Dock and Finder on its next start: `main-plus`'s top bar runs `herdr-app-icon --if-missing`, which needs `brew install librsvg`. It puts the icon back after each app update too. Run `herdr-app-icon` to set it at once.

Herdr sends anonymous daily usage counts by default; Settings → Privacy shows each report, or set `"telemetry": false` in `settings.json`. The exported settings leave it on, as the source machine does. Record the owner's choice.

## 8. Authenticate and reconcile external packages

Have the owner complete interactive login in each harness; do not ask them to paste secrets into the setup log. Start Claude and finish its login, run `codex login`, and use `/login` in Pi for each required provider. Then:

```sh
codex login status
pi auth check --provider openai-codex --no-refresh --json
```

Repeat Pi's readiness check for each provider actually selected in section 7. A credentials check is not proof of access to every model. Use each harness's model picker/catalog to verify the main model, delegated models, and the `HERDR_AUTO_LABEL_MODEL` default `openai-codex/gpt-5.6-luna`. Pick an accessible label model if necessary and persist the override in the shell environment. Labeling makes a small model request on the first prompt; copying its helper does not grant provider access.

In Pi, run `/reload`, `/claude-compat`, `/claude-agents`, and `/mcp` in a scratch project. Trust only the intended project's configuration. Non-interactive sessions skip untrusted project resources. With no MCP config restored, zero MCP connections is expected; it is not evidence that the private setup was reproduced.

The nine exported Pi package sources are:

| Package | Purpose/accounting |
|---|---|
| `@pi-plugins/usage` | Usage display |
| `pi-paster` | Paste support |
| `pi-claude-code-ui` | Claude-style UI; reads `~/.pi/settings.json` |
| `pi-web-access` | Web access; check installed package requirements |
| `context-mode` | Context tools; preserve dependency overrides |
| `pi-subagents` | Delegation; verify configured model access |
| `@juicesharp/rpiv-ask-user-question` | Question UI |
| `@juicesharp/rpiv-todo` | Task UI |
| `pi-autoresearch@1.6.2` | Autoresearch; custom dashboard key is in `pi-autoresearch.json` |

The local Claude compatibility web tools separately read `SERPER_API_KEY` or `EXA_API_KEY`; they do not automatically use Keenable. Reconcile this with shared search instructions. Keep unavailable web-provider features recorded as inactive instead of implying installation supplies keys.

### Optional Claude marketplaces and project plugins

The inventory in `claude-code/EXTERNAL-EXTENSIONS.md` distinguishes user and project scope. Register needed public marketplaces with:

```sh
claude plugin marketplace add anthropics/claude-plugins-official
claude plugin marketplace add asmartbear/asb-skills
claude plugin marketplace add mvanhorn/cli-printing-press
claude plugin marketplace add langchain-ai/langsmith-skills
```

Install the user plugin if wanted:

```sh
claude plugin install swift-lsp@claude-plugins-official --scope user
```

Confirm its Swift toolchain/language-server prerequisites through the plugin's installed instructions. For each actual target project, run these **from that project** when wanted:

```sh
claude plugin install asb-skills@asb-skills --scope project
claude plugin install cli-printing-press@cli-printing-press --scope project
claude plugin install sentry-cli@claude-plugins-official --scope project
```

Do not install project plugins into this configuration repository just to make them appear installed. This is also not an instruction to execute any plugin workflow or send messages through its integrations.

GitKraken's local marketplace is excluded; obtain its source separately before enabling `gitkraken-hooks@gitkraken`. Added marketplace `langsmith-skills` has no listed installed plugin, so registration alone reproduces that inventory. Telegram stays disabled. Run `claude plugin marketplace list` and `claude plugin list`, reconcile `enabledPlugins`, and restart Claude if required. Record resolved plugin versions; the inventory's versions are a snapshot, not a guarantee that current marketplace installs select those versions.

## 9. Optional custom binaries

Complete each chosen build and its checks; otherwise record stock behavior. A patch file on disk is not an installed feature. Build in separate unused directories.

### Claude's single-line footer

First run the export's tests and the helper's read-only inspection:

```sh
python3 -B -m unittest discover -s "$AI_ENV_REPO/claude-code/custom/statusline" -p test_footer_patch.py -v
python3 "$HOME/.claude/bin/claude-footer-oneline.py" --check
```

If the owner wants the footer customization and the native layout is supported, run the helper without arguments, then `--check` again and restart Claude. It creates a patched version, repoints the launcher, and ad-hoc signs it; it must stop if its byte-pattern assumptions do not match. Do not weaken those checks to force a newer release. Use `--revert` to return to stock. Auto-updates can remove the customization; its automatic `--ensure` hook is excluded, so reapply manually or restore that hook separately.

### Codex full effort cycling

Use the [managed shortcut installation](codex/patches/README.md). Link the
rebuild skill for Claude Code and Codex, keeping an existing destination:

```sh
ln -s "$AI_ENV_REPO/codex/skills/rebuild-codex-shortcuts" "$HOME/.claude/skills/rebuild-codex-shortcuts"
ln -s "$HOME/.claude/skills/rebuild-codex-shortcuts" "$HOME/.agents/skills/rebuild-codex-shortcuts"
```

Then ask an agent to run the `rebuild-codex-shortcuts` skill. It applies the
shortcut patch to the installed npm version, builds it, and gates it on the
shortcut, TUI, launcher and router tests. It then installs the build, its
helpers and the `~/.local/bin/codex` launcher. The launcher checks the installed
npm version on every start and never builds. After an npm upgrade it starts
stock Codex at once and names the skill; run the skill again to bring the
shortcuts to the new version.

Keep `~/.local/bin` ahead of npm in PATH. Run
`python3 "$AI_ENV_REPO/codex/scripts/check-shortcuts.py"` after installation.
Existing sessions must exit/resume normally to load the handler; save drafts
first. The router automatically uses the stock shortcut for old sessions.

A failed rebuild reports an error, leaves stock Codex running and keeps the
previous release; see the recovery steps in the linked guide. Do not replace
npm's executable or symlink it to a custom
binary: that was the cause of the September 18 shortcut regression.

The legacy Herdr 0.9.0 machine-header and usage-section builds are in [Appendix L4](#l4-machine-headers-and-pinned-usage-section-optional-build). The Herdr app needs no custom build.

## 10. Finish optional integrations and account for excluded pieces

### Scheduled automations (optional)

Section 6 installed the automations CLI and panel. Automations run on their schedule only while `herdr-automations daemon` runs; the Herdr app has no plugin startup hook to start it. The CLI installs it as a login service. Run this from the final shell environment, because the service records this shell's `PATH` to find `hc`, `git` and the agents:

```sh
"$HOME/.local/bin/herdr-automations" service status
"$HOME/.local/bin/herdr-automations" service install
plutil -lint "$HOME/Library/LaunchAgents/dev.dnzzl.herdr-automations.plist"
"$HOME/.local/bin/herdr-automations" service status
```

It writes `~/Library/LaunchAgents/dev.dnzzl.herdr-automations.plist` and starts the scheduler now and at every login. The plist holds absolute paths and the whole `PATH`, so never copy it from another machine. Regenerate it with `service install` after changing where Node or the agents live. Its log is `~/.local/state/herdr/plugins/dnzzl.automations/daemon.log`. Without the service, the panel's Run now still works and nothing runs on a schedule. Both are valid choices; record which. `service uninstall` removes it and leaves `automations.yaml` and the run history.

### Account usage

The `main-plus` sidebar's Usage block (`mods/usage`) shows each Claude subscription and OpenAI. It only reads files. `herdr-usage`, installed in section 7, writes them using the Claude and Pi logins from section 8, so never run it with shell tracing. Start it as a login job once those logins work. Run this from the final shell environment: a LaunchAgent inherits nothing from the terminal, so the job records `PI_NODE_BIN` and `PI_CLI_PATH` for the Pi wrapper.

```sh
label=io.mitchnick.herdr-usage
plist="$HOME/Library/LaunchAgents/$label.plist"
if [ -e "$plist" ]; then
  echo "Already exists; review it before changing anything: $plist"
else
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-c</string>
    <string>while true; do "$HOME/.local/bin/herdr-usage"; sleep 120; done</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>PI_BIN</key>
    <string>$HOME/.local/bin/pi</string>
    <key>PI_NODE_BIN</key>
    <string>$PI_NODE_BIN</string>
    <key>PI_CLI_PATH</key>
    <string>$PI_CLI_PATH</string>
  </dict>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>/tmp/herdr-usage.out.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/herdr-usage.err.log</string>
</dict>
</plist>
EOF
  plutil -lint "$plist" && launchctl bootstrap "gui/$(id -u)" "$plist"
fi
```

The plist holds absolute paths, so never copy it from another machine. After moving Node or Pi, remove the job (section 12) and run this again. It is a looping `KeepAlive` job rather than `StartInterval` because macOS can silently stop re-arming a `StartInterval` while `launchctl` still reports the job as healthy; `launchctl print "gui/$(id -u)/io.mitchnick.herdr-usage"` showing a `pid` is a real health check. Readings land in `~/.claude/usage-accounts/` and `~/.pi/agent/openai-usage-cache.json` within a few seconds, and the block picks them up within 30. Exit status alone proves nothing: with no login, the script exits 0 and writes nothing. Check freshness and the rendered block without printing credentials or raw account payloads. The usage endpoints are internal and can change; keep the feature outstanding if real responses no longer match the helper.

A machine with several subscriptions can add the optional private `~/.claude/usage-accounts/.config.json` for short names and for readings from other machines; [`herdr-app/README.md`](herdr-app/README.md#usage-block) has its format. It holds personal emails and machine names, so get its values from the owner and never commit it. Without it, every account with a reading still shows, named from its email.

A legacy Herdr 0.9.0 sidebar reads the same publisher; [Appendix L5](#l5-account-usage-in-the-sidebar-optional) covers it.

### Session archiving

The archive helper and Pi shutdown adapter are installed, but section 7 deliberately leaves their project mapping empty. To activate local archival, replace `AGENT_SESSION_ARCHIVE_FAMILIES='{}'` with a JSON object mapping project-family names to **real absolute roots**, for example `{"my-project":"/Users/your-name/Projects/my-project"}`. Keep `AGENT_SESSION_ARCHIVE_NO_GIT=1` and `AGENT_SESSION_ARCHIVE_NO_QMD=1` initially.

Test one non-sensitive scratch transcript with:

```sh
agent-session-archive archive --harness pi --transcript /absolute/path/to/scratch-session.jsonl \
  --cwd /absolute/path/to/mapped/project --no-qmd --no-commit
```

Replace those paths before executing. Inspect the generated `sessions/` Markdown and confirm the project-family route. If QMD indexing is desired, obtain QMD separately, configure its collections, and verify `qmd update`/`qmd embed` before enabling refresh. QMD installation and collection configuration are not supplied here.

Removing `AGENT_SESSION_ARCHIVE_NO_GIT=1` permits automatic session commits **and pushes to origin**, potentially including other pending branch commits. Enable this only when the owner explicitly wants that workflow and the destination repository is appropriate for transcripts. It is not required for a working coding environment. Do not backfill existing private sessions during setup. Claude's SessionEnd hook and any Codex archive integration are not supplied by copying the helper.

### Jev classifier primitive (Claude Code and Codex)

The bundled Python 3 client provides quick Choice, yes/no, Score, and batch
requests to TypeSafe. It works from any directory without Knox, direnv, Node,
MCP configuration, or a subagent. Install the command and the shared skill:

```sh
mkdir -p "$HOME/.local/bin" "$HOME/.claude/skills/jev" "$HOME/.agents/skills"
new_config "$AI_ENV_REPO/claude-code/custom/jev/jev.py" "$HOME/.local/bin/jev"
chmod +x "$HOME/.local/bin/jev"
new_config "$AI_ENV_REPO/claude-code/custom/jev/SKILL.md" "$HOME/.claude/skills/jev/SKILL.md"
```

Keep `~/.claude/skills/jev` canonical. If `~/.agents/skills/jev` is absent, link it:

```sh
ln -s "$HOME/.claude/skills/jev" "$HOME/.agents/skills/jev"
```

Preserve an existing destination; if it already resolves to the canonical skill,
no change is needed. The shared instructions installed in section 4 tell both
agents when to call Jev. Merge the `Jev classifier primitive` section into an
existing global instruction file if necessary.

Credentials resolve from `TYPESAFE_API_KEY`, then `~/.config/jev/env`. Create the
private file with restrictive permissions before entering a key in your editor:

```sh
mkdir -p "$HOME/.config/jev"
(umask 077; touch "$HOME/.config/jev/env")
chmod 600 "$HOME/.config/jev/env"
```

Add `TYPESAFE_API_KEY=<your key>` inside that file. Do not put a real key in shell
commands, logs, this repository, or the skill. An existing key can be transferred
privately; setup must not depend on another project's environment.

Verify offline, then make one small live call using synthetic input:

```sh
python3 -m unittest discover -s "$AI_ENV_REPO/claude-code/custom/jev"
"$HOME/.local/bin/jev" --help
(cd /tmp && "$HOME/.local/bin/jev" choice 'Which team handles this?' billing support other --text 'Please refund a duplicate invoice charge.')
```

Expect JSON with `answers.decision.choice` equal to `billing`. Live verification
uses the TypeSafe account. Exit 0 means a valid response, including negative or
uncertain answers; failure exits 1. No automatic retries or confidence cutoff
are applied. See [the command guide](claude-code/custom/jev/README.md) for formats.

Start fresh Claude Code and Codex sessions and check skill discovery (`/jev` in
Claude Code; `$jev` or the `/skills` picker in Codex). The instruction shorthand
`\jev` also works in Codex. Automatic selection remains the agent's decision.
For rollback, remove only this command, skill/link, private credential file, and
Jev instruction section, restoring any files backed up during installation.

### Skills, hooks, MCPs, research, and unavailable features

| Item | Required disposition before handoff |
|---|---|
| Individual skills, custom agents, prompt templates | Jev is bundled above; for other skills, obtain the owner's separate source or mark unavailable; plugin-installed skills cover only their plugin contents |
| Claude hooks | Pane and tab names are installed by `herdr-app-autoname install-hooks` (section 6). Restore the others privately if desired; helper files alone do not activate archiving or automatic footer patching |
| Codex instruction bridge | Restore the private bridge/hooks or use manual skill links below; `features.hooks` alone is insufficient |
| MCP server definitions, OAuth, service credentials | Recreate from an authorized private source and authenticate each connection; never infer secrets or copy another machine's trust registry |
| Keenable | Obtain the CLI separately; key at `~/.config/keenable/env` with mode 600 or inherited environment; never put the key in commands/logs |
| Deep research workflow | Verify `Workflow` exists and its models/search tools are usable; otherwise keep copied workflow inactive; user confirmation is required before an actual research run |
| GitKraken marketplace and hooks | Obtain separately or disable the unresolved plugin entry |
| Telemetry collector on port 1738 | Restore separately or leave the exported telemetry settings removed |
| Codex Cmd+E picker patch | Included in the managed upgrade-tested shortcut patch; stock uses `/model` |
| Usage LaunchAgent, account state, `usage-accounts/.config.json` | Create locally (section 10); never publish the generated state or the personal names and hosts in `.config.json` |
| Image-provider and compatibility-search keys | Configure privately for selected features, or mark those features inactive |
| Existing sessions, history, caches, trust decisions, plugin registries | Not restored by this repo; generate new state through the tools |

For manual Codex project skill discovery, inspect `.claude/skills` at each applicable directory from the working directory through the repo root. When `.agents/skills` is absent and `.agents` is not a symlink, create `.agents/skills -> ../.claude/skills`. When `.agents/skills` is an existing real directory, preserve it and add `claude-local -> ../../.claude/skills` inside it. Preserve collisions and do not write through a shared `.agents` symlink. Do not link sibling projects or copy skill trees. Verify with Codex's `/skills` picker or `$skill-name` completion. The instruction shorthand `\skill-name` is ordinary text, not a registered slash command; test it only with a harmless diagnostic skill. Do not run `create-pr` to test discovery.

## 11. Verify the installed result

### File and dependency checks

Run in a fresh shell, a Herdr app terminal or Ghostty, so persisted environment settings are exercised:

```sh
whence -a claude codex pi herdr-app hc node npm python3 bun
claude --version
codex --version
pi --version
herdr-app --version
hc --version
pi list
zsh -n "$HOME/.config/ai-dev-environment/shell.zsh"
zsh -n "$HOME/.config/ai-dev-environment/pi-wrapper.zsh"
jq empty "$HOME/.claude/settings.json" "$HOME/.claude/keybindings.json" \
  "$HOME/.pi/agent/settings.json" "$HOME/.pi/agent/keybindings.json" "$HOME/.pi/settings.json" \
  "$HOME/.config/herdr-app/settings.json" "$HOME/.config/herdr-app/keys.json" \
  "$HOME/.config/herdr-app/themes/monokai-pro-spectrum.json" "$HOME/.config/herdr-app/layouts/main-plus.json"
python3 - <<'PY'
from pathlib import Path
import tomllib
with (Path.home() / '.codex/config.toml').open('rb') as f:
    tomllib.load(f)
canonical = (Path.home() / '.claude/CLAUDE.md').resolve(strict=True)
for name in ('.codex/AGENTS.md', '.pi/agent/AGENTS.md'):
    assert (Path.home() / name).resolve(strict=True) == canonical, name
print('TOML and shared instruction links OK')
PY
herdr-app status | jq -e '.layout == "main-plus" and (.errors | length) == 0'
jq -r '.[] | .[] | select(startswith("mod.open:")) | ltrimstr("mod.open:")' "$HOME/.config/herdr-app/keys.json" |
  sort -u | while IFS= read -r mod; do
    test -f "$HOME/.config/herdr-app/mods/$mod/main.js" || echo "keys.json opens a missing mod: $mod"
  done
for name in herdr-app-arrange herdr-app-links herdr-app-cycle-effort claude-cycle-effort-hc herdr-app-grid \
    herdr-app-autoname herdr-app-icon herdr-app-servers herdr-usage herdr-automations ghostty-quad ghostty-dual; do
  test -x "$HOME/.local/bin/$name" || echo "missing: $name"
done
```

TOML/JSON parsing proves syntax, not support for every preference. Open both Claude and Codex and resolve startup/config warnings. If the installed Codex advertises `--strict-config`, use it for that startup check. Check Ghostty's config diagnostics and font/theme availability in the app. The `keys.json` loop and the `missing:` loop must print nothing; the shipped `picker` mod exists once the app has started.

Run the export's focused offline checks:

```sh
cd "$AI_ENV_REPO"
for name in herdr-app-arrange herdr-app-links herdr-app-cycle-effort claude-cycle-effort-hc herdr-app-servers; do
  "$HOME/.local/bin/$name" --help >/dev/null || echo "failed: $name"
done
"$HOME/.local/bin/herdr-app-servers" status
"$HOME/.local/bin/herdr-app-autoname" try --cwd "$HOME" "fix the google sign in redirect"
bash -n "$HOME/.local/bin/herdr-app-grid"
bash -n "$HOME/.local/bin/herdr-usage"
bash -n "$HOME/.local/bin/ghostty-quad"
bash -n "$HOME/.local/bin/ghostty-dual"
(unset HC_TERMINAL_ID; "$HOME/.local/bin/herdr-app-grid" quad "$HOME"; test $? -eq 3) && echo 'grid falls back outside herdr-app'
python3 -B -m unittest discover -s claude-code/custom/statusline -p test_footer_patch.py -v
pi-update --test-only
(cd "$HOME/.pi/agent/extensions/claude-compat" && npm test)
```

`--help` proves each helper's interpreter and imports resolve; it does not drive an agent. `herdr-app-autoname try` makes one real model call and prints a name such as `{"task": "google sign in redirect", "checkout": null, ...}`; an error there means Pi cannot reach `gpt-6.1-sol`. `herdr-app-grid` must exit 3 outside a Herdr terminal, which is what sends `4x4`/`2x2` to Ghostty there. The footer tests do not prove a newly released Claude binary matches its byte patterns.

Create an empty scratch project and run the compatibility smoke test against it:

```sh
export AI_ENV_SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/ai-env-smoke.XXXXXX")"
(cd "$HOME/.pi/agent/extensions/claude-compat" && npm run smoke -- "$AI_ENV_SCRATCH")
```

This checks extension loading/command registration, not live MCP or model behavior.

### Interactive acceptance checklist

Use scratch spaces, tabs and harmless drafts. Record actual observations, not just successful process exit codes. [SHORTCUTS.md](SHORTCUTS.md) is the complete key reference.

- [ ] All three harnesses open in Herdr app terminals with no unresolved config or extension errors, correct theme, and a usable authenticated model. If a minimal model request is made, it returns successfully; otherwise model execution remains unverified.
- [ ] Claude statusline displays directory/branch/context/model/effort as applicable; font glyphs are legible. Pi footer and its active-pane cursor work without duplicate cursors when changing focus.
- [ ] Pi `/model-effort` and Cmd+E open the model/effort picker. Claude Cmd+E opens its picker. Codex `/model` works; Cmd+E also works with the managed patch. In the Herdr app, Cmd+E reaches the terminal as Esc+E.
- [ ] Cmd+Shift+E changes effort exactly once, preserves the current draft/cursor/model, and behaves correctly in each harness. Stock Codex's limited route is distinguished from patched full wrapping. Canceling a picker preserves the draft. A failure is logged to `$TMPDIR/herdr-app-cycle-effort.log`.
- [ ] Cmd+D / Cmd+Shift+D split; Cmd+T creates a tab; Cmd+] / Cmd+[ cycle panes; Cmd+Ctrl+Arrow moves focus; Cmd+Shift+Arrow swaps; Cmd+Alt+Shift+Left/Right moves a tab one slot; Cmd+1..9 and Cmd+Alt+1..9 select tabs and spaces; Cmd+Shift+P and Cmd+G open the picker; Cmd+B toggles the sidebar.
- [ ] Pane mover: Cmd+M opens the tab list and Cmd+Shift+M the full menu. A scratch pane moves to another tab and to a new space, and its program keeps running.
- [ ] Cmd+Shift+R and Cmd+Ctrl+R arrange a scratch tab of 3–5 panes into wide/laptop columns without restarting any program; repeating is harmless; a failure shows a toast and changes nothing.
- [ ] Cmd+K in a Claude or Codex session that mentioned a harmless URL lists it; Enter opens, Ctrl+Y copies, Escape closes. In a plain shell it reads the screen instead.
- [ ] Cmd+F searches the focused terminal's scrollback; Enter copies the line, Shift+Enter copies it with context, `/pattern/` is a regular expression.
- [ ] `4x4` and `2x2` in a Herdr terminal open a new 2x2 or side-by-side tab in that space; in Ghostty they open a Ghostty window.
- [ ] In `main-plus`, the Graph button and Cmd+Shift+G open git-graph for the focused repository, Cmd+Shift+H opens Changes, and Cmd+Shift+J opens Servers; the Automations button opens the panel, which lists `automations.yaml` without an error. The scheduler state matches the section 10 choice.
- [ ] A Claude Code session started after setup in a Herdr terminal appears in the sidebar's Agents list, and `hc get <its address> --json | jq .status` shows `"app": "claude-code"` with a state. If it is missing, check `env | grep CLAUDE_CODE_DISABLE_TERMINAL_TITLE` in that terminal (section 4).
- [ ] In a scratch tab, the first message to Claude, then to Codex, then to Pi names the pane header and the tab within about ten seconds; a later message in the same chat changes nothing; after `/clear` (Codex and Pi: `/new`) the next first message renames a generated tab name but not one typed by hand. In a numbered checkout the tab reads `<checkout> - <name>`. `herdr-app-autoname status` shows each decision. Cmd+Shift+N (or double-clicking the header's name) renames a pane; that name stays over later task names until it is cleared.
- [ ] The sidebar's Usage block lists the signed-in Claude subscription with its 5h, 7d and Fable windows, then any other subscription and OpenAI, and a hover shows a reading only minutes old. If section 10's job was left off, record that; the block then says "No usage readings yet".
- [ ] During work, idle and a harmless input/approval prompt, the sidebar shows each agent's state. Sounds are off in the exported settings; record what a blocked agent shows.
- [ ] Chosen optional features have their own observed result: footer patch, scheduled automations, local archive destination, skills, and restored MCPs. Inactive options have explicit reasons.
- [ ] Quitting and reopening the app keeps every terminal running and returns to `main-plus` with the same keys. After opening a new terminal, PATH, wrapper, themes and instructions still work.

If an arrange fails, the toast says why and nothing was written. The previous layout document is kept in `~/.local/state/herdr-app-arrange/before.json`.

## 12. Handoff, rollback, and future updates

Leave a private setup report containing:

1. Machine/OS/architecture, repo revision, application/runtime versions (including Herdr app, herdr-core and `herdr-automations`), resolved executable paths, and plugin/package versions.
2. Backup location, files created/merged, deliberate deviations from the export, the permanent checkout path, and whether the automations login service and Herdr telemetry are on.
3. Each section marked **verified**, **installed but unverified**, **inactive by choice**, or **blocked**, with the specific missing prerequisite for any blocker.
4. Test results and physical UI observations; identify any checks the owner still needs to perform.
5. Which optional patches are active, their source commits, stock binary backups, and whether upgrades can replace them.
6. Which excluded features remain unavailable, including hooks/bridge, MCPs, skills, and research tools. Do not turn unavailable features into a generic “done.”

Rollback is per component, not a wholesale replacement of HOME:

- Restore reviewed config files from `AI_ENV_BACKUP`; remove only newly created files listed in the report. Preserve credentials and unrelated changes made after setup. Remove/revert only the shell source lines added here.
- Herdr app files: switch away first (`herdr-app do layout.switch --name main`), then restore `settings.json` and `keys.json` from `AI_ENV_BACKUP`. Remove only what section 6 installed: the eighteen exported mod folders, `mods/git-graph`, `mods/automations`, `layouts/main-plus.json` and the theme. Never delete `~/.config/herdr-app` wholesale; the rest is the app's own.
- Run `herdr-app-autoname remove-hooks` and delete `~/.pi/agent/extensions/herdr-app-autoname.ts` before removing the helpers. Tab names it wrote stay; its state is in `~/.local/state/herdr-app-autoname/`.
- Before removing `herdr-app-servers`, stop the servers it started (`herdr-app-servers stop <group>` for each group); they run in its own tmux server, `tmux -L herdr-servers`. Its state is in `~/.local/state/herdr-app-servers/`. Keep `~/.config/herdr-app-servers/projects.json` unless the owner asks otherwise.
- Remove only the eight Herdr helpers from `~/.local/bin`, and restore `ghostty-quad`/`ghostty-dual` from the backup if they were replaced.
- Automations: `herdr-automations service uninstall` if section 10 installed it, then remove `~/.local/bin/herdr-automations`. Keep `automations.yaml` and its run history unless the owner asks otherwise.
- Usage job: `launchctl bootout "gui/$(id -u)/io.mitchnick.herdr-usage"`, then remove its plist. Keep `~/.claude/usage-accounts/` unless the owner asks otherwise; it holds their private `.config.json`.
- Removing the Herdr app itself: herdr-core keeps terminals running after the window closes. Check `hc ls` and end those terminals deliberately before removing `~/.local/bin/herdr-core` and `hc`. Then remove the app bundle and the `~/.local/bin/herdr-app` link.
- Restore Codex's saved native executable and the stock-adapted router together; preserve its npm launcher/helpers and restart Codex sessions normally.
- Run `claude-footer-oneline.py --revert` for the footer customization.
- Disable archive automation through the environment flags before removing helpers. Preserve existing transcripts and archives; setup rollback is not permission to delete them.
- Legacy Herdr 0.9.0 rollback is in [Appendix L7](#l7-legacy-rollback).

For future upgrades, review changes before copying. Pi's `pi update` wrapper runs cursor regressions before/after; rerun compatibility smoke checks after extension updates. Claude updates may need a newly compatible footer patch. Codex's launcher automatically rebuilds and tests its customizations when npm changes; patch incompatibilities are reported explicitly. The Herdr app replaces its shipped mods and layouts on every update, but `tabs-plus`, `pane-plus`, `workspace-chrome-plus`, `agents-plus` and `main-plus` are clones that never update. Compare them with the new shipped `tabs`, `pane`, `workspace-chrome`, `agents` and `main` (their `cloned_from.version` says which release they came from) and carry fixes over by hand. `herdr-app-arrange` and `herdr-app-autoname` edit herdr-core's undocumented layout document; after a core update, a format change makes them refuse without writing. To move git-graph or automations to a newer upstream release, review it and repeat section 6's copy with the new pin. Repeat the acceptance checks affected by each upgrade.

### Coverage map for future maintainers

Use this table when adding files. Every new runtime file, dependency, or config reference needs an install destination, activation step, and verification here. Tests, licenses, demo assets, CI/release files, and plugin development docs remain in the checkout; they are not separately installed as home configuration.

| Repository area | Destination / disposition | Steps |
|---|---|---|
| `claude-code/config/` | `~/.claude/`; alias via shared shell config | 4, 7 |
| `claude-code/custom/statusline/` | statusline at `~/.claude/`, Python helpers in `~/.claude/bin/`; test stays in repo | 4, 9, 11 |
| `claude-code/custom/shortcuts/` | `~/.local/bin/claude-cycle-effort`; used by the legacy router | 4, L2 |
| `claude-code/custom/workflows/` | `~/.claude/workflows/`; runtime availability must be checked | 4, 10 |
| `codex/config/` | `~/.codex/`, shared instruction link, theme; alias via shell config | 4, 5, 7 |
| `codex/patches/` | tested source build and managed launcher outside npm | 9 |
| `ghostty/config/`, `ghostty/helpers/` | `~/.config/ghostty/config`, shell aliases, `~/.local/bin/`; helpers prefer `herdr-app-grid` | 7, 11 |
| `herdr-app/home/` | copied into `~/.config/herdr-app/`; `settings.json` and `keys.json` merged, never symlinked | 6, 7, 11 |
| `herdr-app/bin/` | `~/.local/bin/` | 6, 11 |
| `herdr-app/automations/` | `~/.config/herdr/plugins/config/dnzzl.automations/`; login service optional | 6, 10 |
| `herdr-app/servers.example.json` | the start of `~/.config/herdr-app-servers/projects.json`, which becomes the owner's own | 6 |
| Upstream git-graph and automations (pinned, not in this repo) | mod folders copied into `~/.config/herdr-app/mods/`; CLI copied to `~/.local/bin/` | 6, 10, 11 |
| `herdr/config/`, `herdr/agent-detection/` (legacy) | `~/.config/herdr/`; activate after plugin installation | L2, L3 |
| `herdr/helpers/`, `herdr/lib/` (legacy) | `~/.local/bin/` and `~/.local/lib/herdr-arrange/`; collector optional | L2, L5 |
| `herdr/shortcuts/` (legacy) | `~/.config/herdr/shortcuts/`; stock/patched Codex distinction | L2, 9 |
| `herdr/extensions/custom/herdr-attention/` (legacy) | copied to `~/.config/herdr/plugins/local/herdr-attention`, then linked | L2, L3 |
| Other `herdr/extensions/custom/` directories (legacy) | linked permanent checkout; copy-search built locally | L2, L3 |
| `herdr/patches/` (legacy) | optional pinned builds; 0.8.2 search patch retained only as history | L4 |
| `pi/config/` | agent settings/keys/theme/instruction link; runtime UI at `~/.pi/settings.json`; shell wrapper | 4, 7 |
| `pi/extensions/custom/` | contents copied directly under `~/.pi/agent/extensions/` | 7 |
| `pi/extensions/package*.json` | extension root manifests; also install nested claude-compat dependencies | 7 |
| `pi/helpers/` | `~/.local/bin/`; archive activation separate; `herdr-usage` fetches for the app's Usage block and feeds the legacy sidebar | 7, 10, L5 |
| Both `EXTERNAL-EXTENSIONS.md` inventories | install/reconcile package and marketplace state through each manager | 8 |
| `README.md`, `SHORTCUTS.md`, `LICENSE`, development/test/demo metadata | reference material in permanent checkout | 11, 12 |

## Appendix L. Legacy Herdr 0.9.0 (TUI)

**Legacy.** This is the setup for the old terminal-UI Herdr 0.9.0. It runs inside Ghostty, with its config at `~/.config/herdr/config.toml` and plugins under `~/.config/herdr/plugins/`. A new machine uses the Herdr app instead (sections 3, 6 and 7). Keep this appendix for a machine that still runs the old Herdr, or to reproduce it. The text below is the September 17 audit's, with only its headings and section references updated, and it was not rehearsed again. The old `herdr` and the Herdr app (`herdr-app`, `hc`) are separate programs that share no agents, so they can be installed side by side.

Its extra prerequisites, after sections 1 and 2:

```sh
brew install fzf terminal-notifier
mkdir -p "$HOME/.local/lib/herdr-arrange" "$HOME/.config/herdr/shortcuts" \
  "$HOME/.config/herdr/agent-detection" "$HOME/.config/herdr/plugins/local"
```

`bat` is optional for Openr previews.

### L1. Install the Herdr 0.9.0 binary

On a fresh machine, install the [0.9.0 release](https://github.com/herdrdev/herdr/releases/tag/v0.9.0) to match this export. These macOS asset digests were verified from GitHub's release metadata when this guide was written:

```sh
case "$(uname -m)" in
  arm64)
    AI_ENV_HERDR_ASSET=herdr-macos-aarch64
    AI_ENV_HERDR_SHA=32b53df09872628059c789a69f02a6b8e29e14ddf26711421f3463f70c1aef17
    ;;
  x86_64)
    AI_ENV_HERDR_ASSET=herdr-macos-x86_64
    AI_ENV_HERDR_SHA=d0c920b2a126a74809fa1491411c9a097a44786cac9c2ca51b818a995581cf16
    ;;
  *) echo 'Unsupported architecture' >&2 ;;
esac
curl -fsSL "https://github.com/herdrdev/herdr/releases/download/v0.9.0/$AI_ENV_HERDR_ASSET" \
  -o "$AI_ENV_BACKUP/herdr-download"
test "$(shasum -a 256 "$AI_ENV_BACKUP/herdr-download" | awk '{print $1}')" = "$AI_ENV_HERDR_SHA"
chmod +x "$AI_ENV_BACKUP/herdr-download"
put_file "$AI_ENV_BACKUP/herdr-download" "$HOME/.local/bin/herdr"
herdr --version
```

For an intentionally chosen newer installation, the [official installer](https://herdr.dev/) instead downloads the current release. Download and inspect it before execution:

```sh
curl -fsSL https://herdr.dev/install.sh -o "$AI_ENV_BACKUP/herdr-install.sh"
```

After inspection, and only if choosing that alternative:

```sh
sh "$AI_ENV_BACKUP/herdr-install.sh"
herdr --version
```

If the result is newer than 0.9.0, validate config and plugins against it. Do not apply 0.9.0 source patches to that binary or newer source. For the exact patched baseline, L4 builds 0.9.0 from its pinned source separately. Retain a stock executable before changing the launcher.

Do not launch Herdr until the shell environment in section 7 is ready. Its server retains its startup environment; changing your current terminal's PATH does not update an already-running server.

### L2. Install its runtime dependencies before its config

#### Helpers, library, shortcuts, and Claude detector

```sh
for name in herdr-agent-view herdr-move-tab herdr-arrange herdr-codex-usage; do
  put_file "$AI_ENV_REPO/herdr/helpers/$name" "$HOME/.local/bin/$name" || break
  chmod +x "$HOME/.local/bin/$name"
done
for name in arrange.py test_arrange.py test_live.py order_cases.py README.md; do
  put_file "$AI_ENV_REPO/herdr/lib/herdr-arrange/$name" "$HOME/.local/lib/herdr-arrange/$name" || break
done
put_file "$AI_ENV_REPO/herdr/shortcuts/cycle-effort.py" "$HOME/.config/herdr/shortcuts/cycle-effort.py"
put_file "$AI_ENV_REPO/herdr/shortcuts/test_cycle_effort.py" "$HOME/.config/herdr/shortcuts/test_cycle_effort.py"
new_config "$AI_ENV_REPO/herdr/agent-detection/claude.toml" "$HOME/.config/herdr/agent-detection/claude.toml"
```

If any loop failed, resolve it before proceeding. The arranger needs its adjacent library at `~/.local/lib/herdr-arrange`; copying only its launcher will fail.

**Codex compatibility:** the router identifies the foreground executable against
`~/.local/share/codex-shortcuts/capabilities.json`. Recognized managed builds get
full cycling; stock or unrecognized sessions get Alt+. (increase only, without
Max/Ultra wrapping). Missing or unreadable metadata uses that fallback. There is
no manual router edit or temporary PID list. Install the managed build in section 9.


#### Attention plugin

```sh
mkdir -p "$HOME/.config/herdr/plugins/local/herdr-attention"
for name in herdr-plugin.toml notify.py test_notify.py README.md; do
  put_file "$AI_ENV_REPO/herdr/extensions/custom/herdr-attention/$name" \
    "$HOME/.config/herdr/plugins/local/herdr-attention/$name" || break
done
```

This plugin requires Python, `terminal-notifier`, `/usr/bin/afplay`, and `/System/Library/Sounds/Ping.aiff`. Set the manifest's Python command to the absolute Homebrew Python path if the server cannot resolve it. The plugin must be linked and enabled in L3 **before** applying the config that disables built-in alerts.

#### Build copy-search

```sh
(
  cd "$AI_ENV_REPO/herdr/extensions/custom/herdr-copy-search" || exit
  cargo build --release --locked
)
test -x "$AI_ENV_REPO/herdr/extensions/custom/herdr-copy-search/target/release/herdr-copy-search"
```

`herdr plugin link` does not build it. Keep the built checkout in place. Use this bundled source, not an upstream reinstall that may replace local behavior. Pane-mover needs Node but no npm dependencies; Openr needs Python, zsh, jq, and fzf. Registration follows in L3.

### L3. Start Herdr and register plugins

Start `herdr` in the new Ghostty terminal, using its existing/default config initially. Keep the setup shell available in a separate pane or terminal. Register the local plugins and the pinned external layout plugin:

```sh
herdr plugin link "$HOME/.config/herdr/plugins/local/herdr-attention"
herdr plugin enable mitchnick.attention
herdr plugin link "$AI_ENV_REPO/herdr/extensions/custom/herdr-pane-mover"
herdr plugin enable osamahbeig.pane-mover
herdr plugin link "$AI_ENV_REPO/herdr/extensions/custom/herdr-openr"
herdr plugin enable openr
herdr plugin link "$AI_ENV_REPO/herdr/extensions/custom/herdr-copy-search"
herdr plugin enable copy-search
herdr plugin install edouard-andrei/herdr-layout-tools --ref 826364134071e470f1d54e69b8ab8dfd49972477
herdr plugin enable edi.layout-tools
herdr plugin list
```

Verify all five IDs are enabled. Do not follow the original Openr README's upstream quick-start or automatic key installer; the bundled adaptation supplies Codex transcript support and this repo already supplies its keybindings. Likewise use the bundled pane-mover: its `open-tabs` action is a local addition.

**Only after attention is enabled**, install/merge the Herdr config:

```sh
new_config "$AI_ENV_REPO/herdr/config/config.toml" "$HOME/.config/herdr/config.toml"
herdr config check
herdr server reload-config
herdr server reload-agent-manifests
"$HOME/.local/bin/herdr-agent-view" rest
```

Before reloading, verify the absolute Python path in the Cmd+Shift+E command and the socket paths in the arranger commands. The export targets the default local `~/.config/herdr/herdr.sock`. For another session, update those paths; agent-view and tab-movement helpers also target the default local socket. Do not apply default-session commands to an unrelated session.

`herdr-agent-view rest` sets transient stable ordering; repeat after a server restart. The detector override shadows upstream Claude rules. On a newer Herdr version, compare with its upstream manifest and merge relevant updates or retire the override if the fix is already present.

Config and detector reloads need no server restart. For an already-running server with a stale PATH, prefer absolute interpreters in manifests/bindings. A planned server environment refresh is separate and must preserve the user's running work.

### L4. Machine headers and pinned usage section (optional build)

Never apply the historical `native-search-scrollback-v0.8.2.patch` to 0.9.0 or downgrade a server for it. Herdr 0.9.0 already has native literal search via Ctrl+B, [, /; copy-search adds regex and extraction.

Use either the machine-header patch alone or both patches in this order. The following builds both; omit the two usage-patch application commands for headers only:

```sh
brew install zig@0.15
rustup toolchain install 1.96.1
export ZIG="$(brew --prefix zig@0.15)/bin/zig"
"$ZIG" version
git clone --branch v0.9.0 --single-branch https://github.com/herdrdev/herdr.git "$HOME/Projects/herdr-custom-source"
(
  set -e
  cd "$HOME/Projects/herdr-custom-source"
  git checkout --detach b99002ac99b09e00b4ca692436cb15a6b0d676f1
  git apply --check "$AI_ENV_REPO/herdr/patches/machine-headers-v0.9.0.patch"
  git apply "$AI_ENV_REPO/herdr/patches/machine-headers-v0.9.0.patch"
  git apply --check "$AI_ENV_REPO/herdr/patches/usage-section-v0.9.0.patch"
  git apply "$AI_ENV_REPO/herdr/patches/usage-section-v0.9.0.patch"
  cargo +1.96.1 fmt --check
  just build
  cargo +1.96.1 test --release --locked --bin herdr client::shell
  cargo +1.96.1 test --release --locked --bin herdr config::sidebar
)
```

Stop if Zig is not 0.15.2; obtain the pinned release before building. The checkout's toolchain file selects Rust 1.96.1 for `just build`. Keep patch files/guides available in this checkout or copy the selected pairs into `~/.config/herdr/patches` for maintenance.

Install to a **new** executable path to avoid macOS signature failures from in-place overwrites:

```sh
test ! -e "$HOME/.local/bin/herdr-custom-0.9.0"
install -m 755 "$HOME/Projects/herdr-custom-source/target/release/herdr" "$HOME/.local/bin/herdr-custom-0.9.0"
"$HOME/.local/bin/herdr-custom-0.9.0" --version
cp -pL "$(command -v herdr)" "$AI_ENV_BACKUP/herdr-before-custom"
save_existing "$HOME/.local/bin/herdr"
ln -sfn "$HOME/.local/bin/herdr-custom-0.9.0" "$HOME/.local/bin/herdr"
```

Use a new backup filename for subsequent builds; do not overwrite the stock copy with a custom binary. These client patches match the pinned server's protocol. Do not assume a custom 0.9.0 client can attach to a newer server; compare versions/protocol first. Keep running panes intact and record any required planned migration.

For the pinned usage section, move the four custom-token rows (5h, 7d, fable, openai) from `[ui.sidebar.spaces].rows` into a new `[ui.sidebar.usage]` with `label = "usage"`. Keep the `state_icon`/`workspace` row in spaces. Use the same token names from the exported config. Without a token publisher, no usage block appears. Headers-only and stock binaries must not receive this new table.

Run `herdr config check`. Use the sidebar **menu → detach**, then launch `~/.local/bin/herdr` to load the client. Config reload cannot load compiled rendering changes. No server restart is needed for a compatible client patch. An older stock server may warn that `ui.sidebar.usage` is unknown on config reload; clearing that server warning is a separate planned upgrade. Detailed rendering/compatibility evidence lives in [the usage patch notes](herdr/patches/usage-section-v0.9.0.md).

### L5. Account usage in the sidebar (optional)

The actual export **does include** `pi/helpers/herdr-usage`, despite older Herdr prose saying the publisher is excluded. [Section 10](#account-usage) schedules it for the Herdr app; a legacy machine uses the private runner below instead, because publishing also needs the paths and collector it sets. That publisher reads Claude login credentials and Pi's OpenAI login when refreshing usage; never run it with shell tracing. Its default Pi search only checks nvm directories, so supply `PI_BIN` explicitly for the wrapper installed here.

To enable usage, confirm logins and Herdr's socket first, then set absolute executable paths in the private shell environment or runner:

```sh
export HERDR_BIN="$HOME/.local/bin/herdr"
export PI_BIN="$HOME/.local/bin/pi"
export CODEX_BIN="$(command -v codex)"
"$HOME/.local/bin/herdr-codex-usage"
"$HOME/.local/bin/herdr-usage"
```

Use the Codex collector **before** the publisher: it updates `~/.pi/agent/openai-usage-cache.json` through Codex's login, allowing the publisher's Pi fallback to stay unused while that cache is fresh. Claude's separate usage cache is `~/.claude/usage-cache.json`. No account data belongs in the repo. Check cache freshness and rendered tokens without printing credentials or raw account payloads. These internal usage endpoints can change; keep the feature outstanding if real responses no longer match the helper.

For periodic updates, create a private executable runner under `~/.local/bin` that sources `~/.config/ai-dev-environment/shell.zsh`, exports the absolute `HERDR_BIN`, `PI_BIN`, `CODEX_BIN`, `PI_NODE_BIN`, `PI_CLI_PATH`, and `HERDR_SOCKET_PATH`, runs the collector first, then the publisher. Give it an explicit PATH including the selected Node, Homebrew Python/jq, and system tools. A LaunchAgent does not inherit the interactive terminal environment.

Create a user plist under `~/Library/LaunchAgents/` with a unique label, `KeepAlive` true, `RunAtLoad` true, and `ProgramArguments` of `/bin/bash -c 'while true; do <runner>; sleep 120; done'` with the runner's absolute path. Do not use `StartInterval`: macOS can silently stop re-arming it while `launchctl` still reports the job as healthy. With the loop, the job has a live PID, so `launchctl print gui/$(id -u)/<label>` showing a `pid` is a real health check. Use `plutil -lint`, then `launchctl bootstrap gui/$(id -u) <absolute-plist-path>` and `launchctl kickstart gui/$(id -u)/<label>`. Replace the angle-bracket placeholders first. Record label/path for rollback; do not overwrite an existing job. Verify a scheduled run refreshes the cache and visible tokens. The publisher returns early without a socket or workspace, so exit status alone is insufficient. It publishes on the selected/last local workspace; a patched sidebar can display those tokens once. Stock config displays them in workspace rows.

### L6. Legacy checks

```sh
whence -a herdr
herdr --version
herdr plugin list
herdr config check
python3 -c 'import pathlib, tomllib; tomllib.load((pathlib.Path.home() / ".config/herdr/config.toml").open("rb")); print("Herdr TOML OK")'
```

Confirm every active `keys.command` in Herdr resolves to an installed helper or enabled plugin action.

```sh
cd "$AI_ENV_REPO"
python3 -B -m unittest discover -s herdr/extensions/custom/herdr-attention -p test_notify.py -v
python3 -B -m unittest discover -s herdr/lib/herdr-arrange -p test_arrange.py -v
python3 -B -m unittest discover -s herdr/agent-detection -p test_claude.py -v
python3 -B -m unittest discover -s herdr/extensions/custom/herdr-openr -p 'test_*.py' -v
python3 -B -m unittest discover -s herdr/shortcuts -p test_cycle_effort.py -v
python3 -B -m unittest discover -s herdr/helpers -p test_codex_usage.py -v
(cd "$AI_ENV_REPO/herdr/extensions/custom/herdr-copy-search" && cargo test --locked)
```

The router tests cover managed and stock sessions, replaced binaries, and failed detection. Verify the shortcut in a resumed managed session as well. The notification and usage tests mock external delivery/API behavior; passing them does not prove real banners or live account access. For stronger arranger coverage, `python3 -B herdr/lib/herdr-arrange/test_live.py` starts its own named server and PTY; run only when ready for that isolated integration test. It must not target the user's active session.

- [ ] Herdr Cmd+D / Cmd+Shift+D split; Cmd+T creates a tab; Cmd+] / Cmd+[ move focus; rename, tab movement, workspace selection, and agent navigation work. Use [SHORTCUTS.md](SHORTCUTS.md) as the complete shortcut reference. Prefix fallbacks work, especially over SSH where native Cmd chords may not survive.
- [ ] Pane-mover Cmd+M opens the tab list; Cmd+Shift+M opens the root menu. A scratch pane moves successfully. Main-grid/equalize/editor actions resolve through layout-tools.
- [ ] Cmd+Shift+R and Cmd+Ctrl+R arrange scratch panes into wide/laptop layouts without losing running processes; repeating the same layout is harmless.
- [ ] Cmd+K opens Openr in a Claude/Codex session containing a harmless assistant URL. Enter opens, Ctrl+Y copies, Escape closes. Test mouse interaction physically if required. A missing local transcript falls back to visible text; do not infer remote transcript access.
- [ ] Cmd+Shift+F searches through copy-search; Cmd+Shift+C opens its copy mode; Cmd+Shift+X extracts tokens; copying reaches the macOS clipboard. Ctrl+B, [, / still provides native literal search. Ghostty Cmd+F searches the outer terminal, not the whole Herdr pane history.
- [ ] During work, idle, and a harmless input/approval prompt, the sidebar classifies states correctly. Each sustained blocked cycle produces **one** audible Ping and **one** visible popup, including in a focused pane. Completion produces neither. Check terminal-notifier notification permissions and macOS Focus if presentation fails. Clicking the popup activates Ghostty.
- [ ] After opening a new terminal and reattaching Herdr, PATH, wrapper, themes, plugin links, and instructions still work. Reapply `herdr-agent-view rest` after an actual server restart.

If a layout operation fails with panes in an `arranging panes` tab, keep that tab open and recover with pane-mover. The arranger writes recovery/error files under the system temporary directory. Do not use `layout.apply` for recovery; it can recreate terminals.

### L7. Legacy rollback

- Before disabling attention, restore Herdr's prior built-in notification delivery/sound so blocked alerts do not disappear. Then disable unwanted plugin IDs, restore config/detector, and reload both.
- Restore/relink Herdr's stock executable and detach/relaunch. Remove `[ui.sidebar.usage]` when returning to a stock/header-only client. Keep existing panes and any newer server protocol constraints in mind.
- For an optional usage job, `launchctl bootout gui/$(id -u)/<label>` using the recorded label, then remove only its own plist/runner. Do not remove other LaunchAgents.

Herdr updates require reviewing both pinned source patches and the detector override. Relink plugins if this checkout moves and rebuild copy-search if its source changes.
