# Model and effort shortcuts

Pi's half of the shared cross-harness shortcuts. See
[`herdr/shortcuts/`](../../../../herdr/shortcuts/) for the whole picture.

| Shortcut | Action |
| --- | --- |
| Cmd+E / Alt+E | Search models, then select a supported effort |
| Cmd+Shift+E / Alt+Shift+E | Advance effort for the current model; wrap to its lowest supported level |
| Ctrl+L | Existing native model selector |
| Shift+Tab | Existing native effort cycle |
| `/model-effort` | Open the combined picker |

The picker shows scoped models when configured, otherwise available models. It
keeps the current model visible and selects it first. Type to filter; arrows and
Enter select; Escape cancels either step without applying changes. It changes the
session only after both selections, never the startup default. The editor stays
intact, including draft and cursor.

Effort cycling uses Pi's native `app.thinking.cycle` action. Aliases live in
`~/.pi/agent/keybindings.json`. Pi computes each model's supported levels — do
not hardcode a shared list. A non-reasoning model stays at `off`.

## Transport

Ghostty sends `ESC e` for Cmd+E. The shared Herdr router sends Alt+Shift+E for
Cmd+Shift+E, which can arrive as `CSI 101;4u` or legacy `ESC E`. Native `Super+e`
and `Super+Shift+e` also work when the terminal transports them.

Pi ignores legacy Alt letters in Kitty mode, and never recognizes legacy `ESC E`.
The extension normalizes exact `ESC e` and `ESC E` events to `CSI 101;3u` and
`CSI 101;4u`, leaving paste payloads and unrelated keys unchanged. The input
listener only translates bytes; it does not bypass focused selectors or trigger
model calls.

This directory owns neither Ghostty nor Herdr configuration.

## Install

```sh
mkdir -p ~/.pi/agent/extensions/model-effort-shortcuts
cp index.js ~/.pi/agent/extensions/model-effort-shortcuts/
```

Add the `app.thinking.cycle` aliases from
[`../../../config/keybindings.json`](../../../config/keybindings.json), then run
`/reload` in each existing session after saving its draft. That reloads both the
extension and the keybindings; new sessions pick them up automatically. No Pi,
terminal, or Herdr restart is required.

## Verification

Verified with real Pi subprocesses in isolated PTYs, with Kitty negotiation both
enabled and disabled. No model request was sent.

- All shortcut aliases work.
- Every supported GPT effort advances once; `max` wraps to `low`.
- An Anthropic model wraps `max` to `minimal`.
- A non-reasoning model remains `off`.
- Model search and both selection steps work, including switching providers.
- Cancel at either step preserves model, effort, and a multiline Unicode draft.
- Confirming selections and cycling preserve the draft.
- The footer renders each new effort.
- `/reload` applies the extension and keybindings in the same process.
- The suite also passes at 80 columns by 18 rows, without a pane zoom.

The implementation uses Pi APIs. It does not parse pane text or run shell
regexes.
