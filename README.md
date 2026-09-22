# Atabul Driving Center

![CI](https://github.com/citywings/AtabulDrivingCenter/actions/workflows/ci.yml/badge.svg)

> Professional four-wheeler driving education in Kaikhali, Kolkata — patient instruction, real-road practice, and a method that builds confidence from the first ignition.

---

## Project Overview

**Atabul Driving Center** is a premium single-page marketing website for a driving school based in Kaikhali, Kolkata. The site showcases driving programs, instructor credentials, student reviews, safety education videos, and a multi-step booking request form with WhatsApp/phone handoff.

**Purpose**: Convert visitors into training enquiries through clear pricing, trust signals (Google reviews, instructor profile), and frictionless contact paths (click-to-call, WhatsApp deep links, fixed contact rail).

**Target Users**: Individuals in the Kaikhali–Baguiati–Rajarhat corridor seeking professional four-wheeler driving lessons, refresher training, or hired-driver services.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Hero Section** | Cinematic background video with LCP-optimized poster fallback, personalized time/location greeting |
| **Programmes** | Three tiers: Beginner lessons, Skill polishing, Professional driver service |
| **Training Method** | Four-stage editorial layout (vehicle intro → road training → confidence → assessment) |
| **Instructor Profile** | Editorial portrait, credentials, teaching philosophy, trait list |
| **Reviews Marquee** | 30+ Google reviews in an accessible, pausable horizontal carousel |
| **Fees** | Transparent rate cards with scrollable driver-service table |
| **FAQ + Safety Videos** | 7 accordion FAQs + 14 vertical safety-instruction video clips |
| **Booking Flow** | 5-step guided form (programme → experience → date → time → contact) with validation |
| **Contact Rail** | Fixed bottom-right Call/WhatsApp buttons (always visible, safe-area aware) |
| **SEO Excellence** | Build-time generated meta, JSON-LD (DrivingSchool, Person, Service, VideoObject, FAQPage), sitemap.xml, robots.txt |

---

## Technology Stack

| Category | Technology |
|----------|------------|
| **Language** | TypeScript (strict, ES2020 modules) |
| **Build Tool** | Vite 6.3.5 |
| **Package Manager** | pnpm 8+ (lockfile: `pnpm-lock.yaml`) |
| **Styling** | Custom CSS with design tokens (CSS custom properties) |
| **Animation** | Lenis 1.3 (smooth scroll) + custom CSS scroll-reveal |
| **SEO** | Custom Vite plugin (build-time meta, JSON-LD, sitemap, robots.txt) |
| **Fonts** | Self-hosted WOFF2: Manrope (display), Inter (body), IBM Plex Mono (technical) |
| **Geolocation** | ipapi.co (IP-based city detection, 24h cached) |
| **Linting/Types** | TypeScript strict mode (`tsc --noEmit`) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     index.html (SSR-ready)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Hero       │  │  Programmes │  │  Reviews Marquee    │  │
│  │  (video)    │  │  (cards)    │  │  (30+ reviews)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Method     │  │  Instructor │  │  Fees / FAQ / Video │  │
│  │  (4 stages) │  │  (profile)  │  │  (rates + 14 clips) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Booking Form (5-step wizard)               │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Fixed Contact Rail (Call/WA)               │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Build-time SEO Pipeline** (`vite/plugins/seo.ts`):
- Generates `<title>`, meta description, canonical, Open Graph, Twitter cards
- Emits `robots.txt` and `sitemap.xml` (with image/video entries)
- Injects JSON-LD `@graph` (DrivingSchool, Person, Service×3, VideoObject×14, FAQPage)
- Validates budgets (LCP images, JS/CSS/HTML size) and fails build on drift

**Progressive Enhancement**:
- All content visible without JavaScript (`.js` class gates reveal animations)
- `prefers-reduced-motion` respected globally (no animation, no autoplay)
- `viewport-fit=cover` + CSS `env(safe-area-inset-*)` for notched devices

---

## Project Structure

```
AtabulDrivingCenter/
├── public/                          # Static assets (served as-is)
│   ├── assets/                      # Hero poster (OG), instructor portrait
│   ├── brand/                       # Logo variants, favicon, apple-touch-icon
│   ├── fonts/                       # Self-hosted WOFF2 fonts (Manrope, Inter, IBM Plex Mono)
│   └── rules/                       # 14 safety video clips (.mp4 + .jpg posters)
├── src/
│   ├── assets/                      # Source assets (imported by Vite, hashed at build)
│   │   ├── hero/                    # Hero videos (720p/1280p) + poster
│   │   └── instructors/             # Instructor portrait
│   ├── components/
│   │   └── greeting.ts              # Personalized greeting component
│   ├── config/
│   │   ├── assets.ts                # Asset registry (Vite-imported, fingerprinted)
│   │   └── contact.ts               # Phone/WhatsApp numbers (single source)
│   ├── services/
│   │   └── greeting.ts              # IP geolocation + time-of-day logic
│   ├── seo/
│   │   ├── site.ts                  # Single source of truth (business, programmes, FAQs, clips)
│   │   ├── schema.ts                # JSON-LD builders
│   │   └── render.ts                # HTML string builders (head, FAQ, robots, sitemap)
│   ├── styles/
│   │   ├── tokens.css               # Design tokens (colors, spacing, type, motion)
│   │   ├── base.css                 # Reset, typography, reveal primitives
│   │   ├── components.css           # Buttons, links, header, forms, accordion, toast
│   │   ├── sections.css             # Section layouts (hero, programmes, fees, etc.)
│   │   └── fonts.css                # @font-face declarations
│   ├── main.ts                      # Application entry point
│   └── vite-env.d.ts
├── scripts/                         # Build-time audit & optimization scripts
│   ├── verify-seo.mjs               # Post-build SEO audit (76 checks)
│   ├── verify-responsive.mjs        # CSS-based responsive/touch audit (61 checks)
│   ├── device-audit.mjs             # Real-browser device matrix (Playwright)
│   ├── nav-audit.mjs                # Real-browser navigation audit (Playwright)
│   ├── optimize-*.mjs               # Logo/poster/media optimization
│   └── serve-dist.mjs               # Production preview server
├── vite/
│   └── plugins/seo.ts               # Vite plugin (build-time SEO injection)
├── dist/                            # Production build output (generated)
├── .env.example                     # Environment template (no secrets)
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
├── vite.config.ts
└── README.md
```

> **Note**: The `Asset/` folder (capital A) at the project root contains original source media (raw 4K videos, design files, Gemini-generated images) and is **intentionally excluded** from version control. All production assets are optimized and placed in `public/` or imported via `src/assets/` for Vite fingerprinting.

---

## Getting Started

### Prerequisites
- **Node.js** 18+ (tested on 20+)
- **pnpm** 8+ (`npm install -g pnpm`)

### Installation
```bash
pnpm install
```

### Development
```bash
pnpm dev
```
Starts Vite dev server at `http://localhost:5173/` with HMR.

### Type Checking
```bash
pnpm typecheck
```
Runs `tsc --noEmit` (strict mode).

### Production Build
```bash
pnpm run build
```
Runs `tsc --noEmit && vite build`. Outputs to `dist/`.

### Preview Production Build
```bash
pnpm run serve:dist
```
Serves `dist/` locally for verification.

### Full Audit Suite
```bash
pnpm run check:all
```
Runs all 4 audits: SEO (76), Responsive (61), Device (Playwright), Navigation (Playwright).

---

## Environment Variables

Copy `.env.example` to `.env.local` (never committed):

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SITE_URL` | Yes | Canonical site origin (e.g., `https://your-domain.in`). Defaults to `http://localhost:5173` for dev. |
| `VITE_BUILD_DATE` | No | ISO date (YYYY-MM-DD) for sitemap `<lastmod>`. Set from git commit date in CI. |

> **Security**: Never commit `.env.local`. The `.gitignore` excludes it. The `.env` file in this repo contains a GitHub PAT for CI automation only — rotate if exposed.

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Type-check + production build |
| `pnpm typecheck` | TypeScript strict check only |
| `pnpm preview` | Vite preview of dist |
| `pnpm serve:dist` | Custom static server for dist |
| `pnpm run seo:check` | Post-build SEO audit (76 checks) |
| `pnpm run responsive:check` | CSS responsive/touch audit (61 checks) |
| `pnpm run device:check` | Real-browser device matrix (15 profiles) |
| `pnpm run nav:check` | Real-browser navigation audit |
| `pnpm run check:all` | Run all 4 audit suites |
| `pnpm run optimize:media` | Optimize hero/rules videos |
| `pnpm run optimize:poster` | Generate LCP poster ladder (AVIF/WebP/JPEG) |
| `pnpm run optimize:brand` | Generate brand assets (logo ladder, favicon) |
| `pnpm run brand:mark` | Generate brand mark (512px square) |

---

## Deployment

### Build Output
`dist/` is a **fully self-contained static site** — no server-side runtime required.

### Hosting Options
| Platform | Notes |
|----------|-------|
| **Vercel** | Zero-config; set `VITE_SITE_URL` in project settings |
| **Netlify** | Zero-config; set `VITE_SITE_URL` in site env vars |
| **Cloudflare Pages** | Zero-config; set `VITE_SITE_URL` in env vars |
| **AWS S3 + CloudFront** | Sync `dist/`; set `Cache-Control: public, max-age=31536000, immutable` on hashed assets |
| **Nginx/Apache** | Serve `dist/`; enable gzip/brotli; set long-term cache on `assets/*` |

### Critical Deployment Requirements
1. **HTTPS required** — geolocation (`ipapi.co`), service workers, and preload hints require secure context
2. **Set `VITE_SITE_URL`** at build time — all canonical/OG/sitemap URLs derive from it
3. **Enable compression** — gzip/brotli on text assets (HTML/CSS/JS ~10–22 KB gzipped)
4. **Long-term caching** — hashed filenames in `assets/` are immutable; cache for 1 year
5. **Relative base** — `vite.config.ts` uses `base: "./"`; deploy to a path ending in `/` (e.g., `https://domain.in/prodrive/`) or root

---

## Environment Variables in Detail

The application reads **no secrets at runtime**. All configuration is injected at build time via Vite's `define`/`loadEnv`.

| Variable | Where Used | Example |
|----------|------------|---------|
| `VITE_SITE_URL` | `vite.config.ts` → `seoPlugin` → all canonical/OG/sitemap URLs | `https://atabuldriving.in` |
| `VITE_BUILD_DATE` | `seoPlugin` → sitemap `<lastmod>` | `2025-01-15` |

> The `.env` file in this repo contains a GitHub PAT for CI automation. **Rotate it** if this repo is ever made public.

---

## Development Workflow

```bash
# 1. Clone
git clone https://github.com/citywings/AtabulDrivingCenter.git
cd AtabulDrivingCenter

# 2. Install
pnpm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your VITE_SITE_URL

# 4. Develop
pnpm dev

# 5. Validate before commit
pnpm typecheck
pnpm run build
pnpm run check:all  # optional: full audit suite

# 6. Deploy
# Push to main → CI builds → deploy dist/ to hosting
```

---

## Code Quality & Maintenance

| Tool | Command | Purpose |
|------|---------|---------|
| TypeScript | `pnpm typecheck` | Strict type checking (no emit) |
| SEO Audit | `pnpm run seo:check` | 76 automated checks (meta, schema, budgets, drift) |
| Responsive Audit | `pnpm run responsive:check` | 61 CSS-based checks (touch targets, overflow, safe areas) |
| Device Audit | `pnpm run device:check` | Real-browser tests (15 device profiles via Playwright) |
| Nav Audit | `pnpm run nav:check` | Real-browser navigation tests (deep links, back button, overlay) |

**Conventions**:
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- CSS custom properties for all design tokens (`--dp-*`)
- Vite path alias `@/*` → `src/*`
- ESM modules (`type: "module"` in package.json)

---

## Browser / Platform Support

| Platform | Support |
|----------|---------|
| Chrome/Edge (last 2) | ✅ Full |
| Firefox (last 2) | ✅ Full |
| Safari (last 2) | ✅ Full (iOS 15.4+ for `svh`) |
| Safari < 15.4 | ⚠️ Falls back to `vh` for hero height |
| Mobile Chrome/Safari | ✅ Full (touch-optimized, safe-area aware) |

**Polyfills**: None required (modern APIs only: `IntersectionObserver`, `CSS.supports`, `env()`).

---

## Security

- **No secrets in repo** — `.env.local` excluded; `.env.example` is a template only
- **No runtime secrets** — all config injected at build time
- **CSP-ready** — no inline scripts except the 17-byte `js` class guard; all styles external
- **HTTPS required** — geolocation API, service workers, and preload hints require secure context
- **Dependency audit** — run `pnpm audit` periodically

> The `.env` file in this repository contains a GitHub PAT for CI automation. **This is a build-time secret only**. If this repository is made public, **rotate the token immediately**.

---

## Known Limitations

| Area | Limitation |
|------|------------|
| **Opening Hours** | Not published — `business.openingHours` is `null` in `src/seo/site.ts` (owner input needed) |
| **Twitter Handle** | `social.twitterSite` is `null` — `twitter:site` omitted |
| **Analytics** | No analytics/tracking integrated (privacy-first) |
| **CMS** | None — content edits require code changes + rebuild |
| **i18n** | English (en-IN) only |

---

## Credits

**Developed and supported by CITYWINGS**

**CITYWINGS**  
Kolkata, India  

**Services**:
- Static Website Development
- Dynamic Website Development
- Web Application Development
- Mobile Application Development
- Business Process Automation
- Custom Software Development
- Ongoing Website & Software Support

**Contact**:  
📧 citywings2026@gmail.com

---

## License

This project is proprietary client work for **Atabul Driving Center**. All rights reserved.  
No open-source license is granted. Do not copy, distribute, or modify without explicit written permission from CITYWINGS and the client.

---

*Generated with care by CITYWINGS — Kolkata, India*