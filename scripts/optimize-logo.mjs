/**
 * Atabul Driving Center — brand mark pipeline + source-quality gate.
 *
 *   node scripts/optimize-logo.mjs --report                 pre-flight a candidate
 *   node scripts/optimize-logo.mjs                          validate, then emit ladder
 *   node scripts/optimize-logo.mjs --master f.png --out d/  work on elsewhere (tests)
 *   node scripts/optimize-logo.mjs --opaque-ok              accept a flat-backed export
 *
 * WHY A QUALITY GATE EXISTS AT ALL
 * The first brand-logo file handed over measured 1181x896, 1616 KB, 100% opaque,
 * artwork touching all four edges, on a mottled grey background. Putting that in the
 * header would have made the site's most important element worse, and nothing in the
 * build would have noticed. So the master is measured before it may become an asset.
 * Each threshold is a measured gap between that file and a clean logo export — not a
 * matter of taste:
 *
 *   alpha      clean export keeps a transparent field. 0.0% transparent means the mark
 *              cannot sit on --dp-navy-900 and cannot be recoloured: it becomes a
 *              bright tile whose four corners are four different greys.
 *   flatness   a vector fill has local luminance stddev ~0-1. Sampled "background"
 *              patches of that file: 9.9-34.4, i.e. photographic or re-saved, which no
 *              resampling can undo.
 *   detail     at 2x the display slot a logo is mostly flat areas plus a few strong
 *              edges; that file kept 41.2% of horizontal steps above 24/255 — nearly
 *              all edges, which reads as mud at favicon size.
 *   bleed      ink box == full canvas leaves no clear space, and trimming to the art
 *              needs alpha to know where the art stops.
 *
 * Nothing is written unless every rule passes; any failure exits non-zero.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const MASTER = opt("master", "Asset/Data/Symbolic_logo.png");
const OUT = path.normalize(opt("out", "public/brand"));
const REPORT = argv.includes("--report");
const NAVY = "0x0b1b2b"; // --dp-navy-900: the surface the mark is seen against, for contrast only

/* Display contract, from components.css: .logo__mark is `clamp(6rem, 5vw + 4.5rem, 7rem)`
   tall with width auto — 96px floor, 112px on desktop. 96 is not a preference: it is
   where this artwork crosses the legibility rule below (88px measures 15.2%, 96px
   measures 14.3% against a 15% budget), and the logo's own lettering is ~14% of its
   height, so anything smaller renders the name inside it at 6-8px. The ladder is sized
   off the floor, and markScale preserves the artwork's aspect: a square width+height
   pair *stretches* it, which is what shipped for one revision (132x109 art displayed at
   44x44, ~27% too wide, while this script printed a NOTE saying not to). */
const SLOT_PX = Number(opt("slot", "96"));
const DPR = 3;
const MARK_PX = SLOT_PX * DPR; // rendered height x3: one lossless file serves header and footer
const BUDGETS = {
  /* Full-colour artwork, not a two-tone silhouette: these are 3-4x the silhouette
     budgets for one reason — the mark is now 1.67x larger AND carries its real
     colours, shading and interior detail, which is the whole request. favicon/512
     are plated on the artwork's own ground, so they stay small. `atabul-mark-512`
     is fetched by crawlers, never by a visitor. Budgets are measured ceilings, not
     wishes: each number below is the shipped size plus headroom, recorded in §4a. */
  "atabul-mark.webp": 18, // 380x288 measured 16.7 (lossy q80/method 6): 8% headroom
  "atabul-mark.png": 52, // same art indexed; 49.9 measured. Non-WebP <picture> fallback
  "favicon-32.png": 4, // 32x32: the whole artwork centred on its own ground (2 KB measured)
  "apple-touch-icon.png": 32, // 180x180 plated; 15.1 measured. iOS ignores alpha anyway
  "atabul-mark-512.png": 96, // JSON-LD `logo` + manifest; 83.8 measured, crawlers only
};

const issues = [];
const rule = (name, pass, detail = "") => {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  → ${detail}` : ""}`);
  if (!pass) issues.push(name);
};
const line = (label, value) => console.log(`  ${label.padEnd(10)} ${value}`);
const die = () => {
  if (!issues.length) return;
  console.log(`\n✗ logo pipeline rejected the master (${issues.length} rule(s) failed). Nothing was written.`);
  console.log("  Pre-flight a replacement: node scripts/optimize-logo.mjs --report --master <file>");
  process.exit(1);
};

