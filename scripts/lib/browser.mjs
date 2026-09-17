/**
 * Shared plumbing for the two real-browser gates (device-audit.mjs,
 * nav-audit.mjs). Kept in one place so "how we get a browser on this machine"
 * cannot drift between checks.
 *
 * It deliberately does not install anything: this machine already has a Chromium
 * build under %LOCALAPPDATA%/ms-playwright, and Playwright's module is resolved
 * from the DSH checkout. If the installed build number differs from the one
 * playwright@X expects, passing an explicit executablePath is what makes the run
 * work without downloading a second browser.
 */
import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readdirSync, readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { resolve } from "node:path";

export const PW_URL =
  process.env.PLAYWRIGHT_MODULE ??
  "file:///C:/Users/Ganesha/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs";

export function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Highest installed chromium build with a usable chrome.exe, or null. */
export function findChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "ms-playwright");
  if (!base || !existsSync(base)) return null;
  const builds = readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .map((d) => Number(d.split("-")[1]))
    .sort((a, b) => b - a);
  for (const b of builds) {
    for (const sub of ["chrome-win64/chrome.exe", "chrome-win/chrome.exe"]) {
      const p = resolve(base, `chromium-${b}`, sub);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

export async function waitForPort(port, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await new Promise((res) => {
      const s = createConnection(port, "127.0.0.1");
      s.once("connect", () => { s.destroy(); res(true); });
      s.once("error", () => res(false));
      s.setTimeout(500, () => { s.destroy(); res(false); });
    });
    if (ok) return true;
    await wait(150);
  }
  return false;
}

/**
 * Import Playwright, find Chromium, serve dist/, launch the browser.
 * Throws with an operator-readable message; callers exit non-zero.
 */
export async function bootBrowser({ port }) {
  const pw = await import(PW_URL).catch((e) => {
    throw new Error(`Cannot import Playwright from ${PW_URL}\n${e.message}`);
  });

  const exe = findChromium();
  if (!exe) {
    throw new Error(
      "No chromium build found under %LOCALAPPDATA%/ms-playwright — run: npx playwright install chromium"
    );
  }
  if (!existsSync("dist/index.html")) {
    throw new Error("dist/index.html missing — run `npm run build` first.");
  }

  // A piped stdio is a named pipe, which the confined sandbox refuses — and
  // "ignore" throws away the one thing that explains a boot failure (EADDRINUSE,
  // a missing dist, a slow disk). So the server writes to a log file instead, and
  // the failure path prints it.
  const log = resolve("dist", ".serve-audit.log");
  const fd = openSync(log, "w");
  const server = spawn(process.execPath, ["scripts/serve-dist.mjs", String(port)], { stdio: ["ignore", fd, fd] });
  // Generous because these suites share a machine with other browser sessions:
  // an 8s wait made the gate fail spuriously at exactly the moments it mattered,
  // and a flaky gate is a gate that gets ignored.
  if (!(await waitForPort(port, 25000))) {
    server.kill("SIGKILL");
    closeSync(fd);
    const tail = readFileSync(log, "utf8").trim().split("\n").slice(-6).join("\n      ");
    throw new Error(
      `Local dist server did not start on 127.0.0.1:${port}\n      ${log}:\n      ${tail || "(no output — the process was killed or the machine is saturated)"}`,
    );
  }
  closeSync(fd);

  const browser = await pw.chromium.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
  const base = `http://localhost:${port}/`;

  return {
    pw,
    browser,
    base,
    async shutdown() {
      await browser.close().catch(() => {});
      server.kill("SIGKILL");
    },
  };
}
