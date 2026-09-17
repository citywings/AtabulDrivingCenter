/**
 * ATABUL DRIVING CENTER — STRUCTURED DATA BUILDERS
 * -------------------------------------------------------------------------
 * Pure functions: site facts + origin (+ measured video durations) in, a
 * schema.org @graph out. No DOM, no `process`, no filesystem — that keeps
 * this module inside the browser tsconfig project (`tsc --noEmit` checks it)
 * and makes the output trivially assertable in the build validator.
 *
 * Deliberate omissions:
 *   • No `aggregateRating` / `Review` markup. Google treats ratings a business
 *     publishes about itself as "self-serving" and can issue a manual action;
 *     the 30 real testimonials stay as on-page content and `hasMap` points at
 *     the third-party source of truth instead.
 *   • No invented `openingHoursSpecification` or `uploadDate`. Both are
 *     emitted only when site.ts actually carries the data.
 */

import {
  business,
  faqs,
  instructor,
  meta,
  programmes,
  ruleClips,
  social,
  absoluteUrl,
  type RuleClip,
} from "./site";

export type Json = Record<string, unknown>;

export type GraphInput = {
  origin: string;
  /** Seconds per rule clip, measured from the MP4 container at build time. */
  ruleDurations?: Record<string, number>;
  /** ISO-8601 date (YYYY-MM-DD) for `dateModified`; omitted when unavailable. */
  lastModified?: string;
};

/** Canonical node identifier for the whole deployment. */
export const nodeIds = (origin: string) => ({
  business: `${origin}/#business`,
  website: `${origin}/#website`,
  webPage: `${origin}/#/`,
  faqPage: `${origin}/#faq`,
  instructor: `${origin}/#instructor`,
  service: (id: string) => `${origin}/#service-${id}`,
  video: (file: string) => `${origin}/#video-${file}`,
});

/** Whole-second ISO-8601 duration (8.4s → "PT8S", 75s → "PT1M15S"). */
export function isoDuration(seconds: number): string {
  const total = Math.max(1, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `PT${m ? `${m}M` : ""}${s ? `${s}S` : "0S"}`;
}

function businessNode(ids: ReturnType<typeof nodeIds>, origin: string): Json {
  const node: Json = {
    "@type": "DrivingSchool",
    "@id": ids.business,
    "name": business.name,
    "alternateName": business.alternateName,
    "url": `${origin}/`,
    "description": meta().description,
    "telephone": business.telephone,
    "email": business.email,
    "priceRange": business.priceRange,
    "currenciesAccepted": business.currenciesAccepted,
    "paymentAccepted": business.paymentAccepted,
    "image": absoluteUrl(origin, social.imagePath),
    "logo": absoluteUrl(origin, business.logoPath),
    "address": { "@type": "PostalAddress", ...business.address },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": business.geo.latitude,
      "longitude": business.geo.longitude,
    },
    "hasMap": business.mapsUrl,
    "areaServed": business.areaServed.map((place) => ({
      "@type": "Place",
      name: place,
    })),
    "sameAs": [...business.sameAs],
    "founder": { "@id": ids.instructor },
    "employee": { "@id": ids.instructor },
    "makesOffer": programmes.map((p) => ({ "@id": ids.service(p.id) })),
  };

  // Only emit hours when the owner has actually supplied them.
  if (business.openingHours?.length) {
    const [range, times] = business.openingHours[0].split(" ");
    const [open, close] = (times ?? "").split("-");
    if (open && close) {
      node.openingHoursSpecification = [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: expandDayRange(range),
          opens: open,
          closes: close,
        },
      ];
    }
  }
  return node;
}

/** "Mo-Sa" → ["Monday",…,"Saturday"]; a single "Tu" → ["Tuesday"]. */
export function expandDayRange(range: string): string[] {
  const order = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ] as const;
  const short: Record<string, number> = {
    Mo: 0,
    Tu: 1,
    We: 2,
    Th: 3,
    Fr: 4,
    Sa: 5,
    Su: 6,
  };
  const parts = range.split(/[^A-Za-z]+/).filter(Boolean).map((p) => short[p]);
  if (parts.length === 1 && parts[0] !== undefined) return [order[parts[0]]];
  if (parts.length === 2 && parts[0] !== undefined && parts[1] !== undefined) {
    return order.slice(parts[0], parts[1] + 1);
  }
  return [...order];
}

