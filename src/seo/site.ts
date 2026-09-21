/**
 * ATABUL DRIVING CENTER — SITE FACTS (SINGLE SOURCE OF TRUTH)
 * -------------------------------------------------------------------------
 * Every SEO-visible fact about this business lives here. The build-time SEO
 * plugin (`vite/plugins/seo.ts`) reads this module to generate:
 *
 *   <title> + meta description      → site.meta()
 *   canonical / og:* / twitter:*    → absolute URLs from `resolveOrigin()`
 *   visible FAQ accordion markup    → site.faqs  (src/seo/render.ts)
 *   JSON-LD @graph                  → site.faqs + site.programmes + …  (schema.ts)
 *   robots.txt + sitemap.xml        → site.sitemapPaths
 *
 * Editing marketing copy = edit this file, then `npm run build`. Never hand-
 * edit generated tags; the build overwrites them and the validator fails.
 *
 * `http://localhost:5173/` is the agreed stand-in production origin until the
 * real domain is delegated. Override without touching code:
 *   VITE_SITE_URL=https://example.in npm run build
 */

import { CONTACT } from "../config/contact";

/* --------------------------------------------------------------------------
 * ORIGIN
 * ------------------------------------------------------------------------ */

/** Agreed placeholder origin while the site is unreleased. */
export const DEV_ORIGIN = "http://localhost:5173";

/**
 * Resolve the canonical site origin from a raw env value. Pure (no `process`
 * access) so it stays type-checked in the browser tsconfig project and can be
 * unit-reasoned about. Always returns a slash-trimmed, absolute origin.
 */
export function resolveOrigin(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return DEV_ORIGIN;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEV_ORIGIN;
    return url.origin; // URL#origin is already slash-free
  } catch {
    return DEV_ORIGIN;
  }
}

/** Join the origin with an application-relative path into an absolute URL. */
export function absoluteUrl(origin: string, path: string): string {
  return `${origin.replace(/\/+$/, "")}/${path.replace(/^\.?\//, "")}`;
}

/* --------------------------------------------------------------------------
 * IDENTITY / NAP  (must match the Google Business Profile character-for-
 * character: NAP inconsistency is the #1 local-ranking suppressant)
 * ------------------------------------------------------------------------ */

export const business = {
  name: "Atabul Driving Center",
  /** The name the Google Business Profile is registered under. */
  alternateName: "Atabul Driving Center",
  // Numbers come from src/config/contact.ts so the JSON-LD, the click-to-call /
  // WhatsApp hrefs in index.html and the booking handoff cannot drift apart.
  telephone: CONTACT.phone,
  displayPhone: CONTACT.phoneDisplay,
  /** Second line, published only for driver-service enquiries. */
  driverServicePhone: CONTACT.driverServicePhone,
  driverServiceDisplayPhone: CONTACT.driverServiceDisplayPhone,
  email: "atabulmolla890@gmail.com",
  address: {
    streetAddress:
      "Dakshin Maath, Mondal Ganthi Gali, near Dakshinmark Muslim Kabristan, Arjunpur",
    addressLocality: "Kaikhali, Kolkata",
    addressRegion: "West Bengal",
    postalCode: "700052",
    addressCountry: "IN",
  },
  geo: { latitude: 22.6323921, longitude: 88.4315486 },
  areaServed: ["Kaikhali", "Baguiati", "Arjunpur", "Chinar Park", "Rajarhat", "Kolkata"],
  /** Public Google Maps place link used for `hasMap` and the on-page link. */
  mapsUrl: "https://www.google.com/maps/place/ATABUL+DRIVING+CENTER/@22.6323921,88.4315486,17z",
  /**
   * The brand mark as served, for `logo` on the DrivingSchool node. Generated into
   * public/brand/ by `npm run brand:mark` — 512px square flattened on --dp-navy-900,
   * because Google plates a transparent logo itself and asks for >= 112px.
   */
  logoPath: "brand/atabul-mark-512.png",
  sameAs: [
    "https://www.facebook.com/share/1Ee5BaSHuk/",
    "https://www.instagram.com/atabuldrivinginstructor",
    "https://www.youtube.com/@atabuldrivinginstructor",
  ],
  /**
   * OWNER INPUT NEEDED — the academy publishes no opening hours anywhere on
   * the site, so `openingHoursSpecification` is deliberately omitted rather
   * than invented. Fill this in with the real hours and the schema emits it
   * automatically (`null` = omitted). Sessions are booked individually, so a
   * truthful value may be e.g. ["Mo-Sa 06:00-19:00"].
   */
  openingHours: null as string[] | null,
  /** Derived from the published rate card (lowest → highest listed price). */
  priceRange: "₹500-₹2,000",
  currenciesAccepted: "INR",
  paymentAccepted: "Cash, UPI",
} as const;

