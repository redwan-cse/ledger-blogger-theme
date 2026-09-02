# Ledger — Blogger Layouts V3 Theme

[![CI](https://github.com/redwan-cse/ledger-blogger-theme/actions/workflows/ci.yml/badge.svg)](https://github.com/redwan-cse/ledger-blogger-theme/actions/workflows/ci.yml)
[![Build Theme Artifact](https://github.com/redwan-cse/ledger-blogger-theme/actions/workflows/release.yml/badge.svg)](https://github.com/redwan-cse/ledger-blogger-theme/actions/workflows/release.yml)
[![CodeQL Analysis](https://github.com/redwan-cse/ledger-blogger-theme/actions/workflows/codeql.yml/badge.svg)](https://github.com/redwan-cse/ledger-blogger-theme/actions/workflows/codeql.yml)
[![Security Policy](https://img.shields.io/badge/Security-Policy-blueviolet.svg)](SECURITY.md)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm_Noncommercial_1.0.0-blue.svg)](LICENSE)
[![Blogger Layouts](https://img.shields.io/badge/Blogger-Layouts_V3-ff5722.svg)](https://support.google.com/blogger/answer/46870)
[![Contract Rules](https://img.shields.io/badge/V3_Contract_Rules-39%2F39_PASS-brightgreen.svg)](tools/contract-check.ts)
[![Accessibility](https://img.shields.io/badge/WCAG_2.2-AA_Compliant-success.svg)](tests/render/a11y.spec.ts)
[![Node](https://img.shields.io/badge/node-%3E%3D24.18.1-informational.svg)](package.json)

**Ledger** is a production-grade, responsive Google Blogger theme engineered with **Layouts V3** (`b:layoutsVersion='3'`) and **Widget Version 2** (`version='2'`). It compiles Pug templates, modular SCSS in the OKLCH color space, and TypeScript into a single standalone XML theme verified against real Blogger-rendered HTML.

Live production blog: **[blogs.redwan.work](https://blogs.redwan.work/)**

---

## 🌟 Key Features

- **Platform Contract Conformance**: Strictly complies with Google's native Blogger Layouts V3 architecture and Widget Version 2 specification with zero legacy V1/V2 constructs.
- **Native `super.main` Delegation**: Dispatches through Blogger's internal pagination beans, post cursors, threaded comments, and feed beans with 12 defensive `<b:defaultmarkup>` blocks.
- **100% OKLCH Color Space**: Precision perceptual color ramp with automatic dark & light theme modes and AAA/AA contrast compliance.
- **Zero-JS Server-Side Rendering**: Core content, layout grid, typography, topic pills, and article streams render completely without JavaScript dependencies (`R-EMPTY-2`).
- **Responsive 12-Column Grid**: Single-column layout on mobile (`< 640px`), full-width lead cards on tablet (`640px - 1023px`), and a 12-column desktop grid with a sticky sidebar (`>= 1024px`).
- **Mobile Drawer Navigation & Search**: Smooth off-canvas drawer navigation and search modal with full keyboard accessibility (`Escape` trap, focus management).
- **SEO & Rich Results**: Automatic Schema.org `BlogPosting` and `WebSite` JSON-LD structured data (using `.jsonEscaped`), dynamic OpenGraph, Twitter Cards, and canonical URLs.
- **WCAG 2.2 AA Accessibility**: Strict single-`h1` heading hierarchy per view, functional `#content` skip link, 44px touch targets, and `prefers-reduced-motion` fallbacks.

---

## Layout zones

All seven layout zones are declared as standard `<b:section>` elements and are configurable directly from **Blogger Dashboard → Layout**:

| Zone | `id` | Widget | Purpose |
|---|---|---|---|
| Masthead | `header` | `Header` | Site title and tagline. Locked. |
| Nav | `navlinks` | `LinkList` | Menu items |
| Intro | `intro` | `HTML` | Editorial standfirst |
| Topics | `topics` | `Label` | Topic pills from real labels |
| Posts | `page_body` | `Blog` | The render path. Locked. |
| CTA | `cta` | `HTML` | Closing call to action |
| Footer | `footer` | `HTML` | Attribution and social links |

---

## 📁 Repository Structure

```
ledger-blogger-theme/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # PR & push gate (typecheck, tests, contract, size budget)
│       └── release.yml               # Theme build artifact generator
├── docs/                             # Technical architecture & references
│   ├── README.md                     # Documentation index
│   ├── PROJECT-PLAN.md               # Milestone specs (M0–M6) & state matrix
│   ├── V3-REFERENCE.md               # Blogger Layouts V3 contract reference
│   ├── BLOG_DESIGN_SYSTEM.md         # Typography, OKLCH ramp, & tokens
│   ├── POSTMORTEM.md                 # Failure analysis of legacy theme models
│   └── HARNESS.md                    # Staging render harness runbook
├── example_themes/                   # Google's native V3 themes for parity checks
├── fixtures/                         # Staging seed fixture data
├── src/
│   ├── theme.pug                     # Root template XML shell
│   ├── defaultmarkups/               # 12 defensive defaultmarkup blocks
│   │   ├── common.pug                # widgetTitle, icon, preview fallback
│   │   ├── blog.pug                  # super.main dispatch, feed links, ads
│   │   ├── popular-posts.pug         # Popular post snippet overrides
│   │   ├── featured-post.pug         # Featured post hero card
│   │   ├── blog-archive.pug          # Archive tree & flat hierarchy
│   │   ├── contact-form.pug          # Accessible contact widget
│   │   └── label.pug                 # Topic pill cloud markup
│   ├── widgets/                      # Modular Layouts V3 widget templates
│   │   ├── header.pug                # Header1 with h1/p heading switcher
│   │   ├── blog.pug                  # Blog1 includable suite
│   │   ├── blog-post.pug             # Single post body, byline, share buttons
│   │   ├── blog-comments.pug         # Threaded comments & tombstones
│   │   └── linklist.pug              # Header & drawer menu links
│   ├── partials/                     # Reusable partials (head meta, OpenGraph, JSON-LD)
│   ├── styles/                       # Modular SCSS design system
│   │   ├── tokens.scss               # OKLCH palette, typography scale, spacing
│   │   ├── base.scss                 # CSS reset, accessibility focus rings
│   │   ├── layout.scss               # 12-col grid, header, sticky sidebar, drawer
│   │   ├── article.scss              # Typography, code blocks, syntax theme
│   │   ├── dark.scss                 # Dark mode overrides & contrast enforcement
│   │   └── main.scss                 # SCSS compiler entrypoint
│   └── scripts/
│       └── main.ts                   # Theme toggle, search modal, drawer, progress bar
├── tests/
│   ├── contract/                     # 28 offline contract test suites (454 tests)
│   ├── golden/                       # Canonical snapshot (theme.xml)
│   ├── harness/                      # Unit tests for Blogger API & HTTP harness
│   └── render/                       # Playwright & Axe-core accessibility specs
├── tools/                            # Build toolchain & verification scripts
│   ├── generate.ts                   # Compiler (Pug + SCSS + TS -> dist/theme.xml)
│   ├── contract-check.ts             # 39 Layouts V3 contract validation rules
│   ├── golden-check.ts               # Snapshot mismatch validator
│   ├── style-contract.ts             # CSS rule and selector contract auditor
│   └── watch.ts                      # Live-reloading source watcher
├── dist/
│   └── theme.xml                     # Compiled, production-ready Blogger theme XML
└── package.json
```

---

## 🚀 Quick Start & Development

### Prerequisites

- **Node.js**: `>= 24.18.1`
- **npm**: `>= 11.0.0`

### 1. Installation

```sh
git clone https://github.com/redwan-cse/ledger-blogger-theme.git
cd ledger-blogger-theme
npm ci
```

### 2. Build & Development

```sh
# Generate dist/theme.xml
npm run build

# Watch sources and recompile on change
npm run watch

# Run full project verification suite
npm run verify
```

---

## 🧪 Testing & Quality Assurance

The repository enforces a multi-tier test pyramid executed on every commit and pull request:

```sh
# 1. Typecheck TypeScript sources
npm run typecheck

# 2. Run unit and harness tests
npm test

# 3. Validate all 39 Layouts V3 contract rules
npm run contract:check

# 4. Run 28 contract & adversarial test suites (454 tests)
npm run test:contract

# 5. Verify against the canonical golden snapshot
npm run test:golden
```

### Budget Gates

- **Generation Time**: `< 10 seconds` (enforced in CI).
- **Theme Size Budget**: Target `150 KB – 500 KB` (`dist/theme.xml` current: `~202 KB`).
- **Security Audit**: `0` vulnerabilities via `npm audit`.

---

## 📦 Deployment to Blogger

1. Run `npm run build` (or download `dist/theme.xml` from the latest [GitHub Release](https://github.com/redwan-cse/ledger-blogger-theme/actions/workflows/release.yml)).
2. Navigate to **Blogger Dashboard → Theme**.
3. Click the dropdown arrow next to **Customize** → select **Restore**.
4. Upload `dist/theme.xml`.
5. Under **Blogger Dashboard → Layout**, configure your widgets (`Header`, `LinkList`, `Label`, `HTML`).

---

## 🛡️ Security & Vulnerability Management

Dependencies are audited continuously with zero high or moderate vulnerabilities. To run a security check locally:

```sh
npm audit
```

---

## 📄 License & Attribution

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Noncommercial use, educational study, and contribution are permitted.

> **Note**: Custom identity assets, branding, and images belonging to Md Redwan Ahmed and Fast Cyber Defense are proprietary and must be replaced before deploying to your personal blog.
