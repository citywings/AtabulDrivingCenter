/**
 * Atabul Driving Center — LCP poster optimizer.
 *
 * Derives the `<picture>` ladder for the hero poster from the JPEG master that
 * `npm run optimize:media` produces in public/hero-fallback.jpg:
 *
 *   hero-fallback.avif         1600w AVIF   (browsers that support AVIF)
 *   hero-fallback-900.avif      900w AVIF   (phones: 1x DPR is enough)
 *   hero-fallback.webp         1600w WebP
 *   hero-fallback-900.webp      900w WebP
 *   hero-fallback.jpg          1600w JPEG   (untouched ultimate fallback)
 *
 * Run after optimize:media, before build:  npm run optimize:poster
 * The build audit (vite/plugins/seo.ts) fails if a variant is missing or over
 * budget, so this script is part of the release path, not an optional extra.
 */
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const master = path.join(publicDir, "hero-fallback.jpg");

// Budgets mirror BUDGETS in vite/plugins/seo.ts — keep the two in step.
const TARGETS = [
  { out: "hero-fallback.avif", width: 1600, codec: "avif", budgetKb: 120 },
  { out: "hero-fallback-900.avif", width: 900, codec: "avif", budgetKb: 120 },
  { out: "hero-fallback.webp", width: 1600, codec: "webp", budgetKb: 170 },
  { out: "hero-fallback-900.webp", width: 900, codec: "webp", budgetKb: 170 },
];

const AVIF_CRF = "34";
const WEBP_QUALITY = "78";

if (!ffmpegPath || !existsSync(ffmpegPath)) {
  console.error("ffmpeg binary not found — run npm install first");
  process.exit(1);
}
if (!existsSync(master)) {
  console.error(`master not found: ${master}\nRun npm run optimize:media first.`);
  process.exit(1);
}

function run(args, label) {
  return new Promise((resolve, reject) => {
    // stdio "ignore": sandboxed environments deny piped stdio, and ffmpeg
    // writes artifacts straight to disk — there is nothing to capture.
    const child = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${label} failed (exit ${code})`))));
  });
}

const kb = (p) => statSync(p).size / 1024;
const masterKb = kb(master);
console.log(`master: hero-fallback.jpg ${masterKb.toFixed(0)} KB (1600x900)`);

let failed = false;
for (const target of TARGETS) {
  const out = path.join(publicDir, target.out);
  const scale = ["-vf", `scale=${target.width}:-2:flags=lanczos`];
  try {
    if (target.codec === "avif") {
      await run(
        ["-i", master, ...scale, "-c:v", "libaom-av1", "-crf", AVIF_CRF, "-b:v", "0",
         "-cpu-used", "4", "-still-picture", "1", "-pix_fmt", "yuv420p", "-an", out],
        target.out
      );
    } else {
      await run(["-i", master, ...scale, "-c:v", "libwebp", "-quality", WEBP_QUALITY, "-an", out], target.out);
    }
    const size = kb(out);
    const over = size > target.budgetKb;
    if (over) failed = true;
    console.log(
      `${over ? "[over budget]" : "[ok]      "} ${target.out.padEnd(26)} ${size
        .toFixed(0)
        .padStart(4)} KB / ${target.budgetKb} KB  (${((1 - size / masterKb) * 100).toFixed(0)}% smaller than JPEG)`
    );
  } catch (err) {
    failed = true;
    console.error(`[fail] ${err.message}`);
  }
}

if (masterKb > 240) {
  console.error(`master JPEG is ${masterKb.toFixed(0)} KB, over the 240 KB budget — re-encode it via npm run optimize:media`);
  failed = true;
}

console.log(failed ? "poster optimization INCOMPLETE" : "poster optimization complete");
process.exit(failed ? 1 : 0);
