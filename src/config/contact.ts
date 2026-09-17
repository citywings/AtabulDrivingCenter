/**
 * The published contact numbers, in exactly one place.
 *
 * Three consumers must never disagree, and today they do not have to be kept in
 * step by hand: the JSON-LD `telephone`/`contactPoint` (build time, via
 * `src/seo/site.ts`), the click-to-call and WhatsApp hrefs rendered in
 * `index.html` (checked against this file by the build gate in
 * `vite/plugins/seo.ts`), and the booking handoff link (`src/main.ts`, runtime).
 *
 * This module is deliberately tiny and free of copy text: `src/seo/site.ts`
 * holds a lot of prose that must stay out of the client bundle, so anything
 * imported by `main.ts` lives here instead.
 */
export const CONTACT = {
  /** Atabul's line — click-to-call, WhatsApp and the GBP-facing number. */
  phone: "+916290345383",
  phoneDisplay: "+91 62903 45383",
  /** Same number in the `wa.me` form: no `+`, no spaces. */
  whatsappNumber: "916290345383",
  /** Pre-filled first message for a cold enquiry from the fixed rail. */
  enquiryMessage:
    "Hello Atabul Driving Center, I would like to know about four-wheeler driving lessons in Kaikhali.",
  /** Second line, published only for driver-service enquiries. */
  driverServicePhone: "+919748449601",
  driverServiceDisplayPhone: "+91 97484 49601",
} as const;

export const telHref = `tel:${CONTACT.phone}`;

/** `wa.me` deep link. WhatsApp wants the message percent-encoded. */
export function waHref(message: string = CONTACT.enquiryMessage): string {
  return `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
