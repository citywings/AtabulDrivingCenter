/**
 * RULE & SAFETY CLIP OPTIMIZER
 * Transcodes Asset/Data/rule&safety/*.mp4 (sequential names) into small
 * web-ready variants + poster frames under src/assets/rules/.
 * Order follows the numeric prefix; display text is handled in main.ts.
 * Incremental: skips outputs newer than their source.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, statSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import ffmpegPath from "ffmpeg-static";

const SRC_DIR = "Asset/Data/rule&safety";
const OUT_DIR = "public/rules";
const WIDTH = 640;

mkdirSync(OUT_DIR, { recursive: true });

const sources = readdirSync(SRC_DIR)
  .filter((f) => f.toLowerCase().endsWith(".mp4"))
  .sort((a, b) => {
    const na = parseInt(a.match(/^(\d+)/)?.[1] ?? "99", 10);
    const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? "99", 10);
    return na - nb;
  });

if (sources.length === 0) {
  console.error(`No mp4 sources found in ${SRC_DIR}`);
  process.exit(1);
}

let totalBytes = 0;
for (const src of sources) {
  const seq = src.match(/^(\d+)/)?.[1];
  if (!seq) {
    console.warn(`SKIP (no sequence number): ${src}`);
    continue;
  }
  const outMp4 = join(OUT_DIR, `rule-${seq}.mp4`);
  const outJpg = join(OUT_DIR, `rule-${seq}.jpg`);
  const srcPath = join(SRC_DIR, src);
  const srcMtime = statSync(srcPath).mtimeMs;

  const stale = (p) => {
    try {
      return statSync(p).mtimeMs < srcMtime;
    } catch {
      return true;
    }
  };

  if (stale(outMp4)) {
    execFileSync(
      ffmpegPath,
      ["-y", "-i", srcPath, "-vf", `scale=${WIDTH}:-2`, "-c:v", "libx264",
       "-crf", "27", "-preset", "medium", "-profile:v", "high",
       "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", outMp4],
      { stdio: "ignore" }
    );
  }
  if (stale(outJpg)) {
    execFileSync(
      ffmpegPath,
      ["-y", "-ss", "1.5", "-i", srcPath, "-frames:v", "1",
       "-vf", `scale=${WIDTH}:-2`, "-q:v", "4", outJpg],
      { stdio: "ignore" }
    );
  }
  const kb = Math.round(statSync(outMp4).size / 1024);
  totalBytes += statSync(outMp4).size;
  console.log(`${basename(outMp4)}  ${kb} KB  <- ${src}`);
}

console.log(`\n${sources.length} clips | web total: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
