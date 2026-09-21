/// <reference types="vite/client" />

declare module "*.mp4" {
  const src: string;
  export default src;
}
declare module "*.webp" {
  const src: string;
  export default src;
}
declare module "*.avif" {
  const src: string;
  export default src;
}
declare module "*.jpg" {
  const src: string;
  export default src;
}
declare module "*.svg" {
  const src: string;
  export default src;
}

/**
 * Boot flag for the progressive-enhancement watchdog in index.html: the inline
 * head script removes the `js` class (revealing all `.reveal` content) if the
 * module never runs. This file is a global ambient script, so the interface
 * merges with lib.dom's Window directly — no `declare global` wrapper needed.
 */
interface Window {
  __dpBooted?: boolean;
  /**
   * Structural (not `Lenis`) so this ambient file stays import-free. Assigned in
   * initSmoothScroll for devtools and for scripts/device-audit.mjs, which needs
   * to move the page past Lenis's rAF scroll rewriting.
   */
  __dpLenis?: { scrollTo: (_target: number | HTMLElement | string, _opts?: { immediate?: boolean }) => void } | null;
}
