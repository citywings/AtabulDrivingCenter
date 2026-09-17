/**
 * REAL-BROWSER navigation audit — the empirical companion to the layout gates.
 *
 *   npm run build && npm run nav:check
 *
 * device-audit.mjs proved the menu *opens* and its links are scrollable. It never
 * proved that a tap lands you on the section you asked for. That distinction is
 * the whole point of a nav bar, and it is exactly what a static read of the CSS
 * cannot see: a fixed 80px header covering the heading of whatever section the
 * scroller decided to put at y=0.
 *
 * For every touch profile (and desktop), it taps each live nav link and measures
 * where the destination actually ended up, whether the overlay got out of the
 * way, whether the page can still scroll afterwards, whether the URL and the
 * browser back button reflect the move, and whether the CTA links preselect the
 * booking choice they claim to.
 */
import { bootBrowser } from "./lib/browser.mjs";

const PORT = Number(process.env.NAV_PORT ?? 4181);
const session = await bootBrowser({ port: PORT }).catch((e) => {
  console.error(e.message);
  process.exit(2);
});
const { pw, browser, base } = session;

const D = pw.devices;
const PROFILES = [
  { name: "phone-320", label: "320×568 phone", v: { width: 320, height: 568 }, dpr: 2 },
  { name: "iphone-12", label: "iPhone 12 390×664", ...pick(D["iPhone 12"], "iPhone 12") },
  { name: "pixel-7", label: "Pixel 7 412×839", ...pick(D["Pixel 7"], "Pixel 7") },
  { name: "ipad-gen11", label: "iPad gen 11 portrait 656×944", ...pick(D["iPad (gen 11)"], "iPad (gen 11)") },
  { name: "ipad-mini-744", label: "744×1133 iPad mini (below 48em)", v: { width: 744, height: 1133 }, dpr: 2 },
  { name: "ipad-gen7", label: "iPad gen 7 portrait 810×1080", ...pick(D["iPad (gen 7)"], "iPad (gen 7)") },
  { name: "ipad-pro-land", label: "iPad Pro 11 landscape 1194×834", ...pick(D["iPad Pro 11 landscape"], "iPad Pro 11 landscape") },
  { name: "desktop-1440", label: "1440×900 desktop", v: { width: 1440, height: 900 }, dpr: 1, touch: false, mobile: false },
  // The branch where Lenis is never instantiated: goToSection falls back to
  // scrollIntoView, and that path must reach the same destinations.
  { name: "reduced-motion", label: "375×667 prefers-reduced-motion (no Lenis)", v: { width: 375, height: 667 }, dpr: 2, rm: true },
];

function pick(preset, name) {
  if (!preset?.viewport) throw new Error(`Unknown Playwright device preset: "${name}"`);
  return {
    v: { width: preset.viewport.width, height: preset.viewport.height },
    dpr: preset.deviceScaleFactor ?? 2,
    touch: preset.hasTouch ?? true,
    mobile: preset.isMobile ?? true,
  };
}

/**
 * One nav walk. Everything is measured in the page, from the visitor's point of
 * view: the distance between where a section landed and the bottom of the fixed
 * header is the only number that decides "it worked" or "it covered the title".
 */
const rows = [];

