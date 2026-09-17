/**
 * REAL-BROWSER device audit — the empirical companion to verify-responsive.mjs.
 *
 *   npm run build && npm run device:check
 *
 * Drives Chromium (the ms-playwright install already on this machine) through a
 * phone/tablet/desktop matrix against dist/, and measures what a static read of
 * the CSS cannot know: which srcset candidate the browser actually fetched,
 * whether anything overflows a 320px viewport, whether every control is a real
 * 44px box, whether the overlay menu can be scrolled to its last link, whether
 * the toast collides with the call button, and what a JS-off visitor sees.
 *
 * Overrides: PLAYWRIGHT_MODULE=<path to playwright/index.mjs>  CHROME_PATH=<chrome.exe>
 */
import { mkdirSync } from "node:fs";
import { bootBrowser } from "./lib/browser.mjs";

const PORT = Number(process.env.DEVICE_PORT ?? 4179);
const SHOTS = ".device-shots";
const OUT = process.argv.includes("--shots");

/* ---------------- boot -------------------------------------------------- */
const session = await bootBrowser({ port: PORT }).catch((e) => {
  console.error(e.message);
  process.exit(2);
});
const { pw, browser } = session;
const BASE = session.base;
if (OUT) mkdirSync(SHOTS, { recursive: true });

/* ---------------- the matrix -------------------------------------------- */
const D = pw.devices;
const matrix = [
  { name: "phone-320", label: "320×568 smallest supported", v: { width: 320, height: 568 }, touch: true, dpr: 2, mobile: true },
  { name: "pixel-7", label: "Pixel 7 412×839 (Android, 2.625×)", ...pick(D["Pixel 7"], "Pixel 7") },
  { name: "iphone-se", label: "iPhone SE 375×667", v: { width: 375, height: 667 }, touch: true, dpr: 2, mobile: true },
  { name: "iphone-12", label: "iPhone 12 390×664 (3×)", ...pick(D["iPhone 12"], "iPhone 12") },
  { name: "iphone-14-pro-max", label: "iPhone 14 Pro Max 430×740 (3×)", ...pick(D["iPhone 14 Pro Max"], "iPhone 14 Pro Max") },
  { name: "iphone-se-landscape", label: "iPhone SE landscape 667×375", v: { width: 667, height: 375 }, touch: true, dpr: 2, mobile: true },
  { name: "phone-landscape-short", label: "568×320 very short landscape", v: { width: 568, height: 320 }, touch: true, dpr: 2, mobile: true },
  { name: "ipad-mini-portrait", label: "744×1133 iPad mini 6 (below 48em)", v: { width: 744, height: 1133 }, touch: true, dpr: 2, mobile: true },
  { name: "ipad-gen11-portrait", label: "iPad gen 11 portrait 656×944 (2.5×)", ...pick(D["iPad (gen 11)"], "iPad (gen 11)") },
  { name: "ipad-gen7-portrait", label: "iPad gen 7 portrait 810×1080 (above 48em)", ...pick(D["iPad (gen 7)"], "iPad (gen 7)") },
  { name: "ipad-768", label: "768×1024 exactly 48em", v: { width: 768, height: 1024 }, touch: true, dpr: 2, mobile: true },
  { name: "ipad-pro-landscape", label: "iPad Pro 11 landscape 1194×834", ...pick(D["iPad Pro 11 landscape"], "iPad Pro 11 landscape") },
  { name: "boundary-1024", label: "1024×768 exactly 64em (nav swap)", v: { width: 1024, height: 768 }, touch: true, dpr: 2, mobile: true },
  { name: "desktop-1440", label: "1440×900 desktop regression", v: { width: 1440, height: 900 }, touch: false, dpr: 1, mobile: false },
];
function pick(preset, name) {
  // Two profiles here silently fell back to a phone geometry while the report
  // still printed an iPad name — a matrix that measures the wrong thing is worse
  // than no matrix. Unknown preset = hard error.
  if (!preset?.viewport) throw new Error(`Unknown Playwright device preset: "${name}"`);
  return {
    v: { width: preset.viewport.width, height: preset.viewport.height },
    touch: preset.hasTouch ?? true, dpr: preset.deviceScaleFactor ?? 2, mobile: preset.isMobile ?? true,
  };
}

/* ---------------- in-page measurement ----------------------------------- */
/* WCAG contrast from two *computed* CSS colours, i.e. what the browser actually
   resolved — not what the token source claims. rgba() is composited over the
   background first, because that is the pair a visitor's eye sees. */
