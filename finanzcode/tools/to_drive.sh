#!/usr/bin/env bash
# Copy the 24 finished videos into the Google Drive folder "FC Loom Ads" (Google Drive for desktop, macOS).
#   tools/to_drive.sh [source ...]
# Sources: folders with FC_Loom_*.mp4 and/or the FC_Loom_*.zip files sent in the chat.
# Default: out/ and ~/Downloads. Drive uploads the folder in the background afterwards.
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -gt 0 ] || set -- out "$HOME/Downloads"

DRIVE=""
for d in "$HOME"/Library/CloudStorage/GoogleDrive-*/"Meine Ablage" "$HOME"/Library/CloudStorage/GoogleDrive-*/"My Drive"; do
  [ -d "$d" ] && { DRIVE="$d"; break; }
done
if [ -z "$DRIVE" ]; then
  echo "Google Drive für Desktop nicht gefunden (~/Library/CloudStorage/GoogleDrive-…)."
  echo "Installieren und anmelden: https://www.google.com/drive/download/ – dann noch einmal starten."
  exit 1
fi
DEST="$DRIVE/FC Loom Ads"
mkdir -p "$DEST"

shopt -s nullglob
for src in "$@"; do
  for z in "$src"/FC_Loom_*.zip; do unzip -o -j -q "$z" '*.mp4' -d "$DEST"; done
  for f in "$src"/FC_Loom_*.mp4; do cp -p "$f" "$DEST"/; done
done

n=0; for f in "$DEST"/FC_Loom_*.mp4; do n=$((n + 1)); done
echo "$n von 24 Videos in: $DEST"
[ "$n" -eq 24 ] || echo "Es fehlen Videos – ZIPs aus dem Chat in ~/Downloads laden oder tools/run_all.sh rendern lassen."