if (!fs.existsSync(MASTER)) { console.error(`no master at ${MASTER}`); process.exit(1); }

/* ------------------------------------------------------------------ SVG ---- */
const head = fs.readFileSync(MASTER);
if (/\.svg$/i.test(MASTER)) {
  const svg = head.toString("utf8");
  line("master", `SVG ${(svg.length / 1024).toFixed(1)} KB`);
  rule("an SVG master declares a viewBox", /viewBox="/.test(svg));
  rule("an SVG master is under 60 KB (it ships inline-sized, unresampled)", svg.length < 60 * 1024);
  if (!REPORT && !issues.length) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "atabul-mark.svg"), svg);
    line("wrote", path.join(OUT, "atabul-mark.svg"));
  }
  console.log(
    "\n  NOTE  ffmpeg cannot rasterise SVG, so the three PNG sizes this mark also\n" +
    "        needs (Safari favicon, apple-touch-icon, JSON-LD logo) cannot be derived\n" +
    "        from here. Send the same artwork as a transparent PNG too, or export\n" +
    "        180px and 512px from the design tool — then run this script once.",
  );
  die();
  process.exit(0);
}

/* ----------------------------------------------------------------- read ---- */
if (head.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
  console.error(`unsupported master: only PNG and SVG are handled (0x${head.subarray(0, 4).toString("hex")}…) `);
  process.exit(1);
}
const W = head.readUInt32BE(16);
const H = head.readUInt32BE(20);
const COLOR = { 0: "gray", 2: "RGB", 3: "palette", 4: "gray+alpha", 6: "RGBA" }[head[25]] ?? "?";
line("master", `PNG ${W}x${H} ${COLOR} ${head[24]}-bit  ${(head.length / 1024).toFixed(0)} KB`);
if (W * H > 40e6) { console.error("refusing to decode more than 40M pixels"); process.exit(1); }

const raw = execFileSync(
  ffmpeg,
  ["-hide_banner", "-loglevel", "error", "-i", MASTER, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
  { maxBuffer: 1 << 29 },
);
const px = (x, y) => { const i = (y * W + x) * 4; return [raw[i], raw[i + 1], raw[i + 2], raw[i + 3]]; };
const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];

let transparent = 0, semi = 0, opaque = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const a = px(x, y)[3];
  if (a < 5) { transparent++; continue; }
  if (a < 251) semi++; else opaque++;
  if (a > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
}
const total = W * H;
const pc = (n) => ((n / total) * 100).toFixed(1) + "%";
const inkW = Math.max(1, x1 - x0 + 1), inkH = Math.max(1, y1 - y0 + 1);
line("alpha", `transparent ${pc(transparent)} · semi ${pc(semi)} · opaque ${pc(opaque)}`);
line("ink box", `${x0},${y0} → ${x1},${y1} = ${inkW}x${inkH}, aspect ${(inkW / inkH).toFixed(2)}:1`);

/* Field + shape, printed on every preflight. Whoever reviews a mark may be a model
   that cannot decode images at all, and "it looks fine" is not a reportable answer
   from here. The border ring says whether the artwork sits on one continuous ground
   (then padding it in that colour is invisible, and a plate is honest); the map says
   where the mass actually is. Both are cheap; both have already paid for themselves. */
const ring = [];
for (let x = 0; x < W; x++) ring.push(px(x, 0), px(x, H - 1));
for (let y = 1; y < H - 1; y++) ring.push(px(0, y), px(W - 1, y));
const ringMean = [0, 1, 2].map((c) => ring.reduce((s, p) => s + p[c], 0) / ring.length);
const ringSd = Math.sqrt(
  ring.reduce((s, p) => s + (p[0] - ringMean[0]) ** 2 + (p[1] - ringMean[1]) ** 2 + (p[2] - ringMean[2]) ** 2, 0) / ring.length / 3,
);
const FIELD = ringMean.map((v) => Math.round(v));
line("field", `canvas border rgb(${FIELD.join(",")}) · stddev ${ringSd.toFixed(1)} → ` +
  (ringSd < 8 ? "one continuous ground; padding in it is invisible" : "the edge is not one colour; treat as a crop, not a plate"));

