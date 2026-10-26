# Scene authoring guide (Motiv-Zone)

Each ad has three scenes ("slides" of the Motiv-Zone, 1080 × 710 px):
`adN-hookA.html`, `adN-hookB.html`, `adN-body.html`, each with a cue file `adN-….cues.json`.
The builder (`tools/build.mjs`) puts hook scene + body scene into the Motiv-Zone of the final
4:5 and 9:16 videos. **Hook text, Kilian's circle, subtitles, voice and music are added by the
root composition — never draw them in a scene.**

Read before you start:
1. The briefing pages of your ad (`briefing/Briefing_v2.pdf`, read the page images: Ad 1 p.7–9,
   Ad 2 p.10–12, Ad 3 p.13–15, Ad 4 p.16–18, Ad 5 p.19–21, Ad 6 p.22–24) and the rules/specs
   on p.2–6 (text in `briefing/briefing.txt`). The Ablauf table is the shot list; the sketch is
   the exact first frame.
2. `src/segments.json` – the exact scripts (cue phrases must be copied from here).
3. `src/fx.js` – the animation helpers. Use them; their timings are the briefing's animation table.
4. The reference scene `src/scenes/ad6-hookA.html` + `.cues.json`.

## File contract

```html
<template>
  <style>
    #root { position: absolute; inset: 0; background: #FFFFFF; overflow: hidden; }
    /* your styles, ids prefixed */
  </style>
  <div id="root" data-composition-id="adN-hookA" data-width="1080" data-height="710">
    <div id="aNha-scene" class="clip" data-start="0" data-duration="{{DUR}}">
      … everything …
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    … tweens …
    window.__timelines["adN-hookA"] = tl;   // always the last line
  </script>
</template>
```

- `data-composition-id` and the `__timelines` key = the file name without `.html`.
- **Id prefix** for every id in the file: `aNha-` (hook A), `aNhb-` (hook B), `aNb-` (body), N = ad number.
  All scenes end up in one page; ids must be unique.
