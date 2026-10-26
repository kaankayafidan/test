// FX: shared animation helpers for all motif scenes.
// Every value comes from the briefing's animation table (Specs, Seite 5-6).
// Rules: every tween is a fromTo with immediateRender:false so any frame can be
// seeked in any order; initial states are set once at t=0 with FX.init().
const FX = (() => {
  const IR = { immediateRender: false };
  const q = (el) => el;
  // Pivot: o.svgOrigin ("540 650", absolute SVG user units) for SVG parts, else o.origin (CSS transform-origin).
  // smoothOrigin:false + pivot in both from and to vars, otherwise GSAP adds a lasting x/y offset on SVG parts.
  const pivot = (o, def) => (o.svgOrigin ? { svgOrigin: o.svgOrigin, smoothOrigin: false } : { transformOrigin: o.origin ?? def, smoothOrigin: false });

  // Initial state at t=0 (call once per element before any tween on it).
  function init(tl, el, props) {
    tl.set(el, props, 0);
  }
  function set(tl, el, props, t) {
    tl.set(el, props, t);
  }
  // Generic seek-safe tween.
  function tween(tl, el, from, to, t) {
    tl.fromTo(q(el), from, { ...IR, ...to }, t);
  }

  // "ploppt rein, ploppt auf": Größe 120 -> 100 % in 0,15 s.
  function pop(tl, el, t, o = {}) {
    tl.fromTo(el, { ...pivot(o, "50% 50%"), opacity: 0, scale: o.from ?? 1.2 }, { ...IR, opacity: 1, scale: 1, duration: 0.15, ease: "power2.out", ...pivot(o, "50% 50%") }, t);
  }
  // "einblenden, erscheint": Deckkraft 0 -> 100 % in 0,2 s.
  function fadeIn(tl, el, t, d = 0.2) {
    tl.fromTo(el, { opacity: 0 }, { ...IR, opacity: 1, duration: d, ease: "none" }, t);
  }
  // "ausblenden": Deckkraft 100 -> 0 % in 0,2 s.
  function fadeOut(tl, el, t, d = 0.2) {
    tl.fromTo(el, { opacity: 1 }, { ...IR, opacity: 0, duration: d, ease: "none" }, t);
  }
  // "harter Schnitt": instant switch (hide old, show new).
  function cut(tl, outEl, inEl, t) {
    if (outEl) tl.set(outEl, { opacity: 0 }, t);
    if (inEl) tl.set(inEl, { opacity: 1 }, t);
  }
  // "knallt drauf, knallt ins Bild": Größe 140 -> 100 % in 0,12 s. Stempel zusätzlich 8° schräg.
  function slam(tl, el, t, o = {}) {
    const rot = o.rotation ?? 0;
    tl.fromTo(el, { ...pivot(o, "50% 50%"), opacity: 0, scale: 1.4, rotation: rot }, { ...IR, opacity: 1, scale: 1, rotation: rot, duration: 0.12, ease: "power3.out", ...pivot(o, "50% 50%") }, t);
  }
  // "schnelles Ranzoomen": 100 -> 130 % in 0,4 s, am Ende abbremsen.
  function zoomFast(tl, el, t, o = {}) {
    tl.fromTo(el, { ...pivot(o, "50% 50%"), scale: o.from ?? 1 }, { ...IR, scale: o.to ?? 1.3, duration: 0.4, ease: "power3.out", ...pivot(o, "50% 50%") }, t);
  }
  // "reinzoomen auf ein Detail": auf 150-200 % in 0,5 s, weich. origin = detail point in px ("x y").
  function zoomIn(tl, el, t, o = {}) {
    tl.fromTo(el, { ...pivot(o, "50% 50%"), scale: o.from ?? 1, x: o.fromX ?? 0, y: o.fromY ?? 0 }, { ...IR, scale: o.to ?? 1.75, x: o.x ?? 0, y: o.y ?? 0, duration: o.d ?? 0.5, ease: "power2.inOut", ...pivot(o, "50% 50%") }, t);
  }
  // Rauszoomen auf das ganze Motiv: genauso zurück auf 100 %.
  function zoomOut(tl, el, t, o = {}) {
    tl.fromTo(el, { ...pivot(o, "50% 50%"), scale: o.from ?? 1.75, x: o.fromX ?? 0, y: o.fromY ?? 0 }, { ...IR, scale: 1, x: 0, y: 0, duration: o.d ?? 0.5, ease: "power2.inOut", ...pivot(o, "50% 50%") }, t);
  }
  // "langsamer Zoom, leicht rauszoomen": 100 -> 108 % über 3 s (oder rückwärts), linear.
  function slowZoom(tl, el, t, o = {}) {
    tl.fromTo(el, { ...pivot(o, "50% 50%"), scale: o.from ?? 1 }, { ...IR, scale: o.to ?? 1.08, duration: o.d ?? 3, ease: "none", ...pivot(o, "50% 50%") }, t);
  }
  // "fliegt rein, schiebt sich rein, wird ausgeteilt": von außerhalb in 0,25 s (ease-out),
  // mehrere Elemente je 0,08 s versetzt. els: array of selectors/elements.
  function flyIn(tl, els, t, o = {}) {
    const list = Array.isArray(els) ? els : [els];
    const dist = o.dist ?? 1200;
    const dir = o.from ?? "left";
    const off = { left: { x: -dist }, right: { x: dist }, top: { y: -dist }, bottom: { y: dist } }[dir];
    list.forEach((el, i) => {
      const from = { opacity: 1, x: 0, y: 0, ...off, ...(o.fromExtra || {}) };
      tl.fromTo(el, from, { ...IR, opacity: 1, x: 0, y: 0, rotation: o.rotation ?? 0, scale: 1, duration: 0.25, ease: "power2.out" }, t + i * (o.stagger ?? 0.08));
    });
  }
  // "fliegt raus": opposite of flyIn (same speed).
  function flyOut(tl, el, t, o = {}) {
    const dist = o.dist ?? 1200;
    const to = { left: { x: -dist }, right: { x: dist }, top: { y: -dist }, bottom: { y: dist } }[o.to ?? "right"];
    tl.fromTo(el, { x: 0, y: 0 }, { ...IR, ...to, duration: 0.25, ease: "power2.in" }, t);
  }
  // "kippt": Drehung um 90° in 0,35 s.
  function tip(tl, el, t, o = {}) {
    tl.fromTo(el, { ...pivot(o, "50% 100%"), rotation: o.from ?? 0 }, { ...IR, rotation: o.to ?? 90, duration: 0.35, ease: "power2.in", ...pivot(o, "50% 100%") }, t);
  }
  // "wackelt": Drehung um 6° nach links und rechts um den Fußpunkt, 0,6 s pro Schwung, in Schleife.
  // Starts already in motion (at -6°). d = total length in s. Ends at a swing end; call settle() to stop.
  function wobble(tl, el, t, d, o = {}) {
    const deg = o.deg ?? 6;
    const swings = Math.max(1, Math.floor(d / 0.6));
    tl.fromTo(el, { ...pivot(o, "50% 100%"), rotation: -deg }, { ...IR, rotation: deg, duration: 0.6, ease: "sine.inOut", yoyo: true, repeat: swings - 1, ...pivot(o, "50% 100%") }, t);
    return { end: t + swings * 0.6, endRotation: swings % 2 === 1 ? deg : -deg };
  }
  // Wackeln hält an: back to 0° in 0,3 s.
  function settle(tl, el, t, fromRot, o = {}) {
    tl.fromTo(el, { ...pivot(o, "50% 100%"), rotation: fromRot }, { ...IR, rotation: 0, duration: 0.3, ease: "power2.out", ...pivot(o, "50% 100%") }, t);
  }
  // "pulsiert": Größe 100 -> 108 % und zurück, 0,8 s pro Schlag. d = total length.
  function pulse(tl, el, t, d, o = {}) {
    const beats = Math.max(1, Math.floor(d / 0.8));
    tl.fromTo(el, { ...pivot(o, "50% 50%"), scale: 1 }, { ...IR, scale: o.to ?? 1.08, duration: 0.4, ease: "sine.inOut", yoyo: true, repeat: beats * 2 - 1, ...pivot(o, "50% 50%") }, t);
  }
  // "blinkt": Deckkraft 100 -> 40 % und zurück, 0,8 s pro Takt.
  function blink(tl, el, t, d) {
    const beats = Math.max(1, Math.floor(d / 0.8));
    tl.fromTo(el, { opacity: 1 }, { ...IR, opacity: 0.4, duration: 0.4, ease: "sine.inOut", yoyo: true, repeat: beats * 2 - 1 }, t);
  }
  // "einkreisen, unterstreichen, durchstreichen": rote Linie #DC2626, 10 px.
  // Kreis zeichnet sich in 0,5 s, Linie in 0,3 s. el = <path pathLength="1" class="fx-stroke">.
  function draw(tl, el, t, d) {
    tl.fromTo(el, { opacity: 1, strokeDashoffset: 1 }, { ...IR, opacity: 1, strokeDashoffset: 0, duration: d, ease: "power1.inOut", autoRound: false }, t);
  }
  const drawCircle = (tl, el, t) => draw(tl, el, t, 0.5);
  const drawLine = (tl, el, t) => draw(tl, el, t, 0.3);

  // Hand-drawn (slightly krakelig) ellipse path, ~1.08 turns, seeded so it is identical every render.
  function handCircle(cx, cy, rx, ry, seed = 1) {
    let s = seed >>> 0;
    const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const start = -Math.PI * 0.62 + rnd() * 0.3;
    const turns = 1.08 + rnd() * 0.05;
    const n = 48;
    let d = "";
    const w1 = rnd() * 6.28, w2 = rnd() * 6.28;
    for (let i = 0; i <= n; i++) {
      const p = i / n;
      const a = start + p * turns * Math.PI * 2;
      const wob = 1 + 0.035 * Math.sin(a * 2 + w1) + 0.02 * Math.sin(a * 3 + w2) + p * 0.05;
      const x = cx + Math.cos(a) * rx * wob;
      const y = cy + Math.sin(a) * ry * wob;
      d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
    }
    return d.trim();
  }
  // Hand-drawn straight-ish line (for underline / strike-through).
  function handLine(x1, y1, x2, y2, seed = 1) {
    let s = seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const mx = (x1 + x2) / 2 + (rnd() - 0.5) * 8, my = (y1 + y2) / 2 + (rnd() - 0.5) * 10;
    return `M${x1} ${y1} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2} ${y2}`;
  }

  // "Blitz schlägt ein": Blitz ploppt in 0,1 s rein, 0,1 s weißer Flash über dem Motiv, der Akku wackelt 0,2 s.
  function lightning(tl, bolt, flash, target, t) {
    tl.fromTo(bolt, { opacity: 0, scale: 1.25 }, { ...IR, opacity: 1, scale: 1, duration: 0.1, ease: "power2.out" }, t);
    if (flash) tl.fromTo(flash, { opacity: 0.85 }, { ...IR, opacity: 0, duration: 0.1, ease: "none" }, t + 0.1);
    if (target) {
      tl.fromTo(target, { rotation: -4 }, { ...IR, rotation: 4, duration: 0.05, yoyo: true, repeat: 3, ease: "sine.inOut", transformOrigin: "50% 100%" }, t + 0.1);
      tl.set(target, { rotation: 0 }, t + 0.3);
    }
  }

  // Cursor: one continuous script per scene so the path never jumps.
  // steps: [{t, to:[x,y], d}, {t, orbit:{cx,cy,rx,ry,turns,start}, d}, {t, click:true}, {t, hide:true}, {t, show:true}, {t, sway:{x1,x2,y}, d}]
  // Positions are the arrow tip in motif px. cursor el = .fx-cursor (tip at its 0,0).
  function cursor(tl, cur, ring, startXY, steps) {
    let [x, y] = startXY;
    tl.set(cur, { x, y, opacity: 1 }, 0);
    if (ring) tl.set(ring, { opacity: 0, scale: 0.6 }, 0);
    for (const s of steps) {
      if (s.hide) { tl.set(cur, { opacity: 0 }, s.t); continue; }
      if (s.show) { if (s.at) { x = s.at[0]; y = s.at[1]; tl.set(cur, { x, y }, s.t); } tl.set(cur, { opacity: 1 }, s.t); continue; }
      if (s.click) {
        if (ring) {
          tl.set(ring, { x, y }, s.t);
          tl.fromTo(ring, { opacity: 0.5, scale: 0.6 }, { ...IR, opacity: 0, scale: 1.25, duration: 0.35, ease: "power1.out" }, s.t);
        }
        continue;
      }
      if (s.to) {
        const [nx, ny] = s.to;
        tl.fromTo(cur, { x, y }, { ...IR, x: nx, y: ny, duration: s.d ?? 0.6, ease: s.ease ?? "power2.inOut" }, s.t);
        x = nx; y = ny;
        continue;
      }
      if (s.orbit) {
        // Kreisen: 1 Runde in etwa 1,5 s, knapp außerhalb des Motivs. Starts from current position:
        // first glides onto the orbit, then circles with small straight segments.
        const o = s.orbit, d = s.d ?? 1.5, turns = o.turns ?? 1, n = Math.max(12, Math.round(24 * turns));
        const a0 = o.start ?? Math.atan2(y - o.cy, x - o.cx);
        let t0 = s.t;
        const seg = d / n;
        for (let i = 1; i <= n; i++) {
          const a = a0 + (i / n) * turns * Math.PI * 2;
          const nx = o.cx + Math.cos(a) * o.rx, ny = o.cy + Math.sin(a) * o.ry;
          tl.fromTo(cur, { x, y }, { ...IR, x: nx, y: ny, duration: seg, ease: "none" }, t0);
          x = nx; y = ny; t0 += seg;
        }
        continue;
      }
      if (s.sway) {
        // Cursor pendelt zwischen zwei Punkten (Ad 3: JA / NEIN), 0,6 s pro Weg.
        const w = s.sway, d = s.d ?? 2.4, leg = w.leg ?? 0.6, legs = Math.max(1, Math.floor(d / leg));
        let t0 = s.t;
        for (let i = 0; i < legs; i++) {
          const nx = i % 2 === 0 ? w.x2 : w.x1;
          tl.fromTo(cur, { x, y }, { ...IR, x: nx, y: w.y, duration: leg, ease: "sine.inOut" }, t0);
          x = nx; y = w.y; t0 += leg;
        }
        continue;
      }
    }
    return { x, y };
  }

  // Course mockup with 3 ticks (Kurs-Mockup, daneben 3 Haken). p = id prefix used in the include.
  function course(tl, p, t, tickTimes) {
    tl.set(`#${p}`, { opacity: 0 }, 0);
    [0, 1, 2].forEach((i) => tl.set(`#${p}-i${i}`, { opacity: 0 }, 0));
    tl.set(`#${p}`, { opacity: 1 }, t);
    tl.fromTo(`#${p}-laptop`, { opacity: 0, x: -1100 }, { ...IR, opacity: 1, x: 0, duration: 0.25, ease: "power2.out" }, t);
    [0, 1, 2].forEach((i) => {
      const tt = tickTimes?.[i] ?? t + 0.35 + i * 0.5;
      tl.fromTo(`#${p}-i${i}`, { opacity: 0, scale: 1.2 }, { ...IR, opacity: 1, scale: 1, duration: 0.15, ease: "power2.out", transformOrigin: "0% 50%" }, tt);
    });
  }
  // CTA-Bild: Laptop mittig (80 % Breite), darunter "Mehr dazu" + Pfeil nach unten. Bleibt bis zum Ende.
  function cta(tl, p, t) {
    tl.set(`#${p}`, { opacity: 0 }, 0);
    tl.set(`#${p}-laptop`, { opacity: 0 }, 0);
    tl.set(`#${p}-more`, { opacity: 0 }, 0);
    tl.set(`#${p}`, { opacity: 1 }, t);
    tl.fromTo(`#${p}-laptop`, { scale: 1.2, opacity: 0 }, { ...IR, scale: 1, opacity: 1, duration: 0.15, ease: "power2.out" }, t);
    tl.fromTo(`#${p}-more`, { opacity: 0, y: 30 }, { ...IR, opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }, t + 0.2);
    // Pfeil nach unten: kleine Bewegung nach unten, 3 Mal (keine Endlosschleife).
    tl.fromTo(`#${p}-arrow`, { y: 0 }, { ...IR, y: 14, duration: 0.4, ease: "sine.inOut", yoyo: true, repeat: 5 }, t + 0.5);
  }
  // Kleines Banner "Mehr dazu ↓" am unteren Rand der Motiv-Zone.
  function more(tl, p, t, d) {
    tl.set(`#${p}`, { opacity: 0 }, 0);
    tl.fromTo(`#${p}`, { opacity: 0, y: 40 }, { ...IR, opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }, t);
    if (d != null) tl.fromTo(`#${p}`, { opacity: 1 }, { ...IR, opacity: 0, duration: 0.2 }, t + d);
  }

  return { init, set, tween, pop, fadeIn, fadeOut, cut, slam, zoomFast, zoomIn, zoomOut, slowZoom, flyIn, flyOut, tip, wobble, settle, pulse, blink, draw, drawCircle, drawLine, handCircle, handLine, lightning, cursor, course, cta, more };
})();
