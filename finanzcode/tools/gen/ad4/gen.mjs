// Generates src/scenes/ad4-hookA.html, ad4-hookB.html, ad4-body.html.
// Shared card / portrait markup so the hook grid and the body grid are identical at the seam.
import fs from "node:fs";
import path from "node:path";
import { PORTRAITS, ASSET } from "./art.mjs";

const ROOT = "/home/user/test/finanzcode";
const FX = new Function(fs.readFileSync(path.join(ROOT, "src/fx.js"), "utf8") + "; return FX;")();

// ------------------------------------------------------------------ geometry (scene px)
// Every card is built at its "groß" size (912 x 638 = 90 % of the Motiv-Zone height) and is
// scaled to 1/1.9 (480 x 336) in the 2 x 2 grid. Grid: 48 px side margin, 24 px gap; 10 px top/bottom, 18 px gap.
const SL = [[288, 178], [792, 178], [288, 532], [792, 532]];
const NAMES = [["Der Zocker"], ["Der Dauerlerner"], ["Der Ungeduldige"], ["Der, der", "dranbleibt"]];
const VALS = [[["Risiko", "10"], ["Plan", "0"]], [["Wissen", "9"], ["Trades", "0"]], [["Geduld", "0"], ["Frust", "10"]], [["Plan", "10"], ["Geduld", "9"]]];

// sampled cursor path along a drawn circle: same easing as FX.draw (power1.inOut), so the tip follows the pen
function tracePoints(d, n = 20, off = [0, 0]) {
  const pts = [...d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map((m) => [+m[1] + off[0], +m[2] + off[1]]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum.at(-1);
  const at = (s) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
  };
  const out = [];
  for (let k = 0; k <= n; k++) {
    const p = k / n, e = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
    out.push(at(e * L).map((v) => Math.round(v * 10) / 10));
  }
  return out;
}
// closed Catmull-Rom loop through the 3 open cards (cursor "kreist über die 3 offenen Karten")
function loopPoints(wp, n) {
  const P = (i) => wp[(i + wp.length) % wp.length];
  const out = [];
  for (let k = 0; k <= n; k++) {
    const u = (k / n) * wp.length, i = Math.floor(u) % wp.length, t = u - Math.floor(u);
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t * t + (-a + 3 * b - 3 * c2 + d) * t * t * t);
    out.push([Math.round(c(p0[0], p1[0], p2[0], p3[0])), Math.round(c(p0[1], p1[1], p2[1], p3[1]))]);
  }
  return out;
}
const LOOP = loopPoints([[318, 196], [806, 196], [318, 548]], 36);

// ------------------------------------------------------------------ markup
function css(P) {
  return `
    .${P}-layer { position: absolute; left: 0; top: 0; width: 1080px; height: 710px; }
    .${P}-card { position: absolute; left: 84px; top: 36px; width: 912px; height: 638px; }
    .${P}-face, .${P}-back { position: absolute; left: 0; top: 0; width: 912px; height: 638px; border-radius: 40px; overflow: hidden; }
    .${P}-face { background: #F3F4F6; }
    .${P}-rim { position: absolute; left: 0; top: 0; width: 912px; height: 638px; border-radius: 40px; border: 8px solid #0E1A2B; box-sizing: border-box; }
    .${P}-photo { position: absolute; left: 32px; top: 32px; width: 380px; height: 574px; border-radius: 24px; overflow: hidden; background: #DDE3EA; }
    .${P}-photo svg { position: absolute; left: 0; top: 0; width: 380px; height: 574px; }
    .${P}-dig { position: absolute; left: 512px; top: 210px; width: 300px; height: 220px; display: flex; align-items: center; justify-content: center; font-family: 'Poppins'; font-weight: 700; font-size: 190px; line-height: 1; color: #0E1A2B; }
    .${P}-back { background: #0E1A2B; }
    .${P}-backin { position: absolute; left: 30px; top: 30px; width: 852px; height: 578px; border-radius: 26px; border: 8px solid #9CA3AF; box-sizing: border-box; }
    .${P}-qm { position: absolute; left: 0; top: 0; width: 912px; height: 638px; display: flex; align-items: center; justify-content: center; font-family: 'Poppins'; font-weight: 700; font-size: 361px; line-height: 1; color: #FFFFFF; }
    .${P}-name { position: absolute; left: 40px; top: 24px; font-family: 'Poppins'; font-weight: 700; font-size: 96px; line-height: 106px; color: #0E1A2B; white-space: nowrap; }
    .${P}-val { position: absolute; left: 444px; width: 436px; height: 100px; border-radius: 20px; background: #FFFFFF; display: flex; align-items: center; justify-content: space-between; padding: 0 30px; box-sizing: border-box; font-family: 'Poppins'; font-weight: 700; font-size: 72px; line-height: 1; color: #0E1A2B; white-space: nowrap; }
    .${P}-ov { position: absolute; left: 0; top: 0; width: 912px; height: 638px; overflow: visible; pointer-events: none; }`;
}

