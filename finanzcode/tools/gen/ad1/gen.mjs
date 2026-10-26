// Generator for the repeated SVG parts of the Ad 1 scenes (roulette wheel, chart candles, trade icons).
// Usage: node gen.mjs <scene.html> [...]  -> replaces every <!--gen:NAME args--> ... <!--/gen:NAME--> block in place.
import fs from "node:fs";

const f = (n) => (Math.round(n * 100) / 100).toString();
export const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const STEP = 360 / 37;
const pt = (r, a) => { const t = (a * Math.PI) / 180; return [r * Math.sin(t), -r * Math.cos(t)]; };
function sector(r0, r1, a0, a1) {
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0);
  return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 0 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r0} ${r0} 0 0 0 ${f(x3)} ${f(y3)}Z`;
}
const col = (n, floor) => (n === 0 ? (floor ? "#15803D" : "#16A34A") : RED.has(n) ? (floor ? "#B91C1C" : "#DC2626") : floor ? "#111827" : "#1F2937");

// Geometry (local units, wheel centre at 0,0, outer radius 320)
export const G = { R: 320, track: 277, numR: 226, ringOut: 246, ringMid: 205, ringIn: 160, pocketBall: 182 };

// Roulette wheel seen from above. opts: numbers, ball (track ball), ballIn (ball in the zero pocket), zero (pulse overlay)
export function wheel(p, o = {}) {
  const L = [];
  // static bowl: wooden rim, ball track, deflectors, brass ring
  L.push(`<circle r="320" fill="#4A2A12"/>`, `<circle r="314" fill="#8A5226"/>`, `<circle r="300" fill="#9C5F2D"/>`, `<circle r="293" fill="#6B3D1B"/>`, `<circle r="262" fill="#4A2A12"/>`);
  for (let k = 0; k < 8; k++) L.push(`<path d="M0 -265 L6 -256 L0 -247 L-6 -256 Z" fill="#D4A017" transform="rotate(${22.5 + k * 45})"/>`);
  L.push(`<circle r="250" fill="#C9971C"/>`);
  // rotating wheelhead
  const S = [];
  S.push(`<circle r="246" fill="#1F2937"/>`);
  ORDER.forEach((n, i) => {
    const a = i * STEP, a0 = a - STEP / 2, a1 = a + STEP / 2;
    if (n !== 0 && !RED.has(n)) {
      S.push(`<path d="${sector(G.ringIn, G.ringMid, a0, a1)}" fill="${col(n, true)}"/>`);
    } else {
      S.push(`<path d="${sector(G.ringMid, G.ringOut, a0, a1)}" fill="${col(n, false)}"/>`);
      S.push(`<path d="${sector(G.ringIn, G.ringMid, a0, a1)}" fill="${col(n, true)}"/>`);
    }
  });
  // frets + brass rings
  const frets = ORDER.map((_, i) => { const a = i * STEP - STEP / 2; const [x0, y0] = pt(G.ringIn, a), [x1, y1] = pt(G.ringOut, a); return `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`; }).join("");
  S.push(`<path d="${frets}" stroke="#D4A017" stroke-width="2.4" fill="none"/>`);
  S.push(`<circle r="${G.ringMid}" fill="none" stroke="#D4A017" stroke-width="3"/>`);
  S.push(`<circle r="${G.ringOut}" fill="none" stroke="#D4A017" stroke-width="3"/>`);
  if (o.numbers) {
    // only the pockets that can be seen in the close-up (zero ± 3) carry numbers
    const N = ORDER.map((n, i) => (Math.min(i, 37 - i) <= 3 ? `<text transform="rotate(${f(i * STEP)}) translate(0 ${-G.numR})" fill="#FFFFFF">${n}</text>` : "")).join("");
    S.push(`<g id="${p}-nums" font-family="Poppins" font-weight="700" font-size="17" text-anchor="middle" dominant-baseline="central">${N}</g>`);
  }
  // cone with brass turret
  S.push(`<circle r="160" fill="#C9971C"/>`, `<circle r="156" fill="#6E4220"/>`, `<circle r="148" fill="#9A6332"/>`, `<circle r="112" fill="#AD7442"/>`, `<circle r="74" fill="#BE8650"/>`);
  for (let k = 0; k < 4; k++) S.push(`<g transform="rotate(${k * 90 + 45})"><rect x="-7" y="-104" width="14" height="96" rx="7" fill="#D4A017"/><circle cy="-104" r="12" fill="#E9C14A"/></g>`);
  S.push(`<circle r="26" fill="#D4A017"/>`, `<circle r="15" fill="#F2D06B"/>`);
  if (o.zero) S.push(`<path id="${p}-zp" d="${sector(G.ringIn, G.ringOut, -STEP / 2, STEP / 2)}" fill="#16A34A" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round"/>`);
  if (o.ballIn) S.push(`<g id="${p}-bin">${ball(-G.pocketBall)}</g>`);
  L.push(`<g id="${p}-spin">${S.join("")}</g>`);
  if (o.ball) L.push(`<g id="${p}-borb"><g id="${p}-bdrop">${ball(-G.track)}</g></g>`);
  return L.join("\n");
}
function ball(y) {
  return `<circle cy="${y}" r="10.5" fill="#D1D5DB"/><circle cx="-1.2" cy="${y - 1.2}" r="8.6" fill="#FFFFFF"/>`;
}