/* --------------------------------------------------------------------------
 * HEAD COPY — title + meta description, kept inside the SERP budgets the
 * validator enforces (title 30–65 chars, description 50–160 chars).
 * ------------------------------------------------------------------------ */

export function meta() {
  return {
    /** 58 chars: brand + primary local keyword, no pipe-stack. */
    title: "Driving School in Kaikhali, Kolkata | Atabul Driving Center",
    /** 152 chars: keyword + three services + call-to-action. */
    description:
      "Atabul Driving Center teaches four-wheeler driving in Kaikhali, Kolkata — beginner lessons, refresher training and hired-driver service. Book on call.",
    /** Used as `og:site_name` and the `publisher` label. */
    siteName: "Atabul Driving Center",
    keywords: [
      "driving school kaikhali",
      "car driving training kolkata",
      "driving institute baguiati",
      "learn to drive kolkata",
      "professional driver service kolkata",
    ],
  } as const;
}

/* --------------------------------------------------------------------------
 * SOCIAL CARD  (og:/twitter: — must resolve to an absolute HTTPS URL on the
 * deployed origin; social crawlers do not fetch relative URLs)
 * ------------------------------------------------------------------------ */

export const social = {
  /** Application-relative path. 1600×900 is a safe 16:9 card; keep ≥1200×630. */
  imagePath: "assets/hero-poster-og.jpg",
  imageWidth: 1600,
  imageHeight: 900,
  imageAlt:
    "Atabul Driving Center — four-wheeler driving instruction on the roads of Kaikhali, Kolkata.",
  locale: "en_IN",
  /** Omitted until a handle exists; the validator only warns here. */
  twitterSite: null as string | null,
} as const;

/* --------------------------------------------------------------------------
 * INSTRUCTOR  → schema.org Person
 * ------------------------------------------------------------------------ */

export const instructor = {
  name: "Atabul Molla",
  jobTitle: "Lead driving instructor",
  /** Application-relative path (also rendered as the visible portrait). */
  imagePath: "trainer-portrait.webp",
  imageWidth: 1305,
  imageHeight: 1206,
  imageAlt:
    "Portrait of Atabul Molla, lead driving instructor at Atabul Driving Center, Kaikhali, Kolkata.",
  sameAs: ["https://www.youtube.com/@atabuldrivinginstructor"],
  /**
   * Replaces the visible `[To be confirmed]` placeholder. The wording is
   * derived from copy already published on this page ("years of practical
   * experience and a strong focus on safety") — swap in real certifications
   * (e.g. LMV/TV licence class, RTO trainer registration) as soon as they are
   * available: placeholder text is a measurable quality-score liability.
   */
  credentials:
    "Years of practical, safety-first instruction on Kaikhali and Baguiati roads.",
} as const;

/* --------------------------------------------------------------------------
 * PROGRAMMES  → schema.org Service nodes + the visible programme rows
 * ------------------------------------------------------------------------ */

export type Programme = {
  id: string;
  index: string;
  name: string;
  serviceType: string;
  audience: string;
  description: string;
  points: string[];
  price: string;
  priceNumber: number;
  priceUnit: string;
};

export const programmes: Programme[] = [
  {
    id: "beginner-driving-lessons",
    index: "P·01",
    name: "Beginner driving lessons",
    serviceType: "Beginner four-wheeler driver training",
    audience: "First-time drivers",
    description:
      "Start from zero: vehicle introduction, basic controls, and supervised practice until you drive confidently on live roads.",
    points: ["Vehicle basics", "Clutch & gear control", "Live-road practice"],
    price: "600",
    priceNumber: 600,
    priceUnit: "per hour (academy vehicle) / per 2 hours (own car)",
  },
  {
    id: "driving-skill-polishing-confidence-lessons",
    index: "P·02",
    name: "Driving skill polishing & confidence lessons",
    serviceType: "Refresher and confidence driving lessons",
    audience: "Refresher & confidence",
    description:
      "Already know how to drive but lack confidence on the road, or returning after a long gap? Practical lessons that sharpen road awareness and restore full control of the vehicle.",
    points: ["Road-awareness practice", "Own car or academy vehicle", "Long-gap refresher"],
    price: "600",
    priceNumber: 600,
    priceUnit: "per hour (academy vehicle) / per 2 hours (own car)",
  },
  {
    id: "professional-driver-service",
    index: "P·03",
    name: "Professional driver service",
    serviceType: "Hire driver for personal and commercial travel",
    audience: "Hire a driver",
    description:
      "Reliable, experienced drivers for your personal and commercial travel needs: punctual, professional, and road-ready.",
    points: ["Personal & commercial", "Vetted drivers", "Flexible engagement"],
    price: "500",
    priceNumber: 500,
    priceUnit: "per 5 hours (5-seater)",
  },
  {
    id: "city-outstation-tours",
    index: "P·04",
    name: "City & outstation tours",
    serviceType: "Hire driver for city and outstation trips",
    audience: "Book a tour",
    description:
      "Comfortable city rides and outstation journeys with experienced drivers. Door-to-door service, flexible scheduling, and well-maintained vehicles for stress-free travel.",
    points: ["City & outstation", "Experienced drivers", "Flexible itineraries"],
    price: "500",
    priceNumber: 500,
    priceUnit: "per 5 hours (5-seater)",
  },
];

