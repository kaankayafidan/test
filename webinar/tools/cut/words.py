"""words.py a-b [a-b ...]: print the island words between a and b s as word@start (for choosing cut points)."""
import json, sys
from pathlib import Path
W = json.loads((Path(__file__).resolve().parents[2] / "data/cache/islands.words.json").read_text())["words"]
for rng in sys.argv[1:]:
    a, b = map(float, rng.split("-"))
    print(f"[{rng}] " + " ".join(f"{w['text']}@{w['start']:.2f}" for w in W if a <= w["start"] < b))
