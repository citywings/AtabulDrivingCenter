# ATABUL DRIVING CENTER — DESIGN SYSTEM

> **Precision in every pixel. Confidence in every drive.**
> Version 1.0 · Kaikhali, Kolkata

The single source of truth for Atabul Driving Center's digital brand experience.
Every component and page inherits from this document and from
`src/styles/tokens.css`. Nothing visual may be implemented with magic
numbers or off-system colors.

**Naming.** The business was renamed to **Atabul Driving Center** (from
"DrivePro Academy") across page copy, structured data, the WhatsApp hand-off, the
asset pipeline and this document. What deliberately did *not* change: the
`--dp-*` token namespace and the `dp` class prefix in comments — internal
identifiers, not brand copy. (The `D`-chevron mark that survived the rename has since
been replaced; §4, §4a.) A
mechanical rename of ~500 token references is a separate pass with zero
user-visible effect, so it stays out of brand changes. The generic English noun
"academy" ("academy vehicle", "until the academy confirms") also stays: it is a
common noun in this copy, not the name.

The one thing a rename cannot fix is *inside* the media: if any hero or
`rules/*.mp4` clip carries burned-in lettering of the old name, no text change in
this repository can reach it, and this toolchain cannot see frames. Flagged for a
human eye rather than reported as done.

---

## 1. Brand philosophy

Atabul Driving Center blends **premium automotive editorial** with **modern
technology**, **precision engineering**, and **Indian driving education**.
The interface feels cinematic but restrained, minimal but not empty,
technical but human, premium but not intimidating.

Design pillars:

| Pillar | Expression |
|---|---|
| Precision | 4px spacing system, hairline borders, mono technical labels, thin gold rules |
| Confidence | Light-weight display typography, generous whitespace, single clear CTA per view |
| Safety | Honest states, no dark patterns, booking is a *request* until the academy confirms |
| Trust | Verified facts only; `[To be confirmed]` placeholders where data is pending |
| Indian context | Left-side traffic, right-hand-drive vehicles, Kaikhali–Baguiati locality front and centre |

The supplied BMW.com style reference was used as **inspiration only**
(typographic restraint, surface polarity, editorial whitespace). No layout,
composition, logo, copy, or identity elements were copied.

---

## 2. Color tokens

Defined in `src/styles/tokens.css`. Gold is a **precision accent** — active
states, small highlights, key rules, selected controls — never a dominant
page color. Gradients are used only as readability scrims over hero media,
never as decoration.

| Token | Value | Role |
|---|---|---|
| `--dp-navy-900` | `#0B1B2B` | Deep Drive Navy — primary brand surface, dark sections, footer |
| `--dp-navy-800` | `#132A40` | Professional Navy — hover elevation, secondary surface |
| `--dp-navy-700` | `#1D3A55` | Hover elevation of navy-800 |
| `--dp-navy-600` | `#27507A` | Active/decorative accent on light surfaces (≥3:1) |
| `--dp-gold-500` | `#C99A2E` | brand gold — precision accent on light surfaces |
| `--dp-gold-400` | `#DAB054` | Gold on navy surfaces (contrast-safe) |
| `--dp-gold-600` | `#A87F1F` | Gold hover state |
| `--dp-surface` | `#F5F5F2` | Light surface band |
| `--dp-white` | `#FFFFFF` | Canvas |
| `--dp-ink` | `#111820` | Primary text |
| `--dp-muted` | `#6B737B` | Muted text on light (≥4.5:1 on white/surface) |
| `--dp-muted-dark` | `#A7B4BF` | Muted text on navy (≥4.5:1 on navy-900) |
| `--dp-border` | `#D9DDE1` | Hairline borders |
| `--dp-border-strong` | `#B7BEC4` | Form borders, stronger dividers |
| `--dp-error` / `-bg` | `#B3372E` / `#F9E9E7` | Errors (never color alone — icon + text) |
| `--dp-success` / `-bg` | `#1E7A46` / `#E6F3EC` | Success states |
| `--dp-warning` / `-bg` | `#8A6116` / `#F8EFDC` | Warnings |
| `--dp-focus` | `#C99A2E` | Focus ring (gold-400 variant on navy) |

**Contrast rule:** every text/background pairing meets WCAG 2.2 AA
(≥4.5:1 body, ≥3:1 large text and UI boundaries). Verified pairs include
ink/white (16.5:1), white/navy-900 (14.8:1), muted/white (4.9:1),
muted-dark/navy-900 (7.9:1), gold-600/white (4.6:1), gold-400/navy-900 (7.3:1).

---

## 3. Typography

Maximum three families, all self-hosted (zero external font requests):

| Family | Variable font | Role |
|---|---|---|
| Manrope Variable | `--dp-font-display` | Display, headings, buttons |
| Inter Variable | `--dp-font-body` | Body copy, forms, navigation |
| IBM Plex Mono 400/500 | `--dp-font-mono` | Eyebrows, technical metadata, indices |

**Weights:** display/headings use Light 300 (the signature — never bold the
display scale); body 400; emphasis 500/600; bold 700 reserved for the logo
wordmark and small strong text.

**Fluid scale** (clamp-based; no breakpoint jumps):

| Step | Token | Range |
|---|---|---|
| Display | `--dp-text-display` | 44 → 96px |
| H1 | `--dp-text-h1` | 40 → 72px |
| H2 | `--dp-text-h2` | 32 → 56px |
| H3 | `--dp-text-h3` | 24 → 32px |
| H4 | `--dp-text-h4` | 20px |
| Body L | `--dp-text-body-lg` | 17 → 18px |
| Body | `--dp-text-body` | 16px |
| Small | `--dp-text-small` | 14px |
| Micro | `--dp-text-micro` | 13px |

**Uppercase is reserved** for eyebrows, mono metadata labels, and nav
microcopy (`--dp-tracking-label: 0.14em`). Headings are sentence case.

---

## 4. Logo rules

The brand mark is a **single-colour silhouette in `--dp-gold-500`**, served from
`public/brand/` and resolved by `<picture>`. It replaces the hand-drawn SVG of a
squared golden frame with two forward chevrons, which was live until the supplied
artwork was integrated (§4a records how, and what it cost).

- Provenance: derived from `Asset/Data/brand_logo.png` by `scripts/derive-logo.mjs`.
  The source is a 1181×896, 100% opaque, edge-to-edge re-saved raster; the derivation
  keys its two flat neutral fields (rgb 204,204,204 and 136,136,136, both measured at
  stddev ≤ 0.6) to transparency, smooths the result with five 5×5 majority passes, and
  fills the remaining mass with one token colour. The derived master then passes
  `scripts/optimize-logo.mjs` **on its own measurements**: 62.9% transparent, fill
  stddev 0.0, edge density 11.6% against a 15% budget.
