"""Find the best take of every sentence of the 18 scripts in the raw transcript and build edit lists.

    python3 -I tools/cut/takes.py <raw.words.json> <raw.wav16k> <out_dir> [--only ad1] [--force seg:sentence=take]

For each segment (adN-hookA / hookB / body):
  1. split the script into sentences;
  2. find every occurrence (take) of each sentence in the transcript (local alignment, fuzzy words);
  3. pick one take per sentence with a DP that rewards coverage and clean delivery, prefers later
     takes when equal, and keeps neighbouring sentences close together in the recording;
  4. inside the chosen takes drop fillers (äh, ähm …), stutters / repeated words and partial words,
     and shorten pauses; cut points are moved to the quietest 10 ms within the gap.
Writes <out_dir>/<seg>.edl.json and <out_dir>/takes.md (a readable report with alternatives).
"""
import json
import re
import sys
import wave
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
FILLERS = {"äh", "ähm", "öhm", "öh", "ähh", "hm", "hmm", "mhm", "em", "ehm", "äääh", "uh", "uhm"}
PAUSE_IN = 0.24    # longest pause kept inside a sentence (s, raw time)
PAUSE_SENT = 0.32  # longest pause kept between sentences
PAD = 0.11         # audio kept after a word end / before a word start at a shortened pause


def norm(t):
    t = t.lower().replace("’", "'").replace("‘", "'")
    t = re.sub(r"(\d)[,.](\d)", r"\1#\2", t)
    t = re.sub(r"[^a-z0-9äöüß#]", "", t)
    return t.replace("#", ",")


from functools import lru_cache


