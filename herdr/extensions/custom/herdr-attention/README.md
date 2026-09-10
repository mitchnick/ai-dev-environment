# Needs Input Only

One ding and desktop popup when an agent needs input; completion stays in the sidebar. Requires Herdr 0.9.0 or later, Python 3, macOS `/usr/bin/afplay` and its Ping sound, `terminal-notifier`, and Ghostty for click activation.

The `pane.agent_status_changed` handler ignores every state except `blocked`. It waits one second, then checks the pane's terminal identity and state-change sequence against a fresh snapshot. A file lock and saved token deduplicate concurrent or repeated reports of one blocked cycle. A later blocked cycle can alert again. Focused panes also alert. This delay affects notifications, not sidebar detection.

## Install before disabling built-in alerts

From the repository root:

```sh
brew install python terminal-notifier
mkdir -p "$HOME/.config/herdr/plugins/local/herdr-attention"
cp herdr/extensions/custom/herdr-attention/herdr-plugin.toml \
  herdr/extensions/custom/herdr-attention/notify.py \
  herdr/extensions/custom/herdr-attention/test_notify.py \
  herdr/extensions/custom/herdr-attention/README.md \
  "$HOME/.config/herdr/plugins/local/herdr-attention/"
herdr plugin link "$HOME/.config/herdr/plugins/local/herdr-attention"
herdr plugin enable mitchnick.attention
herdr plugin list
```

Confirm the plugin is enabled and Python 3 is on the Herdr server's PATH. If needed, set the manifest's interpreter to the absolute path returned by `command -v python3` on your machine. The notifier lookup checks PATH, both Homebrew prefixes, and a home-relative Ruby gem fallback.

Only after installing and enabling the plugin, merge these settings into your config (or follow the [full setup](../../../README.md)):

```toml
[ui.toast]
delivery = "off"
delay_seconds = 1

[ui.sound]
enabled = false
```

```sh
herdr config check
herdr server reload-config
```

Herdr 0.9.0's built-in alerts include completion, so the plugin and disabled built-in delivery form one setup. If you disable or remove the plugin later, restore your preferred built-in delivery first to retain needs-input alerts. Generate registration with `plugin link`; do not copy another machine's `plugins.json`.

## Presentation and state

The popup uses terminal-notifier's own identity. Clicking it activates Ghostty; it does not navigate to a specific pane. The title identifies the agent and the body identifies its workspace, tab, and pane. The handler reads agent metadata, not terminal text. Runtime deduplication files live in `HERDR_PLUGIN_STATE_DIR`, falling back to `~/.local/state/herdr-attention`; keep them out of the repository.

The source setup's popup and sound commands exited successfully, but actual macOS popup presentation has **not been visually confirmed**. Allow notifications for terminal-notifier and check macOS Focus settings. A successful command exit alone does not prove that a banner appeared. The public export's tests mock delivery and do not display popups or play sound.

## Test

```sh
python3 -B -m unittest discover -s herdr/extensions/custom/herdr-attention -p test_notify.py -v
```

The plugin is independent of harness hooks and has no daemon. Herdr updates preserve local plugins; review compatibility after updates.
