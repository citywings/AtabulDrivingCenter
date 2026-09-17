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
import { waHref } from "./config/contact";

import { assets } from "@/config/assets";
import { initGreeting } from "./components/greeting";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* --------------------------------------------------------------------------
 * HERO MEDIA — registry-resolved sources, graceful fallback chain:
 * poster <img> is LCP; video fades in when it can actually play.
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
      // A <picture> ladder wins over <img src>: assigning a fallback src is
      // only honoured once the matching <source> elements are detached.
      posterImg.closest("picture")?.querySelectorAll("source").forEach((s) => s.remove());
      posterImg.src = assets.hero.primary.poster;
    },
    { once: true }
  );

  // Registry-driven source resolution (no hard-coded paths in markup).
  // Reduced motion keeps the poster-only hero: no video fetch at all.
  const isMobile = window.matchMedia("(max-width: 47.9375em)");
  const markReady = () => media.classList.add("video-ready");
  let chosen = "";
  const setSource = () => {
    const src = isMobile.matches ? assets.hero.primary.mobile : assets.hero.primary.desktop;
    if (chosen !== src) {
      chosen = src;
      video.src = src;
      video.load();
      // A fresh src starts paused; retry playback (desktop/mobile rotation)
      void video.play().then(markReady).catch(() => {});
    }
  };
  if (prefersReducedMotion) return;

  // The video is a 1-2 MB enhancement behind the poster; start it only after
  // the page has loaded so it never competes with fonts and the LCP poster.
  if (document.readyState === "complete") {
    setSource();
  } else {
    window.addEventListener("load", setSource, { once: true });
  }
  isMobile.addEventListener("change", setSource);

  // The playing event marks readiness once the video actually renders frames.
  // No separate play() call here — setSource() handles playback after load.
  video.addEventListener("playing", markReady, { once: true });
}

/* --------------------------------------------------------------------------
 * INSTRUCTOR PORTRAIT — consume the logical asset ID from the registry.
 * The public/ copy only serves no-JS visitors; JS users get the
 * fingerprinted registry URL.
 * ------------------------------------------------------------------------ */
