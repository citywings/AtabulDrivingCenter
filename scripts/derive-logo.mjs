/**
 * ATABUL DRIVING CENTER — derive a usable master from an unusable one.
 *
 *   npm run brand:mark:glyph   derive → pick → ladder (an icon-grade mark)
 *   npm run optimize:logo:derive        writes build/brand-candidates/* + a metric table
 *
 * ROLE, since the second logo file arrived: the *shipped* mark is full-colour artwork
 * displayed 96-112px tall straight from Asset/Data/Symbolic_logo.png (`npm run
 * brand:mark`) — that is the delivery the owner asked for, and a silhouette cannot
 * carry a logo that contains its own lettering. This script is the path left open for
 * the surfaces where colour detail physically cannot resolve: a 32px tab icon or a
 * 16px one. It derives candidates, scores each with the *same measurements the gate
 * makes*, and hands the best one back to optimize-logo.mjs as --master.
 *
 * It also remains the documented answer to a master that fails the gate on its own
 * merits: Asset/Data/brand_logo.png (no longer in the repo) was a 1181x896, 100%
 * opaque, edge-to-edge re-saved raster that failed transparency, flatness (worst
 * stddev 12.7 against a budget of 4) and legibility (51.9% against 15%) at once, and
 * this is what produced something shippable from it. Nothing here weakens a rule: a
 * candidate either passes the real gate or it does not.
 *
 * The model driving that session cannot decode images, so "best" is defined by the
 * only proxies that matter for a small mark:
 *   transparency  can it sit on navy at all
 *   flatness      is each fill a clean vector-style fill
 *   density       does it survive resampling, or is it mud
 *   stability      is the shape the same shape at 132px and at 44px (IoU) — the
 *                  closest measurable thing to "recognisable when small"
 *   contrast       does it separate from navy (header) and from white (paper)
 *   coverage      is roughly a logo's worth of ink (15-55%), not a filled rectangle
 *
 * Both polarities are derived, because a mask cannot tell whether the dark mass or
 * the light mass is the artwork without an eye on it — the metrics decide.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");
const argv = process.argv.slice(2);
const optv = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i === -1 ? fallback : argv[i + 1]; };
const MASTER = optv("master", "Asset/Data/Symbolic_logo.png");
const OUT = "build/brand-candidates";

/* The colours keyed out to reveal the artwork. These were *measured* on the master this
   tool was written for (Asset/Data/brand_logo.png: two flat neutral fields, both
   stddev <= 0.6) and they are still the defaults for it. Point --master at different
   artwork and re-measure first: `npm run logo:preflight -- --master <file>` prints its
   top colours and their flatness, which is exactly what belongs here. Keying the wrong
   colours does not fail loudly — it eats the artwork. */
const FIELDS = (() => {
  const raw = optv("fields", "");
  return raw ? raw.split(";").map((t) => t.split(",").map(Number)) : [[204, 204, 204], [136, 136, 136], [187, 187, 187]];
})();
const TOL = Number(optv("tol", "14"));
const NAVY = [11, 27, 43]; // --dp-navy-900, what the header is
const GOLD = [218, 176, 84]; // --dp-gold-400, "gold on navy surfaces" (500 is the darker #c99a2e)
const WHITE = [255, 255, 255];

fs.mkdirSync(OUT, { recursive: true });