const selected = (() => {
  const only = (process.env.NAV_ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return only.length ? PROFILES.filter((m) => only.some((o) => m.name.includes(o))) : PROFILES;
})();

for (const dev of selected) {
  const checks = [];
  const add = (name, pass, detail = "") => checks.push({ name, pass: !!pass, detail });
  const ctx = await browser.newContext({
    viewport: dev.v,
    deviceScaleFactor: dev.dpr,
    hasTouch: dev.touch !== false,
    isMobile: dev.mobile !== false,
    ...(dev.rm ? { reducedMotion: "reduce" } : {}),
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 140)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });

  const press = async (loc) => { if (dev.touch !== false) await loc.tap(); else await loc.click(); };

  const read = (href) =>
    page.evaluate((h) => {
      const header = document.querySelector(".header");
      if (!header) {
        // The back button can take us off-site; that must FAIL a check, not
        // crash the run.
        return { offSite: true, url: location.href, headerH: 0, targetTop: null, hash: location.hash,
          y: 0, atBottom: false, menuOpen: false, bodyLocked: false, lenisRunning: null, active: null, toggleVisible: false };
      }
      const hh = Math.round(header.getBoundingClientRect().height);
      const t = h ? document.querySelector(h) : null;
      const r = t?.getBoundingClientRect();
      const menu = document.querySelector(".mobile-menu");
      return {
        headerH: hh,
        targetTop: r ? Math.round(r.top) : null,
        hash: location.hash,
        url: location.href,
        y: Math.round(window.scrollY),
        atBottom: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4,
        menuOpen: !!menu && !menu.hidden && menu.classList.contains("is-open"),
        bodyLocked: getComputedStyle(document.body).overflow === "hidden",
        lenisRunning: window.__dpLenis ? !window.__dpLenis.isStopped : null,
        active: document.querySelector(".nav-desktop__link.is-active")?.getAttribute("href") ?? null,
        toggleVisible: (() => {
          const el = document.querySelector(".nav-mobile-toggle[data-menu-toggle]");
          return !!el && getComputedStyle(el).display !== "none";
        })(),
      };
    }, href);

  /** Wait until scrolling stops moving (Lenis lerps for ~1s by default). */
  const settle = async () => {
    let last = -1;
    let stable = 0;
    for (let i = 0; i < 45; i++) {
      const { y } = await read(null);
      stable = y === last ? stable + 1 : 0;
      last = y;
      if (stable >= 4) break;
      await page.waitForTimeout(100);
    }
    return last;
  };

  await page.goto(base, { waitUntil: "load" });
  await page.waitForTimeout(800);

  const start = await read(null);
  add("page loaded with a working header height", start.headerH > 40 && start.headerH < 200, `${start.headerH}px`);
  add("zero console/page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

  const overlay = start.toggleVisible;
  const navSel = overlay ? ".mobile-menu__link" : ".nav-desktop__link";
  const hrefs = await page.evaluate((s) => [...document.querySelectorAll(s)].map((a) => a.getAttribute("href")), navSel);
  add("the live nav has destinations", hrefs.length >= 6, `${navSel} → ${hrefs.join(" ")}`);

  // ---- every nav destination, tapped like a visitor --------------------
  for (const href of hrefs) {
    if (overlay) {
      await press(page.locator(".nav-mobile-toggle[data-menu-toggle]"));
      await page.waitForTimeout(320);
      const opened = await read(null);
      if (!opened.menuOpen) {
        add(`${href}: overlay opened`, false, "menu did not open — cannot test this destination");
        continue;
      }
    }
    const loc = page.locator(`${navSel}[href="${href}"]`).first();
    if (!(await loc.isVisible().catch(() => false))) {
      add(`${href}: link is tappable`, false, "not visible");
      continue;
    }
    await press(loc);
    await settle();
    const s = await read(href);

    // The headline claim: the section must start below the fixed header, and it
    // must not be dumped a screen away from the top.
    add(`${href} lands below the header, heading visible`,
      s.targetTop !== null && s.targetTop >= s.headerH - 6 && (s.targetTop <= s.headerH + 48 || s.atBottom),
      `top=${s.targetTop} header=${s.headerH}${s.atBottom ? " (page bottom)" : ""}`);
    if (overlay) {
      add(`${href} closed the overlay`, !s.menuOpen, s.menuOpen ? "still open" : "closed");
      add(`${href} released the scroll lock`, !s.bodyLocked && s.lenisRunning !== false,
        `bodyOverflow=${s.bodyLocked ? "hidden" : "auto"} lenisRunning=${s.lenisRunning}`);
    }
    add(`${href} is recorded in the address bar`, s.hash === href, `hash="${s.hash}"`);

    // Scrollability after the nav is the failure that strands a visitor.
    const y0 = s.y;
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(320);
    const y1 = (await read(null)).y;
    add(`${href} left the page scrollable`, y1 > y0, `${y0}px → ${y1}px`);
  }

  // ---- scroll-spy follows the section in view --------------------------
  for (const href of hrefs.slice(0, 4)) {
    await page.evaluate((h) => {
      const el = document.querySelector(h);
      if (window.__dpLenis) window.__dpLenis.scrollTo(el.offsetTop + el.offsetHeight / 2 - innerHeight / 2, { immediate: true });
      else window.scrollTo(0, el.offsetTop + el.offsetHeight / 2 - innerHeight / 2);
    }, href);
    await page.waitForTimeout(400);
    const s = await read(href);
    add(`scroll-spy marks ${href}`, s.active === href || s.targetTop > s.headerH, `active="${s.active}"`);
  }

  // ---- header CTA, logo, deep link, back button ------------------------
  const cta = page.locator("a.header__cta").first();
  if (await cta.isVisible().catch(() => false)) {
    await press(cta);
    await settle();
    const s = await read("#booking");
    add("header CTA reaches the booking pane", s.targetTop >= s.headerH - 6 && (s.targetTop <= s.headerH + 48 || s.atBottom),
      `top=${s.targetTop} header=${s.headerH}`);
  }

  const programme = await page.evaluate(() => {
    const a = document.querySelector("a[data-programme-link]");
    return a ? { href: a.getAttribute("href"), value: a.getAttribute("data-programme-link") } : null;
  });
  if (programme) {
    await page.evaluate(() => window.__dpLenis ? window.__dpLenis.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await press(page.locator("a[data-programme-link]").first());
    await settle();
    const got = await page.evaluate((v) => ({
      checked: document.querySelector('input[name="programme"]:checked')?.value ?? null,
      bookingTop: Math.round(document.querySelector("#booking").getBoundingClientRect().top),
      headerH: Math.round(document.querySelector(".header").getBoundingClientRect().height),
    }), programme.value);
    add("programme CTA preselects that programme", got.checked === programme.value,
      `wanted "${programme.value}" got "${got.checked}"`);
    add("programme CTA reaches #booking below the header", got.bookingTop >= got.headerH - 6,
      `top=${got.bookingTop} header=${got.headerH}`);
  }

  const origin = page.url();
  await press(page.locator('a.logo[href="#home"]').first());
  await settle();
  const home = await read("#home");
  add("logo returns to the top", home.y < 8, `scrollY=${home.y}`);

  await page.goBack({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(900);
  const back = await read(null);
  add("browser back stays inside the site", back.url.startsWith(origin.split("#")[0]), `${origin} → ${back.url}`);

  await page.goto(`${base}#fees`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const deep = await read("#fees");
  add("a deep link to #fees lands below the header",
    deep.targetTop >= deep.headerH - 6 && (deep.targetTop <= deep.headerH + 60 || deep.atBottom),
    `top=${deep.targetTop} header=${deep.headerH}`);

  // ---- overlay affordances (touch profiles only) -----------------------
  if (overlay) {
    const toggle = page.locator(".nav-mobile-toggle[data-menu-toggle]");
    await press(toggle);
    await page.waitForTimeout(300);
    add("toggle opens the overlay", (await read(null)).menuOpen);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const esc = await read(null);
    add("Escape closes the overlay", !esc.menuOpen, `open=${esc.menuOpen} locked=${esc.bodyLocked}`);
    add("Escape releases the scroll lock", !esc.bodyLocked);

    await press(toggle);
    await page.waitForTimeout(300);
    await press(page.locator(".nav-mobile-toggle[data-menu-close]"));
    await page.waitForTimeout(400);
    const byBtn = await read(null);
    add("close button dismisses the overlay", !byBtn.menuOpen && !byBtn.bodyLocked,
      `open=${byBtn.menuOpen} locked=${byBtn.bodyLocked}`);

    // Two opens in a row must not double-stack a scroll lock.
    await press(toggle);
    await page.waitForTimeout(250);
    await press(page.locator(".nav-mobile-toggle[data-menu-close]"));
    await page.waitForTimeout(300);
    const again = await read(null);
    add("the overlay is reliably reusable", !again.menuOpen && !again.bodyLocked, `locked=${again.bodyLocked}`);
  }

  // ---- keyboard entry point --------------------------------------------
  await page.goto(base, { waitUntil: "load" });
  await page.waitForTimeout(600);
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => document.activeElement?.className ?? "");
  add("first Tab lands on the skip link", String(first).includes("skip-link"), `activeElement class="${first}"`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const focused = await page.evaluate(() => document.activeElement?.id ?? "");
  add("skip link actually moves focus into the page", focused === "main", `focused id="${focused}"`);

  /* The fixed contact rail: its taps must reach the platform handlers.
     The smooth-scroll handler is delegated on `document` and matches
     `a[href^="#"]`. If that selector is ever widened to all anchors,
     preventDefault would kill the dialler intent — the button would look
     perfectly fine and no call would ever be placed. A listener on `window`
     runs at the end of the bubble path, so `defaultPrevented` here is the
     *final* state after every handler on the page has had its say. We then
     preventDefault ourselves so the synthetic click never really dials or
     spawns a WhatsApp tab. */
  const rail = await page.evaluate(() => {
    const probe = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return { found: false };
      const y = window.scrollY;
      const out = { found: true, href: el.getAttribute("href") };
      const once = (e) => {
        window.removeEventListener("click", once, false);
        out.prevented = e.defaultPrevented;
        out.moved = Math.abs(window.scrollY - y);
        e.preventDefault(); // neutralise the real hand-off for this test
      };
      window.addEventListener("click", once, false);
      el.click();
      return out;
    };
    return { call: probe(".rail-btn--call"), wa: probe(".rail-btn--wa") };
  });
  add("both rail buttons are present to be tapped", rail.call.found && rail.wa.found);
  add("the call tap is not intercepted — the dialler gets the click",
    rail.call.prevented === false, `prevented=${rail.call.prevented} href=${rail.call.href}`);
  add("the WhatsApp tap is not intercepted — WhatsApp gets the link",
    rail.wa.prevented === false, `prevented=${rail.wa.prevented} href=${String(rail.wa.href).slice(0, 40)}…`);
  add("a rail tap does not move the page", (rail.call.moved ?? 0) <= 1 && (rail.wa.moved ?? 0) <= 1,
    `moved ${rail.call.moved}/${rail.wa.moved}px`);

  if (errors.length) add("no errors across the whole nav walk", false, errors.slice(0, 3).join(" | "));
  await ctx.close();
  rows.push({ dev: dev.label, checks });
}

/* ---------------- report ------------------------------------------------- */
let printed = false;
function printReport() {
  if (printed) return;
  printed = true;
  let failed = 0;
  let total = 0;
  for (const row of rows) {
    const dev = String(row.dev);
    console.log(`\n══ ${dev} ${"═".repeat(Math.max(0, 62 - dev.length))}`);
    for (const c of row.checks) {
      total++;
      if (!c.pass) failed++;
      if (!c.pass || process.env.NAV_VERBOSE) {
        console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  → ${c.detail}` : ""}`);
      }
    }
    const f = row.checks.filter((c) => !c.pass).length;
    console.log(`  ${f ? `✗ ${f} of ${row.checks.length}` : `✓ all ${row.checks.length}`} on this profile`);
  }
  console.log(`\n${"─".repeat(70)}`);
  if (total === 0) console.log("no profile completed — see the stack above");
  else if (failed === 0) console.log(`★ ${total} navigation checks passed across ${rows.length} profiles`);
  else console.log(`✗ ${failed} of ${total} navigation checks FAILED`);
  process.exitCode = failed ? 1 : 0;
}
// A crash half-way through must not cost the evidence already gathered.
process.on("exit", printReport);

await session.shutdown();
printReport();
