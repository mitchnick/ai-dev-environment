# CL-04: generate README demo videos with vhs (inside real herdr)

Context: demo/*.tape files script every keystroke of the demos, so any
agent can regenerate up-to-date videos after a UI change - no human
recording. The demos run the plugin INSIDE a real herdr session (not the
standalone binary) so the videos show herdr's chrome and the real
keybinding/pane flow. Output is mp4 at 2x (2400x1400); the fixture has a
Traditional-Chinese wide-char line, so the render needs a CJK font. `just
gifs` then derives the small README GIFs from those mp4s (step 4).

How it works: the vhs docker image bundles ttyd + ffmpeg + chromium but
not herdr, so the host herdr binary is mounted in (it is statically
linked, so it runs regardless of the container's glibc). The tape seeds a
throwaway herdr config (demo/herdr-demo-config.toml), starts a herdr
server, links this checkout as a plugin, boots the herdr client, fills a
pane with fixtures/sample.txt as scrollback, then opens the plugin via a
herdr keybinding and drives it. herdr state lives under HOME=/tmp and dies
with the --rm container.

Prerequisites:
- docker (this host has no native vhs/ttyd/ffmpeg). Sandbox OFF: the
  image pull hits ghcr.io and docker.sock is a unix socket.
- herdr on PATH (`command -v herdr`). The demo shows whatever version the
  host has.
- a CJK font on the host: `fc-list :lang=zh` (this host has Noto Sans CJK
  at /usr/share/fonts/opentype/noto).

Steps:
1. [ ] `cargo build --release` on the host. The plugin binary is dynamic
       but runs against the image's newer glibc; herdr reads it through
       the mounted checkout (HERDR_PLUGIN_ROOT), no cargo in the image.
2. [ ] Render each tape. `--user` keeps output owned by you; `-e HOME=/tmp`
       + `XDG_RUNTIME_DIR` give herdr/fontconfig writable homes; the herdr
       mount supplies the binary; the noto mount + `fc-cache` let chromium
       fall back to CJK glyphs:
       ```
       docker run --rm --user "$(id -u):$(id -g)" \
         -e HOME=/tmp -e XDG_RUNTIME_DIR=/tmp/run \
         -v "$PWD":/vhs \
         -v "$(command -v herdr)":/usr/local/bin/herdr:ro \
         -v /usr/share/fonts/opentype/noto:/usr/share/fonts/noto-cjk:ro \
         --entrypoint sh ghcr.io/charmbracelet/vhs \
         -c 'fc-cache -f >/dev/null 2>&1; vhs demo/extract.tape'
       ```
       Repeat for demo/copy.tape. Expect demo/copy.mp4 and demo/extract.mp4.
3. [ ] Acceptance criteria - inspect each mp4 (grab frames with the image's
       ffmpeg: `ffmpeg -ss <t> -i demo/x.mp4 -frames:v 1 f.png`, and check
       duration with `ffprobe -show_entries format=duration`):
       - [ ] herdr chrome is visible (left sidebar: spaces/new/agents; a tab
             row) so it reads as a herdr plugin
       - [ ] the pane shell prompt is a clean `$` (not raw escape codes) and
             no `herdr plugin pane open ...` command is visible - the plugin
             opens via the prefix keybinding, not a typed command
       - [ ] duration matches the tape (extract ~11s, copy ~15s). If it plays
             too fast, the 2x capture is dropping frames: LOWER `Set Framerate`
             (12 works). Playback stays 25fps regardless.
       - [ ] CJK line renders as glyphs, not boxes ("wide: <chinese> CJK
             width test ..."). Boxes mean the noto mount / fc-cache was skipped.
       - [ ] copy.mp4: `[copy]` mode row, a search or `[copy] url: N matches`
             pattern-menu state, matches highlighted, the top-right indicator
       - [ ] extract.mp4: the overlay reads candidates -> hint -> separator ->
             input, the `[word]`/`[line]` badge colored, ending with herdr's
             "copied to clipboard" toast
       - [ ] no overlay border ring (demo config sets pane_borders = false)
4. [ ] Derive the README GIFs and embed them. github.com will NOT play a
       repo-relative `<video>` src inline, and user-attachments URLs need a
       manual re-upload on every re-render, so the README embeds committed
       GIFs instead. Run `just gifs` (mp4 -> demo/copy.gif + demo/extract.gif
       via the vhs image's ffmpeg: 1200px/8fps/64-color diff palette, ~0.7 MB
       each; params in demo/mp4-to-gif.sh) and reference them with
       `![...](demo/*.gif)`. The mp4s stay in the repo for the docs site's
       inline `<video>` (justfile site-build / pages.yml).
5. [ ] Commit videos, GIFs, and tape/config/README edits together:
       `docs(demo): record copy and extract demos`. mp4s and GIFs are binary
       but small (< 1 MB each); commit them to the repo. Do not use git-lfs.

Regeneration rule (add to your dev loop): any commit that changes rendering,
keybindings, or the fixture MUST regenerate the videos in the same branch
(rerun steps 1-3, run `just gifs` per step 4, then commit per step 5). If
drift is found later, treat it as a bug: regenerate immediately.

Optional CI (ask the user first): running this in GitHub Actions would need
herdr, a CJK font, and the plugin build in the action, plus a render-diff in
every PR - noise for a single-user repo. Prefer keeping it a manual/agent-run
step.

Done criteria: both mp4s and both derived GIFs in repo (showing real herdr),
GIFs referenced in README via ![](demo/*.gif), criteria pass.