const MAP_COLS = 64;
/* --zoom x,y,w,h prints a higher-resolution map of one region of the master instead of
   the whole canvas. Added because the full map is diagnostic but not forensic: a band
   of repeating vertical strokes *might* be lettering, and whether it is decides how
   large the mark has to be. Textures and text look the same at 64 columns. */
const ZR = opt("zoom");
const [mxb, myb, mwb, mhb] = ZR
  ? ZR.split(",").map(Number)
  : [x0, y0, inkW, inkH];
if (ZR) line("zoom", `region ${mxb},${myb} +${mwb}x${mhb} of the master`);
const cellW = mwb / MAP_COLS;
const mapRows = Math.max(1, Math.min(140, Math.round(mhb / cellW)));
const ramp = " .:-=+*#%@";
line("shape", `mean luminance, ${MAP_COLS}x${mapRows} blocks (ramp "${ramp}" = dark to light)`);
for (let r = 0; r < mapRows; r++) {
  let row = "";
  for (let c = 0; c < MAP_COLS; c++) {
    const bx = mxb + Math.floor(c * (mwb / MAP_COLS)), by = myb + Math.floor(r * (mhb / mapRows));
    const bxe = mxb + Math.floor((c + 1) * (mwb / MAP_COLS)), bye = myb + Math.ceil((r + 1) * (mhb / mapRows));
    let sum = 0, n = 0;
    for (let y = by; y < Math.min(H, bye); y += 2)
      for (let x = bx; x < Math.min(W, bxe); x += 2) { const p = px(x, y); if (p[3] > 40) { sum += lum(p); n++; } }
    row += n ? ramp[Math.min(ramp.length - 1, Math.round((sum / n / 255) * (ramp.length - 1)))] : " ";
  }
  console.log("           │" + row + "│");
}

/* 1 — transparency, unless explicitly overridden for a flat-backed export. */
const OPAQUE_OK = argv.includes("--opaque-ok");
rule(
  OPAQUE_OK
    ? "opaque by design (--opaque-ok): the artwork keeps its own ground and is plated, not keyed out"
    : "the master has a transparent field (>= 2%) so the mark can sit on navy",
  transparent / total >= 0.02 || OPAQUE_OK,
  `${pc(transparent)} transparent` + (OPAQUE_OK ? " · plated" : ""),
);

/* 2 — solid fills must actually be flat. Sample the three commonest colours and
      measure the local (5x5) luminance stddev inside each.
      Alpha caveat, found empirically: a PNG stores RGB as black where alpha is 0,
      so a window straddling a silhouette edge is a luminance cliff, and a perfectly
      flat single-colour fill measured stddev 65.4. The rule was penalising the very
      transparent field that rule 1 demands. A sample now counts only when its whole
      window is opaque, and is skipped — not scored — at a boundary. Genuine
      re-saved-photo noise is unaffected: the original opaque file still measures 12.7. */
const buckets = new Map();
for (let i = 0; i < raw.length; i += 4) {
  if (raw[i + 3] < 40) continue;
  const k = ((raw[i] >> 4) << 8) | ((raw[i + 1] >> 4) << 4) | (raw[i + 2] >> 4);
  buckets.set(k, (buckets.get(k) || 0) + 1);
}
const localSd = (x, y) => {
  const v = [];
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
    const X = x + i, Y = y + j;
    if (X < 0 || Y < 0 || X >= W || Y >= H) return null; // at the canvas edge: no full window
    const p = px(X, Y);
    if (p[3] < 250) return null; // touches the transparent field: not a fill measurement
    v.push(lum(p));
  }
  const m = v.reduce((a, b) => a + b) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
};
const ranked = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
const inkTotal = opaque + semi;
/* Only flats that carry real area are scored. A band under 15% of the ink is an
   anti-aliased fringe or a gradient *inside* the artwork, and gradients are normal in
   a vector export; what a re-saved photograph produces is noise in the large flats.
   Guarded: if nothing reaches 15% (a photo, a dithered image) the largest colour is
   scored anyway, so the rule can never pass by having no fills to measure. */
