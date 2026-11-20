# Scene authoring guide (Motiv-Zone 1080 × 710)

One scene per ad: `src/scenes/adN.html` + `adN.cues.json` (N = 1…8). Ad 3 B (`ad3b`) uses the Ad 3 scene with a
shorter voice (the 620 % passage is cut). The builder (`tools/build.mjs`) puts the scene into the Motiv-Zone of the
4:5 and 9:16 videos. **Hook-Text, Kilian's circle, Untertitel, voice and music come from the root — never draw them.**

Read first: the briefing pages of your ad in `briefing/Briefing_Webinar_V5.pdf` (read the page images; Ad 1 p.14–16,
Ad 2 p.17–19, Ad 3 p.20–22, Ad 4 p.23–25, Ad 5 p.26–28, Ad 6 p.29–31, Ad 7 p.32–34, Ad 8 p.35–37), the rules p.8–13,
`src/fx.js`. The Bildschirm-Ablauf table is the shot list, the first image and storyboards A/B/C are the look.
Everything is drawn by us (no asset package): build the graphics as inline SVG / HTML, or images in `assets/img/adN/`.

## File contract

```html
<template>
  <style> #root { position: absolute; inset: 0; background: #FFFFFF; overflow: hidden; } /* ids prefixed aN- */ </style>
  <div id="root" data-composition-id="adN" data-width="1080" data-height="710">
    <div id="aN-scene" class="clip" data-start="0" data-duration="{{DUR}}"> … </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    …
    window.__timelines["adN"] = tl;   // last line
  </script>
</template>
```
- Every id starts with `aN-`. The builder injects before your script: `C` / `E` (cue start / end times, s), `DUR`,
  `WORDS` ([[text,start,end]…]), `AD` ({nr, key, platz, variant}) and `FX`; shared CSS from `src/components/fx.css`.
- `{{ expr }}` in the HTML is evaluated at build time with C, E, DUR (use only for data-start / data-duration).
- Fonts: `'Poppins'` 400/500/600/700/800/900, `'Caveat'` 400/700, `'Kalam'` 400/700, `'Permanent Marker'` 400.

## Seek safety (frames render in any order)
- Animate only with the FX helpers or `FX.tween(tl, el, from, to, t)` (fromTo, immediateRender:false). Never
  `tl.from()` / `tl.to()`. `tl.set()` is fine. Initial state of everything that appears later: `FX.init(tl, el, {opacity:0})`.
- Never two overlapping tweens on the same property of one element. No tweens on the `.clip` element itself.
- No Math.random, Date, timers, `repeat:-1`. No CSS `transform` on elements GSAP animates. SVG pivots: `{svgOrigin:"x y"}`.

## Cues and timing
- `adN.cues.json`: `{"cues": {name: phrase | {phrase, word, offset, optional}}, "sfx": [...], "kil": [...]}`.
  A phrase is copied **verbatim from the spoken words** (`data/timing/adN.words.json`; before the cut exists, from the
  script in `src/segments.json`). Declare cues in spoken order. `{"phrase": "nur 36", "word": 1}` = time of the 2nd word.
- Beats land on their word or up to 0.2 s before; never hard-code seconds — derive from C/E, clamp lengths.
- `optional: true` (Ad 3 only): the phrase may be missing (Ad 3 B) → `C.name === null`; guard those beats with
  `if (C.name != null)`. Pick phrases that exist only inside the dropped passage.
- `"kil": [{"at": cue, "dur": 2}, {"at": cue, "until": cue}]` = the rows "Kilians Kreis wächst (2 s) auf Ø 360 px" /
  "Kreis zurück": the builder scales the circle (0.4 s soft). The first 2 s big (Ad 7: 3 s) is automatic.
- `"sfx": [{"at": cue, "type": "pop"|"whoosh"|"stamp"|"chalk"|"pen"}]` — max 1 per sentence, only those types.

