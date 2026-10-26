export const meta = {
  name: 'finanzcode-adapt',
  description: 'Adapt every ad\'s motif scenes to Kilian\'s real cut voice, review sync independently, fix, and render the 4 final files per ad',
  phases: [
    { title: 'Adapt', detail: 'cues + beats follow the spoken words' },
    { title: 'Review', detail: 'independent sync + briefing check with real audio timings' },
    { title: 'Fix+Render', detail: 'fix findings, render the 4 deliverables of the ad' },
  ],
}

const BASE = '/home/user/test/finanzcode'
const ADS = args.ads

const COMMON = `
Project ${BASE}: HyperFrames (HTML+GSAP → video) Loom-style ads for a paying client. Read ${BASE}/src/scenes/README.md completely first (contract + briefing rules + the new section "Real voice"), then ${BASE}/src/fx.js. The briefing is ${BASE}/briefing/Briefing_v2.pdf (read the pages of your ad as images) and ${BASE}/briefing/briefing.txt.
Kilian's real voice is cut and in place: data/timing/<seg>.words.json (spoken words with times, already sped up), data/edl/edit.md (spoken text per segment), assets/media/<seg>.voice.wav and .cam.mp4. Kilian did NOT read the briefing scripts verbatim; the spoken text is what the scenes must follow. Build with real timings: cd ${BASE} && node tools/build.mjs --only adN --out build-adN (it prints ⚠ warnings for cue phrases that are not spoken verbatim; the cue times of a build are in build-adN/<variant>/mix.json, hook scene 0..hookDur, body from hookDur).
Only edit your own files: src/scenes/adN-hookA.html, adN-hookB.html, adN-body.html, their .cues.json, assets/img/adN/. Never edit tools/, src/fx.js, src/components/, other ads. Verify by snapshots (npx hyperframes snapshot --at <times> --no-end in a variant dir) and LOOK at the PNGs.`

const SCHEMA_ADAPT = { type: 'object', properties: { changes: { type: 'array', items: { type: 'string' } }, beats: { type: 'array', items: { type: 'string' } }, warnings_left: { type: 'array', items: { type: 'string' } }, lint_errors: { type: 'integer' } }, required: ['changes', 'beats', 'warnings_left', 'lint_errors'] }
const SCHEMA_REVIEW = { type: 'object', properties: { defects: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, variant: { type: 'string' }, time: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'variant', 'time', 'problem', 'fix'] } }, summary: { type: 'string' } }, required: ['defects', 'summary'] }
const SCHEMA_FINAL = { type: 'object', properties: { fixed: { type: 'array', items: { type: 'string' } }, not_fixed: { type: 'array', items: { type: 'string' } }, rendered: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, file: { type: 'string' }, duration: { type: 'number' }, video: { type: 'string' }, lufs: { type: 'number' }, true_peak: { type: 'number' } }, required: ['name', 'file'] } }, problems: { type: 'array', items: { type: 'string' } } }, required: ['fixed', 'not_fixed', 'rendered', 'problems'] }

const results = await pipeline(
  ADS,
  (ad) => agent(`${COMMON}

YOUR AD: Ad ${ad.n} (${ad.title}); variants FC_Loom_0${ad.n}_${ad.name}_{A,B}_{4x5,9x16}; build dir build-ad${ad.n}.
TASK: adapt the three scenes to the real voice.
1. Read data/edl/edit.md for ad${ad.n}-hookA, ad${ad.n}-hookB, ad${ad.n}-body and data/timing/ad${ad.n}-*.words.json. Compare with the briefing script and the existing beats (cue files).
2. Rewrite every cue phrase so it is spoken verbatim (copy the words from words.json). Build until no "not spoken verbatim" / "neither spoken" warning is left for ad${ad.n}.
3. Beats whose content is no longer said: replace them with a visual for what IS said at that moment (same style, same simple effects). New spoken passages without a beat: add simple beats so something new happens every 2-4 s. Keep the first frames of both hooks as they are (sketch), motion from frame 1.
4. Body end: after the CTA beat ("Klick … „Mehr dazu“ / Button / Link"), the CTA-Bild stays (or the final image + the small more-banner) until the end; nothing jumps in the last 0.3 s.
${ad.extra || ''}
5. Rebuild, npx hyperframes lint (0 errors), snapshot every beat of hook A, hook B and body at the real cue times in 4:5 plus t=0 of both hooks in 9:16; look at the PNGs and fix what is wrong. Report every change, the final beat list (time → what is said → what is shown) and any warning left.`, { label: `adapt:ad${ad.n}`, phase: 'Adapt', schema: SCHEMA_ADAPT }),
  (adapted, ad) => agent(`You are an exacting independent reviewer (do NOT edit project files). ${COMMON}
Review Ad ${ad.n} (${ad.title}) against Kilian's real voice and the briefing. Build into a private dir: cd ${BASE} && node tools/build.mjs --only ad${ad.n} --out build-rev2-ad${ad.n}. For hook A, hook B and body: read data/timing/ad${ad.n}-*.words.json and, for every sentence, snapshot the frame ~0.3 s after its first word (variants _A_4x5 and _B_4x5; times in build-rev2-ad${ad.n}/<variant>/mix.json, body offset = hookDur). Also t=0, 0.25, 0.5 of both hooks in 4:5 and t=0 in 9:16, and the last 1 s of the video.
Check: (1) what is shown matches what is being said at that moment (no visual for something not said, no long stretch >4 s without anything new); (2) first frames = sketch, motion from frame 1; (3) captions, hook bar and Kilian's circle (real camera now) look right and nothing overlaps the circle; (4) briefing rules: text ≥40 px, ≤5 words per element, palette, cursor rules, forbidden content, no prices/amounts, no profit promises; (5) visual polish: nothing clipped, leftovers from earlier beats, broken layout.
The adapting agent reported: ${JSON.stringify(adapted)}
Return every defect with severity, variant, time, problem and a concrete fix.`, { label: `review:ad${ad.n}`, phase: 'Review', schema: SCHEMA_REVIEW }).then((rev) => ({ adapted, rev })),
  (r, ad) => agent(`${COMMON}

YOUR AD: Ad ${ad.n} (${ad.title}); build dir build-ad${ad.n}.
An independent reviewer checked your ad against the real voice. Fix every blocker and major, and every minor that is cheap and clearly right (verify disputed findings in a snapshot first):
${JSON.stringify(r?.rev?.defects || [], null, 1)}
Reviewer summary: ${r?.rev?.summary || '(no review)'}
Then: rebuild (node tools/build.mjs --only ad${ad.n} --out build-ad${ad.n}), lint 0 errors, snapshot what you touched and look at it.
FINALLY render the 4 deliverables of this ad: cd ${BASE} && python3 -I tools/render.py --build build-ad${ad.n} --out out (takes several minutes per file; run it in the foreground with a long timeout or in the background and wait for it). It prints one JSON line per file (duration, video, lufs, true_peak). Check every file: duration matches, h264 High 1080x1350 / 1080x1920 30 fps ~15 Mbit/s, LUFS ≈ -14, true peak ≤ -1. Extract 3 frames of each final MP4 with ffmpeg (start, middle, end) and look at them. Report what you fixed, what not, the rendered files and any problem.`, { label: `final:ad${ad.n}`, phase: 'Fix+Render', schema: SCHEMA_FINAL }).then((fin) => ({ ad: ad.n, ...r, fin })),
)
return results
