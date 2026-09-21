/**
 * ATABUL DRIVING CENTER — BUILD-TIME SEO PLUGIN
 * -------------------------------------------------------------------------
 * Turns src/seo/* into deploy artifacts with zero runtime cost:
 *
 *  transformIndexHtml → injects <title>, meta description, canonical, OG/Twitter,
 *                       the visible FAQ accordion and the JSON-LD @graph.
 *                       Runs in dev too, so http://localhost:5173 is identical.
 *  configureServer    → serves /robots.txt and /sitemap.xml from the same
 *                       builders the build uses (dev/prod parity, no drift).
 *  generateBundle     → emits dist/robots.txt + dist/sitemap.xml.
 *  writeBundle        → audits the REAL artifact on disk and fails the build.
 *
 * Nothing here ships to the browser: no JS runs at page load for SEO, which is
 * the whole reason this codebase is crawlable without JavaScript.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";

import {
  absoluteUrl,
  business,
  faqs,
  instructor,
  meta,
  resolveOrigin,
  ruleClips,
  social,
} from "../../src/seo/site";
import { buildGraph, serializeJsonLd, type Json } from "../../src/seo/schema";
import { escapeHtml, renderFaqItems, renderHead, renderRobotsTxt, renderSitemapXml } from "../../src/seo/render";
import { CONTACT, waHref } from "../../src/config/contact";

export type SeoPluginOptions = {
  /** Canonical site origin, e.g. https://your-domain.in (no trailing slash). */
  siteUrl?: string;
  /**
   * ISO date (YYYY-MM-DD) for sitemap <lastmod>. Opt-in on purpose: a timestamp
   * that moves every deploy teaches Google to ignore the field. Wire it to the
   * commit date in CI — never to the build time.
   */
  buildDate?: string;
  /** Fail the build on the first audit error (default) or only warn. */
  strict?: boolean;
};

/** Markers in index.html this plugin replaces. All seven must be present. */
const MARKERS = {
  title: "<!-- SEO:TITLE -->",
  description: "<!-- SEO:DESCRIPTION -->",
  head: "<!-- SEO:HEAD -->",
  faq: "<!-- SEO:FAQ_ITEMS -->",
  jsonld: "<!-- SEO:JSONLD -->",
  credentials: "<!-- SEO:INSTRUCTOR_CREDENTIALS -->",
  railWaHref: "<!-- SEO:RAIL_WA_HREF -->",
} as const;

/** Copy that must never reach a production artifact. */
const PLACEHOLDER_PATTERNS = [
  /\[to be confirmed\]/i,
  /\bTODO\b/,
  /\bFIXME\b/,
  /lorem ipsum/i,
];

/** Performance budgets (raw KB). These are the SEO-visible ones: LCP + render. */
const BUDGETS = {
  "hero-fallback.avif": 80,
  "hero-fallback-900.avif": 50,
  "hero-fallback.webp": 120,
  "hero-fallback-900.webp": 80,
  "hero-fallback.jpg": 240,
  entryJs: 60,
  entryCss: 60,
  html: 140,
} as const;

/**
 * Read a video-track duration (seconds) from an MP4's first `mdhd` box — no
 * ffprobe dependency, same technique as scripts/optimize-media.mjs. Used to
 * emit a factual VideoObject.duration instead of an invented uploadDate.
 */
function mp4DurationSeconds(file: string): number | null {
  try {
    const buf = readFileSync(file);
    const idx = buf.indexOf(Buffer.from("mdhd"));
    if (idx === -1) return null;
    const box = idx - 4;
    const version = buf[box + 8];
    const read =
      version === 1
        ? {
            ts: buf.readUInt32BE(box + 8 + 4 + 16),
            dur: Number(buf.readBigUInt64BE(box + 8 + 4 + 20)),
          }
        : {
            ts: buf.readUInt32BE(box + 8 + 4 + 8),
            dur: buf.readUInt32BE(box + 8 + 4 + 12),
          };
    if (!read.ts) return null;
    return read.dur / read.ts;
  } catch {
    return null;
  }
}