const MIN_FILL_SHARE = 0.15;
const bigFlats = ranked.filter(([, c]) => c / inkTotal >= MIN_FILL_SHARE);
const toScore = new Set((bigFlats.length ? bigFlats : ranked.slice(0, 1)).map(([k]) => k));
const noFlats = bigFlats.length === 0;
const top = ranked.slice(0, 5);
let worst = 0;
for (const [k, count] of top) {
  const sds = [];
  for (let y = 2; y < H - 2 && sds.length < 240; y += 3) for (let x = 2; x < W - 2 && sds.length < 240; x += 3) {
    const p = px(x, y);
    if (p[3] < 40) continue;
    if ((((p[0] >> 4) << 8) | ((p[1] >> 4) << 4) | (p[2] >> 4)) !== k) continue;
    const sd = localSd(x, y);
    if (sd !== null) sds.push(sd);
  }
  sds.sort((a, b) => a - b);
  const med = sds.length ? sds[sds.length >> 1] : 0;
  if (toScore.has(k)) worst = Math.max(worst, med);
  const rgb = [((k >> 8) & 15) * 17, ((k >> 4) & 15) * 17, (k & 15) * 17];
  line("fill", `rgb(${rgb.join(",")}) ${((count / (opaque + semi)) * 100).toFixed(1)}% of ink · median stddev ${med.toFixed(1)} (n=${sds.length})` +
    (sds.length === 0 ? " — no interior sample: this colour exists only on boundaries" : ""));
}
line("scored", `${toScore.size} reported colour(s) count as solid fills (>= ${Math.round(MIN_FILL_SHARE * 100)}% of ink)` +
  (noFlats ? " — nothing reaches that share, so the largest colour is scored anyway" : ""));
rule(`solid fills${noFlats ? "" : " of >= " + Math.round(MIN_FILL_SHARE * 100) + "% of ink"} are flat (stddev <= 4): a clean export, not a re-saved photo`, worst <= 4, `worst ${worst.toFixed(1)}`);

/* 3 — does it survive being small? Resample to 2x the slot, count edge steps. */
/* Measured at the aspect the artwork actually has. The previous version forced a
   non-square mark into an SxS square, so the number it printed was a measurement of a
   distorted image (a 1.32:1 mark was stretched 32% wider, adding steps that are not
   there). Gated at the display slot, reported at favicon size. */
const densityAt = (h) => {
  const w = Math.max(2, Math.round(h * (inkW / inkH)));
  const buf = execFileSync(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-i", MASTER, "-vf", `scale=${w}:${h}:flags=lanczos`, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
    { maxBuffer: 1 << 26 },
  );
  let steps = 0, edge = 0;
  const at = (x, y) => { const i = (y * w + x) * 4; return 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]; };
  for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) { steps++; if (Math.abs(at(x - 1, y) - at(x, y)) > 24) edge++; }
  return { w, h, pct: (edge / steps) * 100 };
};
const atSlot = densityAt(SLOT_PX * 2);
const atFav = densityAt(32);
line("detail", `${atSlot.pct.toFixed(1)}% of horizontal steps exceed 24/255 at ${atSlot.w}x${atSlot.h} (slot x2, aspect kept)`);
line("favicon", `${atFav.pct.toFixed(1)}% at ${atFav.w}x${atFav.h} — reported, not gated`);
rule("the artwork still reads at the size it is displayed (edge density <= 15%)", atSlot.pct <= 15, `${atSlot.pct.toFixed(1)}%`);
if (atFav.pct > 15) console.log(
  `  NOTE      at 32px this artwork measures ${atFav.pct.toFixed(1)}%, over the 15% the mark is gated\n` +
  "            at. That is not a fault in the file and not a licence to lower the bar: a\n" +
  "            full-colour emblem with shading cannot resolve at favicon size, because 32px\n" +
  "            simply is not enough pixels. The favicon rung is plated on the artwork's own\n" +
  "            ground so at least its outline reads. If the tab icon has to be crisp, ship a\n" +
  "            second asset for it: npm run brand:mark:glyph derives a single-colour mark from\n" +
  "            this same file (scripts/derive-logo.mjs) and the ladder accepts it as --master.");

/* 4 — aspect is not a failure, it changes how the CSS must size the box. */
const aspect = inkW / inkH;
if (aspect > 1.15 || aspect < 0.87) {
  console.log(
    `  NOTE      ink aspect ${(inkW / inkH).toFixed(2)}:1 against a square slot — size the mark by\n` +
    "            HEIGHT (height: 6rem; width: auto; the img keeps its intrinsic width and\n" +
    "            height attributes so the ratio is known before the bytes arrive). A\n" +
    "            width+height pair here would letterbox it or stretch it, which is what\n" +
    "            \"never stretched\" forbids.\n",
  );
}
rule("the master is a source, not a shipped asset (< 4 MB)", head.length < 4 * 1024 * 1024, `${(head.length / 1024).toFixed(0)} KB`);
die();