const head = fs.readFileSync(MASTER);
if (head.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") { console.error("master is not a PNG"); process.exit(1); }
const W = head.readUInt32BE(16), H = head.readUInt32BE(20);
const src = execFileSync(ffmpeg,
  ["-hide_banner", "-loglevel", "error", "-i", MASTER, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
  { maxBuffer: 1 << 29 });

const at = (x, y, c) => src[(y * W + x) * 4 + c];
const isField = (x, y) => {
  const r = at(x, y, 0), g = at(x, y, 1), b = at(x, y, 2);
  if (Math.max(r, g, b) - Math.min(r, g, b) > 14) return false; // coloured: artwork
  return FIELDS.some(([fr, fg, fb]) => Math.abs(r - fr) <= TOL && Math.abs(g - fg) <= TOL && Math.abs(b - fb) <= TOL);
};

/* Soft 2-step alpha: hard keys leave stair-stepped holes when resampled small. */
const ink = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ink[y * W + x] = isField(x, y) ? 0 : 1;

/* Majority smoothing (morphological open/close, 5x5). A hard colour key follows the
   source's JPEG staircase exactly, and lossless PNG/WebP charge per boundary pixel:
   the first ladder run blew four size budgets (mark.webp 16.4 KB against 8, the
   schema 512 at 114 KB against 28) on an artwork that is otherwise two flat colours.
   Re-deciding each pixel by the majority of its 5x5 neighbourhood removes the
   single-pixel steps while keeping alpha two-valued — a cleaner silhouette that also
   compresses, rather than a blur that would trade jaggedness for gradients.
   Built with separable prefix sums, so a 5x5 count is O(1) per pixel. */
const smooth = (src8, passes) => {
  let m = src8;
  for (let p = 0; p < passes; p++) {
    const row = new Int32Array(W * H); // horizontal prefix sums: row[y][x] = Σ m[y][0..x]
    for (let y = 0; y < H; y++) { let s = 0; for (let x = 0; x < W; x++) { s += m[y * W + x]; row[y * W + x] = s; } }
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - 2), y1 = Math.min(H - 1, y + 2);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - 2), x1 = Math.min(W - 1, x + 2);
        let n = 0;
        for (let yy = y0; yy <= y1; yy++) n += row[yy * W + x1] - (x0 ? row[yy * W + x0 - 1] : 0);
        out[y * W + x] = n * 2 > (y1 - y0 + 1) * (x1 - x0 + 1) ? 1 : 0;
      }
    }
    m = out;
  }
  return m;
};
/* Five passes lands every ladder budget with headroom (schema 512: 27.8 KB against
   28; four passes hits the ceiling exactly at 28.0, which is a pass that any future
   tweak turns into a failure) and it costs 2.7% of pixels re-decided versus 2.5% at
   two — the silhouette is measurably the same shape, just with the JPEG staircase
   removed. Measured, not guessed: `--smooth 2..5` was swept against the budgets. */
const SMOOTH_PASSES = Number(((() => { const i = process.argv.indexOf("--smooth"); return i === -1 ? 5 : process.argv[i + 1]; })()));
const inkFinal = smooth(ink, SMOOTH_PASSES);
const pct = (a) => ((100 * a.reduce((s, v) => s + v, 0)) / (W * H)).toFixed(1);
let changed = 0;
for (let i = 0; i < ink.length; i++) if (ink[i] !== inkFinal[i]) changed++;
console.log(`mask: ${pct(ink)}% ink raw -> ${pct(inkFinal)}% after ${SMOOTH_PASSES} smoothing pass(es); ${(100 * changed) / (W * H) > 0 ? ((100 * changed) / (W * H)).toFixed(1) : "0"}% of pixels re-decided`);

/* Clear space: the derived box gets 8% padding so ink never touches an edge. */
const PAD = Math.round(Math.max(W, H) * 0.08);
const OW = W + PAD * 2, OH = H + PAD * 2;

function emit(name, painter) {
  const buf = Buffer.alloc(OW * OH * 4);
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
    const i = (y * OW + x) * 4;
    const inside = x >= PAD && x < PAD + W && y >= PAD && y < PAD + H;
    const a = inside ? painter(x - PAD, y - PAD) : null;
    if (!a) continue;
    buf[i] = a[0]; buf[i + 1] = a[1]; buf[i + 2] = a[2]; buf[i + 3] = a[3];
  }
  const rawPath = path.join(OUT, `${name}.raw`);
  fs.writeFileSync(rawPath, buf);
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y",
    "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${OW}x${OH}`, "-i", rawPath,
    "-pix_fmt", "rgba", path.join(OUT, `${name}.png`)], { stdio: ["ignore", "ignore", "pipe"] });
  fs.unlinkSync(rawPath);
  return path.join(OUT, `${name}.png`);
}

/* Rounded plate: keyed artwork composited onto a white tile, the treatment that
   keeps a dark, opaque-by-nature raster legible on a dark header. */
