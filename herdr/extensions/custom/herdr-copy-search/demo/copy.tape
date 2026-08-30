# vhs tape: copy/search mode demo, recorded inside a real herdr session.
# Regenerate: see docs/checklists/CL-04-demo-recording.md (docker vhs
# with the host herdr binary + a CJK font mounted). Produces
# demo/copy.mp4 at 2x (2400x1400) for crisp text.
#
# Flow: boot herdr, fill a pane with the fixture as scrollback, open copy
# mode via the plugin keybinding (prefix+[), search up for "error"
# incrementally, walk matches with n, then pattern-select a URL and yank.

Output demo/copy.mp4

Set FontSize 32
Set Width 2400
Set Height 1400
Set Padding 32
Set TypingSpeed 100ms
# 12fps capture: at 2x the headless screenshots are slow, so higher
# rates drop frames and the clip plays too fast (playback stays 25fps).
Set Framerate 12
# Play back 20% slower for readability.
Set PlaybackSpeed 0.8

Hide
# Seed a throwaway herdr config, start the server, link this checkout.
Type "mkdir -p /tmp/run /tmp/.config/herdr; cp /vhs/demo/herdr-demo-config.toml /tmp/.config/herdr/config.toml"
Enter
Type "herdr server >/tmp/srv.log 2>&1 & sleep 3; herdr plugin link /vhs >/tmp/link.log 2>&1"
Enter
Sleep 4s
Type "clear; herdr"
Enter
Sleep 4s
# Clean prompt, then fill the pane with the fixture the plugin will read.
Type "export PS1='$ '; clear; cat /vhs/fixtures/sample.txt"
Enter
Sleep 1500ms
Show
Sleep 1500ms
# Open copy mode via the plugin keybinding (no typed command).
Ctrl+b
Type "["
Sleep 2s
# incremental up-search: matches highlight while typing
Type "?"
Sleep 500ms
Type "error"
Sleep 1s
Enter
Sleep 1s
Type "n"
Sleep 800ms
Type "n"
Sleep 1s
# pattern menu: select the nearest URL above the cursor, then yank it
Type "p"
Sleep 1200ms
Type "u"
Sleep 1200ms
Type "n"
Sleep 1s
Type "y"
Sleep 1500ms
Hide
