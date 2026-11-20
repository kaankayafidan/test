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

  // Touch-Punkt (Ad 3 und End-Karten): wie cursor(), aber mit Tippen statt Klick.
  // steps: [{t, to:[x,y], d}, {t, tap:true}, {t, shake:true, d}, {t, back:[x,y], d}, {t, hide:true}, {t, show:true, at:[x,y]}]
  // tap = zwei Wellen in 0,3 s; shake = "zittert" (kleine Seitwärtsbewegung, d s); positions = centre of the point.
  function touch(tl, p, startXY, steps, o = {}) {
    const el = `#${p}-touch`, w1 = `#${p}-wave1`, w2 = `#${p}-wave2`;
    let [x, y] = startXY;
    tl.set(el, { x, y, opacity: o.hidden ? 0 : 1, scale: 1 }, 0);
    tl.set([w1, w2], { opacity: 0 }, 0);
    for (const s of steps) {
      if (s.hide) { tl.fromTo(el, { opacity: 1 }, { ...IR, opacity: 0, duration: 0.2 }, s.t); continue; }
      if (s.show) { if (s.at) { x = s.at[0]; y = s.at[1]; tl.set(el, { x, y }, s.t); } tl.fromTo(el, { opacity: 0 }, { ...IR, opacity: 1, duration: 0.2 }, s.t); continue; }
      if (s.tap) {
        tl.fromTo(el, { scale: 1 }, { ...IR, scale: 0.86, duration: 0.08, yoyo: true, repeat: 1, ease: "power1.inOut" }, s.t);
        [w1, w2].forEach((w, k) => {
          tl.set(w, { x, y }, s.t);
          tl.fromTo(w, { opacity: 0.9, scale: 1 }, { ...IR, opacity: 0, scale: 2.1, duration: 0.3, ease: "power1.out" }, s.t + k * 0.12);
        });
        continue;
      }
      if (s.shake) {
        const d = s.d ?? 0.4, n = Math.max(2, Math.round(d / 0.08));
        for (let k = 0; k < n; k++) tl.fromTo(el, { x: x + (k % 2 ? 4 : -4) }, { ...IR, x: x + (k % 2 ? -4 : 4), duration: d / n, ease: "none" }, s.t + (k * d) / n);
        tl.set(el, { x }, s.t + d);
        continue;
      }
      const to = s.to || s.back;
      if (to) {
        tl.fromTo(el, { x, y }, { ...IR, x: to[0], y: to[1], duration: s.d ?? 0.6, ease: s.ease ?? "power2.inOut" }, s.t);
        x = to[0]; y = to[1];
      }
    }
    return { x, y };
  }

  // Mitte-CTA (Ad 1, 2, 3, 8): bei "Live-Webinar" ploppt der Chip, bei "klick" der Button "Mehr dazu";
  // der Button pulsiert, solange der Satz läuft (der Pfeil hüpft 2×), dann fliegen beide raus.
  // o = {live, klick, out}; the scene itself freezes or runs calmly meanwhile.
  function midCta(tl, p, o) {
    const chip = `#${p}-chip`, btn = `#${p}-btn`, arrow = `#${p}-arrow`;
    tl.set([chip, btn], { opacity: 0 }, 0);
    pop(tl, chip, o.live);
    pop(tl, btn, o.klick);
    const pulseD = Math.max(0.8, o.out - o.klick - 0.2);
    pulse(tl, btn, o.klick + 0.15, pulseD);
    tl.fromTo(arrow, { y: 0 }, { ...IR, y: 10, duration: 0.25, ease: "sine.inOut", yoyo: true, repeat: 3 }, o.klick + 0.2);
    tl.fromTo([chip, btn], { opacity: 1, y: 0 }, { ...IR, opacity: 0, y: 190, duration: 0.25, ease: "power2.in", stagger: 0.08 }, Math.max(o.out, o.klick + 0.15 + pulseD));
  }

  // End-Karte (alle Ads), ab "Am Sonntag" bis zum Ende. o = {start, t18, bot, btn, klick, platz, end, touchFrom:[x,y], pulseDate}
  // start: Motiv dimmt, Navy-Karte; "LIVE-WEBINAR" + "Sonntag, 6.12." ploppen. t18: "18 Uhr" in Gelb. bot: Unterzeile.
  // btn (default: bot + 0.35): Button "Mehr dazu". klick: der Touch-Punkt tippt auf "Mehr dazu", danach hüpft der Pfeil alle 3 s.
  // platz: Platz-Chip (nur Ad 2, 4, 6). pulseDate: ab dann pulsiert das Datum bis zum Ende. The red dot blinks the
  // whole time, so the card never stands still. o.card = false: the scene shows its own card frame (Ad 6 wall card).
  function endCard(tl, p, o) {
    const q = (s) => `#${p}-${s}`;
    const end = o.end ?? DUR;
    tl.set([q("dim"), q("card"), q("live"), q("date"), q("time"), q("sub"), q("btn")], { opacity: 0 }, 0);
    if (document.querySelector(q("platz"))) tl.set(q("platz"), { opacity: 0 }, 0);
    tl.fromTo(q("dim"), { opacity: 0 }, { ...IR, opacity: o.dim ?? 0.5, duration: 0.3, ease: "power1.out" }, o.start);
    tl.fromTo(q("card"), { opacity: 0, scale: 0.94 }, { ...IR, opacity: 1, scale: 1, duration: 0.25, ease: "power2.out", transformOrigin: "50% 50%" }, o.start);
    pop(tl, q("live"), o.start + 0.1, { origin: "0% 50%" });
    pop(tl, q("date"), o.start + 0.2, { origin: "0% 50%" });
    pop(tl, q("time"), o.t18 ?? o.start + 0.8, { origin: "0% 50%" });
    fadeIn(tl, q("sub"), o.bot ?? o.start + 1.4);
    const tBtn = o.btn ?? (o.bot ?? o.start + 1.4) + 0.35;
    pop(tl, q("btn"), tBtn, { origin: "0% 50%" });
    if (o.platz != null && document.querySelector(q("platz"))) pop(tl, q("platz"), o.platz, { origin: "0% 50%" });
    const blinks = Math.max(1, Math.floor((end - o.start - 0.2) / 0.8));
    tl.fromTo(q("dot"), { opacity: 1 }, { ...IR, opacity: 0.25, duration: 0.4, ease: "sine.inOut", yoyo: true, repeat: blinks * 2 - 1 }, o.start + 0.2);
    // touch point taps "Mehr dazu"
    const card = document.querySelector(q("card")), btn = document.querySelector(q("btn"));
    const bx = (o.x ?? card?.offsetLeft ?? 70) + (btn?.offsetLeft ?? 60) + (btn?.offsetWidth ?? 330) * 0.62;
    const by = (o.y ?? card?.offsetTop ?? 55) + (btn?.offsetTop ?? 438) + (btn?.offsetHeight ?? 100) * 0.55;
    const tk = o.klick ?? tBtn + 0.6;
    const from = o.touchFrom ?? [bx + 260, by + 260];
    touch(tl, p, from, [{ t: Math.max(o.start, tk - 0.85), show: true, at: from }, { t: Math.max(o.start, tk - 0.65), to: [bx, by], d: 0.6 }, { t: tk, tap: true }, { t: tk + 0.9, hide: true }], { hidden: true });
    // Pfeil hüpft alle 3 s (first hop right after the tap)
    for (let t = tk + 0.35; t < end - 0.2; t += 3) tl.fromTo(q("arrow"), { y: 0 }, { ...IR, y: 12, duration: 0.2, ease: "sine.out", yoyo: true, repeat: 1 }, t);
    if (o.pulseDate != null) pulse(tl, q("date"), o.pulseDate, Math.max(0.8, end - o.pulseDate - 0.1), { origin: "0% 50%", to: 1.05 });
  }

  return { init, set, tween, pop, fadeIn, fadeOut, cut, slam, zoomFast, zoomIn, zoomOut, slowZoom, flyIn, flyOut, tip, wobble, settle, pulse, blink, draw, drawCircle, drawLine, handCircle, handLine, lightning, cursor, touch, midCta, endCard };
})();
