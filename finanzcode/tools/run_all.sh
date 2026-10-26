#!/usr/bin/env bash
# Full pipeline: cut the Loom recording, build all 24 variants, render + mix + encode them into out/.
#   tools/run_all.sh [path/to/loom.mp4] [--only FC_Loom_06_Stuhl_A_4x5,...]
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d .venv ] && . .venv/bin/activate
RAW="${1:-data/raw/loom.mp4}"; shift || true
mkdir -p data/raw data/work
[ "$RAW" -ef data/raw/loom.mp4 ] 2>/dev/null || cp "$RAW" data/raw/loom.mp4
[ -f assets/music/bed.wav ] || tools/make_music.sh
ffmpeg -y -loglevel error -i data/raw/loom.mp4 -vn -ac 1 -ar 16000 data/work/raw16k.wav
python3 -I tools/cut/ranges.py data/work/raw16k.wav data/edit/ranges.json data/edl   # cut lists from the time ranges
python3 -I tools/cut/render_seg.py data/raw/loom.mp4 data/edl                         # voice + circle clips per segment
python3 -I tools/cut/voice_words.py                                                    # caption timings from the cut voice
node tools/build.mjs                                                                   # 24 HyperFrames projects in build/
python3 -I tools/render.py "$@"                                                        # out/*.mp4
ls -la out/*.mp4