function walkFiles(root: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const abs = join(root, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(abs).isDirectory()) out.push(...walkFiles(abs, rel));
    else out.push(rel);
  }
  return out;
}

export function seoPlugin(options: SeoPluginOptions = {}): Plugin {
  const strict = options.strict ?? true;
  let config: ResolvedConfig;
  let origin = resolveOrigin(options.siteUrl);
  let lastModified: string | undefined = isValidIsoDate(options.buildDate)
    ? options.buildDate
    : undefined;

  function isValidIsoDate(value: string | undefined): value is string {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function ruleDurations(): Record<string, number> {
    const dir = join(config?.root ?? process.cwd(), "public", "rules");
    const found: Record<string, number> = {};
    for (const clip of ruleClips) {
      const seconds = mp4DurationSeconds(join(dir, `${clip.file}.mp4`));
      if (seconds && seconds > 0) found[clip.file] = seconds;
    }
    return found;
  }

  const jsonLd = () => serializeJsonLd(buildGraph({ origin, ruleDurations: ruleDurations(), lastModified }));

  /** Un-escape the \u00XX protection applied by serializeJsonLd. */
  const parseJsonLd = (raw: string): Json =>
    JSON.parse(raw.replace(/\\u00([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )) as Json;

  return {
    name: "atabul:seo",
    enforce: "post",

    configResolved(resolved) {
      config = resolved;
      if (isValidIsoDate(options.buildDate)) lastModified = options.buildDate;
      else if (isValidIsoDate(process.env.VITE_BUILD_DATE)) lastModified = process.env.VITE_BUILD_DATE;
      else lastModified = undefined;
      if (!lastModified && process.env.CI) {
        console.warn(
          "[seo] no VITE_BUILD_DATE — sitemap.xml is emitted without <lastmod>. " +
            "Set it from the commit date in CI: git log -1 --format=%cd --date=short"
        );
      }
    },

    transformIndexHtml(html) {
      const { title, description } = meta();
      const railWaHref = waHref();
      const out = html
        .replace(MARKERS.title, `<title>${escapeHtml(title)}</title>`)
        .replace(MARKERS.description, `<meta name="description" content="${escapeHtml(description)}" />`)
        .replace(MARKERS.head, renderHead({ origin, lastModified }))
        .replace(MARKERS.faq, renderFaqItems())
        .replace(MARKERS.credentials, escapeHtml(instructor.credentials))
        .replace(MARKERS.jsonld, `<script type="application/ld+json">\n${jsonLd()}\n    </script>`)
        .replace(MARKERS.railWaHref, railWaHref);

      const missing = Object.entries(MARKERS).filter(([, marker]) => !html.includes(marker));
      if (missing.length) {
        throw new Error(
          `[seo] index.html is missing marker(s): ${missing.map(([name]) => name).join(", ")}. ` +
            `All ${Object.keys(MARKERS).length} SEO markers must be present exactly once — see vite/plugins/seo.ts.`
        );
      }
      return out;
    },

    configureServer(server: ViteDevServer) {
      // Dev parity: identical strings on identical paths to what dist/ gets.
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (path !== "/robots.txt" && path !== "/sitemap.xml") return next();
        const robots = path === "/robots.txt";
        res.setHeader(
          "Content-Type",
          robots ? "text/plain; charset=utf-8" : "application/xml; charset=utf-8"
        );
        res.end(robots ? renderRobotsTxt({ origin, lastModified }) : renderSitemapXml({ origin, lastModified }));
      });
    },

    generateBundle(_options, _bundle, isWrite) {
      if (!isWrite) return;
      this.emitFile({ type: "asset", fileName: "robots.txt", source: renderRobotsTxt({ origin, lastModified }) });
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: renderSitemapXml({ origin, lastModified }),
      });
    },

    async writeBundle(bundleOptions) {
      const outDir = resolve(bundleOptions.dir ?? "dist");
      const htmlFile = join(outDir, "index.html");
      if (!existsSync(htmlFile)) return this.error("[seo] dist/index.html is missing — nothing to audit.");
      const html = readFileSync(htmlFile, "utf8");

      const errors: string[] = [];
      const warnings: string[] = [];
      const metrics: string[] = [];
      const fail = (msg: string) => errors.push(msg);

      /* --- indexability: missing or wrong here costs real rankings -------- */

      if (!/^https?:\/\//.test(origin)) fail(`origin "${origin}" is not an absolute http(s) URL`);
      if (html.includes("SEO:")) fail("unreplaced SEO marker survived into the artifact");

      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
      if (!title) fail("no <title> in the built HTML");
      else if (title.length < 30 || title.length > 65)
        fail(`title is ${title.length} chars, outside the 30–65 SERP budget: "${title}"`);

      const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "";
      if (!description) fail("no meta description in the built HTML");
      else if (description.length < 50 || description.length > 170)
        fail(`meta description is ${description.length} chars (Google truncates ~160); budget 50–170`);

      const h1s = html.match(/<h1[\s>]/g) ?? [];
      if (h1s.length !== 1) fail(`expected exactly one <h1>, found ${h1s.length}`);

      const lang = /<html[^>]*\blang="([^"]+)"/.exec(html)?.[1];
      if (!lang) fail("<html> has no lang attribute");
      else if (!lang.toLowerCase().startsWith("en"))
        warnings.push(`lang="${lang}" while og:locale=${social.locale} and the copy is English`);

      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
      if (!canonical) fail("missing <link rel=canonical>");
      else if (canonical !== `${origin}/`)
        fail(`canonical "${canonical}" does not match resolved origin "${origin}/"`);

      for (const prop of ["og:url", "og:image", "og:title", "og:description", "twitter:card", "twitter:image"]) {
        const value = new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`).exec(html)?.[1];
        if (value === undefined) {
          fail(`missing <meta ${prop}>`);
          continue;
        }
        if (prop.includes("image") || prop === "og:url") {
          if (!/^https?:\/\//.test(value))
            fail(`${prop}="${value}" is relative — Facebook/WhatsApp/LinkedIn crawlers will not resolve it`);
          else if (!value.startsWith(origin)) fail(`${prop}="${value}" is off-origin (${origin})`);
        }
      }

      const ogTarget = social.imagePath.replace(/^\.?\//, "");
      if (!existsSync(join(outDir, ogTarget))) fail(`og:image target is not in dist: ${ogTarget}`);

      /* --- social coherence: every visible icon is an entity signal ------ */

      const visibleSocial = [...html.matchAll(/<a class="social-link" href="([^"]+)"/g)].map((m) => m[1]);
      const declared: string[] = [...business.sameAs];
      const missingFromSchema = visibleSocial.filter((u) => !declared.includes(u));
      const missingFromPage = declared.filter((u) => !visibleSocial.includes(u));
      if (missingFromSchema.length)
        fail(
          `visible social link(s) are not in business.sameAs, so they build no entity graph: ` +
            missingFromSchema.join(", ") +
            ` — add them in src/seo/site.ts`
        );
      if (missingFromPage.length)
        fail(
          `business.sameAs declares profile(s) with no visible icon (unverifiable entity claim): ` +
            missingFromPage.join(", ")
        );

      /* --- contact actions: the fixed rail must really reach the business ---
         A "call" button that dials a stale number, or a WhatsApp button that
         opens someone else's chat, is worse than no button: the visitor trusts
         it enough to leave the page. Every tel: on the page and both rail
         actions are compared against the one source of truth. */

      const telNumbers = [...new Set([...html.matchAll(/href="tel:([^"]+)"/g)].map((m) => m[1]))];
      if (!telNumbers.length) fail('no href="tel:…" anywhere — the fixed call button cannot place a call');
      // Two numbers are published deliberately — the contact section labels the
      // second as driver-service enquiries. Anything outside that pair is drift.
      const sanctioned = new Set([CONTACT.phone, CONTACT.driverServicePhone]);
      const staleTel = telNumbers.filter((n) => !sanctioned.has(n));
      if (staleTel.length)
        fail(
          `tel: href(s) match no number in src/config/contact.ts: ${staleTel.join(", ")} ` +
            `— a phone tap would dial the wrong line`
        );
      if (business.telephone !== CONTACT.phone)
        fail(`JSON-LD telephone (${business.telephone}) differs from CONTACT.phone (${CONTACT.phone})`);
      if (CONTACT.whatsappNumber !== CONTACT.phone.replace(/^\+/, ""))
        fail(`CONTACT.whatsappNumber (${CONTACT.whatsappNumber}) is not CONTACT.phone without the plus`);

      const railButtons = [...html.matchAll(/<a\s+class="rail-btn rail-btn--(wa|call)"[\s\S]*?>/g)].map((m) => ({
        kind: m[1],
        tag: m[0],
        href: /href="([^"]+)"/.exec(m[0])?.[1] ?? "",
      }));
      if (railButtons.length !== 2)
        fail(`the fixed rail needs exactly two buttons (call + wa), found ${railButtons.length}`);
      for (const want of ["call", "wa"] as const) {
        const btn = railButtons.find((b) => b.kind === want);
        if (!btn) {
          fail(`the fixed contact rail has no .rail-btn--${want}: no ${want} action without scrolling for it`);
          continue;
        }
        if (want === "call") {
          if (btn.href !== `tel:${CONTACT.phone}`)
            fail(`rail call href is "${btn.href}", expected "tel:${CONTACT.phone}"`);
          continue;
        }
        const base = `https://wa.me/${CONTACT.whatsappNumber}?text=`;
        if (!btn.href.startsWith(base)) {
          fail(`rail WhatsApp href must start with "${base}", got "${btn.href}"`);
        } else if (btn.href !== waHref()) {
          // Exact equality, not "starts with": the rail href is a hand-written
          // literal in index.html while the message is owned by
          // src/config/contact.ts. A copy edit or a rename that reaches one and
          // not the other sends every visitor a stale first message, and nothing
          // else in the stack would ever notice.
          fail(
            `the rail's pre-filled message no longer matches src/config/contact.ts\n` +
            `     page: ${decodeURIComponent(btn.href.slice(base.length))}\n` +
            `  contact: ${CONTACT.enquiryMessage}`,
          );
        } else if (!decodeURIComponent(btn.href.slice(base.length)).trim()) {
          fail("rail WhatsApp link carries an empty pre-filled message — the chat opens blank");
        }
        if (!/target="_blank"/.test(btn.tag)) fail('rail WhatsApp link needs target="_blank" so the page survives the handoff');
        if (!/rel="[^"]*noopener/.test(btn.tag)) fail('rail WhatsApp link needs rel="noopener"');
      }

      /* --- development credit: "Powered by [mark] CITYWINGS" -----------------
         Supplied asset, supplied order, supplied wording — all three are easy to
         lose in a later footer edit, and the mark is a 1 MB master one careless
         copy away from wrecking the page weight this build polices. */
      const CREDIT_BUDGET_KB = 8;
      const credit = /<p class="footer__credit">[\s\S]*?<\/p>/.exec(html)?.[0] ?? "";
      if (!credit) {
        fail('the footer has no <p class="footer__credit"> — the "Powered by CITYWINGS" credit is required');
      } else {
        const markIdx = credit.indexOf('<img class="footer__credit-mark"');
        const wordIdx = credit.indexOf('class="footer__credit-word"');
        if (markIdx < 0) fail("the credit needs the CITYWINGS mark as <img class=\"footer__credit-mark\">");
        if (wordIdx < 0) fail('the credit needs the word as <span class="footer__credit-word">');
        if (markIdx >= 0 && wordIdx >= 0 && markIdx > wordIdx)
          fail("the credit must place the logo *before* the word — that order was specified");
        if (!/Powered by/.test(credit)) fail('the credit must read "Powered by" ahead of the logo');
        if (!/>CITYWINGS</.test(credit)) fail("the credit word must be exactly CITYWINGS");
        // alt="" is deliberate: the adjacent word names the company, so the image
        // is redundant to a screen reader — and an empty alt degrades to text-only
        // rather than a broken-icon box if the file ever fails to decode.
        if (!/alt=""/.test(credit)) fail('the credit mark needs alt="" (the word carries the name)');
        if (!/width="96"[^>]*height="96"|height="96"[^>]*width="96"/.test(credit))
          fail("the credit mark needs explicit width/height so the footer cannot shift while it loads");
        const src = /class="footer__credit-mark" src="([^"]+)"/.exec(credit)?.[1];
        if (!src) {
          fail("the credit mark needs a src");
        } else {
          const rel = src.replace(/^\.?\//, "");
          const file = join(outDir, rel);
          if (!existsSync(file))
            fail(`the credit mark is missing from dist: /${rel} — regenerate with npm run optimize:brand`);
          else {
            const kb = statSync(file).size / 1024;
            if (kb > CREDIT_BUDGET_KB)
              fail(`the credit mark is ${kb.toFixed(1)} KB, over its ${CREDIT_BUDGET_KB} KB budget (ship the resampled mark, never the ${basename(src)} master)`);
          }
        }
      }

      /* --- brand-name coherence ----------------------------------------------
          src/seo/site.ts owns the name. index.html then repeats it as literals:
          split across the two wordmark lines, the copyright line, the hero
          eyebrow, the instructor badge, five aria-labels and the rail group.
          None of those reach the schema, so a rename that lands partially simply
          looks wrong — and this is the check that catches it at build time. */
      const wm = /<span class="logo__name">([^<]+)<\/span>\s*<span class="logo__sub">([^<]+)<\/span>/.exec(html);
      if (!wm) {
        fail("no .logo__name + .logo__sub pair to compare against the declared business name");
      } else {
        const lockup = `${wm[1]} ${wm[2]}`.replace(/\s+/g, " ").trim().toLowerCase();
        if (lockup !== business.name.toLowerCase())
          fail(`the wordmark reads "${wm[1]} ${wm[2]}" but the declared business name is "${business.name}"`);
      }
      if (!html.includes(business.name))
        fail(`"${business.name}" appears nowhere in the page — the visible brand and the schema have diverged`);
      const esc = business.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const homeLinks = (html.match(new RegExp(`aria-label="${esc} home"`, "g")) ?? []).length;
      if (homeLinks !== 2)
        fail(`expected 2 logo links labelled "${business.name} home" (header + footer), found ${homeLinks}`);
      if (!new RegExp(`©\\s*\\d{4}\\s+${esc}`).test(html))
        fail(`the copyright line does not name the business as "${business.name}"`);

      /* --- brand mark assets -------------------------------------------------
         Per-format byte budgets belong to scripts/optimize-logo.mjs, which owns
         them at the moment it produces each file. This gate owns the two things
         that script cannot: that every reference on the page actually shipped,
         and that nobody hand-copies a 1.6 MB master into public/brand. A swap
         that half-happens — files without references, or references without
         files — fails the build rather than showing a broken image. A reference is any
         /brand/<file> occurrence in the emitted document, including the JSON-LD
         logo/image URLs and CSS url(): a crawler fetching those makes the file as
         load-bearing as a src attribute. */
      /* The ceiling exists to catch a hand-copied master, not to price the ladder:
         per-format byte budgets belong to optimize-logo.mjs. It was 32 KB while the mark
         was a two-colour silhouette; the mark is now full-colour artwork 96px tall
         (380x288), so its PNG twin legitimately costs 49.9 KB and the schema 512 86.5 KB.
         96 KB is still 12x below the 1,224 KB master this rule exists to stop. */
      const BRAND_CEILING_KB = 96;
      const brandRefs = [...html.matchAll(/\.?\/brand\/([\w.\-]+)/g)].map((m) => m[1]);
      for (const ref of brandRefs) {
        const file = join(outDir, "brand", ref);
        if (!existsSync(file)) {
          fail(`the page references /brand/${ref} but dist has no such file — run npm run optimize:logo`);
        } else {
          const kb = statSync(file).size / 1024;
          if (kb > BRAND_CEILING_KB)
            fail(`/brand/${ref} is ${kb.toFixed(1)} KB, over the ${BRAND_CEILING_KB} KB brand-asset ceiling: ship the ladder output, never the master`);
        }
      }
      const brandSrc = resolve(outDir, "..", "public", "brand");
      if (existsSync(brandSrc)) {
        for (const name of readdirSync(brandSrc)) {
          if (!/^(atabul-|favicon-|apple-touch)/.test(name)) continue; // citywings-mark is covered above
          if (!brandRefs.includes(name))
            fail(`public/brand/${name} exists but nothing references it — a logo swap left an orphan, or the reference was dropped`);
        }
      }

      /* --- crawler files: generated, never hand-copied ------------------- */

      const publicDir = join(config?.root ?? process.cwd(), "public");
      for (const [name, needle] of [
        ["robots.txt", `Sitemap: ${absoluteUrl(origin, "sitemap.xml")}`],
        ["sitemap.xml", `<loc>${origin}/</loc>`],
      ] as const) {
        if (existsSync(join(publicDir, name)))
          fail(
            `public/${name} exists and competes with the generated one — ` +
              `src/seo/render.ts is the single source of truth, delete the static copy`
          );
        const file = join(outDir, name);
        if (!existsSync(file)) {
          fail(`${name} was not emitted to dist/`);
          continue;
        }
        const body = readFileSync(file, "utf8");
        if (!body.includes(needle)) fail(`${name} does not reference the resolved origin (${needle})`);
        else metrics.push(`${name.padEnd(21)} present  (${(body.length / 1024).toFixed(1)} KB)`);
        if (name === "robots.txt" && /[^\x09\x0a\x0d\x20-\x7e]/.test(body))
          fail("robots.txt contains non-ASCII characters — crawlers may decode it with a fallback charset");
        if (name === "sitemap.xml") {
          if (!/^<\?xml/.test(body) || !body.includes("</urlset>")) fail("sitemap.xml is not a well-formed urlset");
          const locs = (body.match(/<loc>/g) ?? []).length;
          if (locs < 1) fail("sitemap.xml lists no URLs");
          if (/<loc>[^<]*#[a-z-]+<\/loc>/.test(body))
            fail("sitemap.xml lists fragment URLs (#faq, #fees, …) — fragments are not documents");
        }
      }

      for (const pattern of PLACEHOLDER_PATTERNS)
        if (pattern.test(html)) fail(`placeholder copy reached the artifact (${pattern})`);

      /* --- structured data: parse, then assert the contract -------------- */

      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      if (!blocks.length) fail("no JSON-LD block in the built HTML");
      let nodes: Json[] = [];
      for (const [, raw] of blocks) {
        try {
          const parsed = parseJsonLd(raw);
          nodes.push(...(Array.isArray(parsed["@graph"]) ? (parsed["@graph"] as Json[]) : [parsed]));
        } catch (err) {
          fail(`JSON-LD is not parseable: ${(err as Error).message}`);
        }
      }
      const byType = (type: string) => nodes.filter((n) => n["@type"] === type);
      const school = byType("DrivingSchool")[0];
      if (!school) fail("@graph has no DrivingSchool node");
      else
        for (const key of ["name", "telephone", "address", "geo", "url", "image", "areaServed", "sameAs"])
          if (!school[key]) fail(`DrivingSchool is missing "${key}"`);

      const faqPage = byType("FAQPage")[0];
      if (!faqPage) fail("@graph has no FAQPage node");
      const faqEntries = Array.isArray(faqPage?.mainEntity) ? (faqPage.mainEntity as Json[]) : [];
      if (faqEntries.length !== faqs.length)
        fail(`FAQPage.mainEntity declares ${faqEntries.length} answers but site.ts has ${faqs.length} questions`);

      // Single source of truth: every question in site.ts must actually render.
      for (const faq of faqs)
        if (!html.includes(escapeHtml(faq.q)))
          fail(`FAQ "${faq.q.slice(0, 40)}…" is in site.ts but not in the markup (marker drift)`);

      if (!html.includes(escapeHtml(instructor.credentials)))
        fail("instructor.credentials from site.ts never rendered — the visible line and the Person node must agree");
      const person = byType("Person")[0];
      if (!person) fail("@graph has no Person node for the named instructor");
      else if (!String(person.description ?? "").includes(instructor.credentials))
        fail("Person.description does not carry instructor.credentials");

      const videoCount = byType("VideoObject").length;
      if (videoCount !== ruleClips.length)
        fail(`only ${videoCount}/${ruleClips.length} rule clips resolved to VideoObject nodes (missing/unreadable mp4s)`);
      const serviceCount = byType("Service").length;
      if (serviceCount !== 4) fail(`expected 4 Service nodes for the published programmes, found ${serviceCount}`);

      /* --- performance budgets (LCP + render-blocking) ------------------- */

      const htmlKb = html.length / 1024;
      if (htmlKb > BUDGETS.html) fail(`dist/index.html is ${htmlKb.toFixed(0)} KB (> ${BUDGETS.html} KB)`);
      else metrics.push(`index.html           ${htmlKb.toFixed(0).padStart(4)} KB`);

      for (const [file, budget] of Object.entries(BUDGETS) as Array<[string, number]>) {
        if (!file.startsWith("hero-fallback")) continue;
        const abs = join(outDir, file);
        if (!existsSync(abs)) {
          fail(`LCP ladder is missing ${file} — regenerate with npm run optimize:poster`);
          continue;
        }
        const kb = statSync(abs).size / 1024;
        if (kb > budget) fail(`${file} is ${kb.toFixed(0)} KB, over its ${budget} KB LCP budget`);
        else metrics.push(`${file.padEnd(21)} ${kb.toFixed(0).padStart(4)} KB`);
      }

      const artifacts = walkFiles(join(outDir, "assets")).map((f) => `assets/${f}`);
      for (const kind of ["js", "css"] as const) {
        for (const f of artifacts.filter((x) => new RegExp(`^assets/index.*\\.${kind}$`).test(x))) {
          const kb = statSync(join(outDir, f)).size / 1024;
          const budget = kind === "js" ? BUDGETS.entryJs : BUDGETS.entryCss;
          if (kb > budget) fail(`${f} is ${kb.toFixed(0)} KB (> ${budget} KB ${kind.toUpperCase()} budget)`);
          else metrics.push(`${f.padEnd(21)} ${kb.toFixed(0).padStart(4)} KB  (entry ${kind.toUpperCase()})`);
        }
      }

      /* --- advisory ------------------------------------------------------- */

      if (/localhost|127\.0\.0\.1/.test(origin))
        warnings.push(`origin is the stand-in ${origin} — set VITE_SITE_URL before DNS cutover`);
      if (!business.openingHours?.length)
        warnings.push("business.openingHours is null → no openingHoursSpecification (owner input needed)");
      if (!social.twitterSite) warnings.push("social.twitterSite unset → no twitter:site");
      if (!lastModified) warnings.push("no sitemap <lastmod> (set VITE_BUILD_DATE from the commit date)");
      if (!absoluteUrl(origin, "").endsWith("/")) warnings.push("origin has no resolvable root URL");

      if (errors.length) {
        const message =
          `\n[seo] BUILD AUDIT FAILED (${errors.length})\n` +
          errors.map((e) => `   ✗ ${e}`).join("\n");
        if (strict) this.error(message);
        else this.warn(message);
      }

      console.log(
        `\n[seo] audit passed — origin ${origin}\n` +
          `   canonical   ${origin}/\n` +
          `   robots.txt  ${absoluteUrl(origin, "robots.txt")}\n` +
          `   sitemap     ${absoluteUrl(origin, "sitemap.xml")}\n` +
          `   json-ld     ${nodes.length} nodes · ${faqEntries.length} FAQ answers · ${videoCount} videos · ` +
          `${byType("Service").length} services\n` +
          (metrics.length ? `   ${metrics.join("\n   ")}\n` : "") +
          (warnings.length ? `   ${warnings.map((w) => `! ${w}`).join("\n   ")}\n` : "")
      );
    },
  };
}
