// Ad 3 chart v2: hand-made deterministic Gold 4h OHLC (30 candles), written between
// <!--gen:chart--> and <!--/gen:chart--> in the three Ad 3 scenes, plus the hook-view matrix.
// Chart space = body full view (1080 x 710 Motiv-Zone px).
//   x_i = X0 + 28 i  (30 candles, body 22 px)
//   y(p) = 445 - (p - 10) * 12  (price units: Stop 0, Entry 10, Widerstand 20.5, 2x-Ziel 30)
import fs from "node:fs";
const ROOT = "/home/user/test/finanzcode/src/scenes";
const X0 = 52, PITCH = 28, BODY = 22;
// [open, high, low, close]
const OHLC = [
  [-5.0, -2.8, -6.0, -3.4], [-3.4, 3.6, -4.0, 3.0], [3.0, 4.0, 0.4, 1.2], [1.2, 13.6, 0.8, 12.8],
  [12.8, 25.2, 12.2, 24.4], [24.4, 32.4, 23.6, 31.6], [31.6, 34.8, 29.8, 30.4], [30.4, 31.8, 26.0, 26.8],
  [26.8, 29.0, 26.2, 28.4], [28.4, 28.8, 21.6, 22.4], [22.4, 23.0, 14.8, 15.6], [15.6, 16.2, 10.6, 11.4],
  // Erholung bis an den Widerstand (zwei Dochte bei 20,4 / 20,5), dann Abverkauf in die Basis
  [11.4, 17.0, 10.8, 16.4], [16.4, 20.4, 15.8, 19.6], [19.6, 20.5, 17.6, 18.2], [18.2, 18.6, 12.8, 13.4],
  [13.4, 13.8, 7.4, 8.0], [8.0, 8.4, 2.4, 3.0],
  // Basis (Tief 1,0) mit leicht steigenden Kerzen
  [3.0, 3.6, 1.0, 2.2], [2.2, 3.4, 1.6, 3.0], [3.0, 4.0, 2.4, 3.6], [3.6, 3.9, 2.2, 2.6],
  [2.6, 3.8, 2.0, 3.4], [3.4, 4.4, 2.8, 4.0], [4.0, 4.4, 2.8, 3.2], [3.2, 4.2, 2.6, 3.8],
  [3.8, 4.8, 3.2, 4.4], [4.4, 4.9, 3.4, 3.8], [3.8, 4.6, 3.4, 4.2],
  // dicke grüne Ausbruchskerze (Schluss = Einstieg 10)
  [4.2, 10.6, 3.8, 10.0],
];
const N = OHLC.length;
const X = (i) => X0 + PITCH * i;
const Y = (p) => 445 - (p - 10) * 12;
const f = (v) => +v.toFixed(2);
const G = "#16A34A", R = "#DC2626";
const HOOK_FROM = 18;

function candles(from, ind) {
  const out = [];
  for (let i = from; i < N; i++) {
    const [o, h, l, c] = OHLC[i];
    const col = c >= o ? G : R;
    const top = Y(Math.max(o, c)), bot = Y(Math.min(o, c));
    const hgt = Math.max(3, bot - top);
    const id = i === N - 1 ? ` id="\${p}-bo"` : "";
    out.push(`${ind}<g${id}><line x1="${X(i)}" y1="${f(Y(h))}" x2="${X(i)}" y2="${f(Y(l))}" stroke="${col}" /><rect x="${X(i) - BODY / 2}" y="${f(top)}" width="${BODY}" height="${f(hgt)}" fill="${col}" /></g>`);
  }
  return out.join("\n");
}