@lru_cache(maxsize=None)
def sim(a, b):
    if a == b:
        return 1.0
    if not a or not b or abs(len(a) - len(b)) > max(3, len(a) // 2):
        return 0.0
    r = SequenceMatcher(None, a, b).ratio()
    return r if r >= 0.62 else 0.0


def sentences(script):
    parts = re.split(r"(?<=[.?!])[\"“”]?\s+(?=[A-ZÄÖÜ„\d])", script)
    out = []
    for p in parts:
        toks = [t for t in p.split() if norm(t)]
        if toks:
            out.append(toks)
    return out


def local_align(s, w, lo, hi):
    """Smith-Waterman of sentence tokens s against transcript tokens w[lo:hi]. Returns (score, j0, j1, pairs)."""
    n, m = len(s), hi - lo
    if m <= 0:
        return 0, None, None, [], []
    H = np.zeros((n + 1, m + 1))
    B = np.zeros((n + 1, m + 1), dtype=np.int8)
    S = np.array([[sim(s[i], w[lo + j]) for j in range(m)] for i in range(n)])
    gap = -0.45
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            sc = S[i - 1, j - 1]
            d = H[i - 1, j - 1] + (sc if sc > 0 else -0.8)
            u = H[i - 1, j] + gap
            l = H[i, j - 1] + gap
            best = max(0, d, u, l)
            H[i, j] = best
            B[i, j] = 0 if best == 0 else (1 if best == d else (2 if best == u else 3))
    i, j = np.unravel_index(np.argmax(H), H.shape)
    score = H[i, j]
    pairs = []
    subs = []  # misheard words: same slot in script and transcript, no similarity
    while i > 0 and j > 0 and B[i, j] != 0:
        if B[i, j] == 1:
            if S[i - 1, j - 1] > 0:
                pairs.append((i - 1, lo + j - 1))
            else:
                subs.append((i - 1, lo + j - 1))
            i, j = i - 1, j - 1
        elif B[i, j] == 2:
            i -= 1
        else:
            j -= 1
    pairs.reverse()
    if not pairs:
        return 0, None, None, [], []
    return score, pairs[0][1], pairs[-1][1], pairs, subs


def occurrences(s, w, max_n=8):
    """All non-overlapping takes of a sentence in the transcript (anchor windows + local alignment)."""
    n = len(s)
    key = set(t for t in s if len(t) >= 3) or set(s)
    marks = np.array([1 if t in key else 0 for t in w])
    L = max(4, int(n * 1.5))
    need = max(1 if n <= 2 else 2, int(0.35 * len(key)))
    csum = np.concatenate([[0], np.cumsum(marks)])
    regions = []
    for j in range(len(w)):
        if csum[min(len(w), j + L)] - csum[j] >= need and marks[j]:
            a, b = max(0, j - n // 2 - 2), min(len(w), j + L + n // 2 + 2)
            if regions and a <= regions[-1][1]:
                regions[-1][1] = max(regions[-1][1], b)
            else:
                regions.append([a, b])
    found = []
    stack = [tuple(r) for r in regions]
    while stack and len(found) < max_n * 3:
        lo, hi = stack.pop()
        if hi - lo < max(1, n // 2):
            continue
        r = local_align(s, w, lo, hi)
        if r[1] is None or r[0] < max(1.6 if n <= 3 else 2.0, 0.45 * n):
            continue
        found.append(r)
        stack.append((lo, r[1]))
        stack.append((r[2] + 1, hi))
    found.sort(key=lambda r: -r[0])
    return found[: max_n]


def rms_frames(wav_path):
    with wave.open(str(wav_path)) as f:
        sr = f.getframerate()
        a = np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    hop = int(sr * 0.01)
    n = len(a) // hop
    fr = a[: n * hop].reshape(n, hop)
    return np.sqrt((fr ** 2).mean(axis=1) + 1e-12), 0.01


def quietest(rms, hop, t0, t1):
    i0, i1 = max(0, int(t0 / hop)), min(len(rms) - 1, int(t1 / hop))
    if i1 <= i0:
        return (t0 + t1) / 2
    k = i0 + int(np.argmin(rms[i0 : i1 + 1]))
    return k * hop + hop / 2


def onset(rms, hop, t0, t1, first=True):
    """First (or last) 10 ms frame in [t0, t1] that is clearly above the noise floor."""
    i0, i1 = max(0, int(t0 / hop)), min(len(rms) - 1, int(t1 / hop))
    if i1 <= i0:
        return None
    seg = 20 * np.log10(rms[i0 : i1 + 1] + 1e-9)
    floor = np.percentile(20 * np.log10(rms + 1e-9), 10)
    thr = max(floor + 14, -48)
    idx = np.where(seg > thr)[0]
    if not len(idx):
        return None
    k = idx[0] if first else idx[-1]
    return (i0 + k) * hop


def take_quality(sent, words, occ):
    score, j0, j1, pairs, subs = occ
    n = len(sent)
    cov = sum(sim(sent[i], norm(words[j]["text"])) for i, j in pairs) / n
    span = j1 - j0 + 1
    extra = span - len(pairs) - len(subs)
    fill = sum(1 for j in range(j0, j1 + 1) if norm(words[j]["text"]) in FILLERS)
    prob = float(np.mean([words[j]["prob"] for j in range(j0, j1 + 1)]))
    # clean delivery: full coverage, few extra words, confident recognition
    q = cov - 0.06 * max(0, extra - fill) - 0.03 * fill + 0.1 * (prob - 0.8)
    return q, cov, extra, fill


def choose(seg, sents, words, toks, forced):
    cands = []
    for si, s in enumerate(sents):
        occ = occurrences([norm(t) for t in s], toks)
        c = []
        for o in occ:
            q, cov, extra, fill = take_quality([norm(t) for t in s], words, o)
            c.append({"occ": o, "q": q, "cov": cov, "extra": extra, "fill": fill, "t0": words[o[1]]["start"], "t1": words[o[2]]["end"]})
        c.sort(key=lambda x: x["t0"])
        if f"{si}" in forced:
            k = forced[f"{si}"]
            c = [c[k]] if k < len(c) else c
        cands.append(c)
    # DP over sentences: maximise quality, prefer later takes on ties, keep neighbours close in time
    best = [dict() for _ in sents]
    for si, c in enumerate(cands):
        for k, x in enumerate(c):
            base = x["q"] * 10 + 0.002 * x["t0"]
            if si == 0 or not cands[si - 1]:
                best[si][k] = (base, None)
                continue
            opts = []
            for pk, (pv, _) in best[si - 1].items():
                p = cands[si - 1][pk]
                gap = x["t0"] - p["t1"]
                if gap < -0.05:
                    trans = -3 - min(3, abs(gap) / 60)       # going back in the recording
                elif gap < 8:
                    trans = 1.0                               # same take, contiguous
                else:
                    trans = -min(3, gap / 90)                 # a later take far away
                opts.append((pv + base + trans, pk))
            best[si][k] = max(opts) if opts else (base, None)
    chosen = [None] * len(sents)
    if all(cands):
        k = max(best[-1], key=lambda kk: best[-1][kk][0])
        for si in range(len(sents) - 1, -1, -1):
            chosen[si] = k
            k = best[si][k][1]
    return cands, chosen


def edl_for(sents, cands, chosen, words, rms, hop):
    keep = []          # list of word indices kept, in order, with sentence id
    script_of = {}     # transcript word index -> script token (original spelling)
    for si, (s, c, k) in enumerate(zip(sents, cands, chosen)):
        if k is None:
            continue
        score, j0, j1, pairs, subs = c[k]["occ"]
        aligned = {j: i for i, j in pairs}
        # a misheard word in the same slot as a script word: keep it, spell it as scripted
        for i, j in subs:
            if norm(words[j]["text"]) not in FILLERS:
                aligned.setdefault(j, i)
        for j in range(j0, j1 + 1):
            t = norm(words[j]["text"])
            if j not in aligned:
                if t in FILLERS:
                    continue
                prev_t = norm(words[j - 1]["text"]) if j > 0 else ""
                nxt = [norm(words[x]["text"]) for x in range(j + 1, min(j1 + 1, j + 4))]
                # stutters and repeats ("mein Ziel, mein Ziel"), partial words ("Tra- Trading")
                if t == prev_t or t in nxt or any(n_.startswith(t) and len(t) >= 2 for n_ in nxt[:1]):
                    continue
            keep.append((j, si))
            if j in aligned:
                script_of[j] = s[aligned[j]]
    # drop the earlier copy of a repeated phrase that was aligned but then repeated (keeps the last attempt)
    spans = []
    for idx, (j, si) in enumerate(keep):
        w = words[j]
        if spans and spans[-1]["si"] == si and w["start"] - spans[-1]["end"] <= PAUSE_IN and j == spans[-1]["j1"] + 1:
            spans[-1]["end"], spans[-1]["j1"] = w["end"], j
            spans[-1]["words"].append(j)
        else:
            spans.append({"si": si, "start": w["start"], "end": w["end"], "j0": j, "j1": j, "words": [j]})
    # cut points: quietest point near each edge, keep at most PAUSE_* of silence across a cut
    edl = []
    for k, sp in enumerate(spans):
        a, b = sp["start"], sp["end"]
        prev_end = spans[k - 1]["end"] if k else max(0.0, a - 0.5)
        next_start = spans[k + 1]["start"] if k + 1 < len(spans) else b + 0.5
        limit = PAUSE_SENT if (k + 1 < len(spans) and spans[k + 1]["si"] != sp["si"]) else PAUSE_IN
        if k:
            cin = quietest(rms, hop, max(prev_end, a - PAD), a - 0.02)
        else:
            # the voice starts at frame 1: cut 30 ms before the real onset of the first word
            on = onset(rms, hop, max(0.0, a - 0.35), a + 0.15, first=True)
            cin = max(0.0, (on if on is not None else a) - 0.03)
        if k + 1 < len(spans):
            cout = quietest(rms, hop, b + 0.02, min(next_start, b + max(PAD, limit / 2)))
        else:
            off = onset(rms, hop, b - 0.15, b + 0.45, first=False)
            cout = (off if off is not None else b) + 0.12
        edl.append([round(cin, 3), round(cout, 3)])
    # merge cuts that are contiguous in the recording (no audible cut there)
    merged = []
    for e in edl:
        if merged and e[0] - merged[-1][1] < 0.03:
            merged[-1][1] = e[1]
        else:
            merged.append(e)
    kept_words = []
    for j, si in keep:
        w = words[j]
        kept_words.append({"text": script_of.get(j, w["text"]), "start": w["start"], "end": w["end"], "raw": w["text"], "scripted": j in script_of})
    return merged, kept_words


def main():
    args = sys.argv[1:]
    only = None
    forced = {}
    if "--only" in args:
        i = args.index("--only"); only = args[i + 1].split(","); del args[i : i + 2]
    while "--force" in args:
        i = args.index("--force"); seg_s, k = args[i + 1].split("="); seg, s = seg_s.split(":"); forced.setdefault(seg, {})[s] = int(k); del args[i : i + 2]
    raw_words, wav16, out = Path(args[0]), Path(args[1]), Path(args[2])
    out.mkdir(parents=True, exist_ok=True)
    words = json.loads(raw_words.read_text())["words"]
    # merge tokens whisper splits off ("2" ",7" / "Roulette" "-Kessel")
    fixed = []
    for w in words:
        if fixed and (re.match(r"^,\d", w["text"]) or w["text"].startswith("-")):
            fixed[-1] = {**fixed[-1], "text": fixed[-1]["text"] + w["text"], "end": w["end"]}
        else:
            fixed.append(dict(w))
    words = fixed
    toks = [norm(w["text"]) for w in words]
    rms, hop = rms_frames(wav16)
    seg_def = json.loads((ROOT / "src/segments.json").read_text())
    report = ["# Take-Auswahl\n", "Pro Satz: gewählter Take (✔) und Alternativen. Zeiten = Rohaufnahme.\n"]
    for ad in seg_def["ads"]:
        if only and ad["key"] not in only:
            continue
        for part in ("A", "B", "body"):
            seg = f"{ad['key']}-{'body' if part == 'body' else 'hook' + part}"
            sents = sentences(ad["script"][part])
            cands, chosen = choose(seg, sents, words, toks, forced.get(seg, {}))
            edl, kw = edl_for(sents, cands, chosen, words, rms, hop)
            missing = [si for si, k in enumerate(chosen) if k is None]
            (out / f"{seg}.edl.json").write_text(json.dumps({"segment": seg, "tempo": ad["tempo"], "edl": edl, "words": kw, "missing_sentences": missing}, ensure_ascii=False, indent=1))
            report.append(f"\n## {seg}\n")
            for si, s in enumerate(sents):
                report.append(f"- **{' '.join(s)}**")
                if not cands[si]:
                    report.append("  - ✘ kein Take gefunden")
                for k, x in enumerate(cands[si]):
                    j0, j1 = x["occ"][1], x["occ"][2]
                    said = " ".join(words[j]["text"] for j in range(j0, j1 + 1))
                    mark = "✔" if chosen[si] == k else " "
                    report.append(f"  - {mark} take {k} @ {x['t0']:.1f}–{x['t1']:.1f}s · Abdeckung {x['cov']:.0%} · Extra-Wörter {x['extra']} · Füllwörter {x['fill']} — „{said}“")
            dur = sum(b - a for a, b in edl)
            report.append(f"\n  → {len(edl)} Schnitte, {dur:.1f} s Rohlänge, ≈ {dur / ad['tempo']:.1f} s nach Tempo {ad['tempo']}×" + (f", **fehlend: Sätze {missing}**" if missing else ""))
    (out / "takes.md").write_text("\n".join(report) + "\n")
    print("\n".join(report[-12:]))


if __name__ == "__main__":
    main()
