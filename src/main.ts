/**
 * ATABUL DRIVING CENTER — MAIN
 * Progressive enhancement: every feature checks for its DOM hooks and
 * degrades gracefully. All motion respects prefers-reduced-motion.
 */
import "./styles/tokens.css";
import "./styles/fonts.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/sections.css";

/* Self-hosted fonts — Manrope (display), Inter (body), IBM Plex Mono (technical).
   Faces live in /public/fonts (stable URLs) and are preloaded from <head>;
   see src/styles/fonts.css for the @font-face declarations. */

import Lenis from "lenis";

import { assets } from "@/config/assets";
import { initGreeting } from "./components/greeting";
import { init as initBooking } from "./features/booking";
import { init as initReviewsCarousel } from "./features/reviews-marquee";
import { initLazyFeatures } from "./features/lazy-loader";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* --------------------------------------------------------------------------
 * HERO MEDIA — registry-resolved sources, graceful fallback chain:
 * poster <img> is LCP; video fades in when it can actually play.
 * Modern codec ladder: AV1 → HEVC → H.264 fallback.
 * ------------------------------------------------------------------------ */
function initHeroMedia() {
  const media = document.querySelector<HTMLElement>("[data-hero-media]");
  const video = document.querySelector<HTMLVideoElement>("[data-hero-video]");
  const posterImg = media?.querySelector<HTMLImageElement>("img");
  if (!media || !video) return;

  // Poster is the LCP layer — if it ever fails, fall back to the
  // registry-resolved copy rather than a broken frame.
  posterImg?.addEventListener(
    "error",
    () => {
      posterImg.closest("picture")?.querySelectorAll("source").forEach((s) => s.remove());
      posterImg.src = assets.hero.primary.poster;
    },
    { once: true }
  );

  // Reduced motion keeps the poster-only hero: no video fetch at all.
  if (prefersReducedMotion) return;

  const isMobile = window.matchMedia("(max-width: 47.9375em)");
  const markReady = () => media.classList.add("video-ready");

  const sources = {
    av1: video.querySelector<HTMLSourceElement>("[data-src-av1]"),
    hevc: video.querySelector<HTMLSourceElement>("[data-src-hevc]"),
    h264: video.querySelector<HTMLSourceElement>("[data-src-h264]"),
  };

  // Detect best supported codec (used when AV1/HEVC assets are added)
  const canPlayAV1 = video.canPlayType('video/av1') === "probably" || video.canPlayType('video/av1') === "maybe";
  const canPlayHEVC = video.canPlayType('video/hevc') === "probably" || video.canPlayType('video/hevc') === "maybe";
  // const bestCodec = canPlayAV1 ? "av1" : canPlayHEVC ? "hevc" : "h264"; // for future use
  void canPlayAV1; void canPlayHEVC; // silence unused warning until AV1/HEVC assets added

  let chosen = "";
  const setSource = () => {
    // For now use H.264 from assets; in production, replace with AV1/HEVC files when available
    const h264Src = isMobile.matches
      ? assets.hero.primary.mobile.h264
      : assets.hero.primary.desktop.h264;

    if (chosen !== h264Src) {
      chosen = h264Src;

      // Set src on sources; browser picks first playable
      // AV1/HEVC sources left empty as placeholders - add files when available
      sources.h264?.setAttribute("src", h264Src);

      video.load();
      void video.play().then(markReady).catch(() => {});
    }
  };

  // The video is a 1-2 MB enhancement behind the poster; start it only after
  // the page has loaded so it never competes with fonts and the LCP poster.
  if (document.readyState === "complete") {
    setSource();
  } else {
    window.addEventListener("load", setSource, { once: true });
  }
  isMobile.addEventListener("change", setSource);

  video.addEventListener("playing", markReady, { once: true });
}

/* --------------------------------------------------------------------------
 * SCROLL REVEALS — one IntersectionObserver, staggered via --reveal-delay
 * ------------------------------------------------------------------------ */
/** Set only once the observer is actually installed; the boot guard below
 *  reads it to decide whether it must force-reveal everything. */
let revealsInstalled = false;

function revealAll() {
  document.querySelectorAll<HTMLElement>(".reveal, .media-reveal").forEach((el) => {
    el.classList.add("is-visible");
  });
}

