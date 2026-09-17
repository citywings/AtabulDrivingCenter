/**
 * ATABUL DRIVING CENTER — GREETING UI
 * Renders personalized greeting in the hero section with staggered entrance animation.
 * Follows existing reveal patterns and design tokens.
 */

import { getGreeting as fetchGreeting } from '../services/greeting';

/** Initialize the greeting component in the hero section. */
export async function initGreeting(): Promise<void> {
  const heroInner = document.querySelector<HTMLElement>('.hero__inner');
  if (!heroInner) return;

  // Don't block hero render — fetch in background
  const result = await fetchGreeting();

  // Create greeting element
  const greetingEl = document.createElement('p');
  greetingEl.className = 'hero__greeting reveal';
  greetingEl.style.setProperty('--reveal-delay', '40ms');
  greetingEl.setAttribute('aria-live', 'polite');
  greetingEl.textContent = result.text;

  // Insert after eyebrow (first child of hero__inner)
  const eyebrow = heroInner.querySelector('.hero__eyebrow');
  if (eyebrow) {
    eyebrow.insertAdjacentElement('afterend', greetingEl);
  } else {
    heroInner.prepend(greetingEl);
  }

  // Trigger reveal animation (CSS handles the rest via .js .reveal)
  // The .js class is already on <html> by the time this runs
  requestAnimationFrame(() => {
    greetingEl.classList.add('is-visible');
  });
}