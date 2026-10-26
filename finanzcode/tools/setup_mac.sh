#!/usr/bin/env bash
# One-time setup on macOS (Homebrew): ffmpeg, Node 22+, Python packages, HyperFrames + its Chrome, music bed.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v brew >/dev/null || { echo "Homebrew fehlt – bitte zuerst https://brew.sh installieren."; exit 1; }
brew list ffmpeg >/dev/null 2>&1 || brew install ffmpeg
command -v node >/dev/null && node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' || brew install node
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip >/dev/null
pip install -r tools/requirements.txt
npm install
npx hyperframes browser ensure
tools/make_music.sh
echo "Setup fertig."
