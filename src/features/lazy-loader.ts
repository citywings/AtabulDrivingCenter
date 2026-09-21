/**
 * LAZY LOADER — IntersectionObserver-based dynamic imports for below-fold features.
 * Loads feature modules only when their section enters the viewport.
 */

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Use type assertions via unknown to satisfy TypeScript - all feature modules export an init() function
const featureLoaders = [
  {
    selector: "#reviews",
    importFn: () => import("@/features/reviews-marquee") as unknown as Promise<{ init(): void }>,
    rootMargin: "200px",
  },
  {
    selector: "#faq",
    importFn: () => import("@/features/accordion") as unknown as Promise<{ init(): void }>,
    rootMargin: "200px",
  },
  {
    selector: "#fees",
    importFn: () => import("@/features/fee-tabs") as unknown as Promise<{ init(): void }>,
    rootMargin: "200px",
  },
  {
    selector: "#instructor",
    importFn: () => import("@/features/instructor-image") as unknown as Promise<{ init(): void }>,
    rootMargin: "200px",
  },
  // Rules rail only on desktop (≥64em)
  {
    selector: "[data-rules-rail]",
    importFn: () => import("@/features/rules-rail") as unknown as Promise<{ init(): void }>,
    rootMargin: "200px",
  },
] as const;

const loadedFeatures = new Set<string>();

function initLazyFeatures() {
  if (!("IntersectionObserver" in window)) {
    // Fallback: load all features immediately if no IntersectionObserver
    featureLoaders.forEach(({ importFn }) => importFn());
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        const feature = featureLoaders.find((f) => {
          const el = document.querySelector(f.selector);
          return el === entry.target;
        });

        if (!feature || loadedFeatures.has(feature.selector)) continue;

        loadedFeatures.add(feature.selector);

        // Skip rules rail on mobile (prefers-reduced-motion or small viewport)
        if (feature.selector === "[data-rules-rail]") {
          const isMobile = window.matchMedia("(max-width: 63.9375em)").matches;
          if (isMobile || prefersReducedMotion) continue;
        }

        feature.importFn().then((module) => {
          try {
            module.init();
          } catch (err) {
            console.error(`[atabul] lazy feature ${feature.selector} failed:`, err);
          }
        });
      }
    },
    { rootMargin: "200px" }
  );

  featureLoaders.forEach(({ selector }) => {
    const el = document.querySelector(selector);
    if (el) observer.observe(el);
  });
}

// Export for early initialization if needed
export { initLazyFeatures };