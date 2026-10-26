// Flat illustrated portraits for the 4 Quartett cards (stand-ins for licensed photos).
// viewBox 0 0 380 574 (native card units). Head centre (190, 196). No outlines on shapes,
// feature lines 7 units. Faces are generic, friendly, not modelled on anyone.
const BG = "#DDE3EA";
const INK = "#111827";

const torso = (fill) => `<path d="M24 574 V478 C24 400 88 352 190 348 C292 352 356 400 356 478 V574 Z" fill="${fill}"/>`;
const neck = (shade) => `<path d="M160 250 H220 V338 Q190 360 160 338 Z" fill="${shade}"/>`;
const ears = (skin) => `<ellipse cx="114" cy="206" rx="15" ry="24" fill="${skin}"/><ellipse cx="266" cy="206" rx="15" ry="24" fill="${skin}"/>`;
const head = (skin) => `<ellipse cx="190" cy="196" rx="77" ry="92" fill="${skin}"/>`;
const nose = (shade) => `<path d="M192 214 Q181 236 194 241" fill="none" stroke="${shade}" stroke-width="7" stroke-linecap="round"/>`;
const eye = (cx, cy, o = {}) => {
  const r = o.r ?? 15, ry = o.ry ?? r, pr = o.pr ?? 8, dx = o.dx ?? 0, dy = o.dy ?? 0;
  return `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${ry}" fill="#FFFFFF"/><circle cx="${cx + dx}" cy="${cy + dy}" r="${pr}" fill="${INK}"/><circle cx="${cx + dx + 3}" cy="${cy + dy - 3}" r="2.6" fill="#FFFFFF"/>`;
};
const line = (d, c, w = 7) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

// (1) Der Zocker: aufgerissene Augen, Handy in der Hand.
function zocker() {
  const skin = "#F2C29B", shade = "#E0A57A", hair = "#3B2416", hood = "#DC2626", hoodD = "#B91C1C";
  return [
    `<rect width="380" height="574" fill="${BG}"/>`,
    torso(hood),
    neck(shade),
    // Kapuze um den Hals + Kordeln
    `<path d="M112 356 C124 302 256 302 268 356 C244 388 136 388 112 356 Z" fill="${hoodD}"/>`,
    line("M170 380 L166 444", "#FFFFFF", 7),
    line("M210 380 L214 444", "#FFFFFF", 7),
    ears(skin),
    head(skin),
    // strubbelige Haare
    `<path d="M112 196 C100 126 146 94 194 94 C246 94 284 128 270 198 C264 170 252 154 236 146 L226 160 L212 140 L196 158 L180 138 L164 160 L150 146 C130 156 118 172 112 196 Z" fill="${hair}"/>`,
    `<path d="M150 104 L132 80 L170 96 Z M196 94 L198 66 L220 96 Z M238 104 L264 86 L254 118 Z" fill="${hair}"/>`,
    // hochgezogene Augenbrauen, weit aufgerissene Augen
    line("M134 158 Q157 140 180 154", hair, 8),
    line("M200 154 Q223 140 246 158", hair, 8),
    eye(158, 202, { r: 21, pr: 8.5 }),
    eye(222, 202, { r: 21, pr: 8.5 }),
    nose(shade),
    // aufgeregtes, offenes Grinsen
    `<path d="M152 254 Q190 306 228 254 Q190 268 152 254 Z" fill="#7F1D1D"/>`,
    `<path d="M160 258 Q190 268 220 258 L217 266 Q190 276 163 266 Z" fill="#FFFFFF"/>`,
    // Arm mit Handy (Rückseite zur Kamera)
    line("M48 574 L84 440", hood, 66),
    `<g transform="rotate(-9 96 372)"><rect x="54" y="292" width="88" height="160" rx="16" fill="#0E1A2B"/><rect x="66" y="306" width="22" height="34" rx="8" fill="#334155"/><circle cx="77" cy="316" r="5" fill="#94A3B8"/><circle cx="77" cy="331" r="5" fill="#94A3B8"/></g>`,
    `<ellipse cx="92" cy="424" rx="34" ry="30" fill="${skin}"/>`,
    `<rect x="120" y="356" width="30" height="20" rx="10" fill="${skin}" transform="rotate(-9 135 366)"/>`,
    `<rect x="122" y="380" width="30" height="20" rx="10" fill="${skin}" transform="rotate(-9 137 390)"/>`,
  ].join("");
}

