/**
 * INDEPENDENT responsive/touch auditor. Complements scripts/verify-seo.mjs:
 * the SEO gate proves what a crawler sees; this proves what a thumb gets.
 *
 *   npm run responsive:check          # after a build
 *
 * Every rule below was derived from a defect found by reading the shipped CSS:
 * if you delete the fix, this file should fail.
 */
import { readFileSync } from "node:fs";

const CSS = ["tokens", "fonts", "base", "components", "sections"].map((f) => ({
  file: `src/styles/${f}.css`,
  src: readFileSync(`src/styles/${f}.css`, "utf8"),
}));
const html = readFileSync("index.html", "utf8");
const rules = [];

/* --- tiny recursive CSS parser: strips comments, keeps @media preludes ----- */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ");
function parse(css, file, prelude = "", out = rules) {
  let i = 0;
  while (i < css.length) {
    const brace = css.indexOf("{", i);
    if (brace === -1) break;
    const header = css.slice(i, brace).trim();
    let d = 1, j = brace + 1;
    while (j < css.length && d > 0) {
      if (css[j] === "{") d++;
      else if (css[j] === "}") d--;
      j++;
    }
    const body = css.slice(brace + 1, j - 1);
    if (header.startsWith("@")) {
      const nested = prelude ? `${prelude} /*${header}*/` : header;
      if (!/@media/.test(header)) parse(body, file, prelude, out); // @keyframes/@supports etc.
      else parse(body, file, nested, out);
    } else if (header) {
      out.push({ selector: header.replace(/\s+/g, " "), prelude, body, file });
    }
    i = j;
  }
}
for (const { file, src } of CSS) parse(strip(src), file);

/* --- token table, so var(--dp-tap) can be compared to 44px ---------------- */
const tokens = {};
for (const m of CSS[0].src.matchAll(/(--[\w-]+):\s*([^;]+);/g)) tokens[m[1]] = m[2].trim();
const px = (v) => {
  if (!v) return null;
  let s = String(v).trim();
  const vr = /^var\((--[\w-]+)\)$/.exec(s);
  if (vr) return px(tokens[vr[1]]);
  const n = /^(-?[\d.]+)(px|rem)?$/.exec(s);
  if (!n) return null;
  return parseFloat(n[1]) * (n[2] === "rem" || !n[2] ? 16 : 1);
};

const results = [];
const check = (group, name, pass, detail = "") => results.push({ group, name, pass, detail });
const block = (sel) => rules.filter((r) => r.selector === sel || r.selector.split(",").map(s=>s.trim()).includes(sel));
const decls = (sel) => block(sel).map((r) => r.body).join("\n");
const has = (sel, re) => re.test(decls(sel));

