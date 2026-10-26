// Generates the hand-made Gold 4h candle chart for Ad 3 (deterministic OHLC) and writes it
// between <!--gen:chart ...--> and <!--/gen:chart--> markers in the three Ad 3 scenes.
// Chart space = body full view (1080 x 710 Motiv-Zone px).
//   x_i = 40 + 26 i     (32 candles, body 19 px)
//   y(p) = 405 - (p - 10) * 14.5   (price units: Stop 0, Entry 10, Widerstand 20.5, 2x-Ziel 30)
import fs from "node:fs";
const ROOT = "/home/user/test/finanzcode/src/scenes";
// [open, high, low, close]
const OHLC = [
  [7.0, 8.6, 6.2, 8.2], [8.2, 9.9, 7.6, 9.4], [9.4, 9.8, 8.1, 8.6], [8.6, 11.2, 8.3, 10.8],
  [10.8, 13.4, 10.2, 12.9], [12.9, 13.6, 11.7, 12.2], [12.2, 15.6, 11.9, 15.1], [15.1, 17.9, 14.6, 17.4],
  [17.4, 19.2, 16.6, 18.6], [18.6, 20.5, 17.8, 18.1], [18.1, 18.9, 16.4, 16.9], [16.9, 18.7, 16.5, 18.3],
  [18.3, 20.5, 17.9, 18.0], [18.0, 18.4, 15.6, 15.9], [15.9, 16.6, 13.0, 13.4], [13.4, 14.5, 12.6, 14.1],
  [14.1, 14.3, 10.2, 10.6], [10.6, 11.0, 7.0, 7.4], [7.4, 7.9, 3.6, 4.0], [4.0, 4.4, 0.4, 0.8],
  [0.8, 1.2, -2.4, -1.6], [-1.6, 0.3, -2.0, -0.2], [-0.2, 0.6, -0.9, -0.6], [-0.6, 1.0, -1.0, 0.7],
  [0.7, 1.4, -0.1, 0.3], [0.3, 1.7, 0.1, 1.3], [1.3, 1.9, 0.6, 0.9], [0.9, 2.3, 0.7, 2.0],
  [2.0, 2.5, 1.2, 1.6], [1.6, 2.8, 1.3, 2.5], [2.5, 3.0, 1.8, 2.2], [2.2, 10.5, 1.9, 10.0],
];
const X = (i) => 40 + 26 * i;
const Y = (p) => 405 - (p - 10) * 14.5;
const f = (v) => +v.toFixed(2);
const G = "#16A34A", R = "#DC2626";

function candles(from, ind) {
  const out = [];
  for (let i = from; i < OHLC.length; i++) {
    const [o, h, l, c] = OHLC[i];
    const col = c >= o ? G : R;
    const top = Y(Math.max(o, c)), bot = Y(Math.min(o, c));
    const hgt = Math.max(3, bot - top);
    const id = i === OHLC.length - 1 ? ` id="${"${p}"}-bo"` : "";
    out.push(`${ind}<g${id}><line x1="${X(i)}" y1="${f(Y(h))}" x2="${X(i)}" y2="${f(Y(l))}" stroke="${col}" /><rect x="${X(i) - 9.5}" y="${f(top)}" width="19" height="${f(hgt)}" fill="${col}" /></g>`);
  }
  return out.join("\n");
}

for (const [file, p, from] of [["ad3-hookA.html", "a3ha", 20], ["ad3-hookB.html", "a3hb", 20], ["ad3-body.html", "a3b", 0]]) {
  const fp = `${ROOT}/${file}`;
  if (!fs.existsSync(fp)) continue;
  let src = fs.readFileSync(fp, "utf8");
  const re = /(<!--gen:chart[^>]*-->\n)([\s\S]*?)(\n\s*<!--\/gen:chart-->)/;
  const m = src.match(re);
  if (!m) { console.log("no marker in", file); continue; }
  const ind = (m[3].match(/\n(\s*)/) || ["", ""])[1];
  const body = candles(from, ind).replaceAll("${p}", p);
  src = src.replace(re, `$1${body}$3`);
  fs.writeFileSync(fp, src);
  console.log("wrote", file, OHLC.length - from, "candles");
}
console.log({ E: Y(10), S: Y(0), R: f(Y(20.5)), T2: Y(30), lowest: f(Y(-2.4)), x31: X(31), bo_low: f(Y(1.9)), bo_high: f(Y(10.5)) });