/* ---------------------------------------------------------------- write ---- */
const crop = (inkW < W || inkH < H) ? `crop=${inkW}:${inkH}:${x0}:${y0}:exact=0,` : "";
/* Square rungs (favicon, apple-touch, the 512 schema logo) must plate the artwork in
   *something*, and must actually be square: browsers letterbox a non-square icon
   differently on every platform. Navy was the old assumption — right for a silhouette
   on the site's own surface, wrong for a file whose background is rgb(240,243,244):
   navy padding would cut the emblem out of its ground and float a bright rectangle
   inside a dark tile. So the plate is whatever the artwork sits on. */
const HAS_FIELD = transparent / total >= 0.02;
const PLATE = HAS_FIELD ? NAVY : "0x" + FIELD.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
line("plate", `square rungs composited on ${PLATE} (${HAS_FIELD ? "the site surface, because the master carries alpha" : "the canvas border, stddev " + ringSd.toFixed(1)})`);
/* pad, not overlay: one chain that keeps the aspect, centres the art and fills the
   corners with the artwork's own ground — or leaves them transparent for the favicon,
   where browsers supply their own chrome colour. */
const sq = (px2) => `format=rgba,${crop}scale=${px2}:${px2}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${px2}:${px2}:(ow-iw)/2:(oh-ih)/2:color=${HAS_FIELD && px2 === 32 ? "none" : PLATE}`;
/* The mark rung is NOT letterboxed into a square: it is scaled to the exact rendered
   aspect, because CSS fixes its height and lets the width follow. */
const MARK_W = Math.max(1, Math.round(MARK_PX * (inkW / inkH)));
const markScale = `format=rgba,${crop}scale=${MARK_W}:${MARK_PX}:flags=lanczos`;
line("mark rung", `${MARK_W}x${MARK_PX} px = ${SLOT_PX}px tall at ${DPR}x DPR (art aspect ${(inkW / inkH).toFixed(3)}:1)`);
fs.mkdirSync(OUT, { recursive: true });

/* Encoding is chosen by measurement, not by preference. A clean vector-ish export
   costs nothing extra to keep lossless, so that is attempted first and always wins
   when it fits. A derived silhouette, though it holds exactly two colours, pays per
   boundary pixel: the first ladder run on this artwork missed three budgets with
   lossless RGBA (mark.webp 16.4/8 KB, the schema 512 at 114/28 KB). So each raster
   falls back — indexed PNG, then visually indistinguishable lossy WebP at q90 —
   and the fallback it landed on is printed. Budgets are never adjusted to fit. */
const write = (name, args) => {
  const file = path.join(OUT, name);
  try {
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args, file],
      { stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) {
    // stdio: "ignore" here once hid an encoder-argument error for twenty minutes.
    const why = String(e.stderr ?? "").trim().split("\n").slice(-3).join(" / ");
    throw new Error(`ffmpeg failed for ${name}\n  ${args.join(" ")}\n  ${why || `exit ${e.status}`}`);
  }
  return +(fs.statSync(file).size / 1024).toFixed(1);
};
/* An optional fallback must not be able to break a working pipeline: if the second
   encoding is rejected by this ffmpeg build, keep the first and say so. */
const tryWrite = (name, args) => {
  try { return write(name, args); } catch (e) { console.log(`  NOTE      fallback encoding unavailable: ${e.message.split("\n")[1]?.trim() ?? e.message}`); return Infinity; }
};
/* One input, scaled, then two-colour indexed PNG: palettegen over the scaled frame,
   paletteuse with no dithering and a hard alpha cut (the art is two-valued). */
const indexedChain = (vf) => `${vf},split[a][b];[a]palettegen=stats_mode=full[pg];[b][pg]paletteuse=dither=none:alpha_threshold=128[o]`;
const SRC = (vf) => ["-i", MASTER, "-vf", vf, "-update", "1"];
const IDX = (vf) => ["-i", MASTER, "-filter_complex", indexedChain(vf), "-map", "[o]", "-frames:v", "1", "-update", "1"];
/* Flatten onto the artwork's own ground for outputs that must not carry alpha (iOS
   ignores it, and Google puts transparent logos on a white plate of its own choosing). */