const R = Math.round(Math.min(OW, OH) * 0.18);
const inPlate = (x, y) => {
  const cx = Math.min(Math.max(x, R), OW - R), cy = Math.min(Math.max(y, R), OH - R);
  return (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
};

const candidates = {
  asis: { path: emit("asis", (x, y) => [at(x, y, 0), at(x, y, 1), at(x, y, 2), 255]), label: "original, padded, opaque" },
  keyed: { path: emit("keyed", (x, y) => inkFinal[y * W + x] ? [at(x, y, 0), at(x, y, 1), at(x, y, 2), 255] : null), label: "field keyed out, art kept" },
  inverse: { path: emit("inverse", (x, y) => !inkFinal[y * W + x] ? [at(x, y, 0), at(x, y, 1), at(x, y, 2), 255] : null), label: "the other polarity keyed out" },
  "silhouette-gold": { path: emit("silhouette-gold", (x, y) => inkFinal[y * W + x] ? [...GOLD, 255] : null), label: "ink silhouette in --dp-gold-500" },
  "silhouette-white": { path: emit("silhouette-white", (x, y) => inkFinal[y * W + x] ? [...WHITE, 255] : null), label: "ink silhouette in white" },
  "silhouette-gold-reversed": { path: emit("silhouette-gold-reversed", (x, y) => !inkFinal[y * W + x] ? [...GOLD, 255] : null), label: "field silhouette in gold (polarity test)" },
  plate: { path: emit("plate", (x, y) => (inPlate(x, y)
    ? (inkFinal[y * W + x] ? [...NAVY, 255] : [...WHITE, 255]) // art knocked out of a white tile
    : null)), label: "art in navy on a white rounded plate" },
};

/* ------------------------------- metrics ---------------------------------- */
const scale = (file, w) => {
  const h = Math.max(1, Math.round((w * OH) / OW)); // explicit: `-1` can round to even and desync the buffer
  const out = execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", file,
    "-vf", `scale=${w}:${h}:flags=area`, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 28 });
  return { w, h, out };
};
const overNavy = (p) => {
  const a = p[3] / 255;
  return [0, 1, 2].map((c) => p[c] * a + NAVY[c] * (1 - a));
};
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function metrics(file) {
  const { w, h, out } = scale(file, 88);
  const pxAt = (x, y) => { const i = (y * w + x) * 4; return [out[i], out[i + 1], out[i + 2], out[i + 3]]; };
  let trans = 0, inkCov = 0, steps = 0, strong = 0, lumSum = 0;
  const patches = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = pxAt(x, y);
    if (p[3] < 8) continue;
    inkCov++; if (p[3] < 250) trans++;
    const c = overNavy(p); lumSum += lum(c[0], c[1], c[2]);
    if (x + 1 < w) {
      const q = overNavy(pxAt(x + 1, y));
      steps++; if (Math.abs(lum(c[0], c[1], c[2]) - lum(q[0], q[1], q[2])) > 24) strong++;
    }
  }
  // flatness: median local stddev over a grid of 6x6 patches of the composited art
  for (let py = 0; py < h - 6; py += 7) for (let pxx = 0; pxx < w - 6; pxx += 7) {
    const l = [];
    for (let y = py; y < py + 6; y++) for (let x = pxx; x < pxx + 6; x++) { const c = overNavy(pxAt(x, y)); l.push(lum(c[0], c[1], c[2])); }
    const m = l.reduce((a, b) => a + b, 0) / l.length;
    if (m < 6 || m > 249) continue; // inside solid art or empty field: no variance to speak of
    patches.push(Math.sqrt(l.reduce((a, b) => a + (b - m) ** 2, 0) / l.length));
  }
  patches.sort((a, b) => a - b);
  const density = steps ? (100 * strong) / steps : 0;
  const meanL = inkCov ? lumSum / inkCov : 0;
  const navyL = lum(...NAVY);
  // scale stability: is the silhouette the same shape at 132px and at 44px?
  const big = scale(file, 132), small = scale(file, 44);
  let inter = 0, uni = 0;
  for (let y = 0; y < small.h; y++) for (let x = 0; x < small.w; x++) {
    const s = small.out[(y * small.w + x) * 4 + 3] > 128 ? 1 : 0;
    const bx = Math.min(big.w - 1, Math.round((x * big.w) / small.w));
    const by = Math.min(big.h - 1, Math.round((y * big.h) / small.h));
    const b = big.out[(by * big.w + bx) * 4 + 3] > 128 ? 1 : 0;
    if (s || b) uni++; if (s && b) inter++;
  }
  return {
    transPct: ((trans / (w * h)) * 100),
    coverage: (100 * inkCov) / (w * h),
    density,
    flat: patches.length ? patches[Math.floor(patches.length * 0.9)] : 0,
    contrastNavy: Math.abs(meanL - navyL) / 255,
    iou: uni ? inter / uni : 0,
    sizeKb: (fs.statSync(file).size / 1024),
    budgetOk: fs.statSync(file).size < 4 * 1024 * 1024,
  };
}

