    // Hook-Ansicht (reingezoomt auf Basis + Ausbruchskerze, wie in beiden Anfängen) -> ganzer Chart.
    // = matrix(2.62987 0 0 3.51563 -1422.21 -1444.14), als reine Skalierung um ihren Fixpunkt (seek-sicher).
    const HOOK = { scaleX: 2.62987, scaleY: 3.51563 };
    const HO = "872.59 574.07";
    // Kamera: langsamer Zoom (Wrapper, 100 <-> 108 %) und 150 %-Zoom (zoom-Gruppe) um denselben Punkt (950, 500),
    // die Faktoren multiplizieren sich: 1,08 x 1,389 = 1,5. S() = Position eines Chart-Punkts im Bild bei Zoom k.
    const PV = "950 500";
    const ZW = 1.08, ZT = 1.5, ZZ = ZT / ZW;
    const S = (x, y, k) => [950 + k * (x - 950), 500 + k * (y - 500)];
    // Box: Einstieg y 445, Stop y 565, 2:1-Ziel y 205, Widerstand y 319 (Chart-Koordinaten); Griff in der Box-Mitte x 948.
    const BOX_O = "948 445";

    // ---- Beats (aus den Cues; Mindestabstände halten die Bilder lesbar, wenn schneller gesprochen wird)
    const tL1 = Math.max(0, C.f1 - 0.05);                                  // Label "1/3 Signal?"
    const tSig = Math.max(tL1 + 1.5, C.hier - 0.05);                       // Signal-Pfeil einblenden (Klick)
    const tT1 = Math.max(tSig + 0.5, C.einstieg - 0.05);                   // Haken 1
    const tL2 = Math.max(tT1 + 0.6, C.f2 - 0.05);                          // Label "2/3 Stop?"
    const tStop = Math.max(tL2 + 1.0, C.stop - 0.05);                      // rote Stop-Linie einblenden (Klick)
    const tT2 = Math.max(tStop + 0.4, C.stopW - 0.05);                     // Haken 2
    const tBlink = Math.max(tT2 + 0.4, C.bevor - 0.05);                    // "... und zwar bevor ich einsteige": Stop blinkt 1x
    const tMore = Math.max(tBlink + 0.9, C.mehr - 0.05);                   // Banner "Mehr dazu ↓"
    const tPulseM = Math.max(tMore + 0.4, C.mehrDazu - 0.05);              // "klick unter dem Video ...": Banner pulsiert 1x
    // Banner mind. 3 s und nie weg, bevor "Mehr dazu" ausgesprochen ist (kein oberes Limit).
    const dMore = Math.max(3, Math.max(E.mehrDazu + 0.35, tPulseM + 0.85) - tMore);
    const tSZ = Math.max(tMore + 1.0, C.bleib - 0.05);                     // "Aber bleib noch kurz": langsamer Zoom 100 -> 108 %
    const tL3 = Math.max(tSZ + 0.5, C.f3 - 0.05);                          // Label "3/3 Lohnt sich's?"
    const tNehme = Math.max(tL3 + 0.6, C.nehme - 0.05);                    // "Ich nehme nur Trades ...": Hand zum Einstieg
    const tBox = Math.max(tNehme + 0.9, tSZ + 2.6, C.doppelt - 0.05);      // Long-Position-Box aufziehen (2:1)
    const tZoom = tBox + 0.5;                                              // ... und auf 150 % reinzoomen
    const tRes = Math.max(tZoom + 0.6, C.undhier - 0.05);                  // Widerstands-Linie einblenden
    const tShrink = Math.max(tRes + 0.5, C.ziel - 0.05);                   // Ziel nur bis zum Widerstand: ca. 1:1
    const tCross = Math.max(tShrink + 0.5, C.gerade - 0.05);               // rotes Kreuz am Label 3
    const tX = Math.max(tCross + 0.6, C.also - 0.05);                      // großes rotes X
    const tZO1 = Math.max(tX + 0.6, C.disziplin - 0.05);                   // leicht rauszoomen 108 -> 100 % (3 s), X bleibt
    const tZO2 = Math.max(tZO1 + 3.05, C.dauert - 0.05);                   // rauszoomen auf den ganzen Chart, X bleibt
    const tCourse = Math.max(tZO2 + 0.9, C.wie - 0.05);                    // Kurs-Mockup + 3 Haken
    const k1 = Math.max(tCourse + 0.45, C.denkweise - 0.05);
    const tVK = Math.max(k1 + 0.4, C.videokurs - 0.05);                    // "... in meinem kostenlosen Videokurs": Hand aufs Video
    const k2 = Math.max(k1 + 0.4, C.strategie - 0.05);
    const k3 = Math.max(k2 + 0.4, C.plan - 0.05);
    const tCTA = Math.max(k3 + 1.0, tCourse + 2.0, C.klick - 0.05);        // CTA-Bild bis zum Ende

    // ---- Startzustände
    FX.init(tl, "#a3b-view", { svgOrigin: HO, smoothOrigin: false, ...HOOK });
    FX.init(tl, "#a3b-wrap", { svgOrigin: PV, smoothOrigin: false, scale: 1 });
    FX.init(tl, "#a3b-zoom", { svgOrigin: PV, smoothOrigin: false, scale: 1 });
    FX.init(tl, "#a3b-sig", { opacity: 0, svgOrigin: "864 602", smoothOrigin: false });
    FX.init(tl, "#a3b-box", { opacity: 0 });
    FX.init(tl, "#a3b-bg", { svgOrigin: BOX_O, smoothOrigin: false, scaleY: 0.02 });
    FX.init(tl, "#a3b-br", { svgOrigin: BOX_O, smoothOrigin: false, scaleY: 0.02 });
    ["#a3b-stop", "#a3b-res", "#a3b-l1", "#a3b-t1", "#a3b-l2", "#a3b-t2", "#a3b-l3", "#a3b-t3", "#a3b-x"].forEach((el) => FX.init(tl, el, { opacity: 0 }));

    // Body-Start: aus der Hook-Ansicht auf den ganzen Chart rauszoomen (0,6 s).
    FX.tween(tl, "#a3b-view", { ...HOOK, svgOrigin: HO, smoothOrigin: false }, { scaleX: 1, scaleY: 1, duration: 0.6, ease: "power2.inOut", svgOrigin: HO, smoothOrigin: false }, 0);

    // Frage 1: "Gibt's hier überhaupt ein klares Signal ..." -> "Hier ja, mein Indikator zeigt einen Einstieg" -> Pfeil, Haken.
    FX.pop(tl, "#a3b-l1", tL1, { origin: "0% 50%" });
    FX.fadeIn(tl, "#a3b-sig", tSig);
    FX.pop(tl, "#a3b-t1", tT1);
    const dPulse = tL2 - 0.3 - (tT1 + 1.0);
    if (dPulse >= 0.8) FX.pulse(tl, "#a3b-sig", tT1 + 1.0, Math.min(1.6, dPulse), { svgOrigin: "864 602" });

    // Frage 2: Label tauschen, "Genau da kommt mein Stop hin" -> rote Stop-Linie, Haken; "... bevor ich einsteige" -> blinkt.
    FX.cut(tl, "#a3b-r1", null, tL2);
    FX.pop(tl, "#a3b-l2", tL2, { origin: "0% 50%" });
    FX.fadeIn(tl, "#a3b-stop", tStop);
    FX.pop(tl, "#a3b-t2", tT2);
    FX.blink(tl, "#a3b-stop", tBlink, 0.8);

    // "Wenn du sehen willst, wie ich das Schritt für Schritt mache ...": kleines Banner unten, pulsiert auf "klick ...".
    FX.more(tl, "a3b-more", tMore, dMore);
    FX.pulse(tl, "#a3b-more", tPulseM, 0.8);

    // "Aber bleib noch kurz ...": langsamer Zoom Richtung Einstieg. Frage 3: Label tauschen.
    FX.slowZoom(tl, "#a3b-wrap", tSZ, { svgOrigin: PV, from: 1, to: ZW });
    FX.cut(tl, "#a3b-r2", null, tL3);
    FX.pop(tl, "#a3b-l3", tL3, { origin: "0% 50%" });

    // "... mindestens doppelt so weit weg ..." -> Box aufziehen (2:1), dann auf 150 % reinzoomen.
    tl.set("#a3b-box", { opacity: 1 }, tBox);
    FX.tween(tl, "#a3b-bg", { scaleY: 0.02, svgOrigin: BOX_O }, { scaleY: 1, duration: 0.4, ease: "power2.out", svgOrigin: BOX_O }, tBox);
    FX.tween(tl, "#a3b-br", { scaleY: 0.02, svgOrigin: BOX_O }, { scaleY: 1, duration: 0.3, ease: "power2.out", svgOrigin: BOX_O }, tBox);
    FX.zoomIn(tl, "#a3b-zoom", tZoom, { svgOrigin: PV, to: ZZ });

    // "Und hier? Das nächste Ziel liegt gerade mal so weit weg wie der Stop." -> Widerstand (die zwei Dochte der Erholung
    // sind im 150 %-Bild links zu sehen), Box ca. 1:1, rotes Kreuz.
    FX.fadeIn(tl, "#a3b-res", tRes);
    FX.tween(tl, "#a3b-bg", { scaleY: 1, svgOrigin: BOX_O }, { scaleY: 126 / 240, duration: 0.4, ease: "power2.inOut", svgOrigin: BOX_O }, tShrink);
    FX.pop(tl, "#a3b-t3", tCross);

    // "Also lass ich den Trade weg ..." -> großes rotes X. "Genau diese Disziplin ..." -> leicht rauszoomen (108 -> 100 %,
    // 3 s, linear), X bleibt. "Das dauert keine 2 Minuten ..." -> zurück auf den ganzen Chart (0,5 s), X bleibt.
    FX.slam(tl, "#a3b-x", tX);
    FX.slowZoom(tl, "#a3b-wrap", tZO1, { svgOrigin: PV, from: ZW, to: 1 });
    FX.zoomOut(tl, "#a3b-zoom", tZO2, { svgOrigin: PV, from: ZZ });

    // Kurs-Mockup mit 3 Haken: 3 Fragen · Strategie · 60-Tage-Plan.
    FX.cut(tl, ["#a3b-chart", "#a3b-r3", "#a3b-x"], null, tCourse);
    FX.course(tl, "a3b-course", tCourse, [k1, k2, k3]);

    // "Klick unter dem Video auf „Mehr dazu“." -> CTA-Bild, bleibt bis zum Ende.
    tl.set("#a3b-course", { opacity: 0 }, tCTA);
    FX.cta(tl, "a3b-cta", tCTA);

    // ---- Cursor: ruhig, eine Bewegung pro Satz; Klick-Ring nur, wenn der Klick direkt daneben etwas aufdeckt.
    // Start = Übergabepunkt beider Hooks (links neben der "3").
    const P = (t) => Math.max(0.05, t);
    const m2 = Math.max(1.7, tSig - 0.75);
    const sStop = tL2 + 0.5;
    const hBox = S(948, 445, ZW);                                          // Griff der Box (Einstieg) bei 108 %
    FX.cursor(tl, "#a3b-cur", "#a3b-ring", [215, 590], [
      { t: P(0.7), to: [910, 478], d: 0.8 },                               // "Gibt's hier ...": zeigt auf die Ausbruchskerze
      { t: m2, to: [910, 598], d: Math.min(0.6, Math.max(0.3, tSig - 0.05 - m2)) },  // "Hier ja ...": runter neben den Pfeil
      { t: tSig, click: true },
      { t: sStop, to: [560, 574], d: Math.min(0.8, Math.max(0.3, tStop - 0.1 - sStop)) }, // "Wo weiß ich ...": unter das Tief der Basis
      { t: tStop, click: true },
      { t: tMore + 0.05, to: [742, 634], d: 0.6 },                         // zeigt aufs Banner
      { t: tNehme, to: hBox, d: Math.min(0.9, Math.max(0.4, tBox - 0.1 - tNehme)) },   // zum Einstieg
      { t: tBox, click: true },
      { t: tBox + 0.02, to: S(948, 205, ZW), d: 0.4, ease: "power2.out" },  // Ziel auf 2:1 hochziehen
      { t: tZoom, to: S(948, 205, ZT), d: 0.5, ease: "power2.inOut" },      // fährt mit dem 150 %-Zoom mit
      { t: tShrink, to: S(948, 319, ZT), d: 0.4, ease: "power2.inOut" },    // Ziel runter bis zum Widerstand ziehen
      { t: tX + 0.25, to: [1000, 632], d: 0.7 },                            // aus dem Weg, X bleibt frei
      { t: tVK, to: [408, 268], d: 0.8 },                                   // aufs Kurs-Video
      { t: tCTA, hide: true },
    ]);