const FLAT = (size, idx, extra = []) => idx
  ? ["-i", MASTER, "-filter_complex", indexedChain(sq(size)), "-map", "[o]", "-frames:v", "1", "-update", "1", ...extra]
  : ["-i", MASTER, "-vf", sq(size), "-update", "1"];

/* Attempt list = fidelity order. The first encoding that fits the budget wins, so
   the budgets stay exactly as authored; `guarded` marks a fallback that may not exist
   in this ffmpeg build, and the file left on disk is always the smallest attempt. */
const bestOf = (name, attempts) => {
  let best = null, last = null;
  for (const a of attempts) {
    const kb = a.guarded ? tryWrite(name, a.args) : write(name, a.args);
    if (!Number.isFinite(kb)) continue;
    last = { kb, label: a.label };
    if (!best || kb < best.kb) best = { ...last, args: a.args };
    if (kb <= BUDGETS[name]) break;
  }
  if (last.kb !== best.kb) write(name, best.args);
  rule(`${name} within its ${BUDGETS[name]} KB budget`, best.kb <= BUDGETS[name], `${best.kb} KB · ${best.label}`);
  return { name, kb: best.kb };
};

const made = [];
if (REPORT) {
  console.log(`  REPORT    --report validates the master and writes nothing to ${OUT}/`);
} else {
  made.push(bestOf("atabul-mark.webp", [
    { label: "lossless", args: ["-i", MASTER, "-vf", markScale, "-c:v", "libwebp", "-lossless", "1", "-update", "1"] },
    { label: "lossy q90 — budget forced the fallback", guarded: true,
      args: ["-i", MASTER, "-vf", markScale, "-c:v", "libwebp", "-q:v", "90", "-update", "1"] },
    // q80 + the slowest analysis still keeps a two-colour shape exact where it
    // matters (the silhouette edge) and spends its bits where the eye cannot tell.
    { label: "lossy q80, method 6 — budget forced the fallback", guarded: true,
      args: ["-i", MASTER, "-vf", markScale, "-c:v", "libwebp", "-q:v", "80", "-method", "6", "-update", "1"] },
  ]));
  made.push(bestOf("atabul-mark.png", [
    { label: "lossless RGBA", args: SRC(markScale) },
    { label: "indexed — budget forced the fallback", guarded: true, args: IDX(markScale) },
  ]));
  made.push(bestOf("favicon-32.png", [
    { label: "lossless RGBA", args: SRC(sq(32)) },
    { label: "indexed", guarded: true, args: IDX(sq(32)) },
  ]));
  made.push(bestOf("apple-touch-icon.png", [
    { label: "RGBA on field", args: FLAT(180, false) },
    { label: "indexed on field", guarded: true, args: FLAT(180, true) },
  ]));
  if (Math.min(inkW, inkH) >= 400) made.push(bestOf("atabul-mark-512.png", [
    { label: "RGBA on field", args: FLAT(512, false) },
    { label: "indexed on field", guarded: true, args: FLAT(512, true) },
    // Same pixels, harder deflate: an indexed 512 is mostly one long run of repeats.
    { label: "indexed on field, max deflate", guarded: true, args: FLAT(512, true, ["-compression_level", "100"]) },
  ]));
  else console.log(`  NOTE      ink box is ${inkW}x${inkH}: too small to become a 512px schema/manifest\n` +
    `            logo without inventing pixels — send a larger master for that one.`);
  console.log("\n  written:");
  for (const m of made) console.log(`   ${m.name.padEnd(24)} ${String(m.kb).padStart(6)} KB`);
  /* If a raster missed its budget the ladder is half-approved, and the files on disk
     are bytes this gate rejected — which is worse than no files, because they look
     shipped. Remove everything this run produced: the build gate then fails loudly on
     "a reference whose file did not ship" instead of quietly serving a rejected asset.
     Re-running this command with a master that fits is the way back. */
  if (issues.length) {
    for (const m of made) { try { fs.rmSync(path.join(OUT, m.name)); } catch { /* already gone */ } }
    console.log(`\n  removed:  ${made.map((m) => m.name).join(", ")} — this run produced no assets.`);
  }
}
die();
console.log(`\n★ logo pipeline: ${made.length ? `${made.length} assets in ${OUT}/` : "master accepted"} from ${MASTER}`);