/* ---------------- 1. viewport + device chrome ---------------------------- */
const vp = /<meta name="viewport" content="([^"]+)"/.exec(html)?.[1] ?? "";
check("Viewport", "width=device-width + initial-scale=1", /width=device-width/.test(vp) && /initial-scale=1/.test(vp), vp);
check("Viewport", "no user-scalable=no (pinch-zoom is a right, not a bug)", !/user-scalable\s*=\s*no|maximum-scale/.test(vp));
check("Viewport", "viewport-fit=cover so safe-area insets are non-zero", /viewport-fit=cover/.test(vp));
check("Viewport", "safe-area tokens exist", ["t", "r", "b", "l"].every((s) => /env\(safe-area-inset/.test(tokens[`--dp-safe-${s}`] ?? "")),
  `--dp-safe-t=${tokens["--dp-safe-t"]}`);

/* Fixed surfaces must respect the notch / home indicator. */
const fixed = rules.filter((r) => /position:\s*fixed/.test(r.body));
const unsafe = fixed.filter((r) => !/--dp-safe-/.test(r.body));
check("Viewport", `every position:fixed surface consumes a safe-area inset (${fixed.length} found)`,
  fixed.length >= 4 && unsafe.length === 0, unsafe.map((r) => r.selector).join(", "));
check("Viewport", "page gutter clears the landscape notch",
  /--dp-safe-l/.test(decls(".container")) && /--dp-safe-r/.test(decls(".container")));

/* ---------------- 2. viewport-unit discipline ---------------------------- */
const svhWithoutFallback = rules.filter((r) => {
  const heights = [...r.body.matchAll(/(?:min-|max-)?height:\s*([^;]+)/g)].map((m) => m[1]);
  const i = heights.findIndex((v) => /\bsvh\b/.test(v));
  if (i === -1) return false;
  // cascade requires the vh line to come first, and min(72vh, 620px) counts
  return !heights.slice(0, i).some((v) => /\d(?:\.\d+)?vh\b/.test(v));
});
check("Viewport", "every svh declaration is paired with a vh fallback line",
  svhWithoutFallback.length === 0, svhWithoutFallback.map((r) => r.selector).join(", "));
check("Viewport", "hero holds full-bleed height on pre-svh engines",
  /min-height:\s*100vh/.test(decls(".hero")) && /min-height:\s*100svh/.test(decls(".hero")));

/* ---------------- 3. touch: hover is not a state on glass ---------------- */
const hoverPausers = rules.filter((r) => /:hover/.test(r.selector) && /animation-play-state/.test(r.body) && !/@media[^]*hover/.test(r.prelude));
const hoverPausersGuarded = rules.filter((r) => /:hover/.test(r.selector) && /animation-play-state/.test(r.body) && /\(hover:/.test(r.prelude));
check("Touch", "no carousel pause is hover-only (sticky :hover freezes them on tap)",
  hoverPausers.length === 0 && hoverPausersGuarded.length >= 2,
  `${hoverPausersGuarded.length} guarded, ${hoverPausers.length} ungated`);
check("Touch", "both auto-moving rails ship an aria-pressed pause control",
  (html.match(/class="marquee-pause"[^>]*aria-pressed="false"/g) || []).length === 2);
check("Touch", "tap-highlight removed only because press states exist",
  /-webkit-tap-highlight-color:\s*transparent/.test(decls("html") + CSS[2].src) && /:active/.test(CSS[4].src));
check("Touch", "double-tap zoom delay disabled on interactive elements",
  /touch-action:\s*manipulation/.test(strip(CSS[2].src)));

/* ---------------- 4. tap targets ----------------------------------------- */
const TAP = {
  ".btn": "min-height", ".input": "min-height", ".select": "min-height", ".textarea": "min-height",
  ".option": "min-height", ".accordion__trigger": "min-height", ".social-link": "width",
  ".nav-mobile-toggle": "width", ".marquee-pause": "width", ".rail-btn": "width",
};
for (const [sel, prop] of Object.entries(TAP)) {
  const body = decls(sel);
  const m = new RegExp(`${prop}:\\s*([^;]+)`).exec(body);
  const size = m ? px(m[1]) : null;
  check("Touch", `${sel} tap target >= 44px`, size !== null && size >= 44, m ? `${m[1].trim()} = ${size}px` : "no explicit size");
}

/* ---------------- 5. overflow discipline --------------------------------- */
const wide = rules.filter((r) => {
  const m = /min-width:\s*(\d{3,})px/.exec(r.body);
  return m && +m[1] > 320;
});
const wideOk = wide.every((r) => /\.rates|^\.lane|^\.marquee__card|\.fee-table\b/.test(r.selector));
check("Overflow", "sub-320px blocks exist only inside horizontally scrollable wrappers",
  wideOk, wide.map((r) => `${r.selector} ${/min-width:\s*(\d+)px/.exec(r.body)[1]}px`).join(", "));
check("Overflow", "the rates table wrapper scrolls on touch",
  /overflow-x:\s*auto/.test(decls(".fee-table-wrapper")) && /-webkit-overflow-scrolling/.test(decls(".fee-table-wrapper")));
check("Overflow", "scrollable table region is keyboard reachable (WCAG 2.1.1)",
  /class="fee-table-wrapper"[^>]*tabindex="0"/.test(html) && /role="region"/.test(html));
/* nowrap is forbidden for running text — it is how narrow screens get pushed wide.
   The brand lockup is the deliberate exception: two fixed words, sized by
   measurement (`.fit` at 320px: label 146px inside 202px of lockup against 288px
   available), and the alternative is worse — a shrinkable flex item silently
   wrapped "DRIVING CENTER" into a third line of brand in an 80px header, with no
   overflow for any gate to see. If the lockup ever does run out of room, the
   device audit fails on real horizontal overflow, so the failure stays loud. */
const nowrapRisky = rules.filter(
  (r) => /white-space:\s*nowrap/.test(r.body) && !/\.visually-hidden|\.rates|\.marquee__|\.logo__name|\.logo__sub|\.hero__greeting|\.fee-row__fee|\.fee-item__price|\.fee-table__|\.fee-table th|\.fee-table td|\.fees__tab/.test(r.selector)
);
check("Overflow", "no nowrap outside SR-only text, the scrollable table, or the brand lockup",
  nowrapRisky.length === 0, nowrapRisky.map((r) => r.selector).join(", "));
check("Overflow", "media overlays can never widen the page",
  /max-width:\s*100%/.test(strip(CSS[2].src)) && /box-sizing:\s*border-box/.test(strip(CSS[2].src)));

/* ---------------- 6. the full-screen menu -------------------------------- */
check("Menu", "mobile menu scrolls when its 8 display-size links outgrow the viewport",
  /overflow-y:\s*auto/.test(decls(".mobile-menu")), "");
check("Menu", "menu scroll does not chain into the page behind it",
  /overscroll-behavior:\s*contain/.test(decls(".mobile-menu")));
check("Menu", "menu is inset-bounded, not vh-sized (it tracks the URL bar automatically)",
  /inset:\s*0/.test(decls(".mobile-menu")) && !/(?:^|;)\s*(?:min-|max-)?height:/.test(decls(".mobile-menu")));
/* Navigation must exist at every width: toggle below the desktop breakpoint.
   Only one *conditional* hide is allowed; the `html:not(.js)` rule is the
   documented fail-open swap (overlay → header list) and is checked for
   completeness below, then asserted live in the JS-disabled browser profile. */
const toggleHides = rules.filter((r) => /\.nav-mobile-toggle/.test(r.selector) && /display:\s*none/.test(r.body));
const mediaHides = toggleHides.filter((r) => r.prelude);
check("Menu", "no navigation dead band between tablet and desktop",
  mediaHides.length === 1 && /\(min-width: 64em\)/.test(mediaHides[0].prelude),
  mediaHides.map((r) => r.prelude).join(" "));
check("Menu", "without JS the toggle is dropped *and* the real link list is shown",
  toggleHides.some((r) => !r.prelude && /html:not\(\.js\)/.test(r.selector)) &&
    rules.some((r) => /html:not\(\.js\)[^{]*\.nav-desktop\b/.test(r.selector) && /display:\s*block/.test(r.body)),
  `${toggleHides.length} toggle hides`);

/* ---------------- 7. the fixed contact rail ------------------------------ */
/* The requirement is that the two icons float at one point on the page and no
   amount of scrolling changes that. "Fixed" here is therefore load-bearing, so
   it is asserted four ways: the declaration, nothing hiding it at any width,
   nothing animating its position, and the safe-area insets it must respect. */
const railRules = rules.filter((r) => /\.contact-rail\b|\.rail-btn\b/.test(r.selector));
const railHidden = railRules.filter((r) => r.prelude && /display:\s*none/.test(r.body));
check("Layout", "contact rail is position: fixed, so scroll cannot move it",
  /position:\s*fixed/.test(decls(".contact-rail")));
check("Layout", "nothing hides the contact rail at any width",
  railHidden.length === 0, railHidden.map((r) => r.prelude).join(" "));
check("Layout", "no transition may animate the rail's position",
  railRules.every((r) => !/transition:[^;]*(top|right|bottom|left|inset)/.test(r.body)));
check("Layout", "contact rail is inset by the safe areas (not under the home indicator)",
  /--dp-safe-b/.test(decls(".contact-rail")) && /--dp-safe-r/.test(decls(".contact-rail")));
check("Layout", "toast region reserves the rail's full height on phones",
  rules.some((r) => /\.toast-region/.test(r.selector) && /--dp-rail-h/.test(r.body)) &&
    rules.some((r) => /\.toast-region/.test(r.selector) && /--dp-rail-h/.test(r.body) && /max-width/.test(r.prelude)));

/* ---------------- 7b. development credit --------------------------------- */
/* "Powered by [mark] CITYWINGS" is a client requirement and a contrast
   requirement. Both are one careless footer edit from being lost, and contrast
   is arithmetic, so it is computed here from the tokens instead of trusted. */
const srgbToLin = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
const luminance = (c) => 0.2126 * srgbToLin(c[0]) + 0.7152 * srgbToLin(c[1]) + 0.0722 * srgbToLin(c[2]);
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const toRgb = (v) => {
  const s = String(v).trim();
  const hex = /^#([\da-f]{6})$/i.exec(s);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const fn = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,]+([\d.]+))?\s*\)/.exec(s);
  return fn ? [+fn[1], +fn[2], +fn[3], fn[4] === undefined ? 1 : +fn[4]] : null;
};
const resolveColor = (v) => {
  const ref = /^var\((--[\w-]+)\)$/.exec(String(v).trim());
  return toRgb(ref ? tokens[ref[1]] : v);
};
/* An alpha colour is painted over the footer, so the pair that must clear 4.5:1
   is the composited result, not the raw rgba() string. */
const over = (fg, bg) => (fg.length > 3 ? [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])) : fg);

const navy = toRgb(tokens["--dp-navy-900"] ?? "");
const declColor = (sel) => /color:\s*([^;]+)/.exec(decls(sel))?.[1]?.trim() ?? "";
const creditOn = (sel) => {
  const c = resolveColor(declColor(sel));
  return c && navy ? contrast(over(c, navy), navy) : 0;
};

check("Credit", "the credit reserves the rail's footprint instead of its own row",
  has(".footer__credit", /margin-inline-end:\s*calc\(var\(--dp-fab-size\)/));
/* Count what a visitor sees, not what the source says about itself: this file's
   own explanatory comments quote the very strings being checked for. */
const rendered = html.replace(/<!--[\s\S]*?-->/g, " ");
check("Credit", "the footer carries exactly one 'Powered by' (the credit replaced the tagline)",
  (rendered.match(/Powered by/g) || []).length === 1 && !/Precision in every pixel/.test(rendered),
  `${(rendered.match(/Powered by/g) || []).length} visible occurrence(s)`);
check("Credit", "the CITYWINGS word uses the white token",
  /var\(--dp-white\)/.test(declColor(".footer__credit-word")), declColor(".footer__credit-word"));
check("Credit", "CITYWINGS clears 4.5:1 against the footer ground",
  creditOn(".footer__credit-word") >= 4.5, `${creditOn(".footer__credit-word").toFixed(1)}:1 on ${tokens["--dp-navy-900"]}`);
check("Credit", "the muted footer base line clears 4.5:1 too",
  creditOn(".footer__base") >= 4.5,
  `${declColor(".footer__base")} = ${creditOn(".footer__base").toFixed(2)}:1 (0.45 alpha measured 4.43 — under AA)`);
const markSize = px(/width:\s*([^;]+)/.exec(decls(".footer__credit-mark"))?.[1]);
check("Credit", "the mark renders large enough to identify (≥16px)", markSize !== null && markSize >= 16, `${markSize}px`);
check("Credit", "the mark has intrinsic size in the HTML (no layout shift)",
  /class="footer__credit-mark"[^>]*width="96"/.test(html) && /class="footer__credit-mark"[^>]*height="96"/.test(html));

/* ---------------- 7c. the inline critical CSS is a mirror ------------------ */
/* index.html repeats the logo rules verbatim because the stylesheet has not
   arrived at first paint. Any value that differs is a visible jump: the mark
   resizes, or the wordmark paints in browser-default link blue on navy. Hand
   copies drift, so the copy is compared to the original on every run. */
const inlineCss = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
const inlineRules = [];
parse(strip(inlineCss), "index.html <style>", "", inlineRules);

const resolve = (v) => {
  let s = String(v).trim();
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 10) {
    changed = false;
    s = s.replace(/var\((--[\w-]+)\)/g, (_, name) => {
      changed = true;
      return tokens[name] ?? `var(${name})`;
    });
  }
  return s;
};
const norm = (v) => resolve(v).replace(/["']/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const same = (a, b) => {
  const pa = px(resolve(a)), pb = px(resolve(b));
  if (pa !== null && pb !== null) return pa === pb;
  return norm(a) === norm(b);
};
const baseDecl = (list, sel) =>
  list.filter((r) => !r.prelude && r.selector.split(",").map((s) => s.trim()).includes(sel)).map((r) => r.body).join("\n");
const prop = (body, p) => {
  const m = new RegExp(`(?:^|[;{])\\s*${p}\\s*:\\s*([^;}]+)`).exec(body);
  return m ? m[1].trim() : null;
};
const LOGO_CONTRACT = {
  ".logo": ["display", "align-items", "gap", "text-decoration", "color"],
  ".logo__picture": ["display"],
  ".logo__mark": ["width", "height", "flex", "border-radius", "border"],
  ".logo__word": ["display", "flex-direction", "line-height"],
  ".logo__name": ["font-family", "font-weight", "font-size", "letter-spacing", "text-transform", "color", "text-shadow"],
  ".logo__sub": ["font-family", "font-weight", "font-size", "letter-spacing", "text-transform", "color", "text-shadow"],
};
check("Critical CSS", "the logo contract still has all six selectors in the stylesheet",
  Object.keys(LOGO_CONTRACT).filter((s) => baseDecl(rules, s)).length === 6,
  Object.keys(LOGO_CONTRACT).filter((s) => baseDecl(rules, s)).join(", "));
for (const [sel, props] of Object.entries(LOGO_CONTRACT)) {
  const sheet = baseDecl(rules, sel), mirror = baseDecl(inlineRules, sel);
  const drift = [];
  for (const p of props) {
    const want = prop(sheet, p);
    if (want === null) continue; // nothing declared in the original: nothing to mirror
    const got = prop(mirror, p);
    if (got === null) drift.push(`${p} missing (sheet: ${want})`);
    else if (!same(want, got)) drift.push(`${p}: inline ${got} ≠ sheet ${want}`);
  }
  check("Critical CSS", `the inline copy of ${sel} matches the stylesheet`, drift.length === 0, drift.join(" · "));
}

/* Media-scoped logo rules must be mirrored as well: the small-phone tier exists
   precisely so 320px does not reflow, and a first paint that then jumps when
   components.css lands is the same defect wearing a different hat. */
const declPairs = (body) => [...body.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/g)].map((m) => [m[1].trim(), m[2].trim()]);
const selIn = (selector) => Object.keys(LOGO_CONTRACT).filter((s) => selector.split(",").map((x) => x.trim()).includes(s));
const flat = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const mediaDrift = [];
let mediaSeen = 0;
for (const r of rules.filter((x) => x.prelude)) {
  for (const sel of selIn(r.selector)) {
    mediaSeen++;
    const twin = inlineRules
      .filter((x) => x.prelude && flat(x.prelude) === flat(r.prelude) && selIn(x.selector).includes(sel))
      .map((x) => x.body).join("\n");
    for (const [p, v] of declPairs(r.body)) {
      const got = prop(twin, p);
      if (got === null) mediaDrift.push(`${flat(r.prelude)} ${sel} { ${p} } missing inline`);
      else if (!same(v, got)) mediaDrift.push(`${flat(r.prelude)} ${sel} ${p}: inline ${got} ≠ sheet ${v}`);
    }
  }
}
check("Critical CSS", "media-scoped logo rules are mirrored inline too", mediaDrift.length === 0,
  mediaDrift.length ? mediaDrift.join(" · ") : `${mediaSeen} media-scoped logo rule(s) compared`);

/* ---------------- 8. type + fluid scale --------------------------------- */

const tiny = rules.filter((r) => {
  const m = /font-size:\s*([^;]+)/.exec(r.body);
  if (!m) return false;
  const v = px(m[1].replace(/var\((--[\w-]+)\)/, (_, t) => tokens[t]));
  return v !== null && v < 12;
});
check("Type", "nothing renders below the 12px legibility floor",
  tiny.length === 0, tiny.map((r) => `${r.selector} ${/font-size:\s*([^;]+)/.exec(r.body)[1]}`).join(", "));
const fluid = ["--dp-text-display", "--dp-text-h1", "--dp-text-h2", "--dp-text-h3", "--dp-gutter", "--dp-section-pad"];
check("Type", "display/gutter/section scales are fluid (clamp), not stepped",
  fluid.every((t) => /^clamp\(/.test(tokens[t] ?? "")), fluid.map((t) => `${t}=${tokens[t]}`).join("  ").slice(0, 90));
check("Type", "form controls stay at 16px so iOS does not zoom on focus",
  px(tokens["--dp-text-body"]) >= 16 && /font:\s*inherit/.test(strip(CSS[2].src)) && !/\.input[\s\S]{0,400}font-size:\s*(?:0\.\d+|\d+px)/.test(decls(".input")));
check("Type", "long unbreakable strings wrap (email, URLs)",
  /overflow-wrap:\s*break-word/.test(strip(CSS[2].src)));

/* ---------------- 9. breakpoints are em-based ---------------------------- */
const pxQueries = [...CSS.map((c) => [...c.src.matchAll(/@media[^{]*/g)].map((m) => m[0]))]
  .flat()
  .filter((m) => /\(\s*(min|max)-width:\s*\d+px/.test(m));
check("Breakpoints", "media queries use em, so browser zoom cannot miss them",
  pxQueries.length === 0, pxQueries.join(" | "));
const declaredBps = [...new Set([...CSS.map((c) => [...c.src.matchAll(/@media[^{]*?width:\s*([\d.]+)em/g)].map((m) => +m[1]))].flat())].sort((a, b) => a - b);
check("Breakpoints", "tablet band (48–64em) is designed for, not inherited",
  declaredBps.includes(48) && declaredBps.includes(64), `${declaredBps.join(", ")} em`);

/* ---------------- 10. LCP ladder serves phones a smaller file ------------ */
const preload = /<link rel="preload" as="image"[^>]*>/.exec(html)?.[0] ?? "";
// The <source> element is wrapped across lines, so [^>]* has to span newlines.
const picSource = /<source[^>]*type="image\/avif"[^>]*srcset="([^"]+)"[^>]*sizes="([^"]+)"/.exec(html);
const candidates = (s) =>
  (s ?? "").split(",").map((p) => p.trim().replace(/\s+/g, " ")).filter(Boolean).sort().join("|");
check("Mobile LCP", "hero image preload carries imagesrcset + imagesizes",
  /imagesrcset=/.test(preload) && /imagesizes=/.test(preload));
check("Mobile LCP", "preload candidate list matches the <picture> exactly",
  !!picSource &&
    candidates(/imagesrcset="([^"]+)"/.exec(preload)?.[1]) === candidates(picSource[1]) &&
    /imagesizes="([^"]+)"/.exec(preload)?.[1] === picSource[2],
  `${candidates(/imagesrcset="([^"]+)"/.exec(preload)?.[1])}  vs  ${candidates(picSource?.[1])}`);
check("Mobile LCP", "a 900w poster exists for small viewports",
  /hero-fallback-900\.avif 900w/.test(html));

/* --- report -------------------------------------------------------------- */
const byGroup = [...new Set(results.map((r) => r.group))];
let fails = 0;
for (const g of byGroup) {
  console.log(`\n── ${g} ${"─".repeat(58 - g.length)}`);
  for (const r of results.filter((x) => x.group === g)) {
    if (!r.pass) fails++;
    console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  → ${r.detail}` : ""}`);
  }
}
console.log(`\n── Parsed ${rules.length} CSS rule blocks across ${CSS.length} stylesheets`);
console.log(fails === 0
  ? `★ ALL ${results.length} RESPONSIVE/TOUCH CHECKS PASSED`
  : `✗ ${fails} of ${results.length} CHECKS FAILED`);
process.exitCode = fails ? 1 : 0;