function contrastRatio(fg, bg) {
  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(String(s));
    return m ? m[1].split(/[,\s/]+/).filter(Boolean).map(Number) : null;
  };
  const a = parse(fg), b = parse(bg);
  if (!a || !b) return 0;
  const base = b.length > 3 ? [255, 255, 255] : b.slice(0, 3);
  const rgb = a.length > 3 ? [0, 1, 2].map((i) => a[i] * a[3] + base[i] * (1 - a[3])) : a.slice(0, 3);
  const lin = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : (c / 255 + 0.055) ** 2.4 / 1.055 ** 2.4);
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const [x, y] = [L(rgb), L(base)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const PROBE = () => {
  const vw = innerWidth;
  const de = document.documentElement;
  const sel = (el) =>
    el.tagName.toLowerCase() +
    (el.id ? `#${el.id}` : "") +
    (typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "");
  const shown = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const inScroller = (el) => {
    for (let n = el; n; n = n.parentElement) {
      if (n === document.documentElement || n === document.body) break;
      const cs = getComputedStyle(n);
      // auto/scroll can be scrolled to, hidden clips: neither is a painted
      // overflow defect. Only the root could actually widen the page.
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) return true;
    }
    return false;
  };

  const offenders = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!shown(el) || el.closest("svg")) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el)) {
      offenders.push({ sel: sel(el), left: Math.round(r.left), right: Math.round(r.right) });
    }
  }

  const smallTap = [];
  for (const el of document.querySelectorAll("a[href], button, input, select, textarea, [role=button], label[for]")) {
    if (!shown(el) || el.closest(".visually-hidden") || el.closest("[aria-hidden=true]")) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "inline" && el.closest("p, li, td, .contact__row")) continue; // text links exempt
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44)
      smallTap.push({
        sel: sel(el),
        label: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34),
        w: Math.round(r.width), h: Math.round(r.height),
      });
  }

  const tiny = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length || !shown(el)) continue;
    if (!el.textContent.trim()) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) tiny.push({ sel: sel(el), fs: +fs.toFixed(1) });
  }

  const rect = (s) => {
    const el = document.querySelector(s);
    if (!el || !shown(el)) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
  };

  const menu = document.querySelector(".mobile-menu");
  const input = document.querySelector(".input");
  const track = document.querySelector(".marquee__track");
  const img = document.querySelector(".hero__media img");
  const revealEls = [...document.querySelectorAll(".reveal, .media-reveal")]
    // Skip anything inside a clipping carousel (the JS clones items sideways, and
    // those were never meant to intersect), anything with no box (hidden booking
    // panes), and anything whose subtree is visibility:hidden (the closed menu
    // overlay still has layout boxes).
    .filter((el) => !el.closest(".marquee-window, .rules-rail__window"))
    .filter((el) => el.getBoundingClientRect().height > 0)
    .filter((el) => (el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : true));
  const revealOpacity = revealEls.map((el) => +getComputedStyle(el).opacity);
  const revealStuck = revealEls
    .filter((el) => +getComputedStyle(el).opacity < 0.9)
    .slice(0, 3)
    .map((el) => `${sel(el)} @${Math.round(el.getBoundingClientRect().top)}px "${(el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24)}"`);
  const overlaps = (which) => {
    const els = [...document.querySelectorAll(which)].filter(shown);
    let n = 0;
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i].getBoundingClientRect();
        const b = els[j].getBoundingClientRect();
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) n++;
      }
    }
    return n;
  };
  const navOverlap =
    overlaps(".nav-desktop__link") + overlaps(".footer__col a") + overlaps(".mobile-menu__link") +
    overlaps(".link") + overlaps(".rail-btn") +
    // Cross-group: the hero scroll cue and the fixed rail both live bottom-right.
    (() => {
      const cue = document.querySelector(".hero__scroll");
      const rail = document.querySelector(".contact-rail");
      if (!cue || !rail || !shown(cue)) return 0;
      const a = cue.getBoundingClientRect();
      const b = rail.getBoundingClientRect();
      return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1 ? 1 : 0;
    })();
  const inlineLinks = [...document.querySelectorAll("a[href]")]
    .filter((el) => getComputedStyle(el).display === "inline" && el.getBoundingClientRect().height > 0);

  return {
    vw, vh: innerHeight,
    scrollWidth: de.scrollWidth, bodyScrollWidth: document.body.scrollWidth,
    offenders: offenders.slice(0, 8), offenderCount: offenders.length,
    smallTap: smallTap.slice(0, 10), smallTapCount: smallTap.length,
    tiny: tiny.slice(0, 8), tinyCount: tiny.length,
    hover: matchMedia("(hover: hover)").matches,
    fine: matchMedia("(pointer: fine)").matches,
    maxTouchPoints: navigator.maxTouchPoints,
    svh: CSS.supports("height", "100svh"),
    navDesktop: getComputedStyle(document.querySelector(".nav-desktop")).display !== "none",
    toggle: rect(".nav-mobile-toggle"),
    header: rect(".header"),
    rail: rect(".contact-rail"),
    credit: (() => {
      const p = document.querySelector(".footer__credit");
      if (!p) return null;
      const box = (el) => {
        const b = el?.getBoundingClientRect();
        return b ? { x: Math.round(b.x), y: Math.round(b.y), right: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) } : null;
      };
      const mark = p.querySelector(".footer__credit-mark");
      const word = p.querySelector(".footer__credit-word");
      const footer = document.querySelector(".footer");
      return {
        text: p.textContent.replace(/\s+/g, " ").trim(),
        mark: box(mark), word: box(word),
        markLoaded: !!mark && mark.complete && mark.naturalWidth > 0,
        natural: mark ? `${mark.naturalWidth}×${mark.naturalHeight}` : "",
        src: mark?.currentSrc || "",
        wordColor: word ? getComputedStyle(word).color : "",
        footerBg: footer ? getComputedStyle(footer).backgroundColor : "",
        wordSize: word ? Math.round(parseFloat(getComputedStyle(word).fontSize)) : 0,
        visible: !!word && !!mark && shown(word) && shown(mark) && +getComputedStyle(word).opacity > 0.9,
      };
    })(),
    railPosition: (() => {
      const el = document.querySelector(".contact-rail");
      return el ? getComputedStyle(el).position : null;
    })(),
    railBtns: [...document.querySelectorAll(".rail-btn")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        kind: el.classList.contains("rail-btn--wa") ? "wa" : "call",
        href: el.getAttribute("href"),
        label: el.getAttribute("aria-label") || "",
        target: el.getAttribute("target") || "",
        rel: el.getAttribute("rel") || "",
        w: Math.round(r.width), h: Math.round(r.height),
        x: Math.round(r.left), y: Math.round(r.top),
        right: Math.round(r.right), bottom: Math.round(r.bottom),
      };
    }),
    toast: rect(".toast"),
    toastRegionBottom: rect(".toast-region")?.y ?? null,
    currentSrc: img?.currentSrc ?? null,
    videoSrc: document.querySelector(".hero__media video")?.currentSrc ?? null,
    menuOverflowY: menu ? getComputedStyle(menu).overflowY : null,
    menuScrollH: menu?.scrollHeight ?? 0,
    menuClientH: menu?.clientHeight ?? 0,
    menuVis: menu ? getComputedStyle(menu).visibility : null,
    inputFontSize: input ? parseFloat(getComputedStyle(input).fontSize) : null,
    marqueePlay: track ? getComputedStyle(track).animationPlayState : null,
    revealMinOpacity: revealOpacity.length ? Math.min(...revealOpacity) : 1,
    revealCount: revealOpacity.length,
    revealStuck,
    navOverlap,
    inlineLinkCount: inlineLinks.length,
    inlineLinksTooSmall: inlineLinks
      .filter((el) => el.getBoundingClientRect().height < 20)
      .map((el) => `${sel(el)} ${Math.round(el.getBoundingClientRect().height)}px "${(el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 22)}"`)
      .slice(0, 6),
    faqVisible: [...document.querySelectorAll(".accordion__panel-inner")]
      .filter((p) => p.getBoundingClientRect().height > 8).length,
    faqTotal: document.querySelectorAll(".accordion__panel-inner").length,
    heroTitleHeight: Math.round(document.querySelector(".hero__title")?.getBoundingClientRect().height ?? 0),
    bodyFontPx: parseFloat(getComputedStyle(document.body).fontSize),
    dpr: devicePixelRatio,
  };
};

