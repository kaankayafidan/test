#!/usr/bin/env node
// Generates one HyperFrames project per ad variant (6 ads × hook A/B × 4:5/9:16 = 24)
// from the scene templates in src/scenes and the word timings in data/timing.
//
//   node tools/build.mjs                      all variants
//   node tools/build.mjs --only ad1,ad6       some ads
//   node tools/build.mjs --hooks A --formats 4x5 --out build-ad1 --placeholder
//
// Missing real timings fall back to estimated placeholder timings from the script,
// missing camera/voice media fall back to a grey circle and silence.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const P = (...a) => path.join(ROOT, ...a);
const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(ROOT, args.out || "build");
const ONLY = args.only ? args.only.split(",") : null;
const HOOKS = (args.hooks || "A,B").split(",");
const FORMATS = (args.formats || "4x5,9x16").split(",");
const FORCE_PLACEHOLDER = !!args.placeholder;

const SEG = JSON.parse(fs.readFileSync(P("src/segments.json"), "utf8"));
const METRICS = JSON.parse(fs.readFileSync(P("tools/poppins700.json"), "utf8")).adv;
const FX_JS = fs.readFileSync(P("src/fx.js"), "utf8");
const FX_CSS = fs.readFileSync(P("src/components/fx.css"), "utf8");
const COMP = Object.fromEntries(
  fs.readdirSync(P("src/components")).filter((f) => f.endsWith(".html")).map((f) => [f.replace(/\.html$/, ""), fs.readFileSync(P("src/components", f), "utf8")]),
);
const SFX = JSON.parse(fs.readFileSync(P("assets/sfx/sfx.json"), "utf8"));

const FORMAT = {
  "4x5": {
    W: 1080, H: 1350,
    hook: { top: 60, h: 110, maxW: 960 },
    motif: { x: 0, y: 220, scale: 1 },
    kil: { x: 40, big: { y: 950, d: 360 }, small: { y: 1070, d: 240 } },
    cap: { x: 440, y: 1080, w: 600, h: 200 },
  },
  "9x16": {
    W: 1080, H: 1920,
    hook: { top: 290, h: 110, maxW: 950 },
    motif: { x: 135, y: 420, scale: 0.75 },
    kil: { x: 65, big: { y: 965, d: 280 }, small: { y: 1025, d: 220 } },
    cap: { x: 380, y: 1030, w: 570, h: 200 },
  },
};
const HOOK_TAIL = 0.15; // s of silence kept after the last hook word
const BODY_TAIL = 1.2;  // s the final image holds after the last word (music fades in the last 0.5 s)

// ---------------------------------------------------------------- utilities
function parseArgs(a) {
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith("--")) continue;
    const k = a[i].slice(2);
    if (i + 1 < a.length && !a[i + 1].startsWith("--")) o[k] = a[++i];
    else o[k] = true;
  }
  return o;
}
const r3 = (x) => Math.round(x * 1000) / 1000;
const readJSON = (f, d = null) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function textWidth(s, px) {
  let w = 0;
  for (const ch of s) w += METRICS[ch] ?? 0.6;
  return w * px;
}
export function norm(tok) {
  return tok
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/(\d),(\d)/g, "$1#$2")
    .replace(/[^a-z0-9äöüß#]/g, "")
    .replace(/#/g, ",");
}
function tokenize(text) {
  return text.split(/\s+/).filter(Boolean).map((t) => ({ text: t, n: norm(t) })).filter((t) => t.n);
}

// Estimated timings for previews before the real voice exists (≈ 3 words/s at 1.05×).
function placeholderWords(script) {
  const out = [];
  let t = 0;
  for (const tok of tokenize(script)) {
    const d = 0.08 + 0.038 * [...tok.n].length;
    out.push({ text: tok.text, start: r3(t), end: r3(t + d) });
    t += d + 0.035;
    if (/[.?!:]["“”]?$/.test(tok.text)) t += 0.28;
    else if (/[,;]$/.test(tok.text)) t += 0.12;
  }
  return out;
}

// Global alignment script tokens ↔ spoken words (Needleman-Wunsch, fuzzy match).
function sim(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const la = a.length, lb = b.length;
  const dp = Array.from({ length: la + 1 }, (_, i) => [i]);
  for (let j = 1; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++)
    for (let j = 1; j <= lb; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const r = 1 - dp[la][lb] / Math.max(la, lb);
  return r >= 0.6 ? r : 0;
}
function align(sTok, wTok) {
  const n = sTok.length, m = wTok.length, GAP = -0.4;
  const S = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const B = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i++) { S[i][0] = i * GAP; B[i][0] = 1; }
  for (let j = 1; j <= m; j++) { S[0][j] = j * GAP; B[0][j] = 2; }
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const s = sim(sTok[i - 1], wTok[j - 1]);
      const d = S[i - 1][j - 1] + (s > 0 ? s : -1);
      const u = S[i - 1][j] + GAP, l = S[i][j - 1] + GAP;
      if (d >= u && d >= l) { S[i][j] = d; B[i][j] = 0; } else if (u >= l) { S[i][j] = u; B[i][j] = 1; } else { S[i][j] = l; B[i][j] = 2; }
    }
  const map = new Array(n).fill(null);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (B[i][j] === 0) { if (sim(sTok[i - 1], wTok[j - 1]) > 0) map[i - 1] = j - 1; i--; j--; }
    else if (B[i][j] === 1) i--;
    else j--;
  }
  return map;
}

// Resolve the cue phrases of a scene (copied from the Ablauf table) to times in the spoken words.
function resolveCues(segName, spec, script, words) {
  const sTok = tokenize(script).map((t) => t.n);
  const wTok = words.map((w) => norm(w.text));
  const map = align(sTok, wTok);
  const timeOf = (si, edge) => {
    if (map[si] != null) return edge === "end" ? words[map[si]].end : words[map[si]].start;
    let a = si, b = si;
    while (a >= 0 && map[a] == null) a--;
    while (b < sTok.length && map[b] == null) b++;
    const ta = a >= 0 ? words[map[a]].end : 0;
    const tb = b < sTok.length ? words[map[b]].start : words.at(-1).end;
    return ta + ((si - a) / (b - a)) * (tb - ta);
  };
  const C = {}, E = {}, warn = [];
  let from = 0, fromW = 0;
  for (const [name, raw] of Object.entries(spec.cues || {})) {
    const c = typeof raw === "string" ? { phrase: raw } : raw;
    const pTok = tokenize(c.phrase).map((t) => t.n);
    // 1. the phrase as actually spoken (cut voice): exact token match in the spoken words
    const findW = (start) => {
      for (let i = start; i + pTok.length <= wTok.length; i++) if (pTok.every((p, k) => wTok[i + k] === p)) return i;
      return -1;
    };
    let wHit = findW(c.anywhere ? 0 : fromW);
    if (wHit < 0) wHit = findW(0);
    if (wHit >= 0) {
      if (!c.anywhere) fromW = wHit;
      C[name] = r3(words[wHit + (c.word ?? 0)].start + (c.offset ?? 0));
      E[name] = r3(words[wHit + pTok.length - 1].end);
      continue;
    }
    // 2. else: the phrase in the briefing script, mapped onto the spoken words by alignment
    let hit = -1;
    const search = (start) => {
      for (let i = start; i + pTok.length <= sTok.length; i++) if (pTok.every((p, k) => sTok[i + k] === p)) return i;
      return -1;
    };
    hit = search(c.anywhere ? 0 : from);
    if (hit < 0) hit = search(0);
    if (hit < 0) { warn.push(`${segName}: cue "${name}" phrase neither spoken nor in the script: "${c.phrase}"`); C[name] = 0; E[name] = 0; continue; }
    if (!c.anywhere) from = hit;
    const wi = hit + (c.word ?? 0);
    C[name] = r3(timeOf(wi, "start") + (c.offset ?? 0));
    E[name] = r3(timeOf(hit + pTok.length - 1, "end"));
    const matched = pTok.filter((_, k) => map[hit + k] != null).length;
    if (matched / pTok.length < 1) warn.push(`${segName}: cue "${name}" not spoken verbatim (${matched}/${pTok.length} words found): "${c.phrase}" → ${C[name]} s`);
  }
  return { C, E, warn };
}

// ---------------------------------------------------------------- scene templates
function include(name, attrs) {
  const a = {};
  for (const m of attrs.matchAll(/(\w+)="([^"]*)"/g)) a[m[1]] = m[2];
  const screen = COMP["laptop-screen"];
  if (name === "course") {
    const items = (a.items || "").split("|").filter(Boolean);
    const tick = `<svg viewBox="0 0 58 58"><circle cx="29" cy="29" r="29" fill="#16A34A"/><path d="M16 30 L25 39 L43 20" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const geo = items.length
      ? { lx: 24, ly: 150, lw: 560, lh: 340, fss: 10, fsm: 14, fsl: 23 }
      : { lx: 108, ly: 70, lw: 864, lh: 520, fss: 15, fsm: 22, fsl: 36 };
    const ticks = items.length ? `<ul class="fx-ticks">${items.map((t, i) => `<li id="${a.p}-i${i}">${tick}<span>${esc(t)}</span></li>`).join("")}</ul>` : "";
    return fill(COMP.course, { ...a, ...geo, screen, ticks });
  }
  if (!COMP[name]) throw new Error(`unknown include ${name}`);
  return fill(COMP[name], { ...a, screen });
}
function fill(tpl, vars) {
  return tpl.replace(/\$\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
}
function buildScene(segName, ctx) {
  const file = P("src/scenes", `${segName}.html`);
  let src;
  if (fs.existsSync(file)) src = fs.readFileSync(file, "utf8");
  else src = placeholderScene(segName);
  src = src.replace(/<!--@include\s+([\w-]+)([^>]*?)-->/g, (_, n, at) => include(n, at));
  const evalExpr = (expr) => {
    const f = new Function("C", "E", "DUR", "WORDS", `return (${expr});`);
    const v = f(ctx.C, ctx.E, ctx.DUR, ctx.WORDS);
    return typeof v === "number" ? String(r3(v)) : String(v);
  };
  src = src.replace(/\{\{([\s\S]+?)\}\}/g, (_, e) => evalExpr(e));
  // inject shared CSS + runtime data + FX helpers
  src = src.replace(/<style>/, `<style>\n${FX_CSS}\n`);
  const data = `const C = ${JSON.stringify(ctx.C)};\nconst E = ${JSON.stringify(ctx.E)};\nconst DUR = ${r3(ctx.DUR)};\nconst WORDS = ${JSON.stringify(ctx.WORDS.map((w) => [w.text, w.start, w.end]))};\n`;
  src = src.replace(/<script>/, `<script>\n${data}${FX_JS}\n`);
  return src;
}
function placeholderScene(segName) {
  return `<template>
  <style>#root { position: absolute; inset: 0; background: #fff; } #${segName}-ph { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font: 700 60px 'Poppins'; color: #9CA3AF; }</style>
  <div id="root" data-composition-id="${segName}" data-width="1080" data-height="710">
    <div id="${segName}-ph" class="clip" data-start="0" data-duration="{{DUR}}">${segName}</div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    window.__timelines["${segName}"] = tl;
  </script>
</template>`;
}

// ---------------------------------------------------------------- captions
// 8 px black outline (Untertitel-Spec) as a ring of text-shadows: round corners, no miter spikes
// like -webkit-text-stroke produces on "v", "A", "W".
const OUTLINE = [[8, 40], [5, 24], [2.5, 12]]
  .flatMap(([r, n]) => Array.from({ length: n }, (_, k) => `${(r * Math.cos((2 * Math.PI * k) / n)).toFixed(2)}px ${(r * Math.sin((2 * Math.PI * k) / n)).toFixed(2)}px 0 #000`))
  .join(", ");
const SENT_END = /[.?!:]["“”]?$/;
const COMMA = /[,;]["“”]?$/;
// Untertitel: Zahlen als Ziffern ("neun Jahre" → "9 Jahre", "zehnmal" → "10 Mal"). "Null" (the pocket)
// and the articles ein/eine/einen stay words.
const NUM = { zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12,
  fünfzehn: 15, zwanzig: 20, dreißig: 30, vierzig: 40, fünfzig: 50, sechzig: 60, hundert: 100, tausend: "1.000" };
function digits(text) {
  const m = text.match(/^([„"]?)([A-Za-zÄÖÜäöüß]+)(.*)$/);
  if (!m) return text;
  const low = m[2].toLowerCase();
  if (low in NUM) return `${m[1]}${NUM[low]}${m[3]}`;
  const mal = low.match(/^(.+)mal$/);
  if (mal && mal[1] in NUM) return `${m[1]}${NUM[mal[1]]} Mal${m[3]}`;
  return text;
}
function captionTokens(words) {
  const toks = [];
  for (const w0 of words) {
    const w = { ...w0, text: digits(w0.text) };
    const t = w.text.replace(/[.,;:]+(["“”]?)$/, "$1");
    if (/^prozent[.,;:?!]*$/i.test(w.text) && toks.length && /^\d+(,\d+)?$/.test(toks.at(-1).text)) {
      const prev = toks.at(-1);
      prev.text = `${prev.text} %`;
      prev.end = w.end;
      prev.brk = SENT_END.test(w.text) ? 2 : COMMA.test(w.text) ? 1 : 0;
      continue;
    }
    if (!t) continue;
    toks.push({ text: t, start: w.start, end: w.end, brk: SENT_END.test(w.text) ? 2 : COMMA.test(w.text) ? 1 : 0 });
  }
  return toks;
}
function layoutLines(texts, maxW, gap) {
  // returns {fs, lines} with ≤ 2 lines, or null
  for (let fs = 64; fs >= 44; fs -= 2) {
    const lines = [];
    let cur = [], w = 0;
    let ok = true;
    for (const t of texts) {
      const tw = textWidth(t, fs);
      if (tw > maxW) { ok = false; break; }
      const nw = cur.length ? w + gap + tw : tw;
      if (nw <= maxW) { cur.push(t); w = nw; } else { lines.push(cur); cur = [t]; w = tw; }
    }
    if (!ok) continue;
    if (cur.length) lines.push(cur);
    if (lines.length <= 2) return { fs, lines };
    return null;
  }
  return null;
}
function captionGroups(toks, maxW) {
  const GAP = 22;
  const groups = [];
  let g = [];
  const flush = () => { if (g.length) groups.push(g); g = []; };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (g.length) {
      const prev = g.at(-1);
      const pause = t.start - prev.end;
      const fits = layoutLines([...g, t].map((x) => x.text), maxW, GAP);
      if (g.length >= 3 || prev.brk || pause >= 0.35 || !fits) flush();
    }
    g.push(t);
  }
  flush();
  return groups.map((gr, i) => {
    const lay = layoutLines(gr.map((x) => x.text), maxW, GAP) || { fs: 44, lines: [gr.map((x) => x.text)] };
    const next = groups[i + 1];
    const start = gr[0].start;
    let end = gr.at(-1).end + 0.25;
    if (next) end = next[0].start - gr.at(-1).end < 0.6 ? next[0].start : Math.min(end, next[0].start);
    return { words: gr, start, end, ...lay };
  });
}
function captionsHtml(words, fmt, total) {
  const F = FORMAT[fmt];
  const groups = captionGroups(captionTokens(words), F.cap.w);
  if (groups.length) groups[0].start = 0; // subtitles are on screen from frame 1 (see sketches)
  let wi = 0;
  const sets = [];
  const html = groups
    .map((g, gi) => {
      let k = 0;
      const lines = g.lines
        .map((line) => `<div class="capl" style="font-size:${g.fs}px">${line.map(() => { const w = g.words[k++]; const id = `cap-w${wi++}`; w.id = id; return `<span id="${id}" class="capw">${esc(w.text)}</span>`; }).join("")}</div>`)
        .join("");
      g.words.forEach((w, j) => {
        const on = gi === 0 && j === 0 ? 0 : w.start;
        const off = j + 1 < g.words.length ? g.words[j + 1].start : g.end;
        sets.push(`tl.set("#${w.id}", { color: "#FACC15" }, ${r3(on)});`, `tl.set("#${w.id}", { color: "#FFFFFF" }, ${r3(Math.max(on + 0.04, off))});`);
      });
      const end = Math.min(g.end, total);
      return `    <div id="cap-g${gi}" class="clip capg" data-start="${r3(g.start)}" data-duration="${r3(Math.max(0.05, end - g.start))}">${lines}</div>`;
    })
    .join("\n");
  return `<template>
  <style>
    #root { position: absolute; inset: 0; pointer-events: none; }
    .capg { position: absolute; left: ${F.cap.x}px; top: ${F.cap.y}px; width: ${F.cap.w}px; height: ${F.cap.h}px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .capl { display: block; white-space: nowrap; font-family: 'Poppins'; font-weight: 700; line-height: 80px; }
    .capw { display: inline-block; margin: 0 11px; color: #FFFFFF; text-shadow: ${OUTLINE}; }
  </style>
  <div id="root" data-composition-id="cap" data-width="${F.W}" data-height="${F.H}" data-layout-allow-caption-zone>
${html}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${sets.join("\n    ")}
    window.__timelines["cap"] = tl;
  </script>
</template>`;
}

// ---------------------------------------------------------------- root composition
function hookFont(text, maxW) {
  for (let fs = 64; fs >= 54; fs -= 1) if (textWidth(text, fs) <= maxW - 56) return fs;
  return 54;
}
const SILHOUETTE = `<svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%"><rect width="100" height="100" fill="#DDE3EA"/><circle cx="50" cy="40" r="17" fill="#9CA3AF"/><path d="M18 100 C18 72 33 62 50 62 C67 62 82 72 82 100 Z" fill="#9CA3AF"/></svg>`;

function rootHtml(v) {
  const F = FORMAT[v.fmt];
  const { hook, body } = v;
  const total = r3(hook.dur + body.dur);
  const hfs = hookFont(v.hookText, F.hook.maxW);
  const K = F.kil;
  const camHook = hook.media?.cam, camBody = body.media?.cam;
  const cam = camHook && camBody
    ? `<video id="kil-v1" class="clip" src="${camHook}" data-start="0" data-duration="${r3(hook.dur)}" muted playsinline></video>
          <video id="kil-v2" class="clip" src="${camBody}" data-start="${r3(hook.dur)}" data-duration="${r3(body.dur)}" muted playsinline></video>`
    : SILHOUETTE;
  const audio = [];
  if (hook.media?.voice) audio.push(`<audio id="vo-1" class="clip" src="${hook.media.voice}" data-start="0" data-duration="${r3(Math.min(hook.dur, hook.media.duration))}" data-volume="1"></audio>`);
  if (body.media?.voice) audio.push(`<audio id="vo-2" class="clip" src="${body.media.voice}" data-start="${r3(hook.dur)}" data-duration="${r3(Math.min(body.dur, body.media.duration))}" data-volume="1"></audio>`);
  v.sfx.forEach((s, i) => audio.push(`<audio id="sfx-${i}" class="clip" src="${s.src}" data-start="${r3(s.start)}" data-duration="${r3(s.dur)}" data-volume="${s.vol}"></audio>`));
  if (fs.existsSync(P("assets/music/bed.wav"))) audio.push(`<audio id="music" class="clip" src="assets/music/bed.wav" data-start="0" data-duration="${total}" data-volume="0.1" data-fade-out="0.5"></audio>`);
  const cuts = [...(hook.media?.cuts || []), ...(body.media?.cuts || []).map((t) => t + hook.dur), hook.dur];
  const zoomSets = cuts.filter((t) => t > 0.05 && t < total - 0.05).sort((a, b) => a - b)
    .map((t, i) => `tl.set("#kil-z", { scale: ${i % 2 === 0 ? 1.08 : 1} }, ${r3(t)});`).join("\n      ");
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${F.W}, height=${F.H}" />
    <title>${v.name}</title>
    <script src="assets/lib/gsap.min.js"></script>
    <style>
      @font-face { font-family: 'Poppins'; font-weight: 400; src: url('assets/fonts/Poppins-400.woff2') format('woff2'); }
      @font-face { font-family: 'Poppins'; font-weight: 600; src: url('assets/fonts/Poppins-600.woff2') format('woff2'); }
      @font-face { font-family: 'Poppins'; font-weight: 700; src: url('assets/fonts/Poppins-700.woff2') format('woff2'); }
      @font-face { font-family: 'Poppins'; font-weight: 700; src: url('assets/fonts/Poppins-700-ext.woff2') format('woff2'); unicode-range: U+0100-024F, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF; }
      @font-face { font-family: 'Poppins'; font-weight: 800; src: url('assets/fonts/Poppins-800.woff2') format('woff2'); }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${F.W}px; height: ${F.H}px; overflow: hidden; background: #FFFFFF; }
      #root { position: relative; width: 100%; height: 100%; background: #FFFFFF; font-family: 'Poppins'; }
      #motif { position: absolute; left: ${F.motif.x}px; top: ${F.motif.y}px; width: 1080px; height: 710px; overflow: hidden; transform-origin: 0 0; transform: scale(${F.motif.scale}); background: #FFFFFF; }
      #hook { position: absolute; left: 0; top: ${F.hook.top}px; width: ${F.W}px; height: ${F.hook.h}px; display: flex; justify-content: center; z-index: 20; }
      #hook-bar { height: ${F.hook.h}px; max-width: ${F.hook.maxW}px; padding: 0 28px; border-radius: 20px; background: #0E1A2B; color: #FFFFFF; font-family: 'Poppins'; font-weight: 700; font-size: ${hfs}px; line-height: ${F.hook.h}px; white-space: nowrap; }
      /* Kilian-Kreis: weiße Scheibe (Rand 8 px + Schatten) und eine 8 px kleinere Video-Maske, beide nur per Transform skaliert. */
      #kil-ring { position: absolute; left: ${K.x}px; top: ${K.big.y}px; width: ${K.big.d}px; height: ${K.big.d}px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 0 ${r3(24 * K.big.d / K.small.d)}px rgba(0, 0, 0, 0.25); transform-origin: 0% 100%; z-index: 30; }
      #kil { position: absolute; left: ${K.x + 8}px; top: ${K.big.y + 8}px; width: ${K.big.d - 16}px; height: ${K.big.d - 16}px; border-radius: 50%; overflow: hidden; background: #DDE3EA; transform-origin: 50% 50%; z-index: 31; }
      #kil-z { position: absolute; inset: 0; transform-origin: 50% 40%; }
      #kil-z video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${F.W}" data-height="${F.H}" data-fps="30">
      <div id="motif">
        <div id="${hook.seg}" data-composition-id="${hook.seg}" data-composition-src="compositions/${hook.seg}.html" data-start="0" data-duration="${r3(hook.dur)}" data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="710"></div>
        <div id="${body.seg}" data-composition-id="${body.seg}" data-composition-src="compositions/${body.seg}.html" data-start="${r3(hook.dur)}" data-duration="${r3(body.dur)}" data-track-index="2" data-track-kind="graphics" data-width="1080" data-height="710"></div>
      </div>
      <div id="hook" class="clip" data-start="0" data-duration="3.7" data-track-index="3"><div id="hook-bar">${esc(v.hookText)}</div></div>
      <div id="kil-ring"></div>
      <div id="kil"><div id="kil-z" data-layout-allow-overflow>
          ${cam}
      </div></div>
      <div id="cap" data-composition-id="cap" data-composition-src="compositions/cap.html" data-start="0" data-duration="${total}" data-track-index="5" data-track-kind="captions" data-width="${F.W}" data-height="${F.H}"></div>
      ${audio.join("\n      ")}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      tl.fromTo("#hook-bar", { opacity: 1 }, { opacity: 0, duration: 0.2, ease: "none", immediateRender: false }, 3.5);
      // Kilian 0-2 s groß, dann in 0,4 s weich (ease-in-out) auf die kleine Größe, unten links verankert.
      tl.fromTo("#kil-ring", { scale: 1 }, { scale: ${r3(K.small.d / K.big.d)}, duration: 0.4, ease: "power1.inOut", immediateRender: false }, 2);
      tl.fromTo("#kil", { scale: 1, x: 0, y: 0 }, { scale: ${(K.small.d - 16) / (K.big.d - 16)}, x: ${(K.small.d - K.big.d) / 2}, y: ${(K.big.d - K.small.d) / 2}, duration: 0.4, ease: "power1.inOut", immediateRender: false }, 2);
      ${zoomSets}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

// ---------------------------------------------------------------- main
function segment(ad, part) {
  const seg = `${ad.key}-${part === "body" ? "body" : "hook" + part}`;
  const script = ad.script[part];
  const real = !FORCE_PLACEHOLDER && readJSON(P("data/timing", `${seg}.words.json`));
  const words = real || placeholderWords(script);
  const media = FORCE_PLACEHOLDER ? null : readJSON(P("data/media", `${seg}.json`));
  const tail = part === "body" ? BODY_TAIL : HOOK_TAIL;
  const dur = media?.duration ? media.duration + (part === "body" ? BODY_TAIL : 0) : words.at(-1).end + tail;
  const spec = readJSON(P("src/scenes", `${seg}.cues.json`), { cues: {} });
  const { C, E, warn } = resolveCues(seg, spec, script, words);
  return { seg, part, script, words, media, dur: r3(dur), spec, C, E, warn, placeholder: !real };
}
function sfxFor(s, offset) {
  const out = [];
  for (const x of s.spec.sfx || []) {
    const def = SFX[x.type];
    if (!def) { s.warn.push(`${s.seg}: unknown sfx type ${x.type}`); continue; }
    let t = x.t != null ? (typeof x.t === "number" ? x.t : new Function("C", "E", "DUR", `return (${x.t});`)(s.C, s.E, s.dur)) : s.C[x.at];
    if (t == null || Number.isNaN(t)) { s.warn.push(`${s.seg}: sfx cue ${x.at} unresolved`); continue; }
    t += x.offset ?? 0;
    const take = def.takes[(x.take ?? out.length) % def.takes.length];
    out.push({ type: x.type, src: `assets/sfx/${take.file}`, start: Math.max(0, offset + t - take.peak + 1 / 30), dur: take.dur, vol: def.vol, gainDb: def.gainDb ?? 0 });
  }
  return out;
}

fs.mkdirSync(OUT, { recursive: true });
const manifest = [];
const allWarn = new Set();
for (const ad of SEG.ads) {
  if (ONLY && !ONLY.includes(ad.key)) continue;
  const body = segment(ad, "body");
  for (const h of HOOKS) {
    const hook = segment(ad, h);
    for (const fmt of FORMATS) {
      const name = `FC_Loom_${ad.file}_${h}_${fmt}`;
      const dir = path.join(OUT, name);
      fs.mkdirSync(path.join(dir, "compositions"), { recursive: true });
      const assetsLink = path.join(dir, "assets");
      if (!fs.existsSync(assetsLink)) fs.symlinkSync(path.relative(dir, P("assets")), assetsLink);
      for (const s of [hook, body]) {
        fs.writeFileSync(path.join(dir, "compositions", `${s.seg}.html`), buildScene(s.seg, { C: s.C, E: s.E, DUR: s.dur, WORDS: s.words }));
        s.warn.forEach((w) => allWarn.add(w));
      }
      const words = [...hook.words, ...body.words.map((w) => ({ ...w, start: r3(w.start + hook.dur), end: r3(w.end + hook.dur) }))];
      const total = r3(hook.dur + body.dur);
      fs.writeFileSync(path.join(dir, "compositions", "cap.html"), captionsHtml(words, fmt, total));
      const sfx = [...sfxFor(hook, 0), ...sfxFor(body, hook.dur)];
      const v = { name, fmt, ad, hook, body, hookText: ad.hook[h], sfx };
      fs.writeFileSync(path.join(dir, "index.html"), rootHtml(v));
      fs.writeFileSync(path.join(dir, "hyperframes.json"), JSON.stringify({ $schema: "https://hyperframes.heygen.com/schema/hyperframes.json", paths: { blocks: "compositions", components: "compositions/components", assets: "assets" }, media: { autoProxy: true } }, null, 2));
      fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ id: name, name }, null, 2));
      fs.writeFileSync(path.join(dir, "mix.json"), JSON.stringify({
        name, duration: total, tempo: ad.tempo, placeholder: hook.placeholder || body.placeholder,
        voice: [hook.media?.voiceWav && { src: hook.media.voiceWav, start: 0 }, body.media?.voiceWav && { src: body.media.voiceWav, start: hook.dur }].filter(Boolean),
        sfx: sfx.map((s) => ({ src: s.src, start: r3(s.start), gainDb: s.gainDb })),
        hookDur: hook.dur, cues: { [hook.seg]: hook.C, [body.seg]: body.C },
      }, null, 2));
      manifest.push({ name, dir: path.relative(ROOT, dir), duration: total, placeholder: hook.placeholder || body.placeholder });
    }
  }
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
for (const w of allWarn) console.warn("⚠", w);
console.log(`built ${manifest.length} variant(s) into ${path.relative(ROOT, OUT) || "."}`);
for (const m of manifest) console.log(`  ${m.name}  ${m.duration.toFixed(2)} s${m.placeholder ? "  (placeholder timing)" : ""}`);
