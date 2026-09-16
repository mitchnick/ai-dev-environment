# Openr: local Claude and Codex adaptation

Based on [wraithyy/herdr-openr](https://github.com/wraithyy/herdr-openr), upstream
commit `12089bf35bd0f47923adc245aaa0181ab5b3ff32` (0.3.0), MIT licensed.

Installed as a linked local plugin, so upstream updates do not overwrite the
Codex adapter. Keep this directory in place or relink after moving the checkout.

## Daily use

- **Cmd+K**, or **Ctrl+B then U**: numbered URL picker for the current pane.
- Type part of a URL or its displayed number to filter; arrows select.
- **Enter** or **double-click**: open the selected URL in the default browser.
- **Ctrl+Y**: copy the selected URL, without its displayed number.
- **Escape**: close and return to the conversation.

Reads assistant text from the current Claude or Codex session transcript,
including URLs hidden by Markdown rendering. Newest messages come first;
duplicate URLs appear once. Only the selected session is read. User messages,
reasoning, and tool output are excluded. If a local transcript is unavailable,
it falls back to visible pane text. Remote transcripts must exist on the
machine running the plugin; otherwise only visible URLs can be recovered.

The default window is the last 1,000 JSONL records, not the entire session.
Increase `transcript_lines` in `~/.config/herdr/plugins/config/openr/openr.conf`
if needed. Codex uses `CODEX_HOME` or `~/.codex`; Claude uses
`CLAUDE_CONFIG_DIR` or `~/.claude`. These variables must be available to Herdr.

The original mixed file/URL actions remain available (`openr.pick`,
`openr.pick-visible`, `openr.pick-transcript`). Cmd+K uses `openr.pick-links`.
Automatic startup key installation is disabled; the exported Herdr config
contains the explicit bindings. The optional upstream `install-keybind` action
is not needed with this configuration.

## Install

Requires Herdr, Python 3, zsh, jq and fzf. On macOS:

```sh
brew install fzf
herdr plugin link "$PWD/herdr/extensions/custom/herdr-openr"
herdr plugin enable openr
```

Merge the Openr bindings from `herdr/config/config.toml`, then run
`herdr config check` and `herdr server reload-config`. No agent restart is needed.

## Validation

```sh
python3 -B -m unittest discover -s herdr/extensions/custom/herdr-openr -p 'test_*.py' -v
```

Tests cover transcript routing/filtering, deduplication, Markdown URL handling,
and real fzf interaction in a PTY. Browser and clipboard commands are intercepted
in tests. Live Claude and Codex transcript extraction and Herdr popup process
launch were also checked during installation. Physical mouse and Cmd+K input
must be checked in the user's terminal.

---

## Original upstream documentation

# herdr-openr

Jump to what your agent just did. One keypress → fuzzy picker over the
files and URLs the current pane mentioned. URLs open in your browser,
files in your editor at the right line — or reveal them in Finder /
your file manager, or copy the path.

![openr demo](assets/demo.gif)

Two modes, two keys: `prefix+o` scans the **visible viewport** of any pane;
`prefix+shift+o` reads the **Claude session transcript**
(`~/.claude/projects/<project>/<session>.jsonl`, resolved via the herdr
API) — exact paths from every Edit/Write/Read tool call, whole session
history, zero pane reads. Paths that don't exist are dropped.

There's also `openr.pick` (auto: Claude pane → transcript, otherwise
viewport) if you prefer one key for both — bind it yourself (example in
`herdr-plugin.toml`).

## Quick start

```bash
herdr plugin install wraithyy/herdr-openr
herdr plugin action invoke openr.install-keybind   # binds the keys now
```

The second command is optional — a startup hook binds `prefix+o` (visible)
and `prefix+shift+o` (transcript) by itself on the next herdr server start.
(prefix = herdr's leader key, ctrl+b by default. Different keys? Add your
own `[[keys.command]]` entries to `~/.config/herdr/config.toml` — the hook
never touches existing bindings.)

Needs `zsh`, `fzf`, `jq` (`bat` optional, nicer preview). macOS + Linux.

## Keys

| key | action |
|---|---|
| `enter` | URL → browser · file → editor at line |
| `ctrl-f` | reveal in Finder / open containing dir (Linux) |
| `ctrl-y` | copy path/URL |
| `esc` | cancel |

## Configure

Optional — `~/.config/herdr/plugins/config/openr/openr.conf`:

```sh
file_cmd='nvim +{line} {file}'   # bare {file}/{url}: values are pre-escaped
file_open_in="tab"               # "tab" herdr tab | "detached" GUI editors
url_cmd=""                       # empty = open / xdg-open
preview="1"
scan_source="visible"            # non-agent panes; recent* scrolls the pane
scan_lines=400
transcript_lines=1000            # agent panes

# VS Code:  file_open_in="detached"; file_cmd='code --goto {file}:{line}'
# Zed:      file_open_in="detached"; file_cmd='zed {file}:{line}'
# Helix:    file_open_in="tab";      file_cmd='hx {file}:{line}'
# IntelliJ: file_open_in="detached"; file_cmd='idea --line {line} {file}'
#   (needs the `idea` shell launcher; macOS without it:
#    file_cmd='open -na "IntelliJ IDEA" --args --line {line} {file}')
```

Popup size: `OPENR_WIDTH` / `OPENR_HEIGHT` (default `75%` / `60%`).

## Troubleshooting

- Key does nothing → check `herdr server reload-config` errors, `fzf`/`jq`
  on PATH; failures show an "openr" toast.
- Nothing opens over another popup/overlay — herdr allows one at a time.
- Paths with spaces are not detected (known limit).
- `~/.config/herdr/plugins/config/openr/last.log` = last dispatched
  command, `last-source.log` = last scanned pane + source.

## Prior art

Inspired by [termscope](https://github.com/iurysza/termscope), which pioneered
the "open what's on screen" jump list for herdr. openr grew out of wanting a
different shape of the same idea: Claude transcript as the primary source
instead of the viewport, a popup picker, and a configurable editor command
instead of a fixed nvim split.

## License

[MIT](LICENSE)