// Hook view: candle HOOK_FROM centre -> screen x 40, breakout centre -> 850; breakout high -> y 95, base low -> y 500.
const bo = OHLC[N - 1];
const baseLow = Math.min(...OHLC.slice(HOOK_FROM, N).map((c) => c[2]));
const sx = (850 - 40) / (X(N - 1) - X(HOOK_FROM));
const sy = (500 - 95) / (Y(baseLow) - Y(bo[1]));
const tx = 40 - sx * X(HOOK_FROM), ty = 95 - sy * Y(bo[1]);
const fx = tx / (1 - sx), fy = ty / (1 - sy); // fixed point of the scale
const matrix = `matrix(${sx.toFixed(5)} 0 0 ${sy.toFixed(5)} ${tx.toFixed(2)} ${ty.toFixed(2)})`;
const H = (x, y) => [f(sx * x + tx), f(sy * y + ty)];

for (const [file, p, from] of [["ad3-hookA.html", "a3ha", HOOK_FROM], ["ad3-hookB.html", "a3hb", HOOK_FROM], ["ad3-body.html", "a3b", 0]]) {
  const fp = `${ROOT}/${file}`;
  let src = fs.readFileSync(fp, "utf8");
  const re = /(<!--gen:chart-->\n)([\s\S]*?)(\n\s*<!--\/gen:chart-->)/;
  const m = src.match(re);
  if (!m) { console.log("no marker in", file); continue; }
  const ind = (m[3].match(/\n(\s*)/) || ["", ""])[1];
  const body = candles(from, ind).replaceAll("${p}", p);
  src = src.replace(re, `$1${body}$3`);
  if (from > 0) src = src.replace(/<g transform="matrix\([^)]*\)">/, `<g transform="${matrix}">`);
  fs.writeFileSync(fp, src);
  console.log("wrote", file, N - from, "candles");
}
console.log({
  E: Y(10), S: Y(0), R: f(Y(20.5)), T2: Y(30), top: f(Y(Math.max(...OHLC.map((c) => c[1])))), low: f(Y(Math.min(...OHLC.map((c) => c[2])))),
  xFirst: X(0), xLast: X(N - 1), baseLowY: f(Y(baseLow)), boLowY: f(Y(bo[2])), boHighY: f(Y(bo[1])),
  hook: { matrix, scaleX: +sx.toFixed(5), scaleY: +sy.toFixed(5), origin: `${fx.toFixed(2)} ${fy.toFixed(2)}` },
  hookScreen: { bo: H(X(N - 1), Y(bo[1])), boBody: [H(X(N - 1) - BODY / 2, Y(10)), H(X(N - 1) + BODY / 2, Y(bo[0]))], boLow: H(X(N - 1), Y(bo[2])), prevRight: H(X(HOOK_FROM - 1) + BODY / 2, 0)[0], first: H(X(HOOK_FROM) - BODY / 2, 0)[0] },
});
// Check: what is under the label row / off the edges at the zoom levels used in the body.
const P = [950, 500];
for (const k of [1, 1.08, 1.5]) {
  const sc = (x, y) => [P[0] + k * (x - P[0]), P[1] + k * (y - P[1])];
  let minTopUnderLabel = 1e9, minY = 1e9, maxY = -1e9;
  OHLC.forEach((c, i) => {
    const [l, r] = [sc(X(i) - BODY / 2, 0)[0], sc(X(i) + BODY / 2, 0)[0]];
    if (r < 0 || l > 1080) return;
    const top = sc(0, Y(c[1]))[1], bot = sc(0, Y(c[2]))[1];
    minY = Math.min(minY, top); maxY = Math.max(maxY, bot);
    if (r > 36 && l < 520) minTopUnderLabel = Math.min(minTopUnderLabel, top);
  });
  console.log(`zoom ${k}: candle tops min ${f(minY)}, lows max ${f(maxY)}, min top under label (x 36-520) ${f(minTopUnderLabel)}, box x ${sc(888, 0)[0]}-${sc(1008, 0)[0]}, T2 ${f(sc(0, 205)[1])}, S ${f(sc(0, 565)[1])}, R ${f(sc(0, Y(20.5))[1])}, arrow bottom ${f(sc(0, 627)[1])}, relief x ${f(sc(X(13), 0)[0])}-${f(sc(X(14), 0)[0])}`);
}
