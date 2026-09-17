/**
 * ATABUL DRIVING CENTER — GENERATED HEAD / MARKUP / CRAWLER FILES
 * -------------------------------------------------------------------------
 * Pure string builders for everything the SEO plugin injects. Kept free of
 * Node APIs so they are type-checked by `tsc --noEmit` alongside the site
 * facts they render, and so the output is deterministic and diffable.
 */

import { business, meta, ruleClips, social, absoluteUrl, faqs } from "./site";

export type RenderOptions = {
  origin: string;
  /** ISO-8601 YYYY-MM-DD for the sitemap `<lastmod>`. */
  lastModified?: string;
};

/** Minimal HTML text escaping — the same rules main.ts applies to input. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/* --------------------------------------------------------------------------
 * HEAD — the tags social/AI crawlers require to be absolute and complete.
 * Rendered at `<!-- SEO:HEAD -->` in index.html.
 * ------------------------------------------------------------------------ */
export function renderHead({ origin }: RenderOptions): string {
  const { title, description, siteName } = meta();
  const pageUrl = `${origin}/`;
  const imageUrl = absoluteUrl(origin, social.imagePath);

  const lines = [
    `<link rel="canonical" href="${pageUrl}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`,
    `<meta name="referrer" content="strict-origin-when-cross-origin" />`,

    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${pageUrl}" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`,
    `<meta property="og:locale" content="${social.locale}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    // Absolute URL mandatory: Facebook/WhatsApp/LinkedIn crawlers do not
    // resolve relative og:image values, which would blank the booking card.
    `<meta property="og:image" content="${imageUrl}" />`,
    `<meta property="og:image:width" content="${social.imageWidth}" />`,
    `<meta property="og:image:height" content="${social.imageHeight}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(social.imageAlt)}" />`,
    `<meta property="og:image:type" content="image/jpeg" />`,

    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${imageUrl}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(social.imageAlt)}" />`,
  ];

  if (social.twitterSite) {
    lines.splice(lines.length - 4, 0, `<meta name="twitter:site" content="${social.twitterSite}" />`);
  }

  return lines.join("\n    ");
}

/* --------------------------------------------------------------------------
 * VISIBLE FAQ ACCORDION — generated from the same array that feeds the
 * FAQPage schema, so a Google-visible answer can never diverge from the page.
 * Contract with src/main.ts initAccordion(): each trigger needs
 * `class="accordion__trigger"`, `aria-expanded`, and `aria-controls` pointing
 * at the panel id; the panel needs `role="region"` + `aria-labelledby`.
 * ------------------------------------------------------------------------ */
const ACCORDION_ICON =
  '<svg class="accordion__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>';

export function renderFaqItems(): string {
  return faqs
    .map((faq, i) => {
      const triggerId = `faq-t-${i}`;
      const panelId = `faq-p-${i}`;
      return [
        `            <div class="accordion__item">`,
        `              <h3>`,
        `                <button class="accordion__trigger" type="button" aria-expanded="false" aria-controls="${panelId}" id="${triggerId}">`,
        `                  ${escapeHtml(faq.q)}`,
        `                  ${ACCORDION_ICON}`,
        `                </button>`,
        `              </h3>`,
        `              <div class="accordion__panel" id="${panelId}" role="region" aria-labelledby="${triggerId}">`,
        `                <div class="accordion__panel-inner">`,
        `                  <p>${escapeHtml(faq.a)}</p>`,
        `                </div>`,
        `              </div>`,
        `            </div>`,
      ].join("\n");
    })
    .join("\n");
}

/* --------------------------------------------------------------------------
 * robots.txt — served in dev, emitted to dist/ on build.
 * ------------------------------------------------------------------------ */
export function renderRobotsTxt({ origin }: RenderOptions): string {
  return [
    "# Atabul Driving Center - generated by src/seo/render.ts (edit the data, not this file)",
    "# Keep this file ASCII: some crawlers and CDNs decode robots.txt with a",
    "# non-UTF-8 fallback, which turns typographic punctuation into mojibake.",
    "User-agent: *",
    "Allow: /",
    "",
    "# Feed and preview assets stay crawlable: hero poster, portraits, rule clips.",
    "Allow: /assets/",
    "Allow: /rules/",
    "",
    "# Query-string variants are not pages.",
    "Disallow: /*?utm_",
    "Disallow: /*?ref=",
    "",
    `Sitemap: ${absoluteUrl(origin, "sitemap.xml")}`,
    "",
  ].join("\n");
}

/* --------------------------------------------------------------------------
 * sitemap.xml — one URL per indexable document.
 * This site is intentionally a single document, so the sitemap carries the
 * root URL plus its image/video declarations. Fragment identifiers are NOT
 * separate documents and must never be listed: a sitemap full of `#faq`,
 * `#fees`, … tells Google you have pages you do not have.
 * ------------------------------------------------------------------------ */
export function renderSitemapXml({ origin, lastModified }: RenderOptions): string {
  const pageUrl = `${origin}/`;
  const image = absoluteUrl(origin, social.imagePath);
  const videoThumbs = ruleClips.map((clip) => absoluteUrl(origin, `rules/${clip.file}.jpg`));

  const ns =
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" ' +
    'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"';

  const videos = ruleClips
    .map(
      (clip) => `      <video:video>
        <video:thumbnail_url>${absoluteUrl(origin, `rules/${clip.file}.jpg`)}</video:thumbnail_url>
        <video:title>${escapeHtml(`${clip.label} — ${business.name} road rules`)}</video:title>
        <video:description>${escapeHtml(clip.description)}</video:description>
        <video:content_url>${absoluteUrl(origin, `rules/${clip.file}.mp4`)}</video:content_url>
        <video:family_friendly>yes</video:family_friendly>
      </video:video>`
    )
    .join("\n");

  const images = [image, ...videoThumbs]
    .map((url) => `      <image:image>\n        <image:loc>${url}</image:loc>\n      </image:image>`)
    .join("\n");

  const head = [
    `    <loc>${pageUrl}</loc>`,
    ...(lastModified ? [`    <lastmod>${lastModified}</lastmod>`] : []),
    `    <changefreq>weekly</changefreq>`,
    `    <priority>1.0</priority>`,
  ].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset ${ns}>
  <url>
${head}
${images}
${videos}
  </url>
</urlset>
`;
}
