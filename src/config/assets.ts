/**
 * ATABUL DRIVING CENTER — ASSET REGISTRY
 * ---------------------------------------------------------------------------
 * The single place where logical asset IDs resolve to application-relative
 * URLs. Components must reference `assets.<domain>.<id>` — never a raw path,
 * and never an operating-system path. Vite fingerprints these imports at
 * build time, so production builds emit hashed, cacheable URLs.
 *
 * To swap media: replace the file under src/assets/<domain>/ and keep the ID.
 */
import heroDesktopH264 from "@/assets/hero/hero-primary-1280.mp4";
import heroMobileH264 from "@/assets/hero/hero-primary-720.mp4";
import heroPoster from "@/assets/hero/hero-poster.jpg";
import instructorPortrait from "@/assets/instructors/instructor-primary.webp";

export const assets = {
  hero: {
    /** Cinematic hero film — right-hand-drive cockpit, Indian roads. */
    primary: {
      /** H.264/AVC — universal fallback (all browsers) */
      desktop: {
        h264: heroDesktopH264,
      },
      mobile: {
        h264: heroMobileH264,
      },
      poster: heroPoster, // LCP poster / reduced-motion / no-autoplay fallback
    },
  },
  instructor: {
    /** Lead instructor — premium editorial portraiture. */
    primary: {
      image: instructorPortrait,
    },
  },
} as const;

export type AssetTree = typeof assets;