function instructorNode(ids: ReturnType<typeof nodeIds>, origin: string): Json {
  return {
    "@type": "Person",
    "@id": ids.instructor,
    name: instructor.name,
    jobTitle: instructor.jobTitle,
    image: absoluteUrl(origin, instructor.imagePath),
    description: `${instructor.name} — ${instructor.jobTitle} at ${business.name}, ${business.address.addressLocality}. ${instructor.credentials}`,
    worksFor: { "@id": ids.business },
    telephone: business.telephone,
    sameAs: [...instructor.sameAs],
  };
}

function serviceNodes(ids: ReturnType<typeof nodeIds>, origin: string): Json[] {
  return programmes.map((p) => ({
    "@type": "Service",
    "@id": ids.service(p.id),
    serviceType: p.serviceType,
    name: p.name,
    description: p.description,
    provider: { "@id": ids.business },
    areaServed: business.areaServed,
    // Deep link into the single-page booking flow, pre-selected by main.ts.
    url: `${origin}/#booking`,
    offers: {
      "@type": "Offer",
      price: p.price,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      description: p.priceUnit,
      url: `${origin}/#booking`,
    },
  }));
}

function faqNode(ids: ReturnType<typeof nodeIds>, origin: string): Json {
  return {
    "@type": "FAQPage",
    "@id": ids.faqPage,
    mainEntityOfPage: { "@id": ids.webPage },
    inLanguage: "en-IN",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
    publisher: { "@id": ids.business },
    url: `${origin}/#faq`,
  };
}

function videoNodes(
  ids: ReturnType<typeof nodeIds>,
  origin: string,
  durations: Record<string, number>
): Json[] {
  return ruleClips
    .filter((clip: RuleClip) => typeof durations[clip.file] === "number")
    .map((clip) => ({
      "@type": "VideoObject",
      "@id": ids.video(clip.file),
      name: `${clip.label} — ${business.name} road rules`,
      description: clip.description,
      thumbnailUrl: absoluteUrl(origin, `rules/${clip.file}.jpg`),
      contentUrl: absoluteUrl(origin, `rules/${clip.file}.mp4`),
      duration: isoDuration(durations[clip.file]),
      embedUrl: absoluteUrl(origin, `rules/${clip.file}.mp4`),
      inLanguage: "en-IN",
      publisher: { "@id": ids.business },
      isPartOf: { "@id": ids.webPage },
      contentRating: "General Audience",
    }));
}

function webNode(ids: ReturnType<typeof nodeIds>, origin: string, hasVideos: boolean): Json[] {
  // Sub-nodes are referenced by @id, never embedded twice: duplicating a node
  // body in both `hasPart` and `@graph` makes parsers merge ambiguous copies.
  const hasPart: unknown[] = [
    { "@id": ids.faqPage },
    ...programmes.map((p) => ({ "@id": ids.service(p.id) })),
    ...(hasVideos ? [{ "@id": ids.video(ruleClips[0].file) }] : []),
  ];

  const webPage: Json = {
    "@type": "WebPage",
    "@id": ids.webPage,
    url: `${origin}/`,
    name: meta().title,
    description: meta().description,
    inLanguage: "en-IN",
    isPartOf: { "@id": ids.website },
    about: { "@id": ids.business },
    // The business IS the primary entity of this page.
    mainEntity: { "@id": ids.business },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: absoluteUrl(origin, social.imagePath),
      width: social.imageWidth,
      height: social.imageHeight,
      caption: social.imageAlt,
    },
    hasPart,
  };

  return [
    {
      "@type": "WebSite",
      "@id": ids.website,
      url: `${origin}/`,
      name: meta().siteName,
      description: meta().description,
      inLanguage: "en-IN",
      publisher: { "@id": ids.business },
    },
    webPage,
  ];
}

/** Build the complete @graph for the page. */
export function buildGraph({ origin, ruleDurations = {}, lastModified }: GraphInput): Json {
  const ids = nodeIds(origin);
  const videos = videoNodes(ids, origin, ruleDurations);
  const graph: Json[] = [
    businessNode(ids, origin),
    instructorNode(ids, origin),
    ...webNode(ids, origin, videos.length > 0),
    faqNode(ids, origin),
    ...serviceNodes(ids, origin),
    ...videos,
  ];
  const node: Json = { "@context": "https://schema.org", "@graph": graph };
  if (lastModified) {
    const page = graph.find((n) => n["@type"] === "WebPage");
    if (page) page.dateModified = lastModified;
  }
  return node;
}

/**
 * Serialize for embedding inside `<script type="application/ld+json">`.
 * `<`, `>` and `&` are escaped to \uXXXX so no answer string can ever break
 * out of the script element (a `</script>` inside copy would corrupt the page).
 */
export function serializeJsonLd(node: Json): string {
  return JSON.stringify(node, null, 2)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026");
}