// (2) Der Dauerlerner: unter Notizen begraben.
function dauerlerner() {
  const skin = "#C68642", shade = "#A86B32", hair = "#1F1A17", top = "#334155";
  const paper = (x, y, w, h, rot, lines = 3) => {
    let s = `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#FFFFFF" stroke="#9CA3AF" stroke-width="5"/>`;
    for (let i = 0; i < lines; i++) s += line(`M${x + 22} ${y + 30 + i * 26} H${x + w - 22 - (i === lines - 1 ? w * 0.3 : 0)}`, "#9CA3AF", 7);
    return s + "</g>";
  };
  const sticky = (x, y, s, rot) => `<g transform="rotate(${rot} ${x + s / 2} ${y + s / 2})"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="6" fill="#F3F4F6" stroke="#9CA3AF" stroke-width="5"/>${line(`M${x + 14} ${y + 24} H${x + s - 14}`, "#9CA3AF", 6)}${line(`M${x + 14} ${y + 44} H${x + s - 26}`, "#9CA3AF", 6)}</g>`;
  const curls = [[118, 176], [128, 136], [156, 108], [190, 98], [224, 108], [252, 136], [262, 176]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="30" fill="${hair}"/>`).join("");
  return [
    `<rect width="380" height="574" fill="${BG}"/>`,
    torso(top),
    neck(shade),
    `<path d="M160 350 L190 392 L220 350 Z" fill="#FFFFFF"/>`,
    ears(skin),
    curls,
    head(skin),
    `<path d="M120 170 C128 128 160 116 190 116 C220 116 252 128 260 170 C246 150 220 142 190 142 C160 142 134 150 120 170 Z" fill="${hair}"/>`,
    // Brille
    `<circle cx="157" cy="204" r="29" fill="#FFFFFF" fill-opacity="0.25" stroke="#0E1A2B" stroke-width="7"/>`,
    `<circle cx="223" cy="204" r="29" fill="#FFFFFF" fill-opacity="0.25" stroke="#0E1A2B" stroke-width="7"/>`,
    line("M186 200 Q190 194 194 200", "#0E1A2B", 6),
    eye(157, 206, { r: 13, ry: 11, pr: 7.5 }),
    eye(223, 206, { r: 13, ry: 11, pr: 7.5 }),
    line("M136 164 Q156 156 176 166", hair, 8),
    line("M204 166 Q224 156 244 164", hair, 8),
    nose(shade),
    line("M168 262 Q179 252 190 262 Q201 272 212 262", "#5B2A12", 7),
    // Zettel im Haar
    sticky(214, 64, 70, 14),
    sticky(98, 92, 62, -16),
    // Zettelstapel bis unters Kinn
    paper(18, 470, 230, 150, -8),
    paper(150, 456, 220, 150, 9),
    paper(40, 384, 210, 140, 6),
    paper(150, 372, 214, 140, -7),
    paper(84, 318, 210, 132, -3),
  ].join("");
}

// (3) Der Ungeduldige: genervter Blick auf die Uhr.
function ungeduldig() {
  const skin = "#E0AC69", shade = "#C48F52", hair = "#8B3A1A", top = "#475569";
  return [
    `<rect width="380" height="574" fill="${BG}"/>`,
    // lange Haare hinter dem Kopf
    `<path d="M98 214 C90 120 140 84 190 84 C244 84 292 122 282 214 L292 336 C268 352 236 344 228 318 L152 318 C144 344 112 352 88 336 Z" fill="${hair}"/>`,
    torso(top),
    neck(shade),
    `<path d="M162 350 L190 404 L218 350 Z" fill="#FFFFFF"/>`,
    ears(skin),
    head(skin),
    // Pony
    `<path d="M112 180 C112 118 152 100 192 100 C236 100 270 120 270 182 C252 150 226 136 206 132 C190 150 150 166 112 180 Z" fill="${hair}"/>`,
    // genervt: Brauen schräg nach innen, Lider halb zu, Blick nach unten rechts zur Uhr
    line("M134 170 L178 182", "#5B2A12", 8),
    line("M246 170 L202 182", "#5B2A12", 8),
    eye(158, 208, { r: 15, ry: 11, pr: 7.5, dx: 5, dy: 4 }),
    eye(222, 208, { r: 15, ry: 11, pr: 7.5, dx: 5, dy: 4 }),
    line("M141 200 H175", INK, 6),
    line("M205 200 H239", INK, 6),
    nose(shade),
    line("M168 268 Q190 256 212 268", "#7F1D1D", 7),
    // hochgehaltener Unterarm vor der Brust (dunklerer Ärmel), Faust oben, große Armbanduhr am Handgelenk
    line("M330 586 L250 430", "#334155", 72),
    `<ellipse cx="238" cy="398" rx="34" ry="30" fill="${skin}" transform="rotate(-30 238 398)"/>`,
    `<path d="M214 384 Q226 368 246 372" fill="none" stroke="${shade}" stroke-width="6" stroke-linecap="round"/>`,
    `<rect x="234" y="420" width="78" height="34" rx="8" fill="${INK}" transform="rotate(-62 273 437)"/>`,
    `<circle cx="273" cy="437" r="31" fill="#FFFFFF" stroke="#0E1A2B" stroke-width="7"/>`,
    line("M273 437 L273 418", "#0E1A2B", 6),
    line("M273 437 L287 444", "#DC2626", 5),
  ].join("");
}

// (4) Der, der dranbleibt: ruhig mit Kaffee und leichtem Lächeln.
function dran() {
  const skin = "#8D5524", shade = "#74431B", hair = INK, top = "#16A34A", topD = "#15803D";
  return [
    `<rect width="380" height="574" fill="${BG}"/>`,
    torso(top),
    neck(shade),
    `<path d="M140 352 C150 330 230 330 240 352 C226 372 154 372 140 352 Z" fill="${topD}"/>`,
    ears(skin),
    head(skin),
    `<path d="M114 182 C108 116 150 92 192 92 C236 92 274 118 266 182 C256 150 232 132 192 132 C152 132 126 150 114 182 Z" fill="${hair}"/>`,
    // ruhige Augen, entspannte Brauen, leichtes Lächeln
    line("M138 168 Q157 160 176 168", hair, 8),
    line("M204 168 Q223 160 242 168", hair, 8),
    eye(158, 204, { r: 14, ry: 12, pr: 8 }),
    eye(222, 204, { r: 14, ry: 12, pr: 8 }),
    line("M144 198 Q158 190 172 198", shade, 5),
    line("M208 198 Q222 190 236 198", shade, 5),
    nose(shade),
    line("M164 252 Q190 274 216 252", "#3B1F0E", 7),
    // Rollkragen, Kaffeetasse (Kaffee sichtbar) in beiden Händen
    `<rect x="150" y="306" width="80" height="50" rx="20" fill="${topD}"/>`,
    `<path d="M230 344 C266 344 266 388 230 388" fill="none" stroke="#FFFFFF" stroke-width="13"/>`,
    `<rect x="146" y="324" width="88" height="88" rx="14" fill="#FFFFFF"/>`,
    `<ellipse cx="190" cy="326" rx="40" ry="9" fill="#6B3F1D"/>`,
    `<rect x="146" y="352" width="88" height="20" fill="#0E1A2B"/>`,
    `<ellipse cx="144" cy="392" rx="27" ry="21" fill="${skin}"/>`,
    `<ellipse cx="236" cy="394" rx="27" ry="21" fill="${skin}"/>`,
  ].join("");
}

export const PORTRAITS = [zocker, dauerlerner, ungeduldig, dran].map((f) => f());
export const ASSET = ["ad4-portrait-zocker", "ad4-portrait-dauerlerner", "ad4-portrait-ungeduldig", "ad4-portrait-dranbleiber"];