/* --------------------------------------------------------------------------
 * FAQ  → drives BOTH the visible accordion markup AND the FAQPage schema.
 * One source, no drift: `renderFaqMarkup()` in src/seo/render.ts emits the
 * accordion items into index.html, and schema.ts feeds the same array into
 * `mainEntity`, so a Google-visible answer can never disagree with the page.
 * ------------------------------------------------------------------------ */

export type Faq = { q: string; a: string };

export const faqs: Faq[] = [
  {
    q: "Where is Atabul Driving Center located?",
    a: "We are at Dakshin Maath, Mondal Ganthi Gali, near Dakshinmark Muslim Kabristan, Arjunpur, Kaikhali, Kolkata 700052, near GM Soroni, serving the Kaikhali-Baguiati area.",
  },
  {
    q: "Do you provide pickup for training sessions?",
    a: "Yes, pickup points are available across the Kaikhali-Baguiati area. Confirm your nearest pickup point when you book by call or WhatsApp.",
  },
  {
    q: "Can I learn in my own car?",
    a: "Yes. Both beginner lessons and our driving skill polishing & confidence lessons can be taken in your own car. Our instructors take special care of your vehicle during every session.",
  },
  {
    q: "What will my training cover?",
    a: "Training follows four stages: basic vehicle introduction, practical road training, confidence and traffic handling, and a final skill assessment that prepares you for independent driving and licence approval.",
  },
  {
    q: "What are the fees and course durations?",
    a: "Training is ₹600 per hour, in your own car or in an academy vehicle. Professional driver service starts at ₹500 for 5 hours. The full rate card is published in the fees section above.",
  },
  {
    q: "What are the training timings?",
    a: "Morning, afternoon and evening slots are scheduled individually around your pickup convenience. Call us to check availability for your start date.",
  },
  {
    q: "Do you provide the driving licence?",
    a: "Our final skill assessment prepares you for licence approval with confidence. For specifics about the licence process, ask us when you call.",
  },
];

/* --------------------------------------------------------------------------
 * RULE & SAFETY CLIPS  → schema.org VideoObject
 * Files live in public/rules/. Durations are measured from the MP4 container
 * at build time (never hand-typed), because VideoObject rich results require
 * `duration` or `uploadDate` and we have no real upload dates.
 * ------------------------------------------------------------------------ */

export type RuleClip = { file: string; label: string; description: string };

export const ruleClips: RuleClip[] = [
  { file: "rule-01", label: "Seat belt first", description: "Fasten the seat belt before the vehicle moves, every drive." },
  { file: "rule-02", label: "Check before you move", description: "Walk-around and mirror checks before pulling away." },
  { file: "rule-03", label: "Signal before turning", description: "Indicate early so other road users read your intention." },
  { file: "rule-04", label: "Red means stop", description: "Stop fully at the line on a red signal and hold the clutch." },
  { file: "rule-05", label: "Don't rush", description: "Steady progress beats a saved second in city traffic." },
  { file: "rule-06", label: "Safe following distance", description: "Keep a gap that lets you stop without braking hard." },
  { file: "rule-07", label: "Phone down", description: "No calls or messages while the vehicle is in motion." },
  { file: "rule-08", label: "Pedestrian first", description: "Yield to pedestrians and two-wheelers at every unmarked crossing." },
  { file: "rule-10", label: "Keep crossings clear", description: "Do not enter a crossing you cannot clear." },
  { file: "rule-11", label: "Speed is not skill", description: "Control and predictability are what make a good driver." },
  { file: "rule-12", label: "Rain slow down", description: "Wet grip and visibility both drop: reduce speed early." },
  { file: "rule-13", label: "Smooth braking", description: "Progressive pressure keeps the car stable and passengers comfortable." },
  { file: "rule-14", label: "Lane change", description: "Mirror, signal, check the blind spot, then move." },
  { file: "rule-15", label: "Drinking? Don't drive", description: "No amount of practice offsets alcohol behind the wheel." },
];

/** Public-facing section anchors, used for the sitemap and `Website` fragments. */
export const pageSections = [
  { id: "about", label: "About the academy" },
  { id: "programmes", label: "Programmes" },
  { id: "method", label: "Training method" },
  { id: "instructor", label: "Instructor" },
  { id: "fees", label: "Fees" },
  { id: "reviews", label: "Reviews" },
  { id: "faq", label: "FAQ" },
  { id: "booking", label: "Book training" },
  { id: "contact", label: "Contact" },
] as const;
