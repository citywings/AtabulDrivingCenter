/**
 * RULES RAIL — vertical video carousel beside the FAQ.
 * Lazy-loaded when FAQ section is near viewport (desktop only).
 */
import { prefersReducedMotion } from "../main";

export function init() {
  const rail = document.querySelector<HTMLElement>("[data-rules-rail]");
  const track = rail?.querySelector<HTMLElement>("[data-rules-track]");
  if (!rail || !track) return;
  if (prefersReducedMotion) return;

  for (const el of [...track.children] as HTMLElement[]) {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.setAttribute("aria-hidden", "true");
    track.appendChild(clone);
  }

  const setDuration = () => {
    const half = track.scrollHeight / 2;
    track.style.setProperty("--rules-duration", `${Math.max(45, Math.round(half / 30))}s`);
  };
  setDuration();
  window.addEventListener("resize", setDuration, { passive: true });

  const videos = Array.from(track.querySelectorAll<HTMLVideoElement>("[data-rule-video]"));

  const pauseBtn = rail.querySelector<HTMLButtonElement>("[data-marquee-pause]");
  let userPaused = false;
  pauseBtn?.addEventListener("click", () => {
    const wasPaused = pauseBtn.getAttribute("aria-pressed") === "true";
    userPaused = !wasPaused;
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

  window.setInterval(() => {
    if (inView) videos.forEach(sync);
  }, 1500);
}