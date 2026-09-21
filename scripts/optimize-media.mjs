/**
 * Atabul Driving Center — build-time media optimizer.
 *
 * Converts the supplied 4K hero master into web-delivery assets:
 *   hero-primary-1280.mp4  desktop web video (H.264, faststart, no audio)
 *   hero-primary-720.mp4   mobile web video (H.264, faststart, no audio)
 *   hero-poster.jpg        LCP poster frame (desktop + mobile fallback)
 *
 * Run: npm run optimize:media
 */
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");

const here = path.dirname(fileURLToPath(import.meta.url));
const heroDir = path.resolve(here, "../src/assets/hero");
const master = path.join(heroDir, "hero-master.mp4");
const outDir = heroDir;

if (!ffmpegPath || !existsSync(ffmpegPath)) {
  console.error("ffmpeg binary not found");
  process.exit(1);
}
if (!existsSync(master)) {
  console.error(`master not found: ${master}`);
  process.exit(1);
}

function run(args, label) {
  return new Promise((resolve, reject) => {
    // stdio must be "ignore" (sandboxed environments deny piped stdio);
    // ffmpeg writes artifacts directly to disk, nothing to capture.
    const child = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        console.log(`[ok] ${label}`);
        resolve();
      } else {
        reject(new Error(`${label} failed (ffmpeg exit ${code})`));
      }
    });
  });
}

const mb = (p) => `${(statSync(p).size / 1024 / 1024).toFixed(2)} MB`;

/**
 * Read the video-track duration (seconds) straight out of an MP4 — no
 * ffprobe dependency. Uses the first mdhd box (video track) because the
 * master may carry audio that's slightly longer; since we strip audio
 * with -an, comparing video-track durations is the correct check.
 */
function durationSeconds(file) {
  const buf = readFileSync(file);
  const idx = buf.indexOf(Buffer.from("mdhd"));
  if (idx === -1) throw new Error(`no mdhd box in ${file}`);
  const box = idx - 4;
  const version = buf[box + 8];
  const read = version === 1
    ? { ts: buf.readUInt32BE(box + 8 + 4 + 16), dur: Number(buf.readBigUInt64BE(box + 8 + 4 + 20)) }
    : { ts: buf.readUInt32BE(box + 8 + 4 + 8), dur: buf.readUInt32BE(box + 8 + 4 + 12) };
  if (!read.ts) throw new Error(`bad timescale in ${file}`);
  return read.dur / read.ts;
}

/** Fail the build if a derived variant is shorter than the master. */
function assertFullLength(variant, masterSeconds, tolerance = 0.02) {
  const s = durationSeconds(variant);
  const name = variant.split(/[\\/]/).pop();
  if (s < masterSeconds - tolerance) {
    throw new Error(`${name} is ${s.toFixed(3)}s but the master is ${masterSeconds.toFixed(3)}s — length was cut`);
  }
  console.log(`[ok] ${name} duration ${s.toFixed(3)}s (master ${masterSeconds.toFixed(3)}s)`);
  return s;
}

try {
  const poster = path.join(outDir, "hero-poster.jpg");
  const v1280 = path.join(outDir, "hero-primary-1280.mp4");
  const v720 = path.join(outDir, "hero-primary-720.mp4");

  const masterSeconds = durationSeconds(master);
  console.log(`master: ${masterSeconds.toFixed(3)}s`);

  // 1. Poster frame (1s in) — LCP image for reduced-motion / slow networks.
  await run(
    ["-ss", "1", "-i", master, "-frames:v", "1", "-vf", "scale=1600:-2", "-q:v", "4", poster],
    "poster frame"
  );

  // 2. Desktop web master — 1280w H.264, capped bitrate, faststart, silent.
  // CRF 34 + slower preset for aggressive compression at acceptable quality
  await run(
    [
      "-i", master,
      "-vf", "scale='min(1280,iw)':-2:flags=lanczos",
      "-c:v", "libx264", "-preset", "slow", "-crf", "34",
      "-maxrate", "500k", "-bufsize", "1000k",
      "-pix_fmt", "yuv420p",
      "-an", "-movflags", "+faststart",
      v1280,
    ],
    "desktop 1280w video"
  );

  // 3. Mobile web master — 720w, tighter bitrate.
  // CRF 36 for mobile, smaller viewport needs less detail
  await run(
    [
      "-i", master,
      "-vf", "scale='min(720,iw)':-2:flags=lanczos",
      "-c:v", "libx264", "-preset", "slow", "-crf", "36",
      "-maxrate", "300k", "-bufsize", "600k",
      "-pix_fmt", "yuv420p",
      "-an", "-movflags", "+faststart",
      v720,
    ],
    "mobile 720w video"
  );

  // 4. Guard: the web variants must keep the master's full play length.
  assertFullLength(v1280, masterSeconds);
  assertFullLength(v720, masterSeconds);

  // 5. Sync the no-JS / OG / social copies to the current film. The hero's
  //    LCP <img> and the og:image must be a frame of the SAME video that
  //    plays — a stale poster here is why the old film appears to persist.
  const publicDir = path.resolve(here, "../public");
  copyFileSync(poster, path.join(publicDir, "hero-fallback.jpg"));
  copyFileSync(poster, path.join(publicDir, "assets/hero-poster-og.jpg"));

  console.log(`poster: ${mb(poster)} | desktop: ${mb(v1280)} | mobile: ${mb(v720)}`);
  const stale = path.join(outDir, "hero-primary.mp4");
  if (existsSync(stale)) unlinkSync(stale); // 39MB master stays outside the bundle
  console.log("media optimization complete");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