## Bausteine (identical in all ads, briefing p.10) — use the includes, never rebuild them
- Mitte-CTA (Ad 1, 2, 3, 8): `<!--@include midcta p="aNm"-->` (Ad 8: add `variant="navy"`; its handwritten date is drawn
  by the scene and the include's chip is not used: hide `#aNm-chip` with `FX.init(tl,"#aNm-chip",{opacity:0})` and do not
  pass `live`, or animate your own). `FX.midCta(tl, "aNm", {live: C.live, klick: C.klick, out: E.<end of sentence>})`.
  While it runs the scene freezes or runs calmly — nothing new in the motif.
- End-Karte (all): `<!--@include endcard p="aNe"-->` (Ad 2: `platz="bis zu 15 Plätze"`, Ad 4 and 6: `platz="10 Plätze"`).
  `FX.endCard(tl, "aNe", {start: C.sonntag, t18, bot, klick, platz, pulseDate})` — from "Am Sonntag" to the end; it
  builds with Kilian's sentence and never stands still. Ad 6 pins the card on the wall; Ad 4 shrinks the desktop into a
  grey laptop first; Ad 8 lays it over the page: do that before/around the include (it sits on top of your scene).
- Touch-Punkt (Ad 3, and every End-Karte "klick"): `<!--@include touch p="aN"-->` + `FX.touch(tl, "aN", [x,y], steps)`.
- Mauszeiger (Ad 4 only; Ad 7 only drawn): `<!--@include cursor p="aN"-->` + `FX.cursor(...)` (64 px, yellow ring).

## Briefing rules (p.8–13) you must implement
- Own look per ad (do not align with other ads). First frame = the briefing's first image, motion from frame 1,
  readable in 0.5 s, something open; in the motif max 2 text elements (single digits/signs don't count).
- Something new every 2–4 s; > 4 s without a cue → slow zoom (100→108 % over 3 s) or a marking.
- Important words ≥ 44 px, max 5 elements at once. Only Keynote-like animation: fade, pop, move, scale, rotate,
  wipe-reveal, draw line, morph. No figure animation (poses are swapped, Ad 5: crossfade 0.2 s).
- Handschrift (Ad 1, 8): words revealed by a wipe from the left, 0.4–0.6 s per word, never < 44 px.
- Animations exactly as the table p.12 (ploppt rein = FX.pop, knallt drauf = FX.slam, schnelles Ranzoomen = FX.zoomFast,
  langsamer Zoom = FX.slowZoom, fliegt rein = FX.flyIn, wackelt = FX.wobble, pulsiert = FX.pulse, einkreisen /
  durchstreichen = FX.drawCircle / FX.drawLine with `.fx-stroke` 10 px red (Ad 1, 8 hand-drawn: FX.handCircle/handLine)).
- Colours: Navy #0E1A2B, Gelb #FACC15 (KI, Auswahl, Markierung), Grün #16A34A, Rot #DC2626, Grau #9CA3AF, Hellgrau
  #F3F4F6, Weiß. Ad-specific palettes from each ad's LOOK box.
- **Never in the picture**: logos/brand names (exchanges, brokers, banks, apps, OS, AI tools, football clubs, MetaTrader),
  real known people, money, luxury, cars, profit screenshots, account balances, returns, percentages and amounts of any
  kind, crypto, charts/candles/price lines (only exception: blurred in the background of Ad 7), buy/sell buttons, UIs that
  look like an own bot app or bot push notifications, unlicensed media. These words never as sign/note/chip/hook:
  kostenlos, Masterclass, passiv, Profit, Gewinn, Erfolg, 24/7, Absicherung, besser. Respect each ad's ACHTUNG box.
- Real photos/videos that are missing are drawn as clean flat illustrations inside `class="photo-slot" data-asset="…"`.

## Test loop
```bash
cd /home/user/test/webinar
node tools/build.mjs --only adN --out build-adN            # 4:5 + 9:16 (uses the real voice once data/timing exists)
cd build-adN/FC_Webinar_<NN_Name>_4x5 && npx hyperframes lint   # 0 errors
npx hyperframes snapshot --at <times> --no-end              # LOOK at the PNGs (cue times: mix.json "cues")
```
Use your own build dir and snapshot folder names (other agents run in parallel). Check the first frame in 9:16 too.
