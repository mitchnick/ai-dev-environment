# Entry points for herdr-copy-search development and release.

# Docs toolchain: run Zensical via uvx (isolated, no venv to manage).
# Pinned because Zensical is pre-1.0; bump this single line to upgrade.
zensical := "zensical@0.0.47"

# List available recipes.
default:
    @just --list

# Debug build.
build:
    cargo build

# Run unit tests.
test:
    cargo test

# Full quality gate; run before every commit.
gate:
    cargo fmt --check
    cargo clippy --all-targets -- -D warnings
    cargo test
    cargo build --release

# cargo-release pre-release hook: run the gate, then regenerate
# CHANGELOG.md for the release being prepared. cargo-release sets
# NEW_VERSION and DRY_RUN; on a dry run the changelog is left untouched
# so the working tree stays clean. Needs git-cliff on PATH.
release-hook:
    just gate
    if [ "$DRY_RUN" != "true" ]; then git-cliff --tag "v${NEW_VERSION}" -o CHANGELOG.md; fi

# Manual run against the fixture (needs a real terminal).
run mode="copy":
    cargo run -- --input fixtures/sample.txt --mode {{mode}}

# Switch to local dev: (re)link this checkout, clearing any prior install.
link:
    -herdr plugin uninstall copy-search   # clear any prior link/install first
    herdr plugin link .
    cargo build --release --locked

# Switch to remote: install the published GitHub plugin (end-user path); pass a ref to pin.
install-remote ref="":
    -herdr plugin uninstall copy-search   # clear any prior link/install first
    herdr plugin install qq88976321/herdr-copy-search {{ if ref == "" { "" } else { "--ref " + ref } }} --yes

# Bump version, sync manifests, tag vX.Y.Z locally (no push).
release level="patch":
    cargo release {{level}} --execute

# Derive small looping GIFs (demo/*.gif) from the demo mp4s for inline
# playback in the GitHub README (github.com will not play a repo-relative
# <video>). Uses the vhs image's ffmpeg (no native ffmpeg on the host); run
# with the sandbox off (docker). Rerun after regenerating the mp4s (CL-04).
gifs:
    docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
      -v "$PWD/demo":/demo \
      --entrypoint sh ghcr.io/charmbracelet/vhs /demo/mp4-to-gif.sh

# Build the docs site (website/, Zensical) with demo videos copied in.
# Runs Zensical via uvx; needs uv on PATH (no venv to activate).
site-build:
    mkdir -p website/docs/demo
    cp demo/copy.mp4 demo/extract.mp4 website/docs/demo/
    cd website && uvx {{zensical}} build --clean

# Serve the docs site locally at 0.0.0.0:8099 (Ctrl-C to stop).
site-serve:
    mkdir -p website/docs/demo
    cp demo/copy.mp4 demo/extract.mp4 website/docs/demo/
    cd website && uvx {{zensical}} serve -a 0.0.0.0:8099
