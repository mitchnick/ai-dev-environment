# vhs tape: extract mode demo, recorded inside a real herdr session.
# Regenerate: see docs/checklists/CL-04-demo-recording.md (docker vhs
# with the host herdr binary + a CJK font mounted). Produces
# demo/extract.mp4 at 2x (2400x1400) for crisp text.
#
# Flow: boot herdr, fill a pane with the fixture as scrollback, open the
# extract overlay via the plugin keybinding (prefix+tab), fuzzy-filter to
# URL tokens, move the selection, toggle word/line, copy the pick (Tab).

Output demo/extract.mp4

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
# Open the extract overlay via the plugin keybinding (no typed command).
Ctrl+b
Tab
Sleep 2s
# fuzzy-filter down to URL-ish tokens
Type "http"
Sleep 1200ms
Down
Sleep 600ms
Down
Sleep 1s
# toggle word -> line granularity and back
Ctrl+t
Sleep 1200ms
Ctrl+t
Sleep 1s
# copy the pick via OSC 52 (exits the overlay)
Tab
Sleep 1500ms
Hide
