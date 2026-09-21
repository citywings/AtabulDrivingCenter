/**
 * INSTRUCTOR PORTRAIT — consume the logical asset ID from the registry.
 * Lazy-loaded when instructor section is near viewport.
 */
import { assets } from "@/config/assets";

export function init() {
  const img = document.querySelector<HTMLImageElement>("[data-instructor-img]");
  if (!img) return;
  img.src = `${assets.instructor.primary.image}?v=2`;
}