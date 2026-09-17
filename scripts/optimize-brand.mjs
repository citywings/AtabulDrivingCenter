/**
 * Atabul Driving Center — CITYWINGS credit mark.
 *
 * Derives the footer credit's mark from the supplied master
 * `Asset/Data/source-symbol.png` (measured: 1254×1254, 8-bit RGB, **no alpha**,
 * ~1 MB). Two consequences follow from that, both deliberate:
 *
 *  1. The background is **not** knocked out. A colour-key on a mark whose ground
 *     is 36% white / 34% #eeeeee leaves semi-transparent halo pixels, and this
 *     toolchain has no way to review the result visually — so the mark is shipped
 *     exactly as supplied, on its own ground, which is also the client-safe
 *     answer: the logo is not modified.
 *  2. The master is **not** shipped. The credit displays the mark at 24px; 96px
 *     covers a 4× device-pixel ratio, which is beyond any phone in use. A
 *     megabyte in the footer would outweigh the entire page and undo the LCP
 *     budget this project enforces at build time.
 *
 * Output: public/brand/citywings-mark.webp   (budget: 8 KB)
 *
 * Why WebP and not PNG: the master's ground is a soft white→#eeeeee gradient, so
 * a lossless 96px PNG costs 11.1 KB while the same frame at q90 costs 2.8 KB.
 * WebP is already a shipped format here (the instructor portrait), so no new
 * baseline is introduced — and with `alt=""` a browser that cannot decode it
 * renders nothing, degrading to the text credit instead of a broken-image icon.
 *
 * vite/plugins/seo.ts fails the build if the mark is missing from dist/ or over
 * budget, so this script is part of the release path, not an optional extra —
 * same contract as npm run optimize:poster.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const master = path.join(root, "Asset", "Data", "source-symbol.png");
const outDir = path.join(root, "public", "brand");
const out = path.join(outDir, "citywings-mark.webp");

const DISPLAY_PX = 24; // what the credit renders it at
const TARGET_PX = 96; // 4× DPR headroom
const QUALITY = "90";
const BUDGET_KB = 8;

if (!ffmpegPath || !existsSync(ffmpegPath)) {
  console.error("ffmpeg binary not found — run npm install first");
  process.exit(1);
}
if (!existsSync(master)) {
  console.error(`master not found: ${path.relative(root, master)}`);
  process.exit(1);
}

function run(args) {
  return new Promise((resolve, reject) => {
    // stdio "ignore": sandboxed environments deny piped stdio, and ffmpeg writes
    // the artifact straight to disk — there is nothing to capture.
    const child = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg failed (exit ${code})`))
    );
  });
}

mkdirSync(outDir, { recursive: true });

const masterKb = statSync(master).size / 1024;
// The master is square, so a single dimension is enough; lanczos keeps the red
// edges clean instead of ringing them the way bilinear would at this ratio.
await run([
  "-i", master,
  "-vf", `scale=${TARGET_PX}:${TARGET_PX}:flags=lanczos`,
  "-c:v", "libwebp", "-quality", QUALITY,
  "-preset", "photo", "-lossless", "0",
  "-an", out,
]);

const sizeKb = statSync(out).size / 1024;
const over = sizeKb > BUDGET_KB;
console.log(`master : ${path.relative(root, master)}  ${masterKb.toFixed(0)} KB  1254×1254 RGB (no alpha)`);
console.log(`mark   : ${path.relative(root, out)}  ${sizeKb.toFixed(1)} KB  ${TARGET_PX}×${TARGET_PX} (renders at ${DISPLAY_PX}px, ${(TARGET_PX / DISPLAY_PX).toFixed(0)}× DPR)`);
console.log(`saving : ${((1 - sizeKb / masterKb) * 100).toFixed(2)}% smaller than the master`);
if (over) {
  console.error(`mark is ${sizeKb.toFixed(1)} KB, over the ${BUDGET_KB} KB budget`);
  process.exit(1);
}
console.log(over ? "brand mark INCOMPLETE" : "brand mark complete");
