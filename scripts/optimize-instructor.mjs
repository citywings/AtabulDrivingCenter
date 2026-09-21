/**
 * Atabul Driving Center — instructor portrait optimizer.
 * Converts the supplied trainer PNG to web-delivery WebP.
 * Output: public/instructors/instructor-primary.webp
 * Run: node scripts/optimize-instructor.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const master = path.join(root, "Asset", "Data", "Trainer.png");
const outDir = path.join(root, "public", "instructors");
const out = path.join(outDir, "instructor-primary.webp");

const TARGET_WIDTH = 1200;
const WEBP_QUALITY = "75";
const BUDGET_KB = 120;

if (!ffmpegPath || !existsSync(ffmpegPath)) {
  console.error("ffmpeg binary not found — run npm install first");
  process.exit(1);
}
if (!existsSync(master)) {
  console.error(`master not found: ${master}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const masterKb = statSync(master).size / 1024;
console.log(`master: ${path.relative(root, master)} ${masterKb.toFixed(0)} KB`);

execFileSync(
  ffmpegPath,
  [
    "-y", "-i", master,
    "-vf", `scale=${TARGET_WIDTH}:-2:flags=lanczos`,
    "-c:v", "libwebp", "-quality", WEBP_QUALITY, "-method", "6",
    "-preset", "photo", "-an", out,
  ],
  { stdio: "ignore" }
);

const sizeKb = statSync(out).size / 1024;
const over = sizeKb > BUDGET_KB;
console.log(
  `${over ? "[over budget]" : "[ok]      "} ${path.relative(root, out).padEnd(40)} ${sizeKb
    .toFixed(0)
    .padStart(4)} KB / ${BUDGET_KB} KB  (${((1 - sizeKb / masterKb) * 100).toFixed(0)}% smaller than PNG)`
);

if (over) {
  console.error(`instructor image is ${sizeKb.toFixed(0)} KB, over the ${BUDGET_KB} KB budget`);
  process.exit(1);
}
console.log("instructor optimization complete");