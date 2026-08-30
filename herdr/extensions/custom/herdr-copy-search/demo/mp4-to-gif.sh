#!/bin/sh
# Derive small looping GIFs (demo/*.gif) from the demo mp4s for inline
# playback in the GitHub README: github.com will NOT play a repo-relative
# <video>, and user-attachments URLs need a manual re-upload on every
# re-render, so the README embeds committed GIFs with ![](demo/*.gif). The
# docs site keeps the crisp mp4s (see justfile site-build).
#
# Runs INSIDE the vhs docker image, which bundles ffmpeg (the host has no
# native ffmpeg); invoked by `just gifs`. It expects the demo dir mounted at
# /demo. Settings: 1200px wide is retina for the README column (~880px) yet
# each GIF stays well under 1 MB; 8fps and a 64-color diff palette suit flat
# terminal frames; dither=none + diff_mode=rectangle maximize inter-frame
# compression. mp4 source stays the single source of truth.
set -e
for name in copy extract; do
  ffmpeg -y -v error -i "/demo/$name.mp4" \
    -vf "fps=8,scale=1200:-1:flags=lanczos,palettegen=max_colors=64:stats_mode=diff" \
    "/demo/pal_$name.png"
  ffmpeg -y -v error -i "/demo/$name.mp4" -i "/demo/pal_$name.png" \
    -lavfi "fps=8,scale=1200:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" \
    "/demo/$name.gif"
  rm -f "/demo/pal_$name.png"
done
