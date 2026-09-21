/**
 * INDEPENDENT post-build SEO verification.
 * Deliberately shares NO code with vite/plugins/seo.ts — this is a second
 * pair of eyes. Run against a built dist/: node scripts/verify-seo.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

const DIST = process.argv[2] ?? "dist";
const html = readFileSync(join(DIST, "index.html"), "utf8");
const srcHtml = readFileSync("index.html", "utf8");
const robots = readFileSync(join(DIST, "robots.txt"), "utf8");
const sitemap = readFileSync(join(DIST, "sitemap.xml"), "utf8");

const results = [];
const check = (group, name, pass, detail = "") =>
  results.push({ group, name, pass, detail });

const head = /<head>([\s\S]*?)<\/head>/.exec(html)[1];
const attr = (tag, name) => {
  const m = new RegExp(`<${tag}[^>]*\\b${name}="([^"]*)"`).exec(html);
  return m ? m[1] : null;
};

/* ---------------- 1. crawlability without JavaScript -------------------- */
const textOnly = html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<svg[\s\S]*?<\/svg>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&[a-z]+;/gi, " ")
  .replace(/\s+/g, " ");
check("Crawl", "indexable words in static HTML (no JS)", textOnly.trim().split(" ").length > 1200,
  `${textOnly.trim().split(" ").length} words`);
check("Crawl", "charset declared within first 1024 bytes",
  /charset="UTF-8"/i.test(html.slice(0, 1024)));
check("Crawl", "single <h1>", (html.match(/<h1[\s>]/g) || []).length === 1);
const cssAll = ["base", "components", "sections"]
  .map((f) => readFileSync(`src/styles/${f}.css`, "utf8"))
  .join("\n");
const hiddenRules = [...cssAll.matchAll(/([^{}]*\.reveal[^{}]*)\{([^}]*)\}/g)]
  .filter((m) => /opacity:\s*0(?![.\d])/.test(m[2]));
check("Crawl", "every reveal hidden-state is gated behind the .js class",
  hiddenRules.length > 0 && hiddenRules.every((m) => /\.js\s/.test(m[1])),
  `${hiddenRules.length} hidden-state rules, all .js-prefixed`);
check("Crawl", "hero stagger uses CSS animation (visible immediately, no JS gate needed)",
  /@keyframes hero-in/.test(html) && /\.hero-stagger > \*[^}]*animation: hero-in/.test(html),
  "CSS animation approach verified");
check("Crawl", "boot watchdog strips .js if the module never runs",
  /__dpBooted/.test(html) && /classList\.remove\("js"\)/.test(html) && /window\.__dpBooted = true/.test(readFileSync("src/main.ts", "utf8")));
check("Crawl", "noscript fallback for the JS-only booking flow", /<noscript>[\s\S]*tel:\+91/.test(html));

