#!/bin/bash
# ~/.claude/statusline-command.sh
# Mirrors p10k lean style: dir  git-branch  context%  model  rate-limits

input=$(cat)

# --- Product marks + Nerd Font v3 icons (UTF-8 via octal printf) ---
icon_claude=$(printf '\356\262\202')   # U+EC82  nf-cod-claude
icon_folder=$(printf '\357\204\224')   # U+F114  folder (outline)
icon_git=$(printf    '\356\234\245')   # U+E725  git branch
icon_model=$(printf  '\363\260\231\264')   # U+F0674  nf-md-creation (sparkles)
icon_ctx=$(printf    '\342\227\213')   # U+25CB  white circle (Unicode geometric)
icon_rate=$(printf   '\357\200\227')   # U+F017  clock
icon_cal=$(printf    '\357\201\263')   # U+F073  nf-fa-calendar
icon_effort=$(printf '\363\260\223\205')   # U+F04C5  nf-md-gauge (speedometer)

# --- ANSI colors (256-color where useful) ---
RESET=$'\033[0m'
DIM=$'\033[2m'
BOLD=$'\033[1m'
BLUE=$'\033[38;5;39m'      # folder label
GREEN=$'\033[38;5;106m'    # traffic-light low  (darker lime)
PEACH=$'\033[38;5;173m'    # Claude mark / git clean (terracotta / copper)
YELLOW=$'\033[38;5;214m'   # warning / dirty    (amber gold)
RED=$'\033[38;5;197m'      # high usage  (crimson)
ORANGE=$'\033[38;5;208m'   # effort xhigh (hot)
MAGENTA=$'\033[38;5;135m'  # model       (violet)
CYAN=$'\033[38;5;45m'      # context     (bright cyan, sister of 39)
GRAY=$'\033[38;5;245m'     # separator / rate label

# Color a percentage by threshold: <50 green, <80 yellow, else red
color_pct() {
  local n=$1
  if [ "$n" -ge 80 ]; then echo "$RED"
  elif [ "$n" -ge 50 ]; then echo "$YELLOW"
  else echo "$GREEN"
  fi
}

# Color reasoning effort by level (low=cheap → max=hot, flags quota burn)
color_effort() {
  case "$1" in
    low)    echo "$GREEN" ;;
    medium) echo "$CYAN" ;;
    high)   echo "$YELLOW" ;;
    xhigh)  echo "$ORANGE" ;;
    max)    echo "$RED" ;;
    *)      echo "$GRAY" ;;
  esac
}

# Timestamp → local MM/DD.  Accepts epoch seconds (statusline payload) or
# ISO-8601 UTC (the /usage cache).  Handles BSD (macOS) and GNU date.
to_mmdd() {
  local v="$1" base epoch
  [ -n "$v" ] || return 1
  if [[ "$v" =~ ^[0-9]+$ ]]; then
    epoch="$v"
  else
    base="${v%%.*}"; base="${base%%+*}"; base="${base%%Z*}"   # drop fraction + offset
    epoch=$(date -j -u -f "%Y-%m-%dT%H:%M:%S" "$base" +%s 2>/dev/null) \
      || epoch=$(date -u -d "$base UTC" +%s 2>/dev/null) || return 1
  fi
  [ -n "$epoch" ] || return 1
  date -r "$epoch" +%m/%d 2>/dev/null || date -d "@$epoch" +%m/%d 2>/dev/null
}

sep="${GRAY} · ${RESET}"

# --- 1. Directory (basename, like p10k lean) ---
# Worktree convention: <repo>/.claude/worktrees/<name>  →  show "<repo>/<name>"
current_dir=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""')
if [ -n "$current_dir" ]; then
  if [[ "$current_dir" == *"/.claude/worktrees/"* ]]; then
    wt_name=$(basename "$current_dir")
    repo_root="${current_dir%%/.claude/worktrees/*}"
    repo_name=$(basename "$repo_root")
    folder_name="${repo_name}/${wt_name}"
  else
    folder_name=$(basename "$current_dir")
  fi
else
  folder_name="~"
fi
dir_seg="${PEACH}${icon_claude}${RESET}${sep}${BLUE}${icon_folder} ${BOLD}${folder_name}${RESET}"

# --- 2. Git branch (skip optional locks to avoid contention) ---
git_seg=""
if [ -n "$current_dir" ]; then
  branch=$(git -C "$current_dir" --no-optional-locks branch --show-current 2>/dev/null)
  if [ -n "$branch" ]; then
    dirty=$(git -C "$current_dir" --no-optional-locks status --porcelain 2>/dev/null | head -1)
    if [ -n "$dirty" ]; then
      git_seg="${sep}${YELLOW}${icon_git} ${branch} *${RESET}"
    else
      git_seg="${sep}${PEACH}${icon_git} ${branch}${RESET}"
    fi
  fi
fi

# --- 3. Model — family only (first word of display_name) ---
model=$(echo "$input" | jq -r '.model.display_name // ""')
model_seg=""
[ -n "$model" ] && model_seg="${sep}${MAGENTA}${icon_model} ${model%% *}${RESET}"

# --- 3b. Reasoning effort (absent when model lacks effort support) ---
effort_seg=""
effort=$(echo "$input" | jq -r '.effort.level // empty')
if [ -n "$effort" ]; then
  effort_color=$(color_effort "$effort")
  effort_seg="${sep}${effort_color}${icon_effort} ${effort}${RESET}"
fi

