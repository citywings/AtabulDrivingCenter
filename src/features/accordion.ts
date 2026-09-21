/**
 * ACCORDION — single-open, animated height, accessible.
 * Lazy-loaded when FAQ section is near viewport.
 */
export function init() {
  const root = document.querySelector<HTMLElement>("[data-accordion]");
  if (!root) return;
  const triggers = Array.from(root.querySelectorAll<HTMLButtonElement>(".accordion__trigger"));

  triggers.forEach((trigger) => {
    const panel = root.querySelector<HTMLElement>(`#${trigger.getAttribute("aria-controls")}`);
    if (!panel) return;

    trigger.addEventListener("click", () => {
      const isOpen = trigger.getAttribute("aria-expanded") === "true";
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