function initReveals() {
  const items = document.querySelectorAll<HTMLElement>(".reveal, .media-reveal");
  if (!items.length) return;

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealsInstalled = true;
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  items.forEach((el) => io.observe(el));
  revealsInstalled = true;

  // Safety net: force-reveal any elements the observer missed after 3s.
  // Covers edge cases where elements are already in viewport but observer
  // callback hasn't fired yet, or observer fails silently.
  window.setTimeout(() => {
    items.forEach((el) => {
      if (!el.classList.contains("is-visible")) {
        el.classList.add("is-visible");
      }
    });
  }, 3000);
}

/* --------------------------------------------------------------------------
 * HEADER — transparent over hero, solid surface after scroll
 * ------------------------------------------------------------------------ */
function initHeader() {
  const header = document.querySelector<HTMLElement>("[data-header]");
  if (!header) return;

  let ticking = false;
  const update = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
    ticking = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
}

/* --------------------------------------------------------------------------
 * SCROLL-SPY — animate the nav active indicator
 * ------------------------------------------------------------------------ */
function initScrollSpy() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".nav-desktop__link[href^='#']"));
  const sections = links
    .map((l) => document.querySelector<HTMLElement>(l.hash))
    .filter((s): s is HTMLElement => s !== null);
  if (!sections.length || !("IntersectionObserver" in window)) return;

  const byId = new Map<string, HTMLAnchorElement>();
  links.forEach((l) => byId.set(l.hash.slice(1), l));

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((l) => {
          l.classList.remove("is-active");
          l.removeAttribute("aria-current");
        });
        const link = byId.get(entry.target.id);
        if (link) {
          link.classList.add("is-active");
          link.setAttribute("aria-current", "true");
        }
      }
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  sections.forEach((s) => io.observe(s));
}

/* --------------------------------------------------------------------------
 * MOBILE MENU — focus trap, Escape to close, scroll lock
 * ------------------------------------------------------------------------ */
