# Claude screen spinner override

`claude.toml` is override version `2026.09.10.1`, based on upstream manifest `2026.09.04.1` (Herdr detection engine 2). The change adds `\x{2733}` (`✳`) to exactly three **screen working** character classes: `live_turn_working`, `background_agents_working`, and `background_mcp_task_working`.

The omitted animation frame could make active Claude work alternate between working and idle; unseen idle appears as done. The OSC title idle rule still recognizes `✳` unchanged. Screen activity and terminal titles are separate signals.

## Install

From the repository root, review any existing local override before replacing it:

```sh
mkdir -p "$HOME/.config/herdr/agent-detection"
cp herdr/agent-detection/claude.toml "$HOME/.config/herdr/agent-detection/claude.toml"
herdr server reload-agent-manifests
```

Reloading manifests does not require restarting Herdr or agents.

## Maintain after updates

Local overrides shadow upstream manifests, including newer releases. After updating Herdr or its manifests, compare this file with the new upstream Claude rules (normally cached at `~/.local/state/herdr/agent-detection/remote/claude.toml`). Merge relevant improvements, or retire the local override once upstream covers the fix. Reload manifests after either action. Do not keep this version pinned without review.

Check ongoing work across all spinner frames, a genuinely idle prompt, and an approval dialog. These checks cover the known animation bug; future Claude UI changes may need different rules.

```sh
python3 -B -m unittest discover -s herdr/agent-detection -p test_claude.py -v
```

The offline checks load the exported TOML and exercise its affected regexes with synthetic text. They translate Rust Unicode escapes for Python's regex engine; they do not emulate Herdr's region selection or full detection engine.