// one card. big = include the elements that only appear when the card flies to the front (body).
function card(P, i, big) {
  const n = i + 1;
  const face = (extra = "") => `
            <div class="${P}-face">
              <div id="${P}-p${n}" class="${P}-photo photo-slot" data-asset="${ASSET[i]}"><svg id="${P}-pi${n}" viewBox="0 0 380 574">${PORTRAITS[i]}</svg></div>
              <div id="${P}-d${n}" class="${P}-dig">${n}</div>${big ? bigParts(P, i) : ""}
              <div class="${P}-rim"></div>
            </div>${extra}`;
  let inner;
  if (n < 4) inner = face();
  else
    inner = `
            <div id="${P}-front4" class="${P}-layer" style="left:0;top:0;width:912px;height:638px;">${face()}
            </div>
            <div id="${P}-back4" class="${P}-back"><div class="${P}-backin"></div><div class="${P}-qm">?</div></div>`;
  const over = big ? overlay(P, i) : "";
  return `
      <div id="${P}-s${n}" class="${P}-layer">
        <div id="${P}-w${n}" class="${P}-layer">
          <div id="${P}-c${n}" class="${P}-card">${inner}${over}
          </div>
        </div>
      </div>`;
}
function bigParts(P, i) {
  const n = i + 1;
  const nameHtml = NAMES[i].join("<br>");
  const vTop = n === 4 ? 256 : 156;
  let s = `
              <div id="${P}-n${n}" class="${P}-name">${nameHtml}</div>
              <div id="${P}-va${n}" class="${P}-val" style="top:${vTop}px"><span>${VALS[i][0][0]}</span><span>${VALS[i][0][1]}</span></div>
              <div id="${P}-vb${n}" class="${P}-val" style="top:${vTop + 116}px"><span>${VALS[i][1][0]}</span><span>${VALS[i][1][1]}</span></div>`;
  if (n === 3) s += clock(P);
  if (n === 4) {
    s += `
              <div id="${P}-badge" style="position:absolute;left:578px;top:30px;width:306px;height:150px;border-radius:26px;background:#0E1A2B;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Poppins';font-weight:700;color:#FFFFFF;line-height:1.08;white-space:nowrap;"><span style="font-size:64px">2.000+</span><span style="font-size:40px">im Coaching</span></div>`;
    [492, 662, 832].forEach((x, k) => {
      s += `
              <svg id="${P}-t${k + 1}" viewBox="0 0 96 96" style="position:absolute;left:${x - 48}px;top:496px;width:96px;height:96px;overflow:visible;"><circle cx="48" cy="48" r="48" fill="#16A34A"/><path d="M26 50 L41 65 L71 33" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    });
  }
  return s;
}
function overlay(P, i) {
  if (i !== 0) return "";
  // "Plan 0" einkreisen (rote Linie, 10 px, Kreis in 0,5 s)
  return `
            <svg class="${P}-ov fx-svg" viewBox="0 0 912 638" style="width:912px;height:638px;"><path id="${P}-o1" class="fx-stroke" pathLength="1" d="${CIRC_PLAN}"/></svg>`;
}
const CIRC_PLAN = FX.handCircle(660, 322, 238, 74, 41);
function clock(P) {
  let marks = "";
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, r1 = 50, r2 = k % 3 === 0 ? 38 : 43;
    marks += `<path d="M${(Math.sin(a) * r1).toFixed(1)} ${(-Math.cos(a) * r1).toFixed(1)} L${(Math.sin(a) * r2).toFixed(1)} ${(-Math.cos(a) * r2).toFixed(1)}" stroke="#0E1A2B" stroke-width="6" stroke-linecap="round"/>`;
  }
  return `
              <svg id="${P}-clock" viewBox="-90 -100 180 190" style="position:absolute;left:466px;top:404px;width:180px;height:190px;overflow:visible;">
                <path d="M-46 52 L-60 80 M46 52 L60 80" stroke="#0E1A2B" stroke-width="10" stroke-linecap="round"/>
                <path d="M-74 -40 A30 30 0 0 1 -34 -80 Z" fill="#0E1A2B"/><path d="M74 -40 A30 30 0 0 0 34 -80 Z" fill="#0E1A2B"/>
                <circle r="64" fill="#FFFFFF" stroke="#0E1A2B" stroke-width="10"/>${marks}
                <path d="M0 0 L0 -30" stroke="#0E1A2B" stroke-width="9" stroke-linecap="round"/>
                <path d="M0 0 L26 14" stroke="#0E1A2B" stroke-width="7" stroke-linecap="round"/>
                <g id="${P}-sec"><path d="M0 10 L0 -48" stroke="#DC2626" stroke-width="5" stroke-linecap="round"/></g>
                <circle r="7" fill="#0E1A2B"/>
              </svg>`;
}

// ------------------------------------------------------------------ hooks
const HOOK_CIRC = FX.handCircle(792, 530, 124, 118, 7); // um das "?" der verdeckten Karte

function hook(variant) {
  const P = variant === "A" ? "a4ha" : "a4hb";
  const id = `ad4-hook${variant}`;
  const cards = [0, 1, 2, 3].map((i) => card(P, i, false)).join("");
  const circ = variant === "A" ? `
      <svg class="fx-svg" viewBox="0 0 1080 710"><path id="${P}-circ" class="fx-stroke" pathLength="1" d="${HOOK_CIRC}"/></svg>` : "";
  const trace = JSON.stringify(tracePoints(HOOK_CIRC));
  const script = variant === "A" ? hookAScript(P, trace) : hookBScript(P);
  return `<template>
  <!-- Ad 4 "Die 3 Typen", Anfang ${variant}. Hook- und Body-Raster nutzen dasselbe Karten-/Porträt-Markup, damit der Übergang Anfang -> Body pixelgleich ist. -->
  <style>
    #root { position: absolute; inset: 0; background: #FFFFFF; overflow: hidden; }
    #${P}-scene { position: absolute; inset: 0; }${css(P)}
  </style>
  <div id="root" data-composition-id="${id}" data-width="1080" data-height="710">
    <div id="${P}-scene" class="clip" data-start="0" data-duration="{{DUR}}">
      <!-- 2 x 2 Raster (Skizze S. 16): Karten 1, 2, 3 offen mit großer Ziffer + Bild (noch ohne Namen), rechts unten verdeckt mit "?". -->${cards}${circ}
      <!--@include cursor p="${P}"-->
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    const S = 1 / 1.9;                                    // Groß-Format 912 x 638 -> Raster 480 x 336
    const SL = ${JSON.stringify(SL)};                     // Kartenmitten im Raster
    const R = [215, 270];                                 // Ruhepunkt am Ende = Startpunkt im Body (Bild Karte 1)
    const LOOP = ${JSON.stringify(LOOP)};

    // Raster-Zustand (t = 0)
    SL.forEach(function (c, i) {
      FX.init(tl, "#${P}-c" + (i + 1), { x: c[0] - 540, y: c[1] - 355, scale: S, transformOrigin: "50% 50%" });
    });
    [1, 2, 3].forEach(function (n) { FX.init(tl, "#${P}-d" + n, { scale: 1.9, transformOrigin: "50% 50%" }); });
    FX.init(tl, "#${P}-d4", { scale: 1.9, transformOrigin: "50% 50%" });
    FX.init(tl, "#${P}-front4", { rotationY: -90, opacity: 0, transformPerspective: 2400, transformOrigin: "50% 50%" });   // Vorderseite von Karte 4: hochkant und unsichtbar (wie im Body vor dem Umdrehen)

    // Frame 1: die Karten werden ausgeteilt – jede rutscht von knapp neben ihrem Platz (leicht gedreht) in 0,25 s (ease-out)
    // an ihren Platz, je 0,08 s versetzt, nach 0,49 s liegen alle 4 (so steht das Skizzen-Raster schon im ersten Frame).
    const DEAL = [[-60, -28, -5], [60, -28, 5], [-60, 28, 4], [60, 28, -5]];
    SL.forEach(function (c, i) {
      const el = "#${P}-s" + (i + 1), o = c[0] + "px " + c[1] + "px", d = DEAL[i];
      const from = { x: d[0], y: d[1], rotation: d[2], scale: 1.05, transformOrigin: o };
      FX.init(tl, el, from);
      FX.tween(tl, el, from, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.25, ease: "power2.out", transformOrigin: o }, i * 0.08);
    });

    // Cursor-Hilfen: jede Bewegung startet erst, wenn die vorige fertig ist (nie zwei Tweens gleichzeitig).
    const steps = [];
    let busy = 0;
    function mv(t, to, d, ease) { t = Math.max(t, busy + 0.01); steps.push({ t: t, to: to, d: d, ease: ease || "power2.inOut" }); busy = t + d; return busy; }
    function path(t, pts, d) { t = Math.max(t, busy + 0.01); const seg = d / (pts.length - 1); for (let i = 1; i < pts.length; i++) steps.push({ t: t + (i - 1) * seg, to: pts[i], d: seg, ease: "none" }); busy = t + d; return busy; }
${script}
    window.__timelines["${id}"] = tl;
  </script>
</template>
`;
}

function hookAScript(P, trace) {
  return `
    // "?"-Karte wackelt leicht (±2,5°, 0,6 s pro Schwung) bis kurz vor "… noch einen 4." und hält dann an.
    const WO = "792px 532px";
    const tCirc = Math.max(1.8, C.vierter - 0.1);
    FX.init(tl, "#${P}-w4", { rotation: -2.5, transformOrigin: WO });
    const w = FX.wobble(tl, "#${P}-w4", 0, Math.max(0.6, tCirc - 0.35), { deg: 2.5, origin: WO });
    FX.settle(tl, "#${P}-w4", w.end, w.endRotation, { origin: WO });

    // "… aber es gibt noch einen 4." -> die verdeckte Karte wird eingekreist (rot, 0,5 s); der Cursor zeichnet mit.
    FX.drawCircle(tl, "#${P}-circ", tCirc);
    const TRACE = ${trace};

    // Cursor: kreist ab Frame 1 über die 3 offenen Karten (1 Runde ≈ 1,6 s), danach ruhig.
    path(0, LOOP, 1.6);
    mv(Math.max(C.aber, tCirc - 0.8), TRACE[0], Math.min(0.7, Math.max(0.3, tCirc - 0.05 - Math.max(C.aber, busy + 0.01))));
    path(tCirc, TRACE, 0.5);
    // "… und zu dem kommen wir gleich." -> ruhig zurück auf Karte 1 (dort klickt der Body weiter).
    const tBack = Math.max(busy + 0.25, Math.min(E.gleich - 0.9, DUR - 1.0));
    mv(tBack, R, Math.max(0.3, Math.min(0.8, DUR - 0.1 - tBack)));
    FX.cursor(tl, "#${P}-cur", "#${P}-ring", LOOP[0], steps);
`;
}
function hookBScript(P) {
  return `
    // "?"-Karte wackelt leicht (±2,5°, 0,6 s pro Schwung) durch den ganzen Anfang und steht am Ende still (Übergang in den Body).
    const WO = "792px 532px";
    FX.init(tl, "#${P}-w4", { rotation: -2.5, transformOrigin: WO });
    const w = FX.wobble(tl, "#${P}-w4", 0, Math.max(0.6, DUR - 0.45), { deg: 2.5, origin: WO });
    FX.settle(tl, "#${P}-w4", w.end, w.endRotation, { origin: WO });

    // Cursor bewegt sich ab Frame 1 (ruhiges Hereingleiten zum Raster), "Raster." steht.
    mv(0, [470, 330], 1.1, "power2.out");
    // "… du erkennst dich in einem davon wieder." -> Cursor kreist über die 3 offenen Karten.
    const tLoop = Math.max(busy + 0.35, C.erkennst);
    mv(tLoop - 0.3, LOOP[0], 0.28);
    const dLoop = Math.max(1.0, Math.min(1.6, DUR - 0.6 - tLoop));
    path(tLoop, LOOP, dLoop);
    // danach ruhig auf Karte 1 (Startpunkt des Body).
    const tBack = Math.max(busy + 0.05, DUR - 0.8);
    mv(tBack, R, Math.max(0.25, Math.min(0.6, DUR - 0.1 - tBack)));
    FX.cursor(tl, "#${P}-cur", "#${P}-ring", [560, 650], steps);
`;
}

// ------------------------------------------------------------------ body
function body() {
  const P = "a4b";
  const cards = [0, 1, 2, 3].map((i) => card(P, i, true)).join("");
  const traceBody = JSON.stringify(tracePoints(CIRC_PLAN, 20, [84, 36]));
  const notes = [
    [660, 64, -3, "Strategie 1"], [674, 148, 3, ""], [656, 226, -2, ""], [670, 300, 3, ""], [662, 372, -3, "Strategie 20"],
  ].map(([x, y, r, lab], k) => `
        <div id="${P}-nt${k + 1}" class="${P}-note" style="left:${x}px;top:${y}px;">${lab ? `<div class="${P}-nl">${lab}</div>` : `<div class="${P}-ln" style="top:26px;width:150px;"></div>`}<div class="${P}-ln" style="top:${lab ? 104 : 72}px;width:250px;"></div><div class="${P}-ln" style="top:${lab ? 140 : 108}px;width:300px;"></div><div class="${P}-ln" style="top:${lab ? 176 : 144}px;width:200px;"></div></div>`).join("");
  return `<template>
  <!-- Ad 4 "Die 3 Typen", Body. Hook- und Body-Raster nutzen dasselbe Karten-/Porträt-Markup, damit der Übergang Anfang -> Body pixelgleich ist. -->
  <style>
    #root { position: absolute; inset: 0; background: #FFFFFF; overflow: hidden; }
    #${P}-scene { position: absolute; inset: 0; }${css(P)}
    .${P}-note { position: absolute; width: 380px; height: 230px; border-radius: 14px; background: #FFFFFF; border: 5px solid #9CA3AF; box-sizing: border-box; }
    .${P}-nl { position: absolute; right: 26px; top: 12px; font-family: 'Poppins'; font-weight: 700; font-size: 48px; line-height: 58px; color: #0E1A2B; white-space: nowrap; }
    .${P}-ln { position: absolute; right: 26px; height: 8px; border-radius: 4px; background: #9CA3AF; }
    #${P}-q { position: absolute; left: 640px; top: 128px; width: 420px; text-align: center; font-family: 'Poppins'; font-weight: 700; font-size: 72px; line-height: 86px; color: #0E1A2B; white-space: nowrap; }
    #${P}-k { position: absolute; left: 652px; top: 336px; width: 396px; height: 84px; border-radius: 18px; background: #F3F4F6; display: flex; align-items: center; justify-content: center; gap: 14px; font-family: 'Poppins'; font-weight: 700; font-size: 48px; line-height: 1; color: #0E1A2B; white-space: nowrap; }
    #${P}-k svg { width: 30px; height: 44px; }
  </style>
  <div id="root" data-composition-id="ad4-body" data-width="1080" data-height="710">
    <div id="${P}-scene" class="clip" data-start="0" data-duration="{{DUR}}">
      <div id="${P}-grid" class="${P}-layer">
        <!-- Zettelstapel "Strategie 1 … 20" hinter Karte 2 -->${notes}
        <!-- 2 x 2 Raster wie am Ende der Anfänge; jede Karte fliegt groß nach vorn (90 % der Motiv-Zone). -->${cards}
      </div>
      <!--@include course p="${P}-course"-->
      <!--@include cta p="${P}-cta"-->
      <div id="${P}-q">Welcher<br>warst du?</div>
      <div id="${P}-k"><span>Kommentar</span><svg viewBox="0 0 30 44"><path d="M9 0 H21 V25 H30 L15 44 L0 25 H9 Z" fill="#0E1A2B"/></svg></div>
      <!--@include more p="${P}-more"-->
      <!--@include cursor p="${P}"-->
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    const S = 1 / 1.9;                                    // Groß-Format 912 x 638 -> Raster 480 x 336
    const SL = ${JSON.stringify(SL)};
    const card = function (n) { return "#${P}-c" + n; };
    const others = function (n) { return [1, 2, 3, 4].filter(function (k) { return k !== n; }).map(card); };
    const grid = function (n) { return { x: SL[n - 1][0] - 540, y: SL[n - 1][1] - 355, scale: S }; };
    const st = {};                                         // aktueller Transform jeder Karte (für lückenlose fromTo-Ketten)
    function moveCard(n, to, t, d, ease) {
      FX.tween(tl, card(n), { x: st[n].x, y: st[n].y, scale: st[n].scale }, { x: to.x, y: to.y, scale: to.scale, duration: d, ease: ease }, t);
      st[n] = { x: to.x, y: to.y, scale: to.scale };
    }
    function zone(n, nx, ny) { const s = st[n]; return [540 + s.x + (nx - 456) * s.scale, 355 + s.y + (ny - 319) * s.scale]; }
    const DIG = { x: 138, y: 191 };                        // Ziffer wandert in der großen Karte nach rechts unten (190 px)
    const PH = { 1: [156, 450, -50], 2: [156, 450, -50], 3: [156, 450, -50], 4: [256, 350, -75] }; // Bildausschnitt groß

    // ---------------------------------------------------------------- Anfangszustand = letztes Bild der Anfänge
    [1, 2, 3, 4].forEach(function (n) {
      st[n] = grid(n);
      FX.init(tl, card(n), { x: st[n].x, y: st[n].y, scale: S, transformOrigin: "50% 50%", zIndex: 1, opacity: 1 });
      FX.init(tl, "#${P}-d" + n, { x: 0, y: 0, scale: 1.9, transformOrigin: "50% 50%", opacity: 1 });
      FX.init(tl, ["#${P}-n" + n, "#${P}-va" + n, "#${P}-vb" + n], { opacity: 0 });
    });
    FX.init(tl, ["#${P}-clock", "#${P}-badge", "#${P}-t1", "#${P}-t2", "#${P}-t3"], { opacity: 0 });
    FX.init(tl, "#${P}-badge", { rotation: -4, transformOrigin: "50% 50%" });
    FX.init(tl, "#${P}-sec", { rotation: 0, svgOrigin: "0 0" });
    [1, 2, 3, 4, 5].forEach(function (k) { FX.init(tl, "#${P}-nt" + k, { opacity: 0, x: -300, rotation: [-3, 3, -2, 3, -3][k - 1], transformOrigin: "50% 50%" }); });
    FX.init(tl, "#${P}-front4", { rotationY: -90, opacity: 0, transformPerspective: 2400, transformOrigin: "50% 50%" });
    FX.init(tl, "#${P}-back4", { rotationY: 0, opacity: 1, transformPerspective: 2400, transformOrigin: "50% 50%" });
    FX.init(tl, ["#${P}-q", "#${P}-k", "#${P}-cta-more"], { opacity: 0 });

    // Karte fliegt groß nach vorn: wächst in 0,4 s (ease-out) auf 90 % der Motiv-Zone, die anderen blenden aus.
    // Name (96 px) und genau 2 Werte (72 px) erscheinen erst jetzt.
    function fly(n, t) {
      tl.set(card(n), { zIndex: 5 }, t);
      moveCard(n, { x: 0, y: 0, scale: 1 }, t, 0.4, "power2.out");
      others(n).forEach(function (el) { FX.fadeOut(tl, el, t); });
      FX.tween(tl, "#${P}-p" + n, { top: 32, height: 574 }, { top: PH[n][0], height: PH[n][1], duration: 0.4, ease: "power2.out" }, t);
      FX.tween(tl, "#${P}-pi" + n, { y: 0 }, { y: PH[n][2], duration: 0.4, ease: "power2.out" }, t);
      if (n < 4) FX.tween(tl, "#${P}-d" + n, { x: 0, y: 0, scale: 1.9 }, { x: DIG.x, y: DIG.y, scale: 1, duration: 0.4, ease: "power2.out" }, t);
      else FX.fadeOut(tl, "#${P}-d4", t, 0.15);
      FX.pop(tl, "#${P}-n" + n, t + 0.25);
      FX.pop(tl, "#${P}-va" + n, t + 0.35);
      FX.pop(tl, "#${P}-vb" + n, t + 0.45);
    }
    // Karte zurück ins Raster (0,4 s), Namen/Werte/Extras blenden aus, die anderen Karten blenden wieder ein.
    function back(n, t, extras) {
      ["#${P}-n" + n, "#${P}-va" + n, "#${P}-vb" + n].concat(extras || []).forEach(function (el) { FX.fadeOut(tl, el, t, 0.15); });
      moveCard(n, grid(n), t, 0.4, "power2.inOut");
      others(n).forEach(function (el) { FX.fadeIn(tl, el, t); });
      FX.tween(tl, "#${P}-p" + n, { top: PH[n][0], height: PH[n][1] }, { top: 32, height: 574, duration: 0.4, ease: "power2.inOut" }, t);
      FX.tween(tl, "#${P}-pi" + n, { y: PH[n][2] }, { y: 0, duration: 0.4, ease: "power2.inOut" }, t);
      FX.tween(tl, "#${P}-d" + n, { x: DIG.x, y: DIG.y, scale: 1 }, { x: 0, y: 0, scale: 1.9, duration: 0.4, ease: "power2.inOut" }, t);
      tl.set(card(n), { zIndex: 1 }, t + 0.4);
    }
    function slow(n, t, d, zoomOut) {   // langsamer Zoom 100 -> 108 % über 3 s (anteilig), oder zurück
      if (d < 1) return;
      const k = 0.08 * Math.min(3, d) / 3;
      moveCard(n, { x: st[n].x, y: st[n].y, scale: zoomOut ? st[n].scale - k : st[n].scale + k }, t, Math.min(3, d), "none");
    }

    // Cursor-Hilfen (eine ruhige Bewegung pro Satz; nie zwei Cursor-Tweens gleichzeitig)
    const steps = [];
    let busy = 0;
    function mv(t, to, d, ease) { t = Math.max(t, busy + 0.01); steps.push({ t: t, to: to, d: d, ease: ease || "power2.inOut" }); busy = t + d; return busy; }
    function path(t, pts, d) { t = Math.max(t, busy + 0.01); const seg = d / (pts.length - 1); for (let i = 1; i < pts.length; i++) steps.push({ t: t + (i - 1) * seg, to: pts[i], d: seg, ease: "none" }); busy = t + d; return busy; }
    function click(t) { steps.push({ t: t, click: true }); }
    const R = [215, 270];                                  // = Endpunkt der Anfänge (auf dem Bild von Karte 1)
    const K = { 2: [720, 270], 3: [215, 624], 4: [720, 624] };   // Klickpunkte auf den Raster-Karten (Bildbereich)
    const PARK = [1032, 560];                              // Parkposition rechts neben der großen Karte

    // ---------------------------------------------------------------- Typ 1: der Zocker
    // "Typ 1 ist der Zocker." -> Klick, Karte 1 fliegt groß nach vorn: "Der Zocker", "Risiko 10 · Plan 0".
    const tF1 = Math.max(0, C.typ1 - 0.05);
    click(tF1);
    fly(1, tF1);
    mv(tF1 + 0.2, PARK, 0.7);
    // "… hat keinen Stop und hofft auf den großen Wurf …" -> "Plan 0" einkreisen; der Cursor zeichnet mit.
    const TR1 = ${traceBody};
    const tC1 = Math.max(tF1 + 1.0, C.stop - 0.1);
    FX.drawCircle(tl, "#${P}-o1", tC1);
    mv(Math.max(C.setzt, tC1 - 0.75), TR1[0], 0.6);
    path(tC1, TR1, 0.5);
    mv(tC1 + 0.6, PARK, 0.6);
    // "… und meistens ist er als Erster wieder raus." -> langsamer Zoom.
    const tR2 = Math.max(tC1 + 1.4, C.typ2 - 0.55);
    const tZ1 = Math.max(tC1 + 0.8, C.raus);
    slow(1, tZ1, tR2 - 0.1 - tZ1);

    // ---------------------------------------------------------------- Typ 2: der Dauerlerner
    back(1, tR2, ["#${P}-o1"]);
    mv(tR2, K[2], 0.45);
    const tF2 = Math.max(C.typ2 - 0.05, busy);
    click(tF2);
    fly(2, tF2);
    mv(tF2 + 0.2, [1032, 640], 0.7);
    // "… 50 Videos geschaut und 20 Strategien gespeichert …" -> Karte rückt nach links, dahinter ein Stapel Zettel "Strategie 1 … 20".
    const tV = Math.max(tF2 + 0.9, C.videos - 0.1);
    moveCard(2, { x: -170, y: 6, scale: 0.74 }, tV, 0.4, "power2.inOut");
    [1, 2, 3, 4].forEach(function (k) {
      FX.tween(tl, "#${P}-nt" + k, { opacity: 0, x: -300 }, { opacity: 1, x: 0, duration: 0.25, ease: "power2.out" }, tV + 0.2 + (k - 1) * 0.08);
    });
    const t20 = Math.max(tV + 0.65, C.strat20 - 0.05);
    FX.tween(tl, "#${P}-nt5", { opacity: 0, x: -300 }, { opacity: 1, x: 0, duration: 0.25, ease: "power2.out" }, t20);
    // "… aber noch keinen einzigen Trade gesetzt …" -> Cursor zeigt ruhig auf "Trades 0".
    mv(Math.max(C.keinen, t20 + 0.4), zone(2, 886, 330), 0.6);

    // ---------------------------------------------------------------- Typ 3: der Ungeduldige
    const tR3 = Math.max(busy + 0.6, C.typ3 - 0.55);
    back(2, tR3, ["#${P}-nt1", "#${P}-nt2", "#${P}-nt3", "#${P}-nt4", "#${P}-nt5"]);
    mv(tR3, K[3], 0.45);
    const tF3 = Math.max(C.typ3 - 0.05, busy);
    click(tF3);
    fly(3, tF3);
    mv(tF3 + 0.2, PARK, 0.7);
    // "… nach 2 Wochen Ergebnisse sehen …" -> kleine tickende Uhr (der Sekundenzeiger springt alle 0,5 s).
    const tW = Math.max(tF3 + 0.8, C.wochen - 0.05);
    FX.pop(tl, "#${P}-clock", tW);
    // "… macht er aus Frust einen Rache-Trade …" -> Cursor zeigt ruhig auf "Frust 10".
    mv(Math.max(C.frust, tW + 0.5), zone(3, 886, 330), 0.6);
    const tR4 = Math.max(busy + 0.6, C.typ4 - 0.55);
    for (let k = 1, t = tW + 0.5; t < tR4 - 0.05; k++, t += 0.5) tl.set("#${P}-sec", { rotation: k * 30, svgOrigin: "0 0" }, t);

    // ---------------------------------------------------------------- Typ 4: der, der dranbleibt
    // "Und dann gibt's noch einen 4. Typ:" -> zurück zum Raster, die verdeckte Karte dreht sich um (0,4 s um die senkrechte Achse).
    back(3, tR4, ["#${P}-clock"]);
    mv(tR4, K[4], 0.45);
    const tFl = Math.max(C.typ4 - 0.05, busy);
    click(tFl);
    FX.tween(tl, "#${P}-back4", { rotationY: 0 }, { rotationY: 90, duration: 0.2, ease: "power1.in" }, tFl);
    tl.set("#${P}-back4", { opacity: 0 }, tFl + 0.2);
    tl.set("#${P}-front4", { opacity: 1 }, tFl + 0.2);
    FX.tween(tl, "#${P}-front4", { rotationY: -90 }, { rotationY: 0, duration: 0.2, ease: "power1.out" }, tFl + 0.2);
    // "Von über 2.000 Leuten in meinem Coaching …" -> Klick, Karte 4 groß: "Der, der dranbleibt", "Plan 10 · Geduld 9", Einblendung "2.000+ im Coaching".
    const tF4 = Math.max(C.coaching - 0.05, tFl + 0.6, busy);
    click(tF4);
    fly(4, tF4);
    mv(tF4 + 0.2, PARK, 0.7);
    FX.pop(tl, "#${P}-badge", Math.max(tF4 + 0.55, C.k2000 - 0.05));
    // "Das sind keine Genies …" -> langsamer Zoom; "… eine einzige Strategie … wenig riskieren … geduldig" -> 3 Haken.
    const tk1 = Math.max(tF4 + 1.2, C.einzige - 0.05), tk2 = Math.max(tk1 + 0.4, C.wenig - 0.05), tk3 = Math.max(tk2 + 0.4, C.geduldig - 0.05);
    const tZ4 = Math.max(tF4 + 1.0, C.genies);
    slow(4, tZ4, tk1 - 0.1 - tZ4);
    FX.pop(tl, "#${P}-t1", tk1);
    FX.pop(tl, "#${P}-t2", tk2);
    FX.pop(tl, "#${P}-t3", tk3);
    // "Dafür musst du kein Profi sein …" -> leicht rauszoomen.
    const tK = Math.max(tk3 + 0.6, C.kurs - 0.05);
    const tZ4b = Math.max(tk3 + 0.4, C.profi);
    slow(4, tZ4b, Math.min(st[4].scale > 1 ? 3 * (st[4].scale - 1) / 0.08 : 0, tK - 0.1 - tZ4b), true);

    // ---------------------------------------------------------------- Kurs-Mockup (ohne Punkte: nur der Laptop, mittig)
    // "Wie du zu diesem 4. Typ wirst …" -> Schnitt auf den Kurs; der Laptop schiebt sich in 0,25 s rein.
    tl.set("#${P}-grid", { opacity: 0 }, tK);
    tl.set("#${P}-course", { opacity: 0 }, 0);
    tl.set("#${P}-course", { opacity: 1 }, tK);
    FX.tween(tl, "#${P}-course-laptop", { opacity: 0, x: -1100 }, { opacity: 1, x: 0, duration: 0.25, ease: "power2.out" }, tK);
    // "… in meinem kostenlosen Videokurs" -> Cursor zeigt auf "Kostenloser Videokurs".
    mv(Math.max(C.kostenlos - 0.3, tK + 0.6), [470, 176], 0.6);

    // ---------------------------------------------------------------- CTA-Bild
    // "Klick unter dem Video auf „Mehr dazu“ …" -> Laptop + "Mehr dazu" + Pfeil nach unten.
    const tCTA = Math.max(C.klick - 0.05, busy + 0.2);
    tl.set("#${P}-course", { opacity: 0 }, tCTA);
    FX.cta(tl, "${P}-cta", tCTA);
    steps.push({ t: tCTA, hide: true });

    // ---------------------------------------------------------------- Schlussbild
    // "… welcher Typ du bisher warst." -> Raster mit allen 4 Karten offen, "Welcher warst du?" + "Kommentar ↓", Banner "Mehr dazu ↓" bis zum Ende.
    const tEnd = Math.max(C.welcher - 0.05, tCTA + 1.2);
    tl.set("#${P}-cta", { opacity: 0 }, tEnd);
    const G = 0.58, GX = 40, GY = 96;                       // Raster auf 58 %, links; Text rechts
    [1, 2, 3, 4].forEach(function (n) {
      const c = SL[n - 1];
      tl.set(card(n), { x: GX + (c[0] - 48) * G - 540, y: GY + (c[1] - 10) * G - 355, scale: S * G, opacity: 1, zIndex: 1 }, tEnd);
      tl.set("#${P}-d" + n, { x: 0, y: 0, scale: 1.9, opacity: 1 }, tEnd);
      tl.set("#${P}-p" + n, { top: 32, height: 574 }, tEnd);
      tl.set("#${P}-pi" + n, { y: 0 }, tEnd);
      tl.set(["#${P}-n" + n, "#${P}-va" + n, "#${P}-vb" + n], { opacity: 0 }, tEnd);
    });
    tl.set(["#${P}-badge", "#${P}-t1", "#${P}-t2", "#${P}-t3"], { opacity: 0 }, tEnd);
    tl.set("#${P}-grid", { opacity: 1 }, tEnd);
    FX.pop(tl, "#${P}-q", tEnd);
    FX.more(tl, "${P}-more", tEnd + 0.15);
    FX.pop(tl, "#${P}-k", Math.min(tEnd + 0.4, Math.max(tEnd + 0.2, E.welcher - 0.3)));

    FX.cursor(tl, "#${P}-cur", "#${P}-ring", R, steps);
    window.__timelines["ad4-body"] = tl;
  </script>
</template>
`;
}

const out = path.join(ROOT, "src/scenes");
fs.writeFileSync(path.join(out, "ad4-hookA.html"), hook("A"));
fs.writeFileSync(path.join(out, "ad4-hookB.html"), hook("B"));
fs.writeFileSync(path.join(out, "ad4-body.html"), body());
console.log("ok");