- The builder injects before your script: `C` (cue start times in s), `E` (cue end times = end
  of the phrase's last word), `DUR` (scene length in s), `WORDS` (`[[text,start,end],…]`), and `FX`.
  It also injects the shared CSS classes from `src/components/fx.css`.
- `{{ expression }}` anywhere in the HTML is evaluated at build time with `C`, `E`, `DUR`
  (e.g. `data-start="{{C.kessel}}"`). Use it only for `data-start` / `data-duration` if you
  really need extra clips; normally one scene clip + opacity animation is simpler and safer.
- Includes (expanded by the builder):
  - `<!--@include cursor p="aNha"-->` → `#aNha-cur` (arrow, tip at its 0,0) + `#aNha-ring` (yellow click ring).
    Drive it only with `FX.cursor(tl, "#aNha-cur", "#aNha-ring", [x0,y0], steps)`.
  - `<!--@include course p="aNb-course" items="Grundlagen|Strategie|60-Tage-Plan"-->` (Kurs-Mockup,
    daneben 3 Haken) → animate with `FX.course(tl, "aNb-course", t, [t1,t2,t3])`. Without `items`
    it is the laptop alone, centred.
  - `<!--@include cta p="aNb-cta"-->` (CTA-Bild: Laptop 80 % Breite, "Mehr dazu" 72 px + Navy-Pfeil
    120 px) → `FX.cta(tl, "aNb-cta", t)`.
  - `<!--@include more p="aNb-more"-->` (kleines Banner "Mehr dazu ↓") → `FX.more(tl, "aNb-more", t, d)`
    (`d` omitted = stays to the end).

## Seek safety (renders seek frames in any order)

- Animate with the FX helpers or `FX.tween(tl, el, from, to, t)` (fromTo, `immediateRender:false`).
  Never `tl.from()`, never `tl.to()`. `tl.set()` is fine for instant switches.
- Give every animated element its state at t = 0 with `FX.init(tl, el, {...})` (e.g. `{opacity: 0}`
  for things that appear later). Something visible from frame 1 needs no init.
- Never two overlapping tweens on the same property of the same element. If an element pops in
  and later moves, the move starts after the pop ends.
- Never tween `opacity`/transforms on the `.clip` element itself – animate its children.
- No `Math.random`, `Date`, timers, `repeat: -1`, `requestAnimationFrame`. Loops = finite `repeat`.
- SVG parts rotate/scale around a point given in SVG user units: `{ svgOrigin: "540 650" }`
  (all FX helpers accept `svgOrigin` or `origin`).
- No CSS `transform` in styles on elements you animate with GSAP (set it with `FX.init` instead).
- No external URLs. Fonts: `'Poppins'` 400/600/700/800 (bold = 700). Images you create go to
  `assets/img/adN/…` and are referenced as `assets/img/adN/file.svg`. Inline SVG is preferred.

## Timing

- Cues: in `adN-….cues.json`, map a name to a phrase **copied exactly from the script** in
  `src/segments.json` (punctuation may differ, words must not). Declare cues in script order.
  `{"phrase": "nur 36", "word": 1}` = the time of the 2nd word of the phrase. Use `C.name`
  (start) and `E.name` (end) in the script.
- Real timings arrive later (Kilian's cut voice) and will differ from the placeholder timings you
  test with. **Never hard-code beat times in seconds**: derive from `C`/`E`, keep beats readable
  if speech is 30 % faster or slower, clamp lengths, e.g. `Math.max(0.4, C.b - C.a - 0.15)`.
- A beat lands on its cue word (`C.x`), or up to 0.2 s before it. A beat that needs to be read
  should still be fully visible at `E.x`.
- `DUR` is the scene length. In the body it includes ~1.2 s after the last word: the final image
  holds there. Nothing may jump in the last 0.3 s.

## Briefing rules you must implement (p.2–6)

- Look: a quickly built presentation that Kilian explains casually. Plain, white, spontaneous,
  not an ad spot. One motif per image. Something new every 2–4 s. Simple effects only (animation
  table); slightly krakelig is better than slick (`FX.handCircle` / `FX.handLine` give hand-drawn strokes).
- **First frame of each hook = the sketch**, motion from the very first frame, understandable in
  0.5 s, something open (question mark, hidden card, contradiction). In the motif at most 2 text
  elements with at most 2 words each (single digits/signs and small labels like weekdays don't count).
- Ein-Hand-Regel: only click, scroll, zoom, move, circle, underline. No typing effects: text
  appears by click (pop/fade) and is fully prepared.
- Text you show: ≤ 5 words per element, **never smaller than 40 px** (in 1080×710 scene px).
  Sizes: big number alone 180–240 px; two numbers side by side 120 px each; words in the motif
  60–110 px; small labels 40–48 px. All Poppins Bold.
- Colours only: Navy `#0E1A2B` (hook bar, big numbers, text in the motif, CTA arrow), Grün `#16A34A`
  (richtig, Haken, Ziel, voller Akku, Trading-Blöcke), Rot `#DC2626` (falsch, X, Stop, Blitze,
  einkreisen, durchstreichen), Grau `#9CA3AF` (neutrale Flächen, Job/Arbeit), Hellgrau `#F3F4F6`
  (Kartenflächen, Label-Hintergründe), Gelb `#FACC15` (Klick-Ring, Kalender-Block "Freunde"),
  Blau `#60A5FA` (nur Kalender-Block "Sport"), Weiß `#FFFFFF` (Hintergrund), Schwarz `#111827`
  (Striche/Figuren im Whiteboard-Look Ad 2). Exceptions: photos keep their colours; in Ad 6 figure
  and stool are free flat strong colours (no neon).
- Einkreisen/unterstreichen/durchstreichen: red `#DC2626`, 10 px, circle draws in 0.5 s, line in 0.3 s:
  `<path class="fx-stroke" pathLength="1" d="…"/>` inside an `<svg class="fx-svg">`, then `FX.drawCircle` / `FX.drawLine`.
- Cursor: system pointer at ~2.5× (the include). In Ad 1, 3, 4 and 5 it moves from frame 1 and
  circles the main motif (1 round ≈ 1.5 s, just outside the motif); afterwards calm, one movement
  per sentence. In Ad 2 and 6 the motif moves by itself: no cursor in the first image (it may
  appear later, calm). Click ring (yellow, Ø 64, 50 %) only on a click that reveals something.
- CTA: every body ends with the Kurs-Mockup beat and the CTA-Bild ("Mehr dazu" + arrow) on
  "Klick unter dem Video auf „Mehr dazu“". Show only "Kostenlos", never a crossed-out price,
  never the 500 € amount as an image. If the Ablauf table has a final image after the CTA
  (e.g. "Zurück zum Kessel … Ende"), show that final image and keep the small `more` banner
  ("Mehr dazu ↓") at the bottom of the Motiv-Zone until the end, so "Mehr dazu" stays on screen.
- **Forbidden in the picture** (Meta rejects the ad): logos and brand names (casinos, exchanges,
  brokers, chart platforms, calendar apps, spreadsheet apps), real/known people, money, luxury,
  cars, profit screenshots and account balances in euro, crypto/bitcoin, buy/sell buttons,
  unlicensed photos/videos, the word "Masterclass".
- No stock photos are available in this environment. Where the briefing asks for a photo or
  stock video, draw a clean flat illustration (no photo-real faces) and wrap it in an element
  with `class="photo-slot" data-asset="<short-name>"` so a licensed photo can replace it later.
  Mention every such slot in your report.

## Test loop

```bash
cd /home/user/test/finanzcode
node tools/build.mjs --only adN --out build-adN          # placeholder timings; all 4 variants of your ad
cd build-adN/FC_Loom_0N_<Name>_A_4x5
npx hyperframes lint                                      # 0 errors
npx hyperframes check --json                              # fix every error; layout warnings about the
                                                          # captions/hook are not yours
npx hyperframes snapshot --at 0,0.25,0.5,<cue times…> --no-end    # read the PNGs!
```

- The cue times of a build are in `build-adN/<variant>/mix.json` (`cues`), and the hook scene
  occupies 0…hookDur, the body starts at `hookDur`.
- Look at every beat of the Ablauf table (snapshot just after each cue) in 4:5, and check the
  first frame in 9:16 too (motif scaled to 75 %).
- Handy-Test: look at the t = 0 frame of each hook scaled down to ~360 px wide (e.g. Python PIL)
  — is it understood in 1 s?
- Do not edit anything outside your own scene files and `assets/img/adN/`. If a shared helper is
  missing, write a local one in your scene and say so in the report.
