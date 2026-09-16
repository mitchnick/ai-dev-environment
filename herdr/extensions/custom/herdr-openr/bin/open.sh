#!/usr/bin/env bash
set -euo pipefail
herdr_bin="${HERDR_BIN_PATH:-herdr}"
root="${HERDR_PLUGIN_ROOT:-$(cd -- "$(dirname -- "$0")/.." && pwd)}"
ctx="${HERDR_PLUGIN_CONTEXT_JSON:-}"
[ -n "$ctx" ] || ctx='{}'
fail() { "$herdr_bin" notification show openr --body "$1" >&2; exit 1; }
pane_id="$(printf '%s' "$ctx" | jq -r '.focused_pane_id // empty')"
cwd="$(printf '%s' "$ctx" | jq -r '.focused_pane_cwd // .workspace_cwd // empty')"
[ -n "$pane_id" ] || fail 'Could not resolve the focused pane'
[ -d "$cwd" ] || cwd="$HOME"
transcript_lines=1000
conf="$HOME/.config/herdr/plugins/config/openr/openr.conf"
[ ! -r "$conf" ] || . "$conf"
list="$(mktemp "${TMPDIR:-/tmp}/openr.XXXXXX")"
trap 'rm -f "$list"' EXIT
python3 "$root/bin/candidates.py" --pane "$pane_id" --cwd "$cwd" --mode "${1:-auto}" --lines "$transcript_lines" > "$list" || fail 'Could not read pane links'
[ -s "$list" ] || { "$herdr_bin" notification show openr --body 'No links or files found in this session'; exit 0; }
"$herdr_bin" plugin pane open --plugin openr --entrypoint picker --placement popup \
  --width "${OPENR_WIDTH:-85%}" --height "${OPENR_HEIGHT:-65%}" \
  --env "OPENR_LIST=$list" --env "OPENR_PANE=$pane_id" --env "OPENR_CWD=$cwd" --focus
trap - EXIT