function initInstructorImage() {
  const img = document.querySelector<HTMLImageElement>("[data-instructor-img]");
  if (!img) return;
  // Version param busts any stale cached copy of the unhashed fallback.
  img.src = `${assets.instructor.primary.image}?v=2`;
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
 * ACCORDION — single-open, animated height, accessible
 * ------------------------------------------------------------------------ */
function initAccordion() {
  const root = document.querySelector<HTMLElement>("[data-accordion]");
  if (!root) return;
  const triggers = Array.from(root.querySelectorAll<HTMLButtonElement>(".accordion__trigger"));

  triggers.forEach((trigger) => {
    const panel = root.querySelector<HTMLElement>(`#${trigger.getAttribute("aria-controls")}`);
    if (!panel) return;

    trigger.addEventListener("click", () => {
      const isOpen = trigger.getAttribute("aria-expanded") === "true";
      // close others
      triggers.forEach((t) => {
        if (t === trigger) return;
        t.setAttribute("aria-expanded", "false");
        root.querySelector<HTMLElement>(`#${t.getAttribute("aria-controls")}`)?.classList.remove("is-open");
      });
      trigger.setAttribute("aria-expanded", String(!isOpen));
      panel.classList.toggle("is-open", !isOpen);
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
 * BOOKING — 5-step flow with accessible validation and WhatsApp handoff.
 * Semantics: this is a REQUEST. Confirmation happens only via the academy.
 * ------------------------------------------------------------------------ */
function initBooking() {
  const formEl = document.querySelector<HTMLFormElement>("#booking-form");
  if (!formEl) return;
  const form: HTMLFormElement = formEl;

  const panes = Array.from(form.querySelectorAll<HTMLElement>("[data-pane]"));
  const chips = Array.from(form.querySelectorAll<HTMLElement>("[data-step-chip]"));
  const backBtn = form.querySelector<HTMLButtonElement>("[data-back]");
  const nextBtn = form.querySelector<HTMLButtonElement>("[data-next]");
  const submitBtn = form.querySelector<HTMLButtonElement>("[data-submit]");
  const progressBar = form.querySelector<HTMLElement>("[data-progress-bar]");
  const success = document.querySelector<HTMLElement>("[data-success]");

  let step = 0;
  const LAST = panes.length - 1;

  const paneInputs = (i: number) =>
    Array.from(panes[i].querySelectorAll<HTMLInputElement>("input, textarea"));

  function validatePane(i: number): boolean {
    let ok = true;
    for (const input of paneInputs(i)) {
      const fieldName = input.name;
      const errorEl = form.querySelector<HTMLElement>(`[data-error-for="${fieldName}"]`);
      let message = "";
      if (input.required && input.type !== "checkbox" && !input.value.trim()) {
        message = "This field is required.";
      } else if (input.type === "checkbox" && input.required && !input.checked) {
        message = "Please accept to continue.";
      } else if (input.type === "tel" && input.value.trim()) {
        const digits = input.value.replace(/\D/g, "");
        if (digits.length < 10) message = "Enter a valid phone number (at least 10 digits).";
      } else if (input.type === "date" && input.value) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(`${input.value}T00:00:00`) < today) {
          message = "Please choose today or a future date.";
        }
      }
      const field = input.closest(".field");
      field?.classList.toggle("has-error", Boolean(message));
      // Radios own their group error below; the per-input write would let the
      // later (non-required) radios of a group erase what the first one wrote.
      if (errorEl && input.type !== "radio") errorEl.textContent = message;
      if (input.type === "radio") {
        // Group-level: the error <p> lives in the fieldset (no .field wrapper),
        // so has-error is toggled on the pane itself. The group is re-evaluated
        // once per radio, so only clear when something is actually checked.
        const group = panes[i].querySelectorAll<HTMLInputElement>(`input[name="${fieldName}"]`);
        const anyChecked = Array.from(group).some((r) => r.checked);
        const groupError = form.querySelector<HTMLElement>(`[data-error-for="${fieldName}"]`);
        const groupPane = groupError?.closest(".booking__pane");
        if (anyChecked) {
          if (groupError) groupError.textContent = "";
          groupPane?.classList.remove("has-error");
        } else if (input.required) {
          ok = false;
          if (groupError) groupError.textContent = "Please choose an option.";
          groupPane?.classList.add("has-error");
        }
        continue;
      }
      if (message) ok = false;
    }
    return ok;
  }

  function render() {
    panes.forEach((p, i) => p.classList.toggle("is-active", i === step));
    chips.forEach((c, i) => {
      c.classList.toggle("is-current", i === step);
      c.classList.toggle("is-done", i < step);
    });
    if (progressBar) progressBar.style.width = `${((step + 1) / panes.length) * 100}%`;
    if (backBtn) backBtn.disabled = step === 0;
    if (nextBtn && submitBtn) {
      nextBtn.hidden = step === LAST;
      submitBtn.hidden = step !== LAST;
    }
  }

  function goTo(i: number) {
    step = Math.max(0, Math.min(LAST, i));
    render();
    panes[step].querySelector<HTMLElement>("legend")?.focus?.();
  }

  nextBtn?.addEventListener("click", () => {
    if (validatePane(step)) {
      goTo(step + 1);
    } else {
      const firstInvalid = panes[step].querySelector<HTMLElement>(".has-error input");
      firstInvalid?.focus();
      showToast("Please complete the highlighted field.");
    }
  });

  backBtn?.addEventListener("click", () => goTo(step - 1));

  // Enter advances instead of submitting prematurely (never hijack buttons:
  // Enter on Back must go back, not forward)
  form.addEventListener("keydown", (e) => {
    if (
      e.key === "Enter" &&
      step < LAST &&
      (e.target as HTMLElement).tagName !== "TEXTAREA" &&
      !(e.target as HTMLElement).closest("button")
    ) {
      e.preventDefault();
      nextBtn?.click();
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    // Validate every pane before building the request summary.
    for (let i = 0; i <= LAST; i++) {
      if (!validatePane(i)) {
        goTo(i);
        showToast("Please complete the highlighted field.");
        return;
      }
    }

    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? "");

    if (success) {
      const summary = success.querySelector<HTMLElement>("[data-summary]");
      const wa = success.querySelector<HTMLAnchorElement>("[data-wa-link]");
      // User input is never safe as HTML - escape it before display.
      const esc = (s: string) =>
        s.replace(/[&<>"']/g, (ch) =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch
        );
      if (summary) {
        summary.innerHTML = `
          <div><dt>Programme</dt><dd>${esc(get("programme"))}</dd></div>
          <div><dt>Experience</dt><dd>${esc(get("experience"))}</dd></div>
          <div><dt>Preferred start</dt><dd>${esc(get("date") || "-")}</dd></div>
          <div><dt>Preferred time</dt><dd>${esc(get("time"))}</dd></div>
          <div><dt>Contact</dt><dd>${esc(get("name"))} · ${esc(get("phone"))}</dd></div>
          ${get("note") ? `<div><dt>Note</dt><dd>${esc(get("note"))}</dd></div>` : ""}`;
      }
      if (wa) {
        const lines = [
          "Atabul Driving Center - training request",
          `Programme: ${get("programme")}`,
          `Experience: ${get("experience")}`,
          `Preferred start: ${get("date") || "flexible"} (${get("time")})`,
          `Name: ${get("name")}`,
          `Phone: ${get("phone")}`,
          get("note") ? `Note: ${get("note")}` : "",
        ].filter(Boolean);
        wa.href = waHref(lines.join("\n"));
      }
      form.hidden = true;
      success.hidden = false;
      success.classList.add("is-active");
      if (lenis) lenis.scrollTo(success, { offset: 0 });
      else success.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
    }
  });

  // Min date = today, in LOCAL time (toISOString is UTC and shifts for IST)
  const dateInput = form.querySelector<HTMLInputElement>("input[type='date']");
  if (dateInput) dateInput.min = new Date().toLocaleDateString("en-CA");

  render();
}

/* --------------------------------------------------------------------------
 * REVIEWS MARQUEE — seamless infinite drift. Duplicates the track's own
 * children once, then sizes the loop duration from real content width so
 * the scroll speed stays constant regardless of review count.
 * ------------------------------------------------------------------------ */
function initReviewsMarquee() {
  const marquee = document.querySelector<HTMLElement>("[data-marquee]");
  const track = marquee?.querySelector<HTMLElement>("[data-marquee-track]");
  if (!marquee || !track) return;
  if (prefersReducedMotion) return; // CSS falls back to a static wrapped list

  // Mirror the cards once — the keyframes translate -50%, so the second copy
  // lands exactly where the first began, and the loop is seamless.
  const originals = [...track.children] as HTMLElement[];
  for (const el of originals) {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.setAttribute("aria-hidden", "true"); // screen readers read one copy
    track.appendChild(clone);
  }

  // Constant slow drift (~60px/s — a card passes roughly every 6s) regardless
  // of how wide the content is.
  const setDuration = () => {
    const setWidth = track.scrollWidth / 2;
    track.style.setProperty("--marquee-duration", `${Math.max(60, Math.round(setWidth / 60))}s`);
  };
  setDuration();
  document.fonts?.ready.then(setDuration); // font metrics change card widths
  window.addEventListener("resize", setDuration, { passive: true });

  // Explicit pause control (WCAG 2.2.2) — hover alone is not sufficient.
  const pauseBtn = marquee.querySelector<HTMLButtonElement>("[data-marquee-pause]");
  pauseBtn?.addEventListener("click", () => {
    const paused = pauseBtn.getAttribute("aria-pressed") === "true";
    pauseBtn.setAttribute("aria-pressed", String(!paused));
    // aria-pressed=true means PAUSED; label should reflect the action that WILL happen
    pauseBtn.setAttribute("aria-label", paused ? "Resume review carousel" : "Pause review carousel");
    // "" clears the inline override so :hover/:focus-within pausing keeps working
    track.style.animationPlayState = paused ? "" : "paused";
  });
}

/* --------------------------------------------------------------------------
 * RULES RAIL — vertical video carousel beside the FAQ. Mirrors the track for
 * the seamless top→bottom loop, lazily assigns sources, and plays only the
 * clips actually visible inside the rail window.
 * ------------------------------------------------------------------------ */
function initRulesRail() {
  const rail = document.querySelector<HTMLElement>("[data-rules-rail]");
  const track = rail?.querySelector<HTMLElement>("[data-rules-track]");
  if (!rail || !track) return;
  if (prefersReducedMotion) return; // CSS shows a static poster list

  // Mirror once — keyframes translate -50%, so the loop is seamless.
  for (const el of [...track.children] as HTMLElement[]) {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.setAttribute("aria-hidden", "true");
    track.appendChild(clone);
  }

  // Constant slow drift (~30px/s) regardless of track height.
  const setDuration = () => {
    const half = track.scrollHeight / 2;
    track.style.setProperty("--rules-duration", `${Math.max(45, Math.round(half / 30))}s`);
  };
  setDuration();
  window.addEventListener("resize", setDuration, { passive: true });

  const videos = Array.from(track.querySelectorAll<HTMLVideoElement>("[data-rule-video]"));

  // Explicit pause control (WCAG 2.2.2) — pauses drift AND clip playback.
  const pauseBtn = rail.querySelector<HTMLButtonElement>("[data-marquee-pause]");
  let userPaused = false;
  pauseBtn?.addEventListener("click", () => {
    const wasPaused = pauseBtn.getAttribute("aria-pressed") === "true";
    userPaused = !wasPaused; // pressing Pause (pressed=false) pauses; pressing again resumes
    pauseBtn.setAttribute("aria-pressed", String(userPaused));
    pauseBtn.setAttribute("aria-label", userPaused ? "Resume rule clips carousel" : "Pause rule clips carousel");
    track.style.animationPlayState = userPaused ? "paused" : "";
    if (userPaused) videos.forEach((v) => v.pause());
  });

  let inView = false;
  const sync = (v: HTMLVideoElement) => {
    if (!inView || userPaused) {
      v.pause();
      return;
    }
    const r = v.getBoundingClientRect();
    const w = rail.getBoundingClientRect();
    const overlaps = r.top < w.bottom + 80 && r.bottom > w.top - 80;
    if (overlaps) {
      if (!v.src) {
        v.src = v.dataset.src ?? "";
        // Retry play once the video has loaded enough data
        v.addEventListener(
          "canplay",
          () => {
            if (inView && !userPaused) void v.play().catch(() => {});
          },
          { once: true }
        );
      }
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  new IntersectionObserver(
    (entries) => {
      inView = entries[0]?.isIntersecting ?? false;
      videos.forEach(sync);
    },
    { rootMargin: "120px" }
  ).observe(rail);

  // Cards drift, so re-evaluate which clips deserve to play.
  window.setInterval(() => {
    if (inView) videos.forEach(sync);
  }, 1500);
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
 * FEES TABS — horizontal tab navigation for fee categories
 * ------------------------------------------------------------------------ */
function initFeeTabs() {
  const tabs = document.querySelectorAll<HTMLButtonElement>(".fees__tab");
  const panels = document.querySelectorAll<HTMLDivElement>(".fees__panel");
  if (!tabs.length || !panels.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("aria-controls");
      if (!targetId) return;

      // Update tabs
      tabs.forEach((t) => {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");

      // Update panels
      panels.forEach((p) => {
        if (p.id === targetId) {
          p.classList.add("is-active");
          p.hidden = false;
        } else {
          p.classList.remove("is-active");
          p.hidden = true;
        }
      });
    });
  });
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
for (const step of [
  initHeroMedia,
  initGreeting,
  initInstructorImage,
  initSmoothScroll,
  initReveals,
  initHeader,
  initScrollSpy,
  initMobileMenu,
  initProgrammePreselect,
  initAccordion,
  initBooking,
  initReviewsMarquee,
  initRulesRail,
  initFeeTabs,
]) {
  try {
    step();
  } catch (err) {
    console.error("[atabul] enhancement failed, continuing:", err);
  }
}

// Second fail-open: the bundle booted but the reveal observer never installed
// (throws, frozen API). Show the content instead of leaving it at opacity:0 in
// the rendered snapshot Google indexes.
if (!revealsInstalled) revealAll();
