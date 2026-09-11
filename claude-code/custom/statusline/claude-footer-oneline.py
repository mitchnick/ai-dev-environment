#!/usr/bin/env python3
"""
Put the Claude Code status line and the permission-mode footer on ONE line.

Stock layout (cli bottom bar):

    <Box flexDirection="column" flexShrink={1}>   <- xac
      {statusLine}                                <- Aac
      {hintRow}                                   <- Rac
    </Box>

That column is why the custom status line sits on row 1 and
"bypass permissions on (shift+tab to cycle) - for agents" on row 2.

This script rewrites two byte-exact, length-preserving spots in the
embedded JS of the Bun single-file binary:

  1. xac        column -> flexWrap:"wrap" + columnGap:2. flexDirection and
                flexShrink:1 are dropped, not replaced - Ink's Box already
                defaults to row/shrink-1, and those bytes buy the wrap+gap.
  2. statusline paddingX:<n> -> flexGrow:1

(1) puts both on one row, and wraps back to two when the terminal is too
narrow to hold them - flex line-breaking is decided on flex-basis (content
width), so it is exact, not a guessed column threshold. (2) then makes the
status line box absorb the free width on whatever line it lands on, which
pushes the permission-mode footer to the right edge when they share a row.

Byte lengths are preserved exactly - Bun's standalone binary carries a
trailer with blob offsets, so the file size must not change. The result
is re-signed ad-hoc because Anthropic's Developer ID signature no longer
matches.

Claude Code auto-updates daily and repoints the launcher at the new stock
binary, which drops the patch. --ensure re-applies it and is wired to a
SessionStart hook.

Usage:
    claude-footer-oneline.py            # patch the current version, repoint ~/.local/bin/claude
    claude-footer-oneline.py --ensure   # patch only if the launcher is on stock (hook entry point)
    claude-footer-oneline.py --revert   # point ~/.local/bin/claude back at stock
    claude-footer-oneline.py --check    # report state, change nothing
"""

import os
import re
import shutil
import subprocess
import sys
import time

VERSIONS = os.path.expanduser("~/.local/share/claude/versions")
LAUNCHER = os.path.expanduser("~/.local/bin/claude")
LOG = os.path.expanduser("~/.claude/bin/claude-footer-oneline.log")
SUFFIX = "-oneline"

# (regex over the embedded JS, replacement template) - the replacement is
# padded with spaces to the exact byte length of the match.
PATCHES = [
    (
        rb'flexDirection:"column",flexShrink:1,children:\[([\w$]+),([\w$]+),!1\]',
        rb'flexWrap:"wrap",columnGap:2,children:[\1,\2]',
    ),
    (
        rb'paddingX:([\w$]+),gap:2,children:',
        rb'flexGrow:1,gap:2,children:',
    ),
]


def stock_target():
    """The version file ~/.local/bin/claude resolves to, minus any -oneline."""
    real = os.path.realpath(LAUNCHER)
    if real.endswith(SUFFIX):
        real = real[: -len(SUFFIX)]
    return real


def patch_bytes(buf):
    for pattern, repl_tpl in PATCHES:
        matches = list(re.finditer(pattern, buf))
        if len(matches) != 1:
            raise SystemExit(
                f"abort: expected 1 match for {pattern!r}, found {len(matches)} "
                "- the bundle changed shape, re-derive the patch"
            )
        m = matches[0]
        repl = m.expand(repl_tpl)
        if len(repl) > len(m.group(0)):
            raise SystemExit(f"abort: replacement longer than match for {pattern!r}")
        repl += b" " * (len(m.group(0)) - len(repl))
        buf = buf[: m.start()] + repl + buf[m.end() :]
    return buf


def prune(keep):
    """Drop -oneline builds for versions the updater already removed."""
    for name in os.listdir(VERSIONS):
        if not name.endswith(SUFFIX):
            continue
        path = os.path.join(VERSIONS, name)
        if path == keep:
            continue
        if not os.path.exists(path[: -len(SUFFIX)]):
            os.remove(path)
            log(f"pruned stale {name}")


def log(msg):
    with open(LOG, "a") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}\n")


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    stock = stock_target()
    patched = stock + SUFFIX
    current = os.path.realpath(LAUNCHER)

    if arg == "--ensure":
        if current.endswith(SUFFIX) and os.path.exists(current):
            return
        log(f"launcher on stock ({current}) - re-applying")

    if arg == "--check":
        print(f"launcher -> {current}")
        print(f"stock     : {stock} ({'exists' if os.path.exists(stock) else 'MISSING'})")
        print(f"patched   : {patched} ({'exists' if os.path.exists(patched) else 'absent'})")
        print(f"state     : {'PATCHED' if current.endswith(SUFFIX) else 'stock'}")
        return

    if arg == "--revert":
        if not os.path.exists(stock):
            raise SystemExit(f"abort: stock binary missing at {stock}")
        os.remove(LAUNCHER)
        os.symlink(stock, LAUNCHER)
        print(f"reverted: {LAUNCHER} -> {stock}")
        return

    if not os.path.exists(stock):
        raise SystemExit(f"abort: no stock binary at {stock}")

    size = os.path.getsize(stock)
    if arg != "--ensure":
        print(f"reading {stock} ({size / 1e6:.0f} MB)")
    buf = open(stock, "rb").read()
    try:
        out = patch_bytes(buf)
    except SystemExit as e:
        log(f"FAILED on {os.path.basename(stock)}: {e}")
        raise
    if len(out) != size:
        raise SystemExit("abort: size changed - would break the Bun blob trailer")

    tmp = patched + ".tmp"
    with open(tmp, "wb") as f:
        f.write(out)
    shutil.copymode(stock, tmp)
    os.replace(tmp, patched)
    if arg != "--ensure":
        print(f"wrote   {patched}")

    # Developer ID signature no longer matches - re-sign ad-hoc, keeping the
    # hardened-runtime flag and entitlements.
    subprocess.run(
        ["codesign", "-f", "-s", "-", "--preserve-metadata=entitlements,flags", patched],
        check=True,
        capture_output=(arg == "--ensure"),
    )
    subprocess.run(["xattr", "-d", "com.apple.quarantine", patched], check=False,
                   stderr=subprocess.DEVNULL)

    os.remove(LAUNCHER)
    os.symlink(patched, LAUNCHER)
    prune(keep=patched)
    log(f"patched + linked {os.path.basename(patched)}")
    if arg != "--ensure":
        print("signed  ad-hoc")
        print(f"linked  {LAUNCHER} -> {patched}")
        print("\nStart a NEW claude session to see it. Revert with --revert.")


if __name__ == "__main__":
    main()
