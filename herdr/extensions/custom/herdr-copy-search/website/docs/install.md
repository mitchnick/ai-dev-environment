---
icon: lucide/download
---

# Install

```sh
herdr plugin install qq88976321/herdr-copy-search   # from a git host
# or for local development:
herdr plugin link /path/to/herdr-copy-search
cargo build --release --locked                   # link does not run build steps
```

There is no separate plugin update in v1; reinstall from the git host
to refresh a managed plugin.

## Keybindings

Bind keys in `~/.config/herdr/config.toml` (reload with
`herdr server reload-config`):

```toml
[[keys.command]]
key = "prefix+["
type = "shell"
command = "herdr plugin pane open --plugin copy-search --entrypoint copy"

[[keys.command]]
key = "prefix+/"
type = "shell"
command = "herdr plugin pane open --plugin copy-search --entrypoint search"

[[keys.command]]
key = "prefix+tab"
type = "shell"
command = "herdr plugin pane open --plugin copy-search --entrypoint extract"
```

If your herdr build supports `type = "plugin_action"` bindings, the plugin
also exposes `copy-search.copy`, `copy-search.search`, and
`copy-search.extract` actions that open the same panes.

## Recommended herdr settings

!!! tip "A more in-place look"

    The plugin opens as a herdr overlay pane, which herdr renders
    full-window with a border. Setting `pane_borders = false` under
    `[ui]` in your herdr config removes that frame for a more in-place
    feel. It is a global herdr setting, so it also hides split-pane
    dividers - it suits one-pane-per-tab layouts best.
