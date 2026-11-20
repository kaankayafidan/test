#!/usr/bin/env bash
# Builds assets/music/bed.wav from the Mixkit track (Mixkit Stock Music Free License, see assets/music/CREDITS.md):
# track start to bar 39, then looped from bar 13 with 0.25 s crossfades on the bar line (103.36 BPM, first beat 0.12 s).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=assets/music/src/close-up_michael-ramir-c_mixkit-1167.mp3
[ -f "$SRC" ] || curl -sSL -o "$SRC" https://assets.mixkit.co/music/1167/1167.mp3
END=90.6782; LOOP=30.3063
ffmpeg -y -loglevel error -i "$SRC" -i "$SRC" -i "$SRC" -filter_complex \
  "[0:a]aresample=48000,atrim=0:$END,asetpts=PTS-STARTPTS[a];[1:a]aresample=48000,atrim=$LOOP:$END,asetpts=PTS-STARTPTS[b];[2:a]aresample=48000,atrim=$LOOP:$END,asetpts=PTS-STARTPTS[c];[a][b]acrossfade=d=0.25:c1=tri:c2=tri[ab];[ab][c]acrossfade=d=0.25:c1=tri:c2=tri[out]" \
  -map "[out]" -ac 2 -ar 48000 -c:a pcm_s16le assets/music/bed.wav
echo "assets/music/bed.wav: $(ffprobe -v error -show_entries format=duration -of csv=p=0 assets/music/bed.wav) s"
