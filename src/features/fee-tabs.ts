/**
 * FEE TABS — horizontal tab navigation for fee categories.
 * Lazy-loaded when fees section is near viewport.
 */
export function init() {
  const tabs = document.querySelectorAll<HTMLButtonElement>(".fees__tab");
  const panels = document.querySelectorAll<HTMLDivElement>(".fees__panel");
  if (!tabs.length || !panels.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("aria-controls");
      if (!targetId) return;

      tabs.forEach((t) => {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");

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