- What the derivation cannot keep: the artwork's internal detail. Everything inside
  the silhouette's outline is now solid gold. This is a raster with no vector source,
  so shape is the only thing that survives shrinking.
- Clear space: 8% of the long edge is padded into the derived master, so the ladder's
  ink never touches a canvas edge.
- Lockup: mark + two text lines, **Atabul** over **Driving Center** (uppercased by
  CSS, so `site.ts#business.name` stays readable in prose, titles and alt text). The
  artwork contains no letterforms — a component census found no text-like clusters —
  so the written name is not duplication.
- The ladder is square (132px = 3× the 44px slot) with the art centred inside it, so
  `.logo__mark` keeps its `width: 2.75rem; height: 2.75rem` pair; `object-fit` is not
  needed and the aspect NOTE from the preflight is satisfied by the padding.
- Minimum size: 32px mark. Below 360px the lockup **compacts** (§15a) rather than
  dropping to wordmark-only: label tracking 0.38em → 0.2em and both lines nowrap.
  Measured reason — "ATABUL / DRIVING CENTER" needs 290px where a 320px viewport
  offers 288px, and a shrinkable flex item was absorbing the 2px by wrapping the
  label into a *third* line of brand inside the 80px header (box 156×27 = two
  lines). Compacting the tracking keeps one line at 146px; nowrap means any future
  shortfall fails the device audit as overflow instead of hiding as a reflow
- Light/dark variants: the mark is gold on the navy surfaces it actually sits on
  (scrolled header, footer, mobile overlay). There is no separate light-surface
  variant, and §4a step 6 is where one would come from.
