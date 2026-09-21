/**
 * BOOKING FORM — 5-step flow with accessible validation and WhatsApp handoff.
 * Lazy-loaded when user navigates to booking section.
 */
import { waHref } from "@/config/contact";
import { showToast, prefersReducedMotion } from "../main";

export function init() {
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
  let isInitialRender = true;

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
      if (errorEl && input.type !== "radio") errorEl.textContent = message;
      if (input.type === "radio") {
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
    // Disable pane animation on initial render for instant first-step visibility
    if (isInitialRender) {
      form.classList.add("booking--no-animate");
    }
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
    // Re-enable animation after first paint
    if (isInitialRender) {
      requestAnimationFrame(() => {
        form.classList.remove("booking--no-animate");
        isInitialRender = false;
      });
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
          ({ "&": "&", "<": "<", ">": ">", '"': "\"", "'": "'" })[ch] ?? ch
        );
      if (summary) {
        summary.innerHTML = `
          <div><dt>Programme</dt><dd>${esc(get("programme"))}</dd></div>
          <div><dt>Experience</dt><dd>${esc(get("experience"))}</dd></div>
          <div><dt>Preferred start</dt><dd>${esc(get("date") || "-")}</dd></div>
          <div><dt>Preferred time</dt><dd>${esc(get("time"))}</dd></div>
          <div><dt>Contact</dt><dd>${esc(get("name"))} \u00b7 ${esc(get("phone"))}</dd></div>
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
      if (window.__dpLenis) window.__dpLenis.scrollTo(success);
      else success.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
    }
  });

  const dateInput = form.querySelector<HTMLInputElement>("input[type='date']");
  if (dateInput) dateInput.min = new Date().toLocaleDateString("en-CA");

  form.querySelectorAll<HTMLInputElement>("input[type='radio']").forEach((radio) => {
    radio.checked = false;
  });

  form.querySelectorAll<HTMLLabelElement>(".option").forEach((label) => {
    label.addEventListener("click", (e) => {
      const input = label.querySelector<HTMLInputElement>("input[type='radio']");
      if (input && e.target !== input) {
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  });

  render();
}