// Candle chart (light background, no grid, no prices) + trade box geometry.
export function chart(p) {
  const deltas = [3, -2, 4, 2, -3, -1, 4, 3, -2, 5, -4, -2, 3, 4, -1, 5, 2, -3, -2, 4, 3, -1, 2, 6];
  const wicks = [[1.2, 0.8], [0.6, 1.5], [1.8, 0.7], [0.9, 1.1], [1.4, 1.9], [0.7, 1.2], [1.1, 0.6], [1.6, 1.0], [0.8, 1.7], [1.3, 0.9], [0.9, 2.0], [1.5, 1.1], [0.7, 0.8], [1.2, 1.4], [1.0, 1.6], [1.4, 0.7], [0.8, 1.2], [1.6, 1.3], [0.9, 1.8], [1.1, 0.8], [1.3, 1.0], [0.7, 1.5], [1.2, 0.9], [0.9, 0.8]];
  let c = 100;
  const K = deltas.map((d, i) => { const o = c; c = o + d; const [wu, wd] = wicks[i]; return { o, c, h: Math.max(o, c) + wu, l: Math.min(o, c) - wd }; });
  const lo = Math.min(...K.map((k) => k.l)), hi = Math.max(...K.map((k) => k.h));
  const Y0 = 628, Y1 = 380; // price range -> pixels
  const y = (v) => Y0 - ((v - lo) / (hi - lo)) * (Y0 - Y1);
  const x0 = 82, dx = 28.4, bw = 19;
  const svg = K.map((k, i) => {
    const x = x0 + i * dx, up = k.c >= k.o, fill = up ? "#16A34A" : "#DC2626";
    const top = y(Math.max(k.o, k.c)), bot = y(Math.min(k.o, k.c));
    return `<g fill="${fill}"><rect x="${f(x - 2)}" y="${f(y(k.h))}" width="4" height="${f(y(k.l) - y(k.h))}" rx="2"/><rect x="${f(x - bw / 2)}" y="${f(top)}" width="${bw}" height="${f(Math.max(4, bot - top))}" rx="2.5"/></g>`;
  }).join("\n");
  const ex = x0 + (K.length - 1) * dx, ey = Math.round(y(K.at(-1).c)), u = 104;
  const bx = Math.round(ex + 26), bw2 = 70, lx = bx + bw2 + 20;
  const zc = ey - u, sc = ey + u / 2;
  const over = [
    `<path id="${p}-entry" d="M${f(ex - 8)} ${ey} H${bx + bw2 + 6}" stroke="#0E1A2B" stroke-width="5" stroke-dasharray="14 10" fill="none"/>`,
    `<rect id="${p}-zbar" x="${bx}" y="${ey - 2 * u}" width="${bw2}" height="${2 * u}" rx="8" fill="#16A34A"/>`,
    `<rect id="${p}-sbar" x="${bx}" y="${ey}" width="${bw2}" height="${u}" rx="8" fill="#DC2626"/>`,
  ].join("\n");
  const labels = [
    `<div id="${p}-zlab" class="a1b-clab" style="left: ${lx}px; top: ${zc - 28}px;">Ziel 2</div>`,
    `<div id="${p}-slab" class="a1b-clab" style="left: ${lx}px; top: ${sc - 28}px;">Stop 1</div>`,
    `<svg class="fx-svg" viewBox="0 0 1080 710"><path id="${p}-uline" class="fx-stroke" pathLength="1" d="${`M${lx - 2} ${zc + 42} Q${lx + 74} ${zc + 48} ${lx + 150} ${zc + 39}`}"/></svg>`,
  ].join("\n");
  return { svg, over, labels, entryX: ex, entryY: ey };
}

// Row of trade results: green tick / red X circles.
export function trades(p, pattern = "WWLWLWWL", cy = 355, r = 50, gap = 122) {
  const n = pattern.length, x0 = 540 - ((n - 1) * gap) / 2;
  return [...pattern].map((ch, i) => {
    const cx = f(x0 + i * gap);
    const icon = ch === "W"
      ? `<circle r="${r}" fill="#16A34A"/><path d="M-22 2 L-6 18 L24 -16" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<circle r="${r}" fill="#DC2626"/><path d="M-17 -17 L17 17 M17 -17 L-17 17" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>`;
    return `<g transform="translate(${cx} ${cy})"><g id="${p}-t${i}">${icon}</g></g>`;
  }).join("\n");
}

const GEN = {
  wheel: (a) => wheel(a.p, { numbers: a.numbers === "1", ball: a.ball === "1", ballIn: a.ballIn === "1", zero: a.zero === "1" }),
  candles: (a) => chart(a.p).svg,
  chartover: (a) => chart(a.p).over,
  chartlabels: (a) => chart(a.p).labels,
  trades: (a) => trades(a.p),
};
if (process.argv[1] && process.argv[1].endsWith("gen.mjs")) {
  for (const file of process.argv.slice(2)) {
    let src = fs.readFileSync(file, "utf8");
    src = src.replace(/<!--gen:(\w+)([^>]*?)-->[\s\S]*?<!--\/gen:\1-->/g, (_, name, at) => {
      const a = {};
      for (const m of at.matchAll(/(\w+)="([^"]*)"/g)) a[m[1]] = m[2];
      return `<!--gen:${name}${at}-->\n${GEN[name](a)}\n<!--/gen:${name}-->`;
    });
    fs.writeFileSync(file, src);
    console.log("generated", file);
  }
  const ch = chart("x");
  console.log("chart entry", ch.entryX, ch.entryY);
}