- Never: stretch, rotate, glow, arbitrary recolor, low-contrast placement.
  (Documented tension: `.logo__mark` and both wordmark lines carry a
  `filter: drop-shadow` / `text-shadow` scrim for legibility over the hero film — a
  scrim, not a glow, but it does contradict the old "no drop-shadow" line and is
  owner's call.)

### 4a. Replacing the brand mark — the swap contract

**Status: swapped, by derivation, on instruction.** The supplied
`Asset/Data/brand_logo.png` was measured and refused by `scripts/optimize-logo.mjs`;
the decision was to use it anyway. What ships is therefore a *derivation* (§4), not
the artwork as received. The honest description of the source file is
"screenshot-quality raster of a logo", and no encoding can undo that.

Measured on the file as received — the numbers the gate prints:

| rule | budget | brand_logo.png |
|---|---|---|
| transparent field | ≥ 2 % | **0.0 %** |
| fill flatness (local stddev) | ≤ 4 | **12.7** on the largest fill |
| edge density at 2× the slot | ≤ 15 % | **51.9 %** |
| ink box | must leave room to trim | full canvas; art on all four edges |
| one connected component | — | 1184×896, mean fill rgb(97,66,65) |
| master size | < 4 MB | 1,616 KB |

Keying the flat field fixes transparency and nothing else: on the keyed file flatness
got **worse** (12.7 → 14.7, and 33.5 on a tighter key) and edge density stayed near
41 %, because the noise is *inside* the artwork rather than under it — and the whole
canvas is one connected component, so art and background cannot be separated by
colour at all.

Derivations were built and scored by `scripts/derive-logo.mjs`, then handed to the
**real** gate. Five candidates, three of them passing — all figures below measured at
the shipped `--smooth 5` (other settings shift them by a point or two, so the table is
only meaningful next to the command that produced it):

| candidate | transparent | edge density | flatness | gate |
|---|---|---|---|---|
| keyed field removed, original colours | 62.9 % | 18.4 % | 13.3 | ✗ both |
| art in navy on a white rounded plate | 29.3 % | 15.0 % | **0.0** | ✗ density only |
| silhouette, reversed polarity, `--dp-gold-500` | 65.8 % | 13.0 % | 0.0 | ✓ |
| silhouette, white | 62.9 % | 12.5 % | 0.0 | ✓ |
| **silhouette, `--dp-gold-500`** | **62.9 %** | **11.6 %** | **0.0** | ✓ **shipped** |

Two notes on that ranking, because the two metrics disagree and the disagreement is
informative. `derive-logo.mjs`'s own heuristic composite puts the *reversed* polarity
first (it rewards IoU stability and contrast against navy); the project's committed
gate metric — edge density, the measurement that actually predicts whether a shape
survives 44px and 32px — puts **gold ink** first, 11.6 % against 13.0 %. The gate
governs: the composite is a screening device, not a standard. The polarity is the
other judgement call: the two large *flat* neutral greys read as a background, so the
mass that is not them is taken to be the artwork. Neither call is verifiable without
eyes on the file, which is why both are one flag apart (`--pick`, `--smooth`) rather
than hard-coded anywhere.

The plate variant is worth keeping in mind: after the flatness rule was corrected it
turned out to be genuinely flat (0.0) and loses only on density — if a light-surface
variant is ever wanted, that is the shape to start from, not a new derivation.

The pick is the lowest measured edge density of the accepted set — the one proxy that
correlates with surviving 44px and 32px — and the *ink* polarity, because two large
flat neutral greys are what a background looks like. Both are reproducible choices,
not opinions: `--pick <candidate>` and `--smooth <0..5>`.

Reproduce the chain:

```
npm run brand:mark                     # derive → pick → ladder → public/brand/*
npm run optimize:logo:derive           # metrics table + the shape printed as text
node scripts/optimize-logo.mjs --report --master build/brand-candidates/mark.png
```

**The shape cannot be verified from here.** The session that integrated this file
could not decode images, so the silhouette was chosen by measurement.
`npm run optimize:logo:derive` prints the picked mark as a text map of its alpha
channel — that map is what a human should compare against the real logo before this
goes near production. If the shape is not recognisably the mark, the fix is a clean
export, not another `--pick`.

Everything that changed, in one list:

1. `scripts/derive-logo.mjs` added (derivation, scoring, ranking, text preview);
   `optimize:logo:derive` and `brand:mark` in `package.json`; `build/` gitignored as
   an intermediate.
2. Three fixes in `scripts/optimize-logo.mjs`, none of which relax a budget: the
   flatness rule had been scoring the **alpha boundary** as fill noise (a perfectly
   flat single-colour fill measured 65.4, because PNG stores RGB as black where alpha
   is 0 — and the rule above it *demands* that alpha); ffmpeg errors were swallowed by
   `stdio: "ignore"`; and each raster now tries encodings in fidelity order
   (lossless → indexed PNG → lossy q80/method 6), so the shipped format is chosen by
   the budget instead of by preference.
3. Ladder in `public/brand/`, every budget met: `atabul-mark.webp` 7.5 KB (lossy q80 —
   budget-forced, labelled as such), `atabul-mark.png` 12.7 KB, `favicon-32.png`
   1.8 KB, `apple-touch-icon.png` 15.4 KB, `atabul-mark-512.png` 27.8 KB.
4. `index.html`: `<svg class="logo__mark">` → `<picture class="logo__picture">` with a
   WebP `<source>` and an `<img class="logo__mark" src="./brand/atabul-mark.png"
   width="44" height="44" alt="" decoding="async">`, in the header and footer lockups.
   `alt=""` because the adjacent live text already names the business and the link's
   `aria-label` is its accessible name. The mobile menu carries no mark, so it needed
   no change.
5. `components.css`: `.logo__picture { display: contents }`, so the `<img>` remains the
   flex item and the slot geometry does not move.
6. Head: `public/favicon.svg` deleted and replaced by
   `<link rel="icon" type="image/png" sizes="32x32" href="./brand/favicon-32.png">`
   plus `<link rel="apple-touch-icon">`.
7. `src/seo/site.ts` → `business.logoPath`, emitted as `logo:` on the DrivingSchool
   node in `src/seo/schema.ts`.
8. Gates: `LOGO_CONTRACT` grew `.logo__picture` (six selectors); the build audit now
   counts any `/brand/<file>` occurrence as a reference, because a JSON-LD `logo` URL
   is as load-bearing as a `src` — that rule is what caught the first swap as two
   orphans; and `device-audit` asserts both marks decode and paint and that
   `<picture>` resolved to the WebP rung rather than falling back.

**"Never edit the artwork" is the rule this overrode**, and it remains the rule: a mark
that needs light and dark variants should be *supplied* as both. The derivation here is
a documented exception made on instruction, not a new precedent. When a clean export
arrives — transparent, art clear of the edges, one flat colour per fill, simple
geometry, ideally the SVG plus a 512px PNG — drop step 1 from the chain and run
`npm run optimize:logo`. The ladder, the budgets and every gate stay as they are, and
for the first time the shipped art keeps the detail inside its own outline.

---

## 5. Grid & layout

- Desktop: 12-column mental grid; content container `1200–1280px`
  (`--dp-container-wide: 80rem`)
- Side padding `--dp-gutter`: clamp(20 → 64px) — mobile 20–24, tablet 24–40, desktop 32–64
- Section rhythm `--dp-section-pad`: clamp(72 → 136px) — sections breathe
- Editorial whitespace is a primary element; **most sections are cardless**
- Breakpoints: mobile ~320–767, tablet ~768–1023, desktop ~1024+, wide ~1440+

---

## 6. Spacing

4px base scale — `4 8 12 16 24 32 40 48 64 80 96 120 160` as
`--dp-space-4 … --dp-space-160`. No arbitrary values without a documented
reason (the few permitted: header height 72px, 44px touch targets, logo
geometry).

---

## 7. Motion

| Property | Token | Value |
|---|---|---|
| Signature easing | `--dp-ease-out-exact` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Micro interaction | `--dp-dur-micro` | 160ms |
| UI (buttons/nav) | `--dp-dur-ui` | 240ms |
| Content reveal | `--dp-dur-reveal` | 560ms |
| Hero transitions | `--dp-dur-hero` | 800ms |
| Large media | `--dp-dur-media` | 1000ms |

Rules: staggered hero entrance (eyebrow → headline → support → CTA → meta,
80–620ms delays). One IntersectionObserver drives `.reveal` opacity/translate.
`prefers-reduced-motion: reduce` collapses all animation to near-zero,
disables the hero video (poster carries the hero), and removes smooth
scrolling. Never animate everything — motion communicates hierarchy only.

---

## 8. Imagery

Cinematic, authentic, Indian, precise, human. Approved compositions:
steering-wheel details, hand positioning, mirror adjustment, learner entering
vehicle, instructor guidance, road perspective, controlled parking, Kolkata
streets. **Non-negotiable:** left-side traffic; right-hand-drive vehicles
(driver seat on the right). Never use imagery contradicting Indian road
rules. Current registered media:

| Logical ID | File | Treatment |
|---|---|---|
| `assets.hero.primary` | `src/assets/hero/hero-primary-{1280,720}.mp4` + poster | Full-viewport film, scrim only where text needs it |
| `assets.instructor.primary` | `src/assets/instructors/instructor-primary.webp` | 4:5 editorial portrait, cropped reveal, gold frame offset |

No filters, no cartoon graphics, no generic Western driving-school stock.

---

## 9. Iconography

One family: inline geometric outline SVGs, 1.5px stroke, 24px grid, quiet
and functional. Icons never act as decoration and never appear oversized.
Icons are `aria-hidden` with text labels carrying the meaning.

---

## 10. Buttons

`[icon] LABEL [arrow]` — subtle rectangular (4px radius), never pill.

| Variant | Surface | Use |
|---|---|---|
| `.btn--primary` | navy-900 + white | Main action per view |
| `.btn--secondary` | transparent + border | Alternative action |
| `.btn--accent` | brand gold | **Booking moment on dark surfaces only** |
| `.btn--inverse` / `.btn--ghost-inverse` | white / ghost on navy | Dark sections |

States: hover (background/border shift, arrow nudges 3px), active
(compression), disabled (45% opacity + `cursor: not-allowed`), loading
(spinner). Minimum 44px touch target; visible gold focus ring; never color
alone — text always identifies the action.

---

## 11. Cards

Cards are used only where grouping aids comprehension (booking panel,
option selectors, badges). Style: white surface, 1px `--dp-border` hairline,
6px radius, no heavy shadow (`--dp-shadow-1/2` reserved), generous internal
spacing, strong type hierarchy. Section rhythm stays editorial and cardless
(about, programmes, method, reviews, fees, FAQ).

---

## 12. Forms

- Labels always visible and associated (`for`/`id`); placeholder ≠ label
- Inputs 44px min height; hover/focus states (focus: navy border + gold halo)
- Errors: `role="alert"`, icon + message (not color alone), field-level
  `has-error` state; validation messages are human and specific
- Option cards: real radio inputs, gold ring on selected, visible focus ring
- Consent is an explicit checkbox; phone validation ≥10 digits; date ≥ today

---

## 13. Navigation

Desktop: wordmark left, text links center/right, gold animated underline for
hover/active (`.is-active` via scroll-spy), gold BOOK TRAINING CTA. Header
starts transparent over the hero and transitions to a 92% navy + blur surface
after 24px scroll. Mobile: logo, 44px menu trigger, full-screen navy overlay
menu with staggered indexed links, Escape-to-close, focus management, scroll
lock. Skip-link is the first focusable element.

---

## 14. Booking UI

Five deliberate steps (Programme → Experience → Date → Time → Contact +
consent) with mono step chips, gold progress bar, per-step validation,
Enter-to-advance, Back/Continue pair that swaps to Submit on the last step.
The success state is explicit: **"Booking requested — awaiting
confirmation"** — the UI never claims a confirmed appointment; the request is
handed off to WhatsApp/phone where the academy actually confirms. Without JS
the form renders as a single sheet with a call/WhatsApp note.

---

## 15. Responsive rules

Mobile-first. Sections recompose rather than shrink:

- Hero: bottom-anchored stack on all sizes; scroll cue appears ≥1024px
- About / Instructor: two-column editorial ≥1024px, stacked below
- Programmes: 4-column editorial row ≥1024px (index / name / description / action),
  stacked single column below
- Method: 2×2 grid ≥768px, single column below
- Booking contact grid: 2-col ≥768px
- Navigation: overlay menu <1024px; header CTA from 768px. The fixed **contact
  rail** (call + WhatsApp) is *not* breakpoint-scoped: it is pinned at every
  width, on desktop included (§15g)
- Driver-service rate card: a real `<table>` with `min-width: 580px` inside
  `.fees__scroll` (`overflow-x: auto`, `tabindex="0" role="region"`) — it
  scrolls sideways instead of being crushed into an unreadable stack

### 15a. Breakpoints

| Token | Value | What crosses it |
|---|---|---|
| — | `22.4375em` (≤359px) | wordmark compact tier: label tracking 0.38em → 0.2em, lockup `flex: none`, both lines nowrap (§4) |
| `--dp-bp-mobile` | 30rem / 480px | reserved |
| `--dp-bp-tablet` | 48em / 768px | method 2×2, booking form 2-col, header CTA appears |
| — | `47.9375em` | lower bound of the phone-only rules (hero frame inset, mobile JS variant) |
| `--dp-bp-desktop` | 64em / 1024px | desktop nav, hero scroll cue, 4-col programmes, two-col about/instructor/contact/footer, toast returns to its low position (the contact rail is present at every width) |
| — | 72em / 1152px | nav link gap widens |
| `--dp-bp-wide` | 90rem | reserved |

Media queries are **em, never px**: a zoomed or font-enlarged browser must still
cross breakpoints, and px conditions ignore user font scale. The `tokens.css`
breakpoint values are a registry (CSS cannot use `var()` in a query prelude) —
`src/main.ts` reads the same numbers as `matchMedia` strings.

### 15b. Device chrome — notch, status bar, home indicator

`<meta name="viewport">` carries **`viewport-fit=cover`**, which is what makes
`env(safe-area-inset-*)` resolve to anything other than `0`. The meta and the
insets are a matched pair: without the meta the tokens are dead, and with the
meta but no insets the content deliberately slides under the notch. One rule:

> **Any `position: fixed` surface consumes the inset of every edge it is
> anchored to.** Add a fixed element without them and
> `npm run responsive:check` fails.

| Surface | Consumes |
|---|---|
| `.container` (every section) | `-l` / `-r` — landscape notch and punch-hole |
| `.header` | `-t`, and `scroll-padding-top` grows with it so anchors don't land under the bar |
| `.mobile-menu` | all four, plus `overflow-y: auto` + `overscroll-behavior: contain` |
| `.contact-rail` | `-b` / `-r` — out of the swipe-up gesture zone, at every width |
| `.toast-region` | `-b`, plus `--dp-rail-h` clearance below 64em so neither rail button lands on the message explaining why the booking failed |
| `.hero__scroll` | indirectly: its `bottom` adds `--dp-rail-h` so the desktop scroll cue clears the rail (§15g) |
| `.hero__frame` | all four, through a local `--dp-hero-inset` base so the phone override cannot undo them |

### 15c. Touch rules — there is no mouse here

- **Viewport units.** Anything height-critical uses `svh`, written as a cascade
  pair (`min-height: 100vh; min-height: 100svh;`) so pre-2023 engines keep a
  full-bleed hero. Never bare `vh` on an `overflow: hidden` box: iOS measures
  `vh` against the *retracted* URL bar and clips the content while the bar is
  showing (that was `.rules-rail__window`).
- **Hover is a capability, not a default.** `:hover` may restyle; it may not
  gate a *mechanism*. A hover-only `animation-play-state: paused` sticks after a
  tap and freezes both carousels with no visible way to resume, so those rules
  live in `@media (hover: hover) and (pointer: fine)` while `:focus-within`
  stays unconditional — and both rails ship an `aria-pressed` pause button.
- **44px minimum interactive box** (`--dp-tap`), in *both* axes, for anything a
  thumb is aimed at — icon-only controls included:
  `.marquee-pause` was 36px and is the only pause a touch visitor can reach.
  Chromium then measured four more claim-breakers, all of them "text links that
  are really buttons": `.link` CTAs ("Book this programme", "Enquire on call") at
  31px tall, `.contact__row a` (phone / WhatsApp / email) at 28px, the `< 64em`
  footer link list at 17px, and `.hero__scroll` at 21px *wide* (`vertical-rl`
  swaps the axes, so `min-width` grows it sideways, not `padding-inline`). Each
  now takes `min-height`/`min-width: var(--dp-tap)` as a real box — growing the
  element, never faking a hit area with an absolutely positioned pseudo-element.
- **`min-width`, not `padding-inline`, for narrow nav.** 8 desktop nav links ×
  16px of padding did not fit the header at exactly `1024px` and pushed the CTA
  69px past the canvas. `min-width: var(--dp-tap)` grows only the two words
  ("FAQ", "Fees") that need it, and `text-align: center` keeps them optically
  placed; the `::after` marker spans the box, which is how a nav underline reads.
- **Cascade order is a rule, not a detail.** `.nav-mobile-toggle { display:
  inline-flex }` sat *below* the `@media (min-width: 64em) { display: none }`
  block; equal specificity, later wins, and the hamburger rendered beside the
  desktop nav on every wide screen. Same-specificity overrides must be ordered,
  so the hide rule now lives after the base rule with a comment saying why.
  No static grep can see this — only a real engine can.
- `touch-action: manipulation` kills the 300ms double-tap delay;
  `-webkit-tap-highlight-color: transparent` is permitted only because `:active`
  press states replace it.
- No `user-scalable=no`, no `maximum-scale`. Pinch-zoom is a right.
- Form controls stay at 16px (`--dp-text-body`) — smaller makes iOS Safari zoom
  the whole page on focus and the visitor loses their place.
- `white-space: nowrap` is allowed only in `.visually-hidden` and inside the
  scrollable `.rates` table; long emails/URLs rely on `overflow-wrap: break-word`.
- Type floor: nothing meaningful renders below 12px. `--dp-text-micro` (13px) is
  the smallest declared step — 11px uppercase mono badges were raised.

### 15d. The gate

`npm run responsive:check` → `scripts/verify-responsive.mjs` parses all five
stylesheets (390 rule blocks) and asserts the above: 61 checks over the viewport
declaration, safe-area consumption by every fixed surface, `svh`/`vh` pairing,
per-component tap-target sizes, hover-gated mechanisms, nowrap/overflow
discipline, keyboard access to the scrollable table, the nav dead-band, toast vs
rail clearance, the rail's fixed-position contract (§15g), the 12px floor,
em-only breakpoints, and `imagesrcset` /
`imagesizes` parity between the hero preload and `<picture>` — without parity,
phones preload the 1600w AVIF and the 900w file is dead weight. It reads source
plus `index.html`, so a stale `dist/` cannot fool it.

**What the critical-CSS mirror caught on its first run** — three failures, all real,
none of them visible to any other layer:

- `.logo`, `.logo__name`, `.logo__sub` had no `color` in the inline copy while the
  sheet sets white/white/gold. Before `components.css` arrives the wordmark is
  *inheriting the UA link colour*: blue text on navy, then white and gold when the
  CSS lands. That is a first-paint legibility flicker on the brand element, and
  only an HTML/CSS comparison can see it — a browser audit samples one settled
  moment and always sees the correct colours.
- The inline font stacks had dropped a fallback each: `"Manrope"` missing from the
  display stack, `"Cascadia Mono", "Consolas"` from the mono stack. Where a visitor
  has no variable Manrope, first paint resolves to a generic and the sheet then
  re-resolves to a different face: a metrics jump, i.e. layout shift on the logo.
- `.logo__name` / `.logo__sub` also lacked the `text-shadow` scrim that keeps the
  wordmark legible over the hero film.

Fixed by making the copy literal and exact (`#ffffff`, `#dab054`, full stacks, both
shadows — literals are required, since custom properties do not exist before
`tokens.css` loads), and now enforced property-by-property after token resolution,
so the mirror cannot drift again. This is the gate the logo swap in §4a depends on.

### 15e. The browser run (what the gate cannot see)

`npm run device:check` → `scripts/device-audit.mjs` builds nothing; it serves
`dist/` on `127.0.0.1:4179`, launches real Chromium (16 profiles: 320×568,
Pixel 7, iPhone SE, iPhone 12, iPhone 14 Pro Max, two short landscapes, 744×1133,
iPad gen 11 portrait 656×944 *below* 48em, iPad gen 7 810×1080 *above* 48em,
exactly 48em, iPad Pro 11 landscape, exactly 64em, 1440×900 — plus a
`javaScriptEnabled: false` context and a `reducedMotion: "reduce"` context) and
asserts **782 measured checks**. It fails the same way the static gate does:
non-zero exit, and it is the only layer that can see computed layout, real media
selection and scroll behaviour.

What it asserts per profile, none of it derivable from CSS text: no console or
page errors; `document.scrollWidth === innerWidth` and nothing painted beyond the
canvas; every visible control a ≥44×44 box with no overlapping pairs; nothing
under 12px; exactly one of the two navs present (the dead-band, measured not
inferred); form controls ≥16px; the FAB on-screen and never under the toast; the
overlay menu scrollable with all 8 links reachable; the poster `currentSrc`
equal to the candidate `vw × devicePixelRatio` implies (a 3× phone *should* take
1600w — asserting "phones always get 900w" would be testing the wrong thing) and
fetched exactly once; one hero film variant, matching the 768px split; **both brand
marks complete with `naturalWidth > 0` and paint at 44×44, and `<picture>` resolves to
the WebP rung** (a raster mark can 404, arrive with the wrong MIME or fail to decode
while the layout still looks entirely correct — which is exactly what no static gate
and no overflow check can see); zero
third-party requests; `(hover: none)` on touch contexts; the carousel still
running under touch and its pause button actually pausing on tap.

Three things the run taught the harness, kept because they are the failure modes
of any future scripted check: **Lenis rewrites `window.scrollTo()` from its rAF
loop**, so a sweep of native jumps silently inspects a page that never moved —
drive it with wheel events, or with `window.__dpLenis.scrollTo(el, { immediate:
true })`, the handle `initSmoothScroll()` publishes for exactly this purpose
(under `prefers-reduced-motion` there is no Lenis, so the fallback is native).
**`checkVisibility()` plus `getBoundingClientRect().height` are mandatory** before
judging an element's opacity: a `visibility: hidden` overlay and a `display: none`
booking pane both keep real layout boxes, so their reveals read as "stuck at 0".
**A missing `devices[...]` preset must be a hard error** — two names that no
longer exist in Playwright 1.61 fell back to 390×844 while the report printed iPad
labels, i.e. the matrix measured a phone and claimed a tablet.

It still cannot verify `env(safe-area-inset-*)` (Chromium resolves it to `0`, so
§15b is structurally proven and visually unproven), the `vh` → `svh` fallback
pair (a modern engine always has `svh`), or a real notch, thumb reach and
Safari's URL-bar reflow. Those remain device-lab checks.

### 15f. Navigation is a mechanism — tap it, measure where it lands

`npm run device:check` proved the menu could be *opened* on a phone. It did not
prove a tap *went anywhere*, and that gap was the user-visible bug: on a phone
and on a tablet, tapping a nav item closed the overlay and left the page exactly
where it was. Four defects lived in that one code path:

1. **A scroll queued on a paused engine is thrown away.** `open()` calls
   `lenis.stop()` (Lenis ignores `body { overflow: hidden }`), and
   `initSmoothScroll` registers its click listener *before* `initMobileMenu`
   does, so on the same anchor the order was `scrollTo()` on stopped Lenis →
   `close()` → `start()`, and `start()` resyncs `animatedScroll` to the current
   position, discarding the queued move. Fixed twice over, because boot order is
   a trap that resets: `goToSection()` calls `lenis.start()` before scrolling,
   and the overlay's close handler is registered in the **capture** phase so the
   menu is always out of the way before any navigation runs.
2. **Do not add a header offset to Lenis.** Measured in Chromium: `scrollTo(el)`
   with no options lands a section **exactly 96px down** — Lenis 1.3 already
   honours `html { scroll-padding-top }`. Passing `offset: -96` (the obvious
   "fix") double-counts it and parks the heading 192px below the fold. The
   `nav:check` landing band is what protects this from a Lenis upgrade.
3. **`preventDefault` without `pushState` erases the destination.** The hash never
   updated, so nothing reflected where the visitor was, and the browser back
   button left the site (measured: `…/#booking → about:blank`). `goToSection()`
   now pushes the fragment, a `popstate` listener honours the walk, and the skip
   link's `preventScroll` focus still runs.
4. **A fragment jump on first paint drifts.** The load-time jump happens before
   the hero media and carousel clones size themselves (~100px), so the deep link
   re-aligns once on the frame after `load` — and only if the visitor has not
   scrolled in the meantime.

The fail-open doctrine applies to navigation as hard as to content: below `64em`
the overlay *is* the navigation, so with a broken bundle a phone visitor would
hold a hamburger that does nothing. `html:not(.js)` now drops the toggle and
shows the real `.nav-desktop__link` list in the header, asserted in the
JS-disabled browser profile (8 links rendered, dead toggle not offered, still no
horizontal overflow).

`npm run nav:check` → `scripts/nav-audit.mjs` (9 profiles, 528 checks, incl. one
with `prefers-reduced-motion` where Lenis is never constructed and
`goToSection` must reach the same destination natively) taps **every live nav
link** and asserts, per destination: it lands below the fixed header and not a
screen away; the overlay closed; the scroll lock released; the page still
scrolls afterwards; the URL recorded it; scroll-spy marks it; programme CTAs
preselect the right booking choice; logo returns to top; back stays in the site;
deep links land; Escape, the close button and repeated opens behave. Reverting
fix 1 reproduces 16 failures across phone and tablet in one run.

### 15g. The fixed contact rail — one point on the screen, two real actions

Two circular buttons, call and WhatsApp, pinned to the bottom-right corner at
**every** width including desktop (the old `.float-call` hid itself ≥64em; the
header CTA books a slot, whereas the rail is the path for a visitor already
holding a phone, so it now stays). `.contact-rail` / `.rail-btn` in
`sections.css`, `--dp-rail-h` in tokens.

The requirement "scrolling must never change where the icons are" is load-bearing,
so it is asserted rather than intended:

- **It cannot move.** `position: fixed`, no scroll listener, no `.reveal`, no
  transition touching `top/right/bottom/left`. The device gate reads the rail's
  bounding rect **three times** — at `y=0`, after sweeping to the bottom, and
  again after returning to the top — and demands equality to 0.5px.
  `getBoundingClientRect()` is viewport-relative, so for a genuinely fixed
  element those three reads are the same number; the third one exists because a
  scroll handler can displace a node on the way *back* and look untouched on the
  way down. Flipping the rail to `position: absolute` put it at `y = -11829`
  after the sweep, and injecting a scroll handler that `translateY`s it at the
  top failed the same pair — the checks are proven to bite, not just to pass.
- **It cannot disappear.** Four static checks: the declaration, nothing hiding it
  at any width, nothing animating its position, and both safe-area insets
  consumed (it sits exactly where a home indicator and a rounded corner are).
- **It must not be covered or covering.** 56px targets (> the 44px floor) stacked
  with a 12px gap so a thumb cannot choose the wrong action; toast region
  reserves `--dp-rail-h`; the hero scroll-cue's `bottom` adds `--dp-rail-h`
  because both live in that corner on desktop. Stacking is measured with
  `elementFromPoint` at the rail's centre while the overlay menu is open — the
  menu wins, so no stray circle floats above a full-screen menu.
- **The taps must reach the platform.** `tel:+916290345383` opens the dialler;
  `https://wa.me/916290345383?text=…` with `target="_blank" rel="noopener"`
  opens a real, prefilled chat without losing the page. `nav-audit` clicks both
  and asserts `defaultPrevented === false` from a `window` listener at the end of
  the bubble path, i.e. after every handler on the page has had its say — the
  only way to see that the smooth-scroll handler does not quietly claim a click
  whose selector it does not match. Widen `a[href^="#"]` to `a` and the gate
  reports both taps intercepted plus a `querySelector("tel:…")` throw.
- **The numbers have one owner.** `src/config/contact.ts` is imported by
  `src/seo/site.ts` (JSON-LD `telephone`) and `src/main.ts` (booking handoff),
  and the build gate compares the *literal hrefs in `index.html`* against it:
  any `tel:` outside the sanctioned pair, a rail call that is not the primary
  line, a `wa.me` number that does not equal the phone without its `+`, an empty
  prefilled message, or a missing `target`/`rel` fails the build. Its first run
  flagged the second published line (driver-service, labelled as such in the
  contact section) — the gate allows a pair and pins the rail to the primary.

Icon colour: WhatsApp's brighter `#25D366` puts a white glyph at 2:1, failing
WCAG 1.4.11's 3:1 non-text floor, so the token is the brand's darker
`--dp-whatsapp-600: #128c7e`. The glyph is a chat bubble with three dots, not the
trademarked logo.

### 15h. The development credit — "Powered by [mark] CITYWINGS"

The site is built by CITYWINGS and the credit is a requirement, so it is specified
literally and enforced: `Powered by`, the supplied logo, then the word — one line
in the footer's base bar, the mark before the word. It **replaced** the brand
tagline *"Precision in every pixel. Confidence in every drive."* in that slot, so
the footer carries one credit and never two; the tagline survives only as the
principle this file is written against (line 3) and a note in `tokens.css`, not as
page copy.

- **Order is asserted twice, differently.** The build gate compares the DOM index
  of the `<img>` with that of the word span; the browser gate measures the rendered
  boxes (`mark ends at x=138, word starts at x=146` on a 320px phone). Swapping
  them fails the build with "the credit must place the logo *before* the word".
- **The word is white, and the number is computed.** `var(--dp-white)` on
  `--dp-navy-900` is 17.4:1 from the token side (static gate) and 17.41:1 from
  `getComputedStyle()` in real Chromium (browser gate). Two independent sources:
  if only one of them moves, the disagreement *is* the bug report.
- **The logo is not modified.** The supplied asset is 1254×1254 8-bit RGB with no
  alpha channel (measured: 30% `#fa5954` mark on a 70% white ground). It therefore
  ships on its own ground, as a small rounded chip. Knocking the white out would
  be an unauthorised edit of a client's mark, and a colour-key leaves semi-
  transparent halo pixels that nobody here can review — this toolchain cannot look
  at images, so "it looks fine" is not an available defence. What *is* available
  is arithmetic: the resample was validated by re-measuring the composition
  (red 29.9% → 29.2%, mean RGB 243,202,200 → 242,201,199).
- **The master never ships.** 1,023 KB would have been the heaviest image on the
  page by five times over. `scripts/optimize-brand.mjs` resamples to 96² (4× the
  24px display box) WebP q90 = **2.9 KB**, and the build gate fails the build if
  `dist/brand/citywings-mark.webp` is missing or over 8 KB. The optimizer is part
  of the release path, exactly like `optimize:poster`.
- **Rail clearance is measured at the bottom of the document.** In the tagline's
  slot the credit becomes the base row's right-hand item — precisely where the
  fixed rail lives. The first version of that check sampled the end of the scroll
  sweep and passed, which meant nothing: the sweep rests wherever the last hidden
  reveal happened to be. Driving the harness to the true bottom (and asserting
  `scrollY === scrollHeight − innerHeight`, so the check cannot pass vacuously)
  found a real collision: at 1024 and at 1194×834 the rail's 56px column overlapped
  the word by 24px — the WhatsApp button sitting on top of "CITYWINGS". Fixed with
  `margin-inline-end: calc(var(--dp-fab-size) + var(--dp-space-16))`; a trailing
  margin cannot move a start-aligned item, so phones — where the row wraps — keep
  their full gutter. Measured clearance now 41px at 1024, 48px at 1194, 138px at
  1440, and 25px at 320 with the two never sharing a line.
- **A content check must strip comments before it counts.** The rule that the
  footer says "Powered by" exactly once reported 4 occurrences, because this
  credit's own explanatory HTML comment quotes the phrase twice and the tagline it
  replaced once. `rendered = html.replace(/<!--[\s\S]*?-->/g, " ")` is now what the
  credit checks run against: gate the pixels a visitor gets, not the prose the
  source contains about itself.
- **`alt=""` + intrinsic `width`/`height` + `loading="lazy"`.** The word already
  names the company, so the image is decorative: a screen reader says "Powered by
  CITYWINGS" rather than announcing a file called source-symbol; if the file ever
  fails to decode, the credit survives as text instead of a broken-icon box; and
  the footer cannot shift while it loads.
- Found on the way: `.footer__base` set its legal line to
  `rgba(255,255,255,0.45)` over navy = **4.43:1**, below the AA floor for its 13px
  text. Raised to 0.62 (7.28:1) — and both pairs are now computed on every run
  (§16), because a hand-worked 4.43 should not depend on anyone redoing the math.

It is deliberately **not a link**: no CITYWINGS URL was supplied, and this project
does not invent destinations. Adding one is a single attribute plus one line in
the build gate.

---

## 16. Accessibility (WCAG 2.2 AA)

Semantic landmarks (`header/main/section/footer/nav`), one `h1`, ordered
headings, skip link, visible gold focus rings, 44×44 touch targets, accordion
and menu built on `aria-expanded`/`aria-controls`, radio groups with
`role="radiogroup"`, `role="alert"` errors, `aria-live` success, descriptive
alt text, `prefers-reduced-motion` support, no color-only state, decorative
SVG hidden. The hero is `aria-hidden` media with real text content on top.

**Contrast is computed, never assumed.** The footer's legal line sat at
`rgba(255,255,255,0.45)` over `--dp-navy-900`, which composites to 4.43:1 — under
the 4.5:1 AA floor for its 13px text, and invisible to any review that only reads
token names. Both gates now do the arithmetic: `verify-responsive.mjs` composites
each alpha text colour over its background and asserts 4.5:1 (base line 7.28:1,
CITYWINGS word 17.4:1), and `device-audit.mjs` measures the same pair from
`getComputedStyle()` inside real Chromium, so the claim survives both a CSS edit
and a runtime override (§15h).

---

## 17. Performance

Self-hosted variable fonts (subset woff2), **31 KB JS (9.7 KB gzip / 8.4 KB
brotli)**, **45 KB CSS (8.6 KB gzip)**, `dist/index.html` 117 KB (19.5 KB gzip)
— the growth is the JSON-LD `@graph`, which is metadata, not layout. The hero
film is **2.28 MB desktop / 0.94 MB mobile H.264** with faststart +
`preload="none"`, started only on `window load` so it never competes with the
LCP image. The poster is a real `<picture>` ladder: **AVIF 53 KB (1600w) /
27 KB (900w)** → WebP 134 / 62 KB → baseline JPEG 186 KB fallback, preloaded as
AVIF with `fetchpriority="high"`. Lazy below-fold imagery, one
IntersectionObserver, rAF-throttled scroll listener, zero third-party runtime
scripts, fingerprinted asset URLs.
Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1, Lighthouse 90+/95+/95+/95+.
Budgets are **enforced**: `vite build` fails past the per-file limits in
`vite/plugins/seo.ts` (see §20).

---

## 17b. Poster pipeline

`npm run optimize:media` (video + JPEG master) → `npm run optimize:poster`
(AVIF/WebP + 900w cuts) → `npm run build`. Both use `ffmpeg-static` with
`stdio: "ignore"` (piped stdio is denied in sandboxed/CI shells). Source of
truth for the ladder is `public/hero-fallback.jpg`; the variants are committed,
never generated by the build itself.

The hero `<link rel="preload" as="image">` must carry `imagesrcset` +
`imagesizes` that match the `<picture><source>` **exactly** (`href` stays as the
fallback for engines without `imagesrcset`). A bare `href` preload commits the
browser to the 1600w file before the source set is resolved, so every phone
downloads 53.2 KB instead of 27.5 KB and then warns that the preload went
unused. `npm run responsive:check` compares the two candidate lists.

---

## 18. Asset protocol

**Never hard-code machine-specific paths.** All media lives in
`src/assets/<domain>/` and is imported through the registry
(`src/config/assets.ts`), which maps logical IDs → fingerprinted
application-relative URLs:

```ts
assets.hero.primary.desktop    // hero-primary-1280.mp4
assets.hero.primary.mobile     // hero-primary-720.mp4
assets.hero.primary.poster     // hero-poster.jpg
assets.instructor.primary.image
```

Components consume logical IDs (`data-hero-video`, `data-instructor-img`
wired in `src/main.ts`). `public/` holds only no-JS/OG fallback copies — plus
`public/brand/citywings-mark.webp`, the footer credit mark (§15h): that image is
referenced straight from `index.html` on purpose, because a development credit
must still render when the bundle fails to load, and routing it through the
registry would make it JS-dependent. It is not hashed, the same accepted
trade-off as the hero's no-JS fallback; it changes only if CITYWINGS rebrands.
Optimization pipeline: `npm run optimize:media` (ffmpeg: poster + two
bitrate-capped transcodes from the 39MB master), `npm run optimize:poster`
(the AVIF/WebP LCP ladder), `npm run optimize:brand` (the credit mark:
1254×1254 1,023 KB master → 96×96 2.9 KB WebP, 99.7% smaller), and
`npm run brand:mark` (`optimize:logo:derive` → pick → ladder), plus
`npm run logo:preflight` (§4a: the brand-mark ladder. It measures whether a master is
a clean export at all — it refused the one handed over, and §4a records both the
derivation that shipped instead and exactly which measurements were traded).

---

## 19. Component usage rules

Registry of components (all in `index.html` + `src/styles/*`): Header,
Navigation, Mobile Menu, Button, Link, Section Heading, Eyebrow, Video,
Image, Programme Row, Stage Card, Instructor Feature, Review, Fee Row, FAQ
Item, Form Field, Option Card, Date Input, Step Chips, Progress Bar, Modal
surface (mobile menu), Toast, Booking Form, Footer, Badge, Lane Divider,
Skip Link, Float Call, Loading/Empty/Error states (button spinner, form
errors).

Rules: components never redefine tokens; states are defined for
hover/active/focus/disabled/error/loading/empty; motion per §7; responsive
per §15; copy per the content registry with its data-integrity rule
(**no invented prices, credentials, counts, guarantees — ever**).

Placeholder copy is now machine-enforced: `[To be confirmed]`, `TODO`, `FIXME`
and `lorem ipsum` **fail the build** (see §20). Unknown facts stay out of the
artifact — `business.openingHours` is `null` in `src/seo/site.ts` and the
schema simply omits `openingHoursSpecification` rather than guessing hours.

---

## 20. SEO layer (build-time, no runtime cost)

Every SEO-visible fact lives in **`src/seo/site.ts`** — one edit per change, no
HTML archaeology. Pure builders render it: `src/seo/schema.ts` (JSON-LD
`@graph`) and `src/seo/render.ts` (head tags, visible FAQ accordion,
`robots.txt`, `sitemap.xml`). `vite/plugins/seo.ts` injects the output into the
six bare markers in `index.html` (`SEO:TITLE`, `SEO:DESCRIPTION`, `SEO:HEAD`,
`SEO:FAQ_ITEMS`, `SEO:JSONLD`, `SEO:INSTRUCTOR_CREDENTIALS`) and emits the
crawler files. **Dev and prod are identical**: `configureServer` serves the same
`/robots.txt` and `/sitemap.xml` strings on the same paths.

**Origin.** `VITE_SITE_URL` (see `.env.example`) drives canonical, `og:url`,
`og:image`, `twitter:image`, sitemap `<loc>` and the robots `Sitemap:` line.
Until the domain is delegated it is `http://localhost:5173`, which the audit
warns about on every build. Flip one env value at DNS cutover; no code edit.
`VITE_BUILD_DATE` (commit date, from CI) adds sitemap `<lastmod>` — deliberately
not derived from the build clock, because a moving `lastmod` teaches Google to
ignore it.

**Schema.** `DrivingSchool` (+ `url`, `image`, `priceRange`, `hasMap`,
`currenciesAccepted`, `paymentAccepted`, `areaServed`, `makesOffer` ×3) →
`Person` instructor → `WebSite`/`WebPage` → `FAQPage` (7 Q&A, generated from the
same array that renders the accordion) → 14 × `VideoObject` with `duration`
**measured from the MP4 `mdhd` box at build time**, never typed. No
`aggregateRating`/`Review` markup on purpose: Google treats ratings a business
publishes about itself as self-serving, and the 30 testimonials stay as on-page
content pointing at the third-party source via `hasMap`.

**The audit gate** (`writeBundle`, runs after every build, fails it on drift):
title 30–65 chars · description 50–170 · exactly one `<h1>` · `lang` present ·
canonical equals the resolved origin · `og:url`/`og:image`/`twitter:image`
absolute and on-origin · `og:image` target exists in `dist/` · no placeholder
copy · JSON-LD parses and carries `DrivingSchool`/`FAQPage`/`Person`/`Service`
×3/`VideoObject` ×14 with no duplicate `@id` · every `site.ts` FAQ question
actually renders · `robots.txt`/`sitemap.xml` present, origin-correct, ASCII-only,
no fragment URLs in the sitemap · every visible `.social-link` href appears in
`business.sameAs` **and** vice-versa (a social icon that is not an entity signal,
or an entity claim with no icon, both fail the build) · LCP ladder files within
budget · entry JS/CSS within budget · no unreplaced `SEO:` marker ·
`public/robots.txt` must not exist · **contact-action coherence** (§15g): every
`tel:` href on the page is one of the two numbers in `src/config/contact.ts`, the
fixed rail's call href is the primary line, its `wa.me` number equals that phone
without the `+`, the prefilled message is non-empty, and `target="_blank"` /
`rel="noopener"` are present · **development credit** (§15h): the
`Powered by → logo → CITYWINGS` order, `alt=""`, intrinsic `width`/`height`, and
`dist/brand/citywings-mark.webp` existing at ≤8 KB ·
**brand-mark assets** (§4a): every `./brand/*` the page references must have
shipped, none may exceed 32 KB, and none produced by the pipeline may sit
unreferenced — so a swap that half-happens cannot build ·
**the inline critical CSS is checked against the stylesheet** as a mirror: five
logo selectors, every declaration the sheet makes must be matched by the copy in
`index.html` after token resolution ·
**brand-name coherence**: the two wordmark lines joined must equal
`business.name` from `src/seo/site.ts`, that name must appear in the page at all,
both logo links must read `"<name> home"`, the © line must name the business, and
the rail's pre-filled WhatsApp message must equal `waHref()` exactly — the name is
owned in one file and copied as a literal in seven, which is precisely how a
rename goes half-way.

**Fail-open rule.** The inline `js` class in `<head>` gates every hidden reveal
state; `main.ts` sets `window.__dpBooted` and a 3-second watchdog strips `js` if
the bundle never boots. A mis-pathed or blocked deploy therefore serves **fully
visible content** instead of a page whose headings, prices and FAQ answers are
`opacity: 0` in Google's rendered snapshot. Keep it that way: never hide content
behind a class the bundle is required to remove.

**Four layers, four different blindnesses.** The build gate (above) runs inside
`writeBundle` and cannot be skipped by any deploy path. `npm run seo:check`
(`scripts/verify-seo.mjs`, 76 checks) re-derives everything from the *artifact* —
it shares no code with the plugin, so a bug in the builder cannot make both agree;
it measures `src=`, `srcset`, preloads and CSS `url()` (outbound `<a href>`
domains are navigation, not page load) and reports "0 external fetches".
`npm run responsive:check` (60) reads source CSS and `index.html`.
`npm run device:check` (782 across 16 real-Chromium profiles, §15e) is the layer
that sees computed layout — it proved the fail-open rule holds where it matters:
with JavaScript off at 390×844, **55/55 reveals and 7/7 FAQ answers render**, all
5 booking panes are readable, 8 header links are still navigable, and there is no
horizontal overflow. `npm run nav:check` (528 across 9 profiles, §15f) is the
layer that sees *behaviour*: it taps every nav link and measures where the page
actually ended up, which is how a menu that opens beautifully and goes nowhere
passed the first three layers untouched.

All four run in sequence with `npm run check:all`; a non-zero exit from any of
them stops it.

Every one of these layers exists because a claim was made before it was
measurable. Any future claim in this file — "the site is fine on mobile",
"navigation works", "SEO is manageable" — must name the layer that can prove it.

**Working hazard, recorded because this repo has no VCS.** There is no `.git`
here (`git rev-parse --show-toplevel` resolves to an unrelated project one level
up), so a bad write has no undo. While testing the contact rail, a PowerShell
5.1 `Get-Content -Raw | Set-Content -Encoding UTF8` round-trip decoded
`index.html`'s UTF-8 bytes as ANSI (cp1252) and rewrote them as UTF-8, mangling
130 non-ASCII sequences (`—`, `“ ”`, `·`, `❤️`, Bengali-free but emoji-bearing
testimonials). It was recoverable — the map is invertible, and the restoration was
accepted only after the file hashed byte-identical to a SHA-256 taken before the
write — but that needed luck and a `dist/` copy, not process. Two rules follow:
mutate sources with an editor or an explicitly-UTF-8 script, never a shell
round-trip; and hash a file before any bulk textual operation on a repo with no
history. Initialising `git` here would replace that discipline with a safety net
and is the single cheapest improvement left in this project.