function initMobileMenu() {
  const menu = document.querySelector<HTMLElement>("[data-mobile-menu]");
  const toggle = document.querySelector<HTMLButtonElement>("[data-menu-toggle]");
  const closeBtn = document.querySelector<HTMLButtonElement>("[data-menu-close]");
  if (!menu || !toggle) return;

  let lastFocused: HTMLElement | null = null;

  const open = () => {
    lastFocused = document.activeElement as HTMLElement;
    menu.hidden = false;
    // Focus must wait for visibility (the menu is hidden until .is-open lands)
    requestAnimationFrame(() => {
      menu.classList.add("is-open");
      closeBtn?.focus();
    });
    toggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    lenis?.stop(); // Lenis animates window scroll and ignores body overflow
  };

  const close = () => {
    menu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    lenis?.start();
    window.setTimeout(() => {
      if (!menu.classList.contains("is-open")) menu.hidden = true;
    }, prefersReducedMotion ? 0 : 240);
    lastFocused?.focus();
  };

  toggle.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  // Capture phase on purpose: the overlay has to be gone — scroll lock released,
  // Lenis resumed — *before* the anchor's own navigation handler runs. On the
  // bubble phase this depended on which initializer happened to register first.
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", close, true));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("is-open")) close();
    // Focus trap: Tab must cycle inside the open menu, never reach the page behind it
    if (e.key === "Tab" && menu.classList.contains("is-open")) {
      const focusables = Array.from(
        menu.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((el) => {
        const style = getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
      });
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !menu.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

/* --------------------------------------------------------------------------
 * ACTIVE SECTION HERO CTA — programme links preselect the booking choice
 * ------------------------------------------------------------------------ */
function initProgrammePreselect() {
  document.querySelectorAll<HTMLAnchorElement>("[data-programme-link]").forEach((a) => {
    a.addEventListener("click", () => {
      const value = a.dataset.programmeLink;
      const radio = document.querySelector<HTMLInputElement>(
        `input[name="programme"][value="${value}"]`
      );
      if (radio) radio.checked = true;
    });
  });
}

/* --------------------------------------------------------------------------
 * TOAST — polite status messaging
 * ------------------------------------------------------------------------ */
function showToast(message: string) {
  const region = document.querySelector<HTMLElement>("[data-toast-region]");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span>${message}</span>`;
  region.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-shown"));
  window.setTimeout(() => {
    toast.classList.remove("is-shown");
    window.setTimeout(() => toast.remove(), prefersReducedMotion ? 0 : 300);
  }, 5000);
}

/* --------------------------------------------------------------------------
 * SMOOTH SCROLL — Lenis inertial scrolling. Skipped entirely under
 * prefers-reduced-motion (native scroll stays); anchor links route through
 * Lenis for consistent easing with the sticky-header offset already defined
 * by html { scroll-padding-top }.
 * ------------------------------------------------------------------------ */
let lenis: Lenis | null = null;

/**
 * Move to a section, optionally recording it in the address bar.
 *
 * `lenis.start()` first is the important line, not a formality: the overlay menu
 * stops Lenis while it is open, and `initSmoothScroll` is registered before
 * `initMobileMenu` in the boot list — so this handler used to run while the
 * engine was paused. A scrollTo() queued on a stopped Lenis is silently
 * discarded when start() resyncs, and a phone tap closed the menu and left the
 * page exactly where it was.
 *
 * No `offset` is passed, deliberately. Measured against Chromium: Lenis 1.3
 * already honours `html { scroll-padding-top }` for an element target (offset 0
 * lands a section exactly 96px down, which is the declared padding), so adding a
 * header-height offset here double-counts it and parks the heading 192px below
 * the fold. `npm run nav:check` asserts the landing band, so a Lenis upgrade
 * that stops honouring it fails the gate instead of silently covering headings.
 */
function goToSection(target: HTMLElement, record: boolean): void {
  if (lenis) {
    lenis.start();
    lenis.scrollTo(target);
  } else {
    // Reduced motion: same destination, no animation. scrollIntoView honours
    // scroll-padding-top natively, so the header clearance is identical.
    target.scrollIntoView({ behavior: "auto", block: "start" });
  }
  if (record) {
    const id = `#${target.id}`;
    if (location.hash !== id) {
      try {
        history.pushState(history.state, "", id);
      } catch {
        /* opaque origin / file:// — the scroll already happened, keep going */
      }
    }
  }
}

function initSmoothScroll() {
  if (!prefersReducedMotion) {
    lenis = new Lenis({ lerp: 0.12, autoRaf: true });
    // Debug/automation handle, alongside __dpBooted. Lenis rewrites window scroll
    // from its rAF loop, so a plain `window.scrollTo()` from devtools or a test
    // gets pulled back to the animated position — this is the supported way to
    // drive the page programmatically.
    window.__dpLenis = lenis;
  }

  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector<HTMLElement>(id);
      if (!target) return;
      e.preventDefault();
      goToSection(target, true);
      // preventDefault kills the browser's fragment focus, so restore it for
      // keyboard users (skip link, in-page nav). Scroll itself stays above.
      if (target.matches('[tabindex], a, button, input, select, textarea')) {
        target.focus({ preventScroll: true });
      }
    });
  });

  // pushState makes the back button walk through the sections a visitor asked
  // for instead of leaving the site; this is what honours that walk.
  window.addEventListener("popstate", () => {
    const id = location.hash;
    if (!id || id === "#") return;
    const target = document.querySelector<HTMLElement>(id);
    if (target) goToSection(target, false);
  });

  // A fragment jump on first paint happens before the hero media and the
  // carousel clones have sized themselves, so the destination drifts ~100px off.
  // Re-align once, on the frame after `load`, and never if the visitor has
  // already scrolled of their own accord.
  const frag = location.hash;
  if (frag.length > 1) {
    const target = document.querySelector<HTMLElement>(frag);
    const landedAt = window.scrollY;
    window.addEventListener("load", () => {
      requestAnimationFrame(() => {
        if (target && Math.abs(window.scrollY - landedAt) < 4) goToSection(target, false);
      });
    });
  }
}

/* --------------------------------------------------------------------------
 * BOOT
 * ------------------------------------------------------------------------ */
// Tells the index.html watchdog this bundle is alive, so it keeps the `js`
// class and the reveal animations. If this file ever 404s (bad deploy path,
// blocked CDN), the watchdog strips `js` after 3s and the page renders fully
// visible: a broken build degrades to readable content, never a blank SERP.
window.__dpBooted = true;

// Every enhancement is isolated: one throwing initializer must never take the
// others — or the page's own text — down with it.
// CRITICAL features loaded immediately:
for (const step of [
  initHeroMedia,
  initGreeting,
  initSmoothScroll,
  initReveals,
  initHeader,
  initScrollSpy,
  initMobileMenu,
  initProgrammePreselect,
  initBooking,
  initReviewsCarousel,
]) {
  try {
    step();
  } catch (err) {
    console.error("[atabul] enhancement failed, continuing:", err);
  }
}

// LAZY-LOADED features (loaded when their section enters viewport):
initLazyFeatures();

// Second fail-open: the bundle booted but the reveal observer never installed
// (throws, frozen API). Show the content instead of leaving it at opacity:0 in
// the rendered snapshot Google indexes.
if (!revealsInstalled) revealAll();

// Export for feature modules
export { showToast, prefersReducedMotion, lenis };