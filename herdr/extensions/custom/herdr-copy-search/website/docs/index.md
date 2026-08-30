---
icon: lucide/rocket
---

# herdr-copy-search

Incremental regex search over [herdr](https://herdr.dev) pane
scrollback, tmux-copycat-style predefined pattern search, and
extrakto-style token extraction, with a tmux-style copy mode for
refining and yanking matches. All copying goes through OSC 52, so it
works over SSH without any clipboard helper on the remote host.

## Why

Since v0.7.4 herdr's native copy mode has literal smart-case search
built in - use it for plain browsing and literal lookups. This plugin
covers what native does not: regex + smartcase incremental search that
drops you into a copy mode at the match, predefined and user-defined
patterns, token extraction, and soft-wrap-aware matching. The
coexistence positioning and the exit conditions live in the
[roadmap](https://github.com/qq88976321/herdr-copy-search/blob/master/docs/ROADMAP.md).

## The three modes

- **search** - incremental regex search (an invalid regex falls back to a
  literal), plus tmux-copycat-style pattern search over
  `[u]rl [f]ile [g]it-sha [i]p [d]igits [q]uoted`, running backward from
  the cursor; committing a search lands in copy mode on the match.
- **extract** - an extrakto-style fuzzy picker over the same scrollback,
  newest first, in a bottom popup; `Tab` copies, `Enter` inserts.
- **copy** - the landing state for search and patterns, also openable
  directly: vim-style motions, `v`/`V` selection, `y` or `Enter` to copy.

See [Install](install.md) to set it up and [Modes](modes.md) for the full
keybindings.

## Demos

Recorded inside a real herdr session against the sample fixture.

<figure>
  <figcaption>Search / copy: incremental up-search, walk matches, pattern-select a URL, then yank.</figcaption>
  <video src="demo/copy.mp4" controls preload="metadata" width="100%"></video>
</figure>

<figure>
  <figcaption>Extract: fuzzy-filter tokens, toggle word/line granularity, copy the pick.</figcaption>
  <video src="demo/extract.mp4" controls preload="metadata" width="100%"></video>
</figure>

## Status

!!! note "Personal tool, built with heavy AI assistance (Claude Code)"

    I review what ships and use it daily over SSH, but it comes with no
    warranty and no support commitment: issues and PRs are welcome and may
    still go unanswered. Expect tmux-like behavior, not tmux-grade maturity.

Source on [GitHub](https://github.com/qq88976321/herdr-copy-search),
[MIT licensed](https://github.com/qq88976321/herdr-copy-search/blob/master/LICENSE).
