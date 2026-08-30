---
icon: lucide/keyboard
---

# Modes

## Search / copy mode

Opens an overlay over the focused pane showing its recent scrollback (the
herdr server caps pane reads at about 1000 lines). The `search` entrypoint
opens with the search prompt active; committing a search lands in copy
mode on the match - no scrolling - to refine the selection and yank. The
`copy` entrypoint is the same view opened idle.

| Keys | Action |
| --- | --- |
| `h j k l`, arrows | move (a column count is kept across short lines) |
| `w b e`, `{ }` | word and paragraph motions |
| `0 ^ $`, `g G` | line start/end, buffer top/bottom |
| `ctrl+f/b/d/u`, PgUp/PgDn | page and half-page |
| `/` `?` | incremental regex search down / up (invalid regex falls back to literal) |
| in prompt: `Left/Right`, `Home/End`, `Delete` | edit the query, readline-style: `ctrl+a/e` line ends, `ctrl+b/f` char, `ctrl+left/right` word, `ctrl+w` delete word, `ctrl+k` kill to end, `ctrl+d` delete, `ctrl+u` clears |
| `n` `N` | next / previous match in search direction |
| `S` | toggle smartcase (default on: an all-lowercase query ignores case, any uppercase is case-sensitive; off is always case-sensitive) |
| `v` `V` | charwise / linewise selection |
| `iw aw iW aW` | select the word / WORD text object under the cursor (works after `v` or on its own) |
| `y` | copy selection, or the match under the cursor |
| `Enter` | copy the selection or the match under the cursor and exit; with nothing to copy, just exit |
| `p` | pattern menu: `[u]rl [f]ile [g]it-sha [i]p [d]igits [q]uoted` |
| `alt+u/f/g/i/d/q` | activate a pattern directly |
| mouse | wheel scrolls; click moves; drag selects and copies on release; double-click selects the WORD under the pointer, triple-click the whole (soft-wrap joined) line - both copy on release. A mouse copy keeps the selection highlighted (`Esc` clears it) |
| `q`, `Esc`, `ctrl+c` | exit (Esc clears the selection or cancels the search first; ctrl+c exits from any mode) |

Pattern searches run backward from the cursor like tmux-copycat: the
nearest match above is selected and `n` walks up through older output.

### User-defined patterns

Add your own patterns, or disable defaults, in the plugin config file
(path from `herdr plugin config-dir copy-search`). A `pattern_<key>`
entry appears in the menu and on `alt+<key>`; an empty value removes a
default; reusing a default's key replaces its regex:

```toml
# $HERDR_PLUGIN_CONFIG_DIR/config.toml
pattern_t = "\\bTODO\\b"   # p then t, or alt+t
pattern_j = "\\{[^}]*\\}"  # a JSON-ish object
pattern_u = ""             # disable the built-in url pattern
```

Values are taken verbatim between the quotes (no TOML escape processing).
An invalid regex falls back to a literal search, matching the
incremental-search behavior.

### Colors

The mode badge and highlight colors can be themed in the same config file.
Each element takes an optional `_fg` and `_bg`; omit one to keep its
default. A value is a color name (`cyan`, `dark_yellow`, ...), a 0-255
palette index, or `#rrggbb` hex:

```toml
# $HERDR_PLUGIN_CONFIG_DIR/config.toml
badge_copy_bg    = "cyan"        # [copy] badge accent
badge_search_bg  = "magenta"     # [search] badge accent
match_bg         = "dark_yellow"
match_current_bg = "yellow"
cursor_bg        = "cyan"
indicator_bg     = "yellow"      # top-right position indicator
```

Colors honor `NO_COLOR`: the badge and indicator fall back to reverse
video.

## Extract mode

extrakto-style picker over the same scrollback: tokens (or whole lines)
are listed newest first and filtered with a built-in fuzzy matcher. Like
`fzf --height`, the picker occupies only the bottom of the overlay
(default 40%); the pane content stays visible above it in its original
colors.

Popup height: pass `--height PCT` in the pane command, or set it in the
plugin config file (path from `herdr plugin config-dir copy-search`):

```toml
# $HERDR_PLUGIN_CONFIG_DIR/config.toml
extract_height = 40
```

| Keys | Action |
| --- | --- |
| type / Backspace | edit the fuzzy query |
| `Left/Right`, `Home/End`, `Delete` | edit the query, readline-style: `ctrl+a/e` line ends, `ctrl+b/f` char, `ctrl+left/right` word, `ctrl+w` delete word, `ctrl+k` kill to end, `ctrl+d` delete |
| `Up`/`Down`, `ctrl+p/n` | move the selection |
| `PgUp/PgDn`, wheel over the backdrop | scroll the pane output above the popup (wheel over the list moves the selection) |
| `Enter` | insert the pick into the source pane (`herdr pane send-text`) |
| `Tab` | copy the pick via OSC 52 |
| `ctrl+t` | toggle word / line granularity |
| `ctrl+u` | clear the query |
| `Esc` | clear the query, then exit |
| `ctrl+c` | exit |

Top to bottom the picker reads: the candidate list, a dim keybind hint, a
separator rule, then the input row; a divider rule separates the pane
backdrop above from the candidates. The `[word]`/`[line]` badge and the
selected row are themable in the same config file (`_fg`/`_bg`, same value
syntax as the copy-mode colors):

```toml
# $HERDR_PLUGIN_CONFIG_DIR/config.toml
badge_word_bg       = "blue"
badge_line_bg       = "green"
extract_selected_bg = "white"
```

Extract mode follows extrakto's convention (Enter inserts, Tab copies);
copy mode follows tmux (Enter copies and exits).