/* ---------------- 2. document structure -------------------------------- */
const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => +m[1]);
const skips = levels.slice(1).map((l, i) => (l > levels[i] + 1 ? `${levels[i]}->${l}` : null)).filter(Boolean);
check("Structure", "no skipped heading levels", skips.length === 0, skips.join(", "));
check("Structure", "html lang set", /<html[^>]*lang="en-IN"/.test(html), attr("html", "lang") ?? "");
check("Structure", "viewport present", /name="viewport" content="width=device-width/.test(head));
check("Structure", "all <img> have alt", [...html.matchAll(/<img\b[^>]*>/g)].every((m) => /\balt="/.test(m[0])));
check("Structure", "all <img> have intrinsic width+height (no CLS)",
  [...html.matchAll(/<img\b[^>]*>/g)].every((m) => /\bwidth="\d+"/.test(m[0]) && /\bheight="\d+"/.test(m[0])));
const badAnchors = [...new Set([...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]))]
  .filter((id) => !new RegExp(`\\bid="${id}"`).test(html));
check("Structure", "every in-page anchor has a real target", badAnchors.length === 0, badAnchors.join(", "));
check("Structure", "no generic link text", !/\b(click here|read more|learn more)\b/i.test(textOnly));

/* ---------------- 3. references all resolve (no 404 crawl waste) -------- */
const refs = new Set();
for (const m of html.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)) refs.add(m[1]);
for (const m of html.matchAll(/srcset="([^"]+)"/g))
  for (const part of m[1].split(",")) refs.add(part.trim().split(/\s+/)[0]);
const missing = [...refs]
  .map((r) => r.replace(/^\.\//, "").split("?")[0])
  .filter((r) => !existsSync(join(DIST, r)));
check("Links", `all ${refs.size} local references resolve in dist/`, missing.length === 0, missing.join(", "));

// Determine origin from canonical for third-party subresource check
const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
const origin = canonical ? new URL(canonical).origin : "http://localhost:5173";

// What the browser actually FETCHES at load: src=, srcset=, preload/
// preconnect links, and CSS url(). Outbound <a href> is navigation, not a
// subresource, so it must not count against the zero-third-party claim.
const subresources = new Set([
  ...[...html.matchAll(/\bsrc="(https?:\/\/[^"/]+)/g)].map((m) => m[1]),
  ...[...html.matchAll(/<link[^>]*rel="(?:preload|preconnect|dns-prefetch|modulepreload)"[^>]*href="(https?:\/\/[^"/]+)/g)].map((m) => m[1]),
  ...[...html.matchAll(/<link[^>]*href="(https?:\/\/[^"/]+)"[^>]*rel="(?:preload|stylesheet)"/g)].map((m) => m[1]),
]);
for (const f of readdirSync(join(DIST, "assets")).filter((x) => x.endsWith(".css"))) {
  for (const m of readFileSync(join(DIST, "assets", f), "utf8").matchAll(/url\((['"]?)(https?:\/\/[^)'"]+)\1\)/g))
    subresources.add(m[2].split("/").slice(0, 3).join("/"));
}
const thirdParty = [...subresources].filter(
  (o) => !o.startsWith(origin) && !/^https?:\/\/(localhost|127\.)/.test(o)
);
const outbound = new Set([...html.matchAll(/<a[^>]+href="(https?:\/\/[^"/]+)/g)].map((m) => m[1]));
check("Links", "zero third-party subresources fetched at page load",
  thirdParty.length === 0,
  thirdParty.length ? thirdParty.join(", ") : `0 external fetches · ${outbound.size} outbound domains are navigation only`);
check("Links", "no absolute localhost URLs baked into asset refs",
  !/(?:href|src|srcset)="\/?\/?localhost/.test(html));

/* ---------------- 4. head metadata ------------------------------------- */
check("Head", "canonical present and self-referencing", canonical === `${origin}/`, canonical ?? "MISSING");
check("Head", "noindex absent (page is meant to rank)",
  !/content="[^"]*noindex/.test(html));
check("Head", "meta robots allows rich media previews",
  /max-image-preview:large/.test(html));
const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
check("Head", "title 30–65 chars", title.length >= 30 && title.length <= 65, `${title.length} chars`);
const desc = /name="description" content="([^"]*)"/.exec(html)?.[1] ?? "";
check("Head", "description 50–170 chars", desc.length >= 50 && desc.length <= 170, `${desc.length} chars`);
check("Head", "description contains the target locality", /Kaikhali/i.test(desc));
check("Head", "title contains the head term", /driving school/i.test(title));
for (const p of ["og:type", "og:url", "og:site_name", "og:locale", "og:image", "og:image:width", "og:image:height", "og:image:alt", "twitter:card", "twitter:image"]) {
  const v = new RegExp(`<meta (?:property|name)="${p}" content="([^"]*)"`).exec(html)?.[1];
  check("Head", `${p} present`, v !== undefined, v ?? "");
}
const ogUrl = /property="og:url" content="([^"]+)"/.exec(html)?.[1];
check("Head", "og:url equals canonical", ogUrl === canonical, `${ogUrl} vs ${canonical}`);
const ogImg = /property="og:image" content="([^"]+)"/.exec(html)?.[1] ?? "";
check("Head", "og:image absolute + on-origin", ogImg.startsWith(`${origin}/`), ogImg);
check("Head", "og:image file exists in dist", existsSync(join(DIST, ogImg.replace(/^https?:\/\/[^/]+\//, ""))));
check("Head", "twitter card is large-image", /name="twitter:card" content="summary_large_image"/.test(html));

/* ---------------- 5. structured data integrity ------------------------- */
const ldRaw = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
check("Schema", "exactly one JSON-LD block", ldRaw.length === 1, `${ldRaw.length}`);
let graph = [];
let parsed = null;
try {
  parsed = JSON.parse(ldRaw[0][1].replace(/\\u00([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))));
  graph = parsed["@graph"];
} catch (e) {
  check("Schema", "JSON-LD parses", false, e.message);
}
check("Schema", "@context is schema.org", parsed?.["@context"] === "https://schema.org");
check("Schema", "JSON-LD is HTML-safe (no raw < or > inside)", !/[<>]/.test(ldRaw[0][1]));
const defined = graph.map((n) => n["@id"]);
check("Schema", "@id values unique", new Set(defined).size === defined.length);
const refsInGraph = [];
const walk = (o) => {
  if (Array.isArray(o)) return o.forEach(walk);
  if (o && typeof o === "object") {
    if (typeof o["@id"] === "string" && !o["@type"]) refsInGraph.push(o["@id"]);
    Object.values(o).forEach(walk);
  }
};
walk(graph);
const dangling = refsInGraph.filter((r) => !defined.includes(r));
check("Schema", "every {@id} reference resolves to a node", dangling.length === 0, dangling.join(", "));
const types = graph.map((n) => n["@type"]);
for (const t of ["DrivingSchool", "Person", "WebSite", "WebPage", "FAQPage", "Service", "VideoObject"])
  check("Schema", `${t} node present`, types.includes(t), `${types.filter((x) => x === t).length}×`);
const school = graph.find((n) => n["@type"] === "DrivingSchool");
check("Schema", "DrivingSchool has all LocalBusiness identity fields",
  ["@id", "name", "url", "telephone", "address", "geo", "image", "sameAs", "areaServed", "priceRange", "hasMap"].every((k) => school[k]));
check("Schema", "geo matches the address locality", school.geo.latitude > 22 && school.geo.latitude < 23);
const faq = graph.find((n) => n["@type"] === "FAQPage");
const visibleQ = [...html.matchAll(/class="accordion__trigger"[^>]*>([\s\S]*?)<svg/g)].map((m) => m[1].trim());
check("Schema", "FAQPage.mainEntity count == visible accordion count",
  faq.mainEntity.length === visibleQ.length, `${faq.mainEntity.length} vs ${visibleQ.length}`);
check("Schema", "FAQPage text matches the visible text verbatim",
  faq.mainEntity.every((q, i) => q.name === visibleQ[i]),
  faq.mainEntity.find((q, i) => q.name !== visibleQ[i])?.name ?? "");
check("Schema", "every Question has an Answer with text",
  faq.mainEntity.every((q) => q.acceptedAnswer?.["@type"] === "Answer" && q.acceptedAnswer.text.length > 40));
check("Schema", "no self-serving aggregateRating/Review markup",
  !types.includes("AggregateRating") && !types.includes("Review") && !("aggregateRating" in school));
const vids = graph.filter((n) => n["@type"] === "VideoObject");
check("Schema", "VideoObjects carry duration + thumbnail + contentUrl",
  vids.every((v) => /^PT\d+[M\S]*$/.test(v.duration) && /^https?:/.test(v.thumbnailUrl) && /\.mp4$/.test(v.contentUrl)),
  `${vids.length} clips`);
check("Schema", "video contentUrl targets resolve in dist",
  vids.every((v) => existsSync(join(DIST, v.contentUrl.replace(/^https?:\/\/[^/]+\//, "")))));
check("Schema", "Service nodes expose the published price",
  graph.filter((n) => n["@type"] === "Service").every((s) => s.offers?.price && s.offers.priceCurrency === "INR"));

/* ---------------- 6. crawler files ------------------------------------- */
check("Files", "robots.txt allows the whole site", /User-agent: \*\s*\nAllow: \//.test(robots));
check("Files", "robots.txt does not block anything essential", !/Disallow: \/(\s|$)/.test(robots));
check("Files", "robots.txt references the sitemap on the same origin",
  robots.includes(`${origin}/sitemap.xml`));
check("Files", "robots.txt is pure ASCII", /^[\x09\x0a\x0d\x20-\x7e]*$/.test(robots));
// Hand-rolled XML well-formedness: balanced tags + declaration + no raw '&'.
const stack = [];
let xmlOk = /^<\?xml version="1\.0" encoding="UTF-8"\?>/.test(sitemap);
for (const m of sitemap.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
  const [, closing, tag, , selfClose] = m;
  if (tag === "xml" || selfClose) continue;
  if (closing) { if (stack.pop() !== tag) { xmlOk = false; break; } }
  else stack.push(tag);
}
check("Files", "sitemap.xml is well-formed (balanced tags)", xmlOk && stack.length === 0, stack.join(">"));
check("Files", "sitemap escapes raw ampersands", !/<&|&[^lamp];/.test(sitemap));
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check("Files", "sitemap has exactly one document URL", locs.length === 1, locs.join(", "));
check("Files", "no fragment URLs listed as pages", !locs.some((l) => l.includes("#")));
check("Files", "sitemap URLs are absolute on-origin", locs.every((l) => l === `${origin}/`));
const smAssets = [...sitemap.matchAll(/<(?:image:loc|video:content_url|video:thumbnail_url)>([^<]+)</g)].map((m) => m[1]);
check("Files", "every sitemap asset exists in dist",
  smAssets.every((a) => existsSync(join(DIST, a.replace(/^https?:\/\/[^/]+\//, "")))),
  `${smAssets.length} asset URLs`);

/* ---------------- 7. the management contract --------------------------- */
const markers = [...srcHtml.matchAll(/<!--[ \t]*SEO:[A-Z_]+[ \t]*-->/g)].map((m) => m[0]);
check("Manage", "7 bare markers in source index.html", markers.length === 7, `${markers.length}`);
check("Manage", "zero markers left in the artifact", !/SEO:[A-Z_]/.test(html));
check("Manage", "no hand-written meta in source (all generated)",
  !/<title>|property="og:|rel="canonical"/.test(srcHtml));
const seoFiles = ["src/seo/site.ts", "src/seo/schema.ts", "src/seo/render.ts", "vite/plugins/seo.ts", ".env.example"];
check("Manage", "SEO layer files all present", seoFiles.every((f) => existsSync(f)), seoFiles.filter((f) => !existsSync(f)).join(", "));
check("Manage", "no stray static robots/sitemap competing with generated ones",
  !existsSync("public/robots.txt") && !existsSync("public/sitemap.xml"));
check("Manage", "JSON-LD is not duplicated in source", !/application\/ld\+json/.test(srcHtml));
check("Manage", "performance budgets declared in code", /BUDGETS/.test(readFileSync("vite/plugins/seo.ts", "utf8")));

/* ---------------- report ------------------------------------------------ */
const groups = [...new Set(results.map((r) => r.group))];
let fails = 0;
for (const g of groups) {
  console.log(`\n── ${g} ${"─".repeat(58 - g.length)}`);
  for (const r of results.filter((x) => x.group === g)) {
    if (!r.pass) fails++;
    console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  → ${r.detail}` : ""}`);
  }
}
const bytes = (f) => `${(statSync(f).size / 1024).toFixed(1)} KB`;
console.log(`\n── Artifact ${"─".repeat(52)}`);
console.log(`  index.html ${bytes(join(DIST, "index.html"))} · robots.txt ${bytes(join(DIST, "robots.txt"))} · sitemap.xml ${bytes(join(DIST, "sitemap.xml"))}`);
console.log(`  LCP ladder: avif1600 ${bytes(join(DIST, "hero-fallback.avif"))} · avif900 ${bytes(join(DIST, "hero-fallback-900.avif"))} · webp1600 ${bytes(join(DIST, "hero-fallback.webp"))} · jpeg ${bytes(join(DIST, "hero-fallback.jpg"))}`);
console.log(`  files in dist: ${readdirSync(DIST, { recursive: true }).filter((f) => statSync(join(DIST, f)).isFile()).length}`);
console.log(`\n${fails === 0 ? "★ ALL " + results.length + " INDEPENDENT CHECKS PASSED" : "✗ " + fails + " of " + results.length + " CHECKS FAILED"}`);
process.exitCode = fails ? 1 : 0;