/* ---------------- run --------------------------------------------------- */
const selected = (() => {
  const only = (process.env.DEVICE_ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return only.length ? matrix.filter((m) => only.some((o) => m.name.includes(o))) : matrix;
})();
const rows = [];
const allChecks = [];
let shotCount = 0;

for (const dev of selected) {
  const ctx = await browser.newContext({
    viewport: dev.v,
    deviceScaleFactor: dev.dpr,
    isMobile: dev.mobile,
    hasTouch: dev.touch,
  });
  const page = await ctx.newPage();
  console.log(`· probing ${dev.label}`);
  const errors = [];
  const requests = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 90)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 90)); });
  page.on("request", (r) => requests.push(r.url()));

  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForTimeout(700); // let load-gated video + Lenis settle

  // The rail's contract is "same point on screen, whatever the scroll offset".
  // getBoundingClientRect() is viewport-relative, so capturing it here at y=0
  // and again after the sweep below is exactly that measurement.
  const readRail = () => {
    const r = document.querySelector(".contact-rail")?.getBoundingClientRect();
    return r ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null;
  };
  const railAtTop = await page.evaluate(readRail);

  // Walk the whole document so every IntersectionObserver reveal has fired,
  // then return to the top: "nothing stuck at opacity 0" is only meaningful
  // after the page has actually been scrolled through.
  // Lenis rewrites window scroll from its rAF loop, so a bare window.scrollTo()
  // gets snapped back and the observers never see most of the page. Drive the
  // documented handle (immediate jumps), falling back to native scroll for the
  // reduced-motion build where Lenis is never instantiated.
  const docH = await page.evaluate(() => document.body.scrollHeight);
  const stepPx = Math.round(dev.v.height * 0.8);
  const jump = (yy) =>
    page.evaluate(([y, h]) => {
      if (window.__dpLenis) window.__dpLenis.scrollTo(y, { immediate: true });
      else window.scrollTo(0, Math.min(y, h));
    }, [yy, docH]);
  for (let y = 0; y < docH; y += stepPx) {
    await jump(y);
    await page.waitForTimeout(90); // let the IntersectionObserver + transition land
  }
  await jump(docH);
  await page.waitForTimeout(500);
  const reached = await page.evaluate(() => Math.round(window.scrollY));
  await jump(0);
  // --reveal-duration is 560ms; measure after the last transition has settled.
  await page.waitForTimeout(700);

  // One cheap realism check: a physical wheel event must actually move the page.
  const beforeWheel = await page.evaluate(() => Math.round(window.scrollY));
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(700);
  const afterWheel = await page.evaluate(() => Math.round(window.scrollY));

  // Discrete 0.8-viewport jumps can outrun an IntersectionObserver callback on a
  // busy frame (decoding hero + rail clips). Any reveal still hidden after the
  // sweep gets its element explicitly centred, so a stuck reveal below is a real
  // defect and not a timing artefact of this harness.
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const candidates = () => [...document.querySelectorAll(".reveal, .media-reveal")]
      .filter((el) => !el.closest(".marquee-window, .rules-rail__window"))
      .filter((el) => el.getBoundingClientRect().height > 0)
      .filter((el) => (el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : true))
      .filter((el) => +getComputedStyle(el).opacity < 0.9);
    for (const el of candidates()) {
      if (window.__dpLenis) window.__dpLenis.scrollTo(el, { immediate: true });
      else el.scrollIntoView({ block: "center" });
      await sleep(300);
    }
    if (candidates().length) await sleep(600);
  });

  const checks = [];
  const add = (name, pass, detail = "") => checks.push({ name, pass, detail });

  const boot = await page.evaluate(() => ({ js: document.documentElement.classList.contains("js"), booted: !!window.__dpBooted }));
  add("module booted (no fail-open fallback needed)", boot.booted, JSON.stringify(boot));
  const vp = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, d: devicePixelRatio }));
  add("the profile really got the viewport it asked for", Math.abs(vp.w - dev.v.width) <= 2,
    `asked ${dev.v.width}×${dev.v.height}, page reports ${vp.w}×${vp.h} @${vp.d}×`);
  add("zero console/page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

  /* The mark was an inline SVG until the brand swap; it is now a raster ladder. A
     wrong path, a wrong MIME type or a failed decode leaves the layout looking
     perfectly normal while painting nothing, and no static gate can see that. So
     every profile asserts the pixels arrived, and that <picture> resolved to the
     WebP rung rather than silently falling back. */
  const marks = await page.evaluate(() => [...document.querySelectorAll("picture.logo__picture img.logo__mark")]
    .map((i) => {
      const r = i.getBoundingClientRect();
      return { complete: i.complete, src: (i.currentSrc || i.src).split("/").pop(),
        nw: i.naturalWidth, nh: i.naturalHeight, w: Math.round(r.width), h: Math.round(r.height) };
    }));
  /* The 96px floor is the legibility gate from the ladder, measured not decorative:
     the artwork carries its own lettering at ~14% of its height, so a smaller box is a
     smaller logo, not a compact one. Asserted per profile because the box is a clamp()
     and every device here resolves it differently. */
  add("both brand marks decode and paint at the contract size (header + footer)",
    marks.length === 2 && marks.every((m) => m.complete && m.nw > 0 && m.h >= 90 && m.w >= 115),
    JSON.stringify(marks));
  /* The check that was missing when the mark was 132x109 art displayed at 44x44: the
     old assertion (>= 40 in both axes) passed a 27% horizontal stretch, because a
     distorted image is still an image. Rendered aspect must match intrinsic aspect. */
  add("the mark is not stretched (rendered aspect within 3% of the file's)",
    marks.length === 2 && marks.every((m) => Math.abs(m.w / m.h - m.nw / m.nh) / (m.nw / m.nh) < 0.03),
    marks.map((m) => `${m.w}x${m.h} from ${m.nw}x${m.nh}`).join(", "));
  add("the mark resolves to the WebP rung, not the PNG fallback",
    marks.length === 2 && marks.every((m) => m.src === "atabul-mark.webp"),
    marks.map((m) => m.src).join(", "));

  // trigger the validation toast, then measure collision with the FAB
  const next = page.locator("[data-next]").first();
  if (await next.isVisible().catch(() => false)) {
    await next.scrollIntoViewIfNeeded().catch(() => {});
    await next.click().catch(() => {});
    await page.waitForTimeout(420);
  }
  const p = await page.evaluate(PROBE);

  // The requirement is symmetric. Sweeping down and comparing proves the rail
  // does not drift *with* the document; returning to the top the same way the
  // sweep travelled proves nothing was left displaced behind — a transform that
  // a scroll handler set and never cleared, a stuck will-change layer, a
  // re-parented node. Same rect, third read.
  await page.evaluate(() => {
    if (window.__dpLenis) window.__dpLenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  });
  await page.waitForTimeout(250);
  const railAfterReturn = await page.evaluate(readRail);

  // Worst case for the credit is the true bottom of the document: the fixed rail
  // is pinned to that corner, and the footer's last row is what sits under it.
  // Measured here rather than inferred from the sweep's resting position, which
  // is wherever the last hidden reveal happened to be.
  await page.evaluate(() => {
    const end = document.documentElement.scrollHeight;
    if (window.__dpLenis) window.__dpLenis.scrollTo(end, { immediate: true });
    else window.scrollTo(0, end);
  });
  await page.waitForTimeout(250);
  const atBottom = await page.evaluate(() => {
    const box = (s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), right: Math.round(b.right), bottom: Math.round(b.bottom) };
    };
    const max = document.documentElement.scrollHeight - innerHeight;
    return { rail: box(".contact-rail"), credit: box(".footer__credit"), at: Math.round(window.scrollY), max: Math.round(max), vh: innerHeight };
  });

  add("no horizontal page overflow", p.scrollWidth <= p.vw + 1, `scrollWidth ${p.scrollWidth} vs vw ${p.vw}`);
  add("nothing painted outside the viewport", p.offenderCount === 0,
    p.offenders.map((o) => `${o.sel} →${o.right}`).slice(0, 3).join(" | "));
  add("every control is a ≥44px touch box", p.smallTapCount === 0,
    p.smallTap.map((t) => `${t.sel} ${t.w}×${t.h} "${t.label}"`).slice(0, 4).join(" | "));
  add("the sweep really scrolled to the bottom",
    reached >= docH - p.vh * 2, `reached ${reached}px of ${docH}px`);
  add("a physical wheel event moves the page", afterWheel > beforeWheel, `${beforeWheel}px → ${afterWheel}px`);
  if (p.vw < 1024) {
    add("inline text links stay tappable (≥20px in the thumb zone)",
      p.inlineLinksTooSmall.length === 0, `${p.inlineLinkCount} inline · ${p.inlineLinksTooSmall.join(" | ")}`);
  } else {
    add("desktop text links rely on the pointer, documented not asserted", true,
      `${p.inlineLinkCount} inline links at (pointer: fine)`);
  }
  add("no two navigation or CTA boxes overlap", p.navOverlap === 0, `${p.navOverlap} overlapping pairs`);
  add("nothing renders under 12px", p.tinyCount === 0, p.tiny.map((t) => `${t.sel} ${t.fs}px`).slice(0, 4).join(" | "));
  add("exactly one navigation is available (no dead band)",
    p.navDesktop !== (p.toggle !== null), `desktopNav=${p.navDesktop} toggle=${p.toggle !== null}`);
  add("header inside the viewport", !!p.header && p.header.bottom <= p.vh, JSON.stringify(p.header));
  add("form controls ≥16px (no iOS focus zoom)", p.inputFontSize === null || p.inputFontSize >= 16, `${p.inputFontSize}px`);

  // ---- the fixed contact rail -------------------------------------------
  const call = p.railBtns.find((b) => b.kind === "call");
  const wa = p.railBtns.find((b) => b.kind === "wa");
  add("contact rail is present and holds both actions", !!p.rail && p.railBtns.length === 2,
    p.rail ? `${p.railBtns.length} buttons at ${p.rail.x},${p.rail.y}` : "NOT RENDERED");
  add("contact rail is position: fixed", p.railPosition === "fixed", String(p.railPosition));
  const sameRect = (a, b) => !!a && !!b && ["x", "y", "w", "h"].every((k) => Math.abs(a[k] - b[k]) <= 0.5);
  const railMid = p.rail ? { x: p.rail.x, y: p.rail.y, w: p.rail.w, h: p.rail.h } : null;
  add("the rail does not move when the page scrolls down", sameRect(railAtTop, railMid),
    `at y=0 ${JSON.stringify(railAtTop)} vs after sweep ${JSON.stringify(railMid)}`);
  add("the rail is back exactly where it started after scrolling up", sameRect(railAtTop, railAfterReturn),
    `start ${JSON.stringify(railAtTop)} vs after returning ${JSON.stringify(railAfterReturn)}`);
  if (p.rail) {
    add("rail fully inside the viewport",
      p.rail.x >= 0 && p.rail.right <= p.vw + 1 && p.rail.y >= 0 && p.rail.bottom <= p.vh + 1,
      JSON.stringify(p.rail));
    for (const b of p.railBtns) {
      add(`rail ${b.kind} button is a ≥44px target`, b.w >= 44 && b.h >= 44, `${b.w}×${b.h}`);
      add(`rail ${b.kind} button names itself for screen readers`, b.label.length > 10, `"${b.label}"`);
      if (p.toast) {
        const overlap = !(p.toast.x + p.toast.w <= b.x || b.right <= p.toast.x ||
          p.toast.y + p.toast.h <= b.y || b.bottom <= p.toast.y);
        add(`toast does not sit on the rail ${b.kind} button`, !overlap,
          `toast ${p.toast.x},${p.toast.y}+${p.toast.w}×${p.toast.h} vs ${b.x},${b.y}+${b.w}×${b.h}`);
      }
    }
  }
  // The behaviour the whole feature exists for: a tap must reach this business.
  add("the call button dials the published line", call?.href === "tel:+916290345383", call?.href ?? "missing");
  add("the WhatsApp button opens a real chat, prefilled",
    !!wa && wa.href.startsWith("https://wa.me/916290345383?text=") &&
      decodeURIComponent(wa.href.slice("https://wa.me/916290345383?text=".length)).trim().length > 20,
    wa ? `${wa.href.slice(0, 58)}… (${wa.href.length} chars)` : "missing");
  add("WhatsApp opens in a new tab and cannot reach back into the page",
    wa?.target === "_blank" && /noopener/.test(wa?.rel ?? ""), `target="${wa?.target}" rel="${wa?.rel}"`);
  add("the two rail targets cannot be confused by a thumb",
    !!call && !!wa && Math.abs(call.y - wa.bottom) >= 8,
    `gap ${call && wa ? Math.abs(call.y - wa.bottom) : "n/a"}px`);

  // ---- the CITYWINGS development credit ----------------------------------
  add("the Powered-by credit renders", !!p.credit && p.credit.visible, p.credit ? `"${p.credit.text}"` : "no .footer__credit in the footer");
  if (p.credit) {
    add("the credit reads exactly 'Powered by CITYWINGS'", /^Powered by\s+CITYWINGS$/.test(p.credit.text), `"${p.credit.text}"`);
    add("the logo is placed before the word",
      !!p.credit.mark && !!p.credit.word && p.credit.mark.right <= p.credit.word.x + 1,
      `mark ends at x=${p.credit.mark?.right}, word starts at x=${p.credit.word?.x}`);
    add("the mark decoded at its shipped size", p.credit.markLoaded && p.credit.natural === "96×96",
      `${p.credit.natural} · ${String(p.credit.src).split("/").pop()}`);
    const markFetches = requests.filter((u) => /citywings-mark/.test(u)).length;
    add("the mark was fetched exactly once", markFetches === 1, `${markFetches} request(s)`);
    add("the credit word is at least 12px", p.credit.wordSize >= 12, `${p.credit.wordSize}px`);
    const ratio = contrastRatio(p.credit.wordColor, p.credit.footerBg);
    add("the credit word clears 4.5:1 as the browser computed it", ratio >= 4.5,
      `${p.credit.wordColor} on ${p.credit.footerBg} = ${ratio.toFixed(2)}:1`);
    // The rail is pinned over the bottom-right corner and the credit is the last
    // line on the page — this is the one place the two can meet. PROBE ran at the
    // end of the sweep, i.e. with the footer fully scrolled into view.
    const onRail = [p.credit.mark, p.credit.word].filter(Boolean).filter((b) =>
      p.rail && !(p.rail.x >= b.right || b.x >= p.rail.right || p.rail.y >= b.y + b.h || b.y >= p.rail.bottom));
    add("the fixed rail does not cover the credit", onRail.length === 0,
      onRail.length ? `rail ${JSON.stringify(p.rail)} over ${JSON.stringify(onRail[0])}`
        : `credit ends ${p.credit.word?.right}px, rail starts ${p.rail?.x}px`);
    // The case that actually decides it: the absolute bottom of the document,
    // where the fixed rail sits over the footer's last row. Guarded by proof
    // that the harness really got there, or the check below could pass vacuously.
    add("the sweep really reached the bottom of the document",
      Math.abs(atBottom.at - atBottom.max) <= 2, `scrollY ${atBottom.at} of ${atBottom.max}`);
    const bl = atBottom.rail && atBottom.credit &&
      Math.min(atBottom.rail.right, atBottom.credit.right) - Math.max(atBottom.rail.x, atBottom.credit.x) > 1 &&
      Math.min(atBottom.rail.bottom, atBottom.credit.bottom) - Math.max(atBottom.rail.y, atBottom.credit.y) > 1;
    add("the rail does not cover the credit at the bottom of the page", !bl,
      `rail ${JSON.stringify(atBottom.rail)} vs credit ${JSON.stringify(atBottom.credit)}`);
  }

  // Tap only exists on a touch context; desktop profiles must use click.
  const press = async (locator) => { if (dev.touch) await locator.tap(); else await locator.click(); };

  if (p.toggle) {
    add("menu is scrollable when content exceeds it",
      p.menuOverflowY === "auto" || p.menuScrollH <= p.menuClientH,
      `overflowY=${p.menuOverflowY} scrollH=${p.menuScrollH} clientH=${p.menuClientH}`);
    // Two elements share the class: the header button opens, the one inside the
    // overlay closes. Address them by their data attribute, not by class.
    await press(page.locator(".nav-mobile-toggle[data-menu-toggle]"));
    await page.waitForTimeout(400);
    const open = await page.evaluate(() => {
      const m = document.querySelector(".mobile-menu");
      const links = [...m.querySelectorAll(".mobile-menu__link")];
      const box = m.getBoundingClientRect();
      const reachable = links.map((l) => {
        l.scrollIntoView({ block: "center", behavior: "instant" });
        const r = l.getBoundingClientRect();
        return r.top >= box.top - 2 && r.bottom <= box.bottom + 2;
      });
      return {
        vis: getComputedStyle(m).visibility,
        total: links.length,
        reachable: reachable.filter(Boolean).length,
        scrollable: m.scrollHeight > m.clientHeight + 1,
      };
    });
    add("overlay menu opens", open.vis === "visible", `visibility=${open.vis}`);
    // The rail is pinned above normal content at all times; while a full-screen
    // menu is up it must be *under* it, or a floating gold circle sits on top of
    // the overlay the visitor is trying to read.
    const railHit = await page.evaluate(() => {
      const r = document.querySelector(".contact-rail")?.getBoundingClientRect();
      if (!r) return null;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit ? `${hit.tagName.toLowerCase()}.${String(hit.className).split(" ")[0]}` : "nothing";
    });
    add("the open overlay covers the rail", !!railHit && !railHit.includes("contact-rail") && !railHit.includes("rail-btn"),
      `topmost element at the rail's centre: ${railHit}`);
    add(`all ${open.total} menu links reachable by scroll`, open.reachable === open.total,
      `${open.reachable}/${open.total} in view (scrollable=${open.scrollable})`);
    await press(page.locator(".nav-mobile-toggle[data-menu-close]"));
    await page.waitForTimeout(300);
  }

  // poster + video candidate the browser actually chose. `sizes="100vw"` means
  // the right candidate depends on CSS px x devicePixelRatio: a 3x 390pt phone
  // legitimately wants 1170 device px, so it must take the 1600w file. Asserting
  // "phones always get 900w" would be testing the wrong thing.
  const need = Math.round(p.vw * p.dpr);
  const wantSmall = need <= 900;
  add(`hero poster resolves to the ${wantSmall ? "900w" : "1600w"} candidate (${p.vw}×${p.dpr} = ${need} device px)`,
    !!p.currentSrc && p.currentSrc.includes(wantSmall ? "-900." : "hero-fallback.avif"),
    p.currentSrc?.replace(/^https?:\/\/[^/]+\//, "") ?? "no currentSrc");
  const avif1600 = requests.filter((u) => /hero-fallback\.avif/.test(u)).length;
  const avif900 = requests.filter((u) => /hero-fallback-900\.avif/.test(u)).length;
  add("no double-fetch of the preloaded poster",
    Math.max(avif1600, avif900) <= 1 && (avif1600 > 0 || avif900 > 0),
    `1600w×${avif1600} 900w×${avif900}`);
  add(`only the chosen poster was fetched (${wantSmall ? "900w" : "1600w"})`,
    (wantSmall ? avif1600 === 0 : avif900 === 0), `1600w×${avif1600} 900w×${avif900}`);
  const mp4s = [...new Set(requests.filter((u) => /\/hero-primary-\d+[^/]*\.mp4$/.test(u)).map((u) => u.split("/").pop()))];
  const railClips = new Set(requests.filter((u) => /\/rule-.*\.mp4$/.test(u)).map((u) => u.split("/").pop()));
  add("exactly one hero film variant was fetched", mp4s.length <= 1, mp4s.join(", "));
  add("hero film variant matches the viewport",
    mp4s.length === 1 && (p.vw < 768 ? mp4s[0].includes("720") : mp4s[0].includes("1280")),
    `${mp4s.join(",")} at ${p.vw}px · ${railClips.size} rule clips`);
  add("zero third-party requests",
    requests.filter((u) => !u.startsWith(BASE)).length === 0,
    requests.filter((u) => !u.startsWith(BASE)).slice(0, 2).join(" | "));

  if (!p.hover) {
    add("touch context reports no hover capability", p.hover === false && p.fine === false, `hover=${p.hover} fine=${p.fine}`);
    const paused = await page.evaluate(() => getComputedStyle(document.querySelector(".marquee__track")).animationPlayState);
    add("carousel still running under touch (no sticky-hover freeze)", paused === "running", paused);
    const btn = page.locator(".marquee-pause").first();
    if (await btn.isVisible().catch(() => false)) {
      await press(btn);
      await page.waitForTimeout(250);
      const st = await page.evaluate(() => ({
        pressed: document.querySelector(".marquee-pause").getAttribute("aria-pressed"),
        play: getComputedStyle(document.querySelector(".marquee__track")).animationPlayState,
      }));
      add("explicit pause control works on tap", st.pressed === "true" && st.play === "paused", JSON.stringify(st));
    }
  }

  add("reveals ended visible (nothing stuck at opacity 0)", p.revealMinOpacity > 0.9,
    `min ${p.revealMinOpacity} across ${p.revealCount} · ${p.revealStuck.join(" | ")}`);
  add("hero headline painted with real height", p.heroTitleHeight > 30, `${p.heroTitleHeight}px tall`);

  if (OUT) {
    await page.evaluate((y) => scrollTo(0, y), 0);
    await page.screenshot({ path: resolve(SHOTS, `${dev.name}-hero.png`) }).catch(() => {});
    shotCount++;
  }

  rows.push({ dev: dev.label, p, checks });
  allChecks.push(...checks.map((c) => ({ dev: dev.name, ...c })));
  await ctx.close();
}

/* ---------------- no-JS and reduced-motion contexts --------------------- */
const noJs = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, javaScriptEnabled: false });
const np = await noJs.newPage();
await np.goto(BASE, { waitUntil: "load" });
const nojs = await np.evaluate(() => {
  const vis = (el) => +getComputedStyle(el).opacity > 0.9 && el.getBoundingClientRect().height > 4;
  return {
    js: document.documentElement.classList.contains("js"),
    revealsVisible: [...document.querySelectorAll(".reveal, .media-reveal")].filter(vis).length,
    revealsTotal: document.querySelectorAll(".reveal, .media-reveal").length,
    faqOpen: [...document.querySelectorAll(".accordion__panel-inner")].filter((p) => p.getBoundingClientRect().height > 8).length,
    faqTotal: document.querySelectorAll(".accordion__panel-inner").length,
    h1: document.querySelector("h1")?.innerText.trim().slice(0, 40),
    scrollWidth: document.documentElement.scrollWidth, vw: innerWidth,
    panesVisible: [...document.querySelectorAll(".booking__pane")].filter(vis).length,
    navLinks: [...document.querySelectorAll(".nav-desktop__link")].filter(vis).length,
    credit: (document.querySelector(".footer__credit")?.textContent ?? "").replace(/\s+/g, " ").trim(),
    toggleVisible: (() => {
      const el = document.querySelector(".nav-mobile-toggle[data-menu-toggle]");
      return !!el && vis(el);
    })(),
  };
});
rows.push({
  dev: "JS DISABLED (390×844)", p: nojs, checks: [
    { name: "the .js gate is off, as designed", pass: nojs.js === false, detail: String(nojs.js) },
    { name: "ALL content visible without JavaScript", pass: nojs.revealsVisible === nojs.revealsTotal && nojs.revealsTotal > 20, detail: `${nojs.revealsVisible}/${nojs.revealsTotal} reveals` },
    { name: "a phone visitor can still navigate without JS", pass: nojs.navLinks >= 8, detail: `${nojs.navLinks} header links rendered` },
    { name: "the dead hamburger is not offered without JS", pass: nojs.toggleVisible === false, detail: `toggle visible=${nojs.toggleVisible}` },
    { name: "every FAQ answer readable without JS", pass: nojs.faqOpen === nojs.faqTotal, detail: `${nojs.faqOpen}/${nojs.faqTotal} panels` },
    { name: "booking form readable without JS", pass: nojs.panesVisible >= 4, detail: `${nojs.panesVisible} panes shown` },
    { name: "no horizontal overflow without JS", pass: nojs.scrollWidth <= nojs.vw + 1, detail: `${nojs.scrollWidth} vs ${nojs.vw}` },
    { name: "h1 still the same headline", pass: !!nojs.h1, detail: nojs.h1 ?? "" },
    // The credit is static markup rather than a registry-injected asset for
    // exactly this reason: a development credit that disappears when the bundle
    // 404s is not a credit. (The lazy mark may legitimately not have decoded
    // yet — this context never scrolls — so the text is what is asserted.)
    { name: "the development credit survives a broken bundle", pass: /^Powered by\s+CITYWINGS$/.test(nojs.credit), detail: `"${nojs.credit}"` },
  ],
});
await noJs.close();