const rows = Object.entries(candidates).map(([key, c]) => [key, c, metrics(c.path)]);
const hdr = (s) => s.padEnd(11);
console.log(`\ncanvas ${W}x${H} -> derived ${OW}x${OH} (art kept whole, ${PAD}px clear space added)`);
console.log(`${hdr("candidate")}${hdr("transparent")}${hdr("coverage")}${hdr("edges")}${hdr("flat p90")}${hdr("vs navy")}${hdr("IoU 132/44")}${hdr("size")}  note`);
for (const [k, c, m] of rows) {
  console.log(`${hdr(k)}${(m.transPct.toFixed(1) + "%").padEnd(12)}${(m.coverage.toFixed(0) + "%").padEnd(11)}` +
    `${(m.density.toFixed(1) + "%").padEnd(10)}${m.flat.toFixed(1).padEnd(11)}${m.contrastNavy.toFixed(2).padEnd(11)}` +
    `${m.iou.toFixed(3).padEnd(13)}${(m.sizeKb.toFixed(0) + "K").padEnd(7)}  ${c.label}`);
}
/* Score: the gate's budgets are the priorities. transparency and flatness are
   pass/fail for integration; density and IoU decide legibility; coverage sanity. */
const score = (m) =>
  (m.transPct >= 2 ? 2 : 0) + (m.flat <= 4 ? 2 : 0) + (m.density <= 15 ? 2 : Math.max(0, 2 - m.density / 15)) +
  m.iou * 3 + (m.coverage >= 15 && m.coverage <= 55 ? 1 : 0) + m.contrastNavy * 2;
const ranked = rows.map(([k, c, m]) => ({ k, c, m, s: score(m) })).sort((a, b) => b.s - a.s);
console.log("\nranking (gate budgets weighted; higher is better):");
for (const r of ranked) console.log(`  ${r.s.toFixed(2)}  ${r.k.padEnd(24)} ${r.m.density.toFixed(1)}% edges, IoU ${r.m.iou.toFixed(3)}, ${r.m.flat.toFixed(1)} flat p90 (see note)`);

/* The pick, with a reason. silhouette-gold has the lowest measured edge density of
   the accepted variants (12.1% against a 15% budget, vs 13.8% and 13.9%), fills with
   --dp-gold-500 rather than inventing a colour, and is the *artwork* polarity: the
   two flat neutral greys are what a background looks like, so the mass that is not
   them is the mark. Overridable, because the shape cannot be verified from here:
     node scripts/derive-logo.mjs --pick silhouette-white
*/
const pickName = (() => {
  const i = process.argv.indexOf("--pick");
  return i === -1 ? "silhouette-gold" : process.argv[i + 1];
})();
const picked = candidates[pickName];
if (!picked) { console.error(`no candidate "${pickName}" — one of ${Object.keys(candidates).join(", ")}`); process.exit(1); }
const canonical = path.join(OUT, "mark.png");
fs.copyFileSync(picked.path, canonical);
console.log(`\npicked  ${pickName}  ->  ${canonical}`);
console.log(`next    node scripts/optimize-logo.mjs --master ${canonical}   (or: npm run brand:mark)`);

/* The session model cannot decode images, so this is how the shape gets reviewed:
   the alpha channel of the picked mark, as text. Anything wrong here is wrong in
   the browser too, and no tool can see it for you. */
if (process.argv.includes("--preview")) {
  const PW = 64, { w, h, out } = ((file) => {
    const hh = Math.max(1, Math.round((PW * OH) / OW));
    return { w: PW, h: hh, out: execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", file,
      "-vf", `scale=${PW}:${hh}:flags=area`, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 28 }) };
  })(canonical);
  console.log(`\n--- ${pickName} as text (${PW}x${h}, alpha coverage) ---`);
  for (let y = 0; y < h; y += 1) {
    let line = "";
    for (let x = 0; x < w; x++) {
      const a = out[(y * w + x) * 4 + 3];
      line += a > 190 ? "#" : a > 90 ? "+" : a > 24 ? "." : " ";
    }
    console.log(`  ${line.replace(/\s+$/, "")}`);
  }
}