# --- 4. Context window usage ---
ctx_seg=""
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
if [ -n "$used" ]; then
  used_int=$(printf '%.0f' "$used")
  ctx_color=$(color_pct "$used_int")
  ctx_seg="${sep}${ctx_color}${icon_ctx} ${used_int}%${DIM} ctx${RESET}"
fi

# --- DISABLED: rate limits (5h / 7d / fable) and 7d reset date ---
# Uncomment sections 4b, 5, 5b below (and restore the printf args) to bring back
# the "5h:1% 7d:45% fable:32% · 08/19" tail.
#
# # --- 4b. Per-model weekly usage (Fable) ---
# # The statusline payload only carries overall 5h/7d usage. Per-model weekly
# # buckets come from the same endpoint /usage calls (GET /api/oauth/usage, OAuth
# # bearer from the keychain). Refresh a small JSON cache in the background — never
# # blocking the redraw — and read Fable's weekly % from whatever is cached.
# SCOPED_MODEL="fable"
# USAGE_CACHE="$HOME/.claude/usage-cache.json"
# USAGE_TTL=120   # refresh at most once every N seconds
#
# usage_mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0; }
#
# cache_age=999999
# [ -f "$USAGE_CACHE" ] && cache_age=$(( $(date +%s) - $(usage_mtime "$USAGE_CACHE") ))
#
# if [ "$cache_age" -ge "$USAGE_TTL" ]; then
#   touch "$USAGE_CACHE" 2>/dev/null           # claim the slot so concurrent renders don't all fetch
#   {
#     tok=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null \
#             | jq -r '.claudeAiOauth.accessToken // empty')
#     [ -z "$tok" ] && tok=$(jq -r '.claudeAiOauth.accessToken // empty' "$HOME/.claude/.credentials.json" 2>/dev/null)
#     if [ -n "$tok" ]; then
#       body=$(curl -s --max-time 5 https://api.anthropic.com/api/oauth/usage \
#               -H "Authorization: Bearer $tok" \
#               -H "Content-Type: application/json" \
#               -H "anthropic-beta: oauth-2025-04-20")
#       if printf '%s' "$body" | jq -e '.limits' >/dev/null 2>&1; then
#         printf '%s' "$body" > "$USAGE_CACHE.tmp" && mv "$USAGE_CACHE.tmp" "$USAGE_CACHE"
#       fi
#     fi
#   } >/dev/null 2>&1 &
# fi
#
# fable=""
# if [ -n "$SCOPED_MODEL" ] && [ -s "$USAGE_CACHE" ]; then
#   fable=$(jq -r --arg m "$SCOPED_MODEL" '
#     [ .limits[]?
#       | select(.kind=="weekly_scoped" and (.scope.model.display_name // "" | ascii_downcase | startswith($m)))
#       | .percent ] | first // empty' "$USAGE_CACHE" 2>/dev/null)
# fi
#
# # --- 5. Rate limits (5h, 7d, and Fable weekly when available) ---
# rate_seg=""
# five=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
# week=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
# # Early in a session the payload carries no rate_limits yet — fall back to the
# # /usage cache so 5h/7d never blink out.
# if [ -s "$USAGE_CACHE" ]; then
#   [ -z "$five" ] && five=$(jq -r '.five_hour.utilization // empty' "$USAGE_CACHE" 2>/dev/null)
#   [ -z "$week" ] && week=$(jq -r '.seven_day.utilization // empty' "$USAGE_CACHE" 2>/dev/null)
# fi
# [[ "$five" =~ ^[0-9]+(\.[0-9]+)?$ ]] || five=""
# [[ "$week" =~ ^[0-9]+(\.[0-9]+)?$ ]] || week=""
# if [ -n "$five" ] || [ -n "$week" ] || [ -n "$fable" ]; then
#   rate_seg="${sep}${GRAY}${icon_rate}${RESET}"
#   if [ -n "$five" ]; then
#     five_int=$(printf '%.0f' "$five")
#     five_color=$(color_pct "$five_int")
#     rate_seg="${rate_seg} ${GRAY}5h:${five_color}${five_int}%${RESET}"
#   fi
#   if [ -n "$week" ]; then
#     week_int=$(printf '%.0f' "$week")
#     week_color=$(color_pct "$week_int")
#     rate_seg="${rate_seg} ${GRAY}7d:${week_color}${week_int}%${RESET}"
#   fi
#   if [ -n "$fable" ] && [[ "$fable" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
#     fable_int=$(printf '%.0f' "$fable")
#     fable_color=$(color_pct "$fable_int")
#     rate_seg="${rate_seg} ${GRAY}fable:${fable_color}${fable_int}%${RESET}"
#   fi
# fi
#
# # --- 5b. 7d window reset date (MM/DD, local time) ---
# # Prefer the live payload; fall back to the usage cache refreshed above.
# reset_seg=""
# reset_iso=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')
# if [ -z "$reset_iso" ] && [ -s "$USAGE_CACHE" ]; then
#   reset_iso=$(jq -r 'first(
#       (.seven_day.resets_at // empty),
#       (.limits[]? | select(.kind=="weekly_all") | .resets_at // empty)
#     )' "$USAGE_CACHE" 2>/dev/null)
# fi
# if [ -n "$reset_iso" ]; then
#   reset_mmdd=$(to_mmdd "$reset_iso")
#   [ -n "$reset_mmdd" ] && reset_seg="${sep}${GRAY}${icon_cal} ${reset_mmdd}${RESET}"
# fi

printf "%s%s%s%s%s" "$dir_seg" "$git_seg" "$ctx_seg" "$model_seg" "$effort_seg"