const rm = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const rp = await rm.newPage();
await rp.goto(BASE, { waitUntil: "load" });
await rp.waitForTimeout(500);
const reduced = await rp.evaluate(() => ({
  anim: getComputedStyle(document.querySelector(".marquee__track")).animationName,
  reveals: [...document.querySelectorAll(".reveal")].every((el) => +getComputedStyle(el).opacity > 0.9),
  scrollWidth: document.documentElement.scrollWidth, vw: innerWidth,
  heroHeight: Math.round(document.querySelector(".hero").getBoundingClientRect().height),
}));
rows.push({
  dev: "REDUCED MOTION (375×667)", p: reduced, checks: [
    { name: "carousel drift disabled", pass: reduced.anim === "none", detail: reduced.anim },
    { name: "reveals fully visible", pass: reduced.reveals, detail: "" },
    { name: "wrapped carousel causes no horizontal overflow", pass: reduced.scrollWidth <= reduced.vw + 1, detail: `${reduced.scrollWidth} vs ${reduced.vw}` },
    { name: "hero keeps a full-height stage", pass: reduced.heroHeight >= 600, detail: `${reduced.heroHeight}px` },
  ],
});
await rm.close();

/* ---------------- report ------------------------------------------------- */
let fails = 0, total = 0;
for (const row of rows) {
  const dev = String(row.dev);
  console.log(`\n══ ${dev} ${"═".repeat(Math.max(0, 62 - dev.length))}`);
  for (const c of row.checks) {
    total++;
    if (!c.pass) fails++;
    console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  → ${c.detail}` : ""}`);
  }
}
console.log(`\n${"─".repeat(70)}`);
console.log(fails === 0
  ? `★ ${total} measured checks passed across ${rows.length} device profiles`
  : `✗ ${fails} of ${total} checks FAILED`);
if (OUT) console.log(`screenshots in ${SHOTS}/`);

await session.shutdown();
process.exitCode = fails ? 1 : 0;
