# Ledger — project plan

| | |
|---|---|
| **Repository** | `redwan-cse/ledger-blogger-theme` |
| **Format** | Blogger **Layouts V3** (`b:layoutsVersion='3'`) with **widget version 2** |
| **Production blog** | [blogs.redwan.work](https://blogs.redwan.work) · Blogger ID `5972841034338492159` · 16 posts |
| **Staging blog** | `staging-ledger-theme.blogspot.com` (created in M0) |
| **Brand parent** | [redwan.work](https://redwan.work) — Fast Cyber Defense |
| **Estimate** | ~10 working days, 8 milestones |
| **Revision** | 2 |

**Companion documents.** The platform contract lives in
[`V3-REFERENCE.md`](V3-REFERENCE.md) and is not repeated here. The failure
analysis driving these requirements lives in [`POSTMORTEM.md`](POSTMORTEM.md).
References below to F1–F5 point at that document.

> **Revision 2** folds in a reviewed third-party Layouts V3 checklist. The
> `Header` widget was a real gap and is now a required zone. `b:loop` index
> capping, `b:with` compute-once, and Google's native V3 themes as a primary
> source were also adopted. What was rejected, and why, is in §11.

---

## 1. Scope

Build one excellent Blogger theme, from scratch, for a working blog with real
readers.

Not a template for sale. Not a 10,000-line marketplace product. A theme whose
homepage renders sixteen posts with JavaScript disabled, every single time, and
which cannot silently stop doing that.

### Goals

- **G1** Render correctly on every V3 view type, with JavaScript disabled.
- **G2** Fail loudly. No blank page is ever acceptable output.
- **G3** Look like a publication with an editorial point of view, not a template.
- **G4** Load fast on a mid-range Android phone over 4G.
- **G5** Make it impossible for a change that breaks rendering to reach production.

### Non-goals, binding

Not for sale or redistribution. No Theme Designer colour customiser. No AMP, no
Dynamic Views, no third-party comment system. No dark mode this release. No IE,
no pre-2022 Safari. No visual page builder.

### Users

| User | Job to be done | Success looks like |
|---|---|---|
| **Reader** (practitioner, arrives from search or a shared link) | Judge in ~8 seconds whether this is worth reading, then read without friction | Scans, reads, shares |
| **Prospect** (CTO or CISO evaluating a hire) | Assess whether the author is credible | Reaches the contact CTA |
| **Author** | Publish and configure from the dashboard, never touch XML | Never opens the theme editor |
| **Crawler** (Googlebot, LinkedIn, X, Slack) | Extract title, description, canonical, image, structured data | Rich-result eligible, correct share preview |

---

## 2. Design direction

### 2.1 The category reflex, and why we refuse it

Name the category and the design writes itself: *cybersecurity* means near-black,
neon cyan, monospace everything. The predecessor did exactly that
(`#00e5ff` on `#0a0a0a`).

It is the most predictable choice in the space, every template mill ships it, and
it undercuts the business goal. The parent site sells **penetration testing, red
teaming, SOC-as-a-service, and digital forensics** to CTOs and CISOs. A prospect
deciding whether to spend real money on a security audit is not reassured by
something that looks like a hacker-themed stream overlay.

**Direction: editorial, not operational.** Reference points are a well-set
technical journal and a serious print magazine. Security work is written down,
argued, and cited. The blog should look like it belongs to someone who writes
carefully.

### 2.2 Colour

**Strategy: Restrained.** Tinted neutrals carry the page; one accent under 10% of
surface area.

| Role | OKLCH | Use |
|---|---|---|
| Page | `oklch(98.4% 0.004 85)` | Warm off-white. Paper, not screen. Never `#fff`. |
| Surface | `oklch(96.2% 0.006 85)` | Recessed blocks: code, pull quotes, empty states |
| Ink | `oklch(23% 0.012 85)` | Body text. Warm near-black, never `#000`. |
| Ink muted | `oklch(48% 0.010 85)` | Bylines, dates, captions |
| Rule | `oklch(89% 0.006 85)` | Hairlines. 1px, no exceptions |
| Accent | `oklch(46% 0.148 25)` | Oxidised red. Links, active nav, the one CTA |
| Accent wash | `oklch(94% 0.028 25)` | Sparing background tint |

One hue family (85) for neutrals so nothing clashes; accent at hue 25, nearly
opposite. Chroma stays low near the lightness extremes so nothing looks
radioactive. Ink on page ≈ 14:1 (AAA); accent on page ≈ 6.4:1 (AA).

### 2.3 Typography

Two families, one request.

- **Serif** for headlines and article body. At reading size it signals long-form
  and separates the blog from every sans-serif template in the category.
- **Grotesque sans** for nav, metadata, labels, buttons. Mono only inside `<pre>`
  and `<code>`.

Scale at 1.333, so hierarchy is unmistakable:

```
Article h1     clamp(2.0rem, 1.4rem + 2.6vw, 3.15rem)   700
Article h2     1.777rem                                  650
Article h3     1.333rem                                  650
Body           1.0625rem / 1.7                           400   max 68ch
Row title      1.15rem                                   600
Meta / label   0.8125rem                                 500   +0.01em
```

The 68ch measure is the highest-leverage typographic decision on a reading site.

### 2.4 Layout

12 columns at desktop, but the index is **not** a uniform card grid. Uniform
grids flatten editorial judgement and are the clearest tell of generated design.

- **Lead post:** first post on page 1, 8 columns, larger title, 2-line excerpt
  via `snippet(data:post.snippets.long, {length: 180})`.
- **Subsequent posts:** single-column list of hairline-separated rows. Title,
  date, reading time, topic. No card chrome, no shadows, no hover lift.

A list reads faster than a grid, scales to any post count, has **no image
dependency** (correct: zero of 16 posts have one), and looks deliberate.

**Post formats are deliberately not implemented.** `b:switch` on a post's labels
can route Video / Audio / Gallery layouts, and it is a legitimate V3 technique.
Out of scope here because this is a text-first security blog: 16 long-form posts,
zero media posts. Building format routing for content that does not exist is
scope creep with extra steps. Revisit if media posts ever appear.

**Spacing.** Base 4px, rhythm deliberately uneven: `4, 8, 12, 16, 24, 32, 48, 72,
112`. Section gaps large (72–112), intra-component tight (8–12).

**Motion.** Colour and opacity only, 120–200ms, ease-out quart. **No
scroll-triggered reveals at all** (F3).

### 2.5 Views

Ten. Each is a distinct V3 render path and each gets a test.

| View | Condition | Content |
|---|---|---|
| Home p1 | `isHomepage and not data:newerPageUrl` | Masthead, lead, list, pager |
| Home p2+ | `isHomepage and data:newerPageUrl` | List, pager |
| Label | `isLabelSearch` | "Filed under X", list, pager |
| Search | `isSearch and not isLabelSearch` | "Results for X", count, list |
| Archive | `isArchive` | `view.archive.rangeMessage`, list, pager |
| Post | `isPost` | Article, share, bio, comments, related |
| Static page | `isPage` | Article only |
| Empty result | `not data:posts` on any index | Named empty state |
| Error | `isError` | Error state, search box, recent posts |
| Layout mode | `isLayoutMode` | Must render without throwing |

### 2.6 State matrix

Every row is a requirement. F2 is why this table exists.

| State | Treatment |
|---|---|
| Index with posts | Lead + list |
| Index, zero posts | "No posts published yet." + home link |
| Search, zero results | "Nothing matched *query*." + pre-filled search + 5 recent |
| Label, zero posts | "Nothing filed under *label* yet." + all-topics link |
| Archive, zero posts | Range message + "no posts" + home link |
| 404 | "That page doesn't exist." + search + 5 recent |
| Post, no featured image | No image slot. No reserved space, no placeholder graphic. |
| Post, no labels | Topic row omitted entirely |
| Post, zero comments | "No comments yet." + form |
| Comments disabled | Section omitted entirely |
| Comment deleted | Tombstone via `data:comment.isDeleted`, not empty markup |
| Author, no photo | Static SVG monogram. **Never a blank Gravatar.** |
| Title > 120ch | Max 3 lines in rows, unclamped in article |
| Pager, first page | "Older" only |
| Pager, last page | "Newer" only |
| Pager, single page | Omitted entirely |
| No JS | Everything above identical, minus copy-link and related |

### 2.7 Responsive

Three real layouts, not one shrunk three ways.

- **< 640px** Single column, 20px gutters. Masthead collapses to title plus a
  `<details>` disclosure nav (works with no JS). Lead joins the list.
- **640–1024px** Single column, 48px gutters, lead returns full width, metadata
  inline.
- **> 1024px** 12-column grid. Article body in columns 3–10. Post metadata in the
  left margin.

### 2.8 Accessibility

**WCAG 2.2 AA**, verified in CI.

Skip link first in tab order. One `<h1>` per view, no skipped levels. Focus ring
2px accent at 2px offset, never `outline: none`. Landmarks: `banner`, `main`,
`contentinfo`, `navigation`, `search`. Touch targets ≥ 44×44.
`prefers-reduced-motion: reduce` disables all transitions. Every image has `alt`;
decorative SVGs `aria-hidden='true'`.

---

## 3. Repository and toolchain

### 3.1 Stack

| Concern | Choice | Why |
|---|---|---|
| Source | Pug → V3 XML | Blogger XML is unindentable and unreviewable at scale. Pug gives real includes and loops. Prior art: `zkreations/hamlet`, `zkreations/canvas`. |
| Styles | SCSS → one `<b:skin>` CDATA block | V3 permits no external stylesheet |
| Scripts | TypeScript → esbuild → one inline IIFE | Typed, small enough to inline |
| Runtime | Node 24 | |
| Tests | Vitest (contract) + Playwright (render) | |
| CI | GitHub Actions | |
| Deploy | Manual upload, build-stamp gated | Blogger API v3 has no theme endpoint (OD-1) |

### 3.2 Layout zones

Seven `b:section` zones, all editable from Blogger → Layout.

| Zone | `id` | Widget | Max | Purpose |
|---|---|---|---|---|
| Masthead | `masthead` | `Header` | 1 | Site title and tagline. **Locked.** |
| Nav | `navlinks` | `LinkList` | 1 | Menu items |
| Intro | `intro` | `HTML` | 1 | Editorial standfirst under the title |
| Topics | `topics` | `Label` | 1 | Topic pills, derived from real labels |
| Posts | `main` | `Blog` | 1 | The render path. **Locked**, `preferred='yes'`. |
| CTA | `cta` | `HTML` | 1 | Closing call to action |
| Footer | `footer` | `HTML` | 3 | Attribution, social, extras |

**The masthead zone is not optional.** Without a declared `Header` widget the
blog title and description are not editable from Layout, and Blogger may inject
its own markup. It also carries the `h1`/`p` switch that makes R-A11Y-3
satisfiable. See V3-REFERENCE §7.

### 3.3 File layout

```
ledger-blogger-theme/
├── .github/workflows/
│   ├── ci.yml                    # PR gate
│   ├── release.yml               # tag -> artifact + checksum
│   └── canary.yml                # 6-hourly production check
├── src/
│   ├── theme.pug                 # <html> shell, head, body
│   ├── defaultmarkups/
│   │   ├── common.pug            # widgetTitle, icon, empty
│   │   ├── popular-posts.pug
│   │   ├── featured-post.pug
│   │   ├── contact-form.pug
│   │   ├── blog-archive.pug
│   │   └── label.pug
│   ├── widgets/
│   │   ├── header.pug            # Header widget: site title + tagline
│   │   ├── blog.pug              # THE critical file
│   │   ├── label.pug
│   │   ├── linklist.pug
│   │   └── html.pug
│   ├── partials/
│   │   ├── masthead.pug  footer.pug
│   │   ├── pager.pug  empty-state.pug  recent-list.pug
│   │   └── head-meta.pug  head-schema.pug
│   ├── styles/
│   │   ├── tokens.scss           # OKLCH ramp, type scale, spacing
│   │   ├── base.scss  layout.scss
│   │   ├── index.scss  article.scss
│   │   ├── states.scss           # empty, error, pager
│   │   └── main.scss
│   └── scripts/
│       ├── copy-link.ts
│       └── related.ts
├── fixtures/
│   └── staging-seed.json         # content that makes edge cases testable
├── tests/
│   ├── contract/                 # offline, fast, no network
│   ├── golden/                   # committed snapshots of generated XML
│   └── render/                   # Playwright vs a live blog
├── tools/
│   ├── generate.ts               # pug + scss + ts -> dist/theme.xml
│   ├── contract-check.ts         # V3 rules
│   ├── render-harness.ts
│   ├── deploy-check.ts           # build-stamp gate
│   └── seed-staging.ts           # Blogger API v3 post/page CRUD
├── dist/theme.xml
└── docs/
    ├── PROJECT-PLAN.md  V3-REFERENCE.md  POSTMORTEM.md
    ├── HARNESS.md  RUNBOOK.md
    └── reference/                # exported Google native V3 theme (M0)
```

### 3.4 Scripts

| Command | Does | Network |
|---|---|---|
| `npm run generate` | Pug + SCSS + TS → `dist/theme.xml` | no |
| `npm run watch` | Regenerate on change | no |
| `npm run test:contract` | V3 conformance on generated XML | no |
| `npm run test:golden` | Diff against committed snapshot | no |
| `npm run harness` | HTTP render check, all ten views | **yes** |
| `npm run harness:browser` | Playwright: JS / no-JS / reduced-motion | **yes** |
| `npm run test:a11y` | axe-core across ten views | **yes** |
| `npm run test:lighthouse` | Performance budgets | **yes** |
| `npm run seed:staging` | Create fixture content via Blogger API | **yes** |
| `npm run lint` | stylelint + eslint | no |

### 3.5 The staging blog

**A second, disposable Blogger blog is a hard requirement, not a convenience.**

The predecessor could not test large parts of itself because production has
**zero labels and zero static pages**, so the harness returned `SKIP` on entire
requirement families. Every experiment also ran against the live blog, so every
mistake was public and every run risked the rate limiter.

`staging-ledger-theme.blogspot.com`, seeded via **Blogger API v3** (which
supports post and page CRUD even though it cannot upload themes):

| Fixture | Exercises |
|---|---|
| 25 posts | Pagination beyond one page |
| Title `🛡️ "Quotes" & <angles> — em dash` | `.jsonEscaped`, XML escaping |
| 180-character title | Clamping |
| Post with no labels | Conditional topic row |
| Post with 6 labels | Label overflow |
| Post with no featured image | Image-optional layout |
| 4000-word post | Reading time, long-form rhythm |
| Post with comments disabled | Conditional comment section |
| Post with 12 threaded comments | `filter`/`map` threading |
| Post with a deleted comment | Tombstone rendering |
| 3 static pages | Page chrome vs post chrome |
| 8 labels, one with zero posts | Label views, empty label state |

This single artefact converts roughly a dozen untestable requirements into
testable ones.

The staging blog has a second job: **it is where Google's native V3 themes get
read.** Apply Contempo, export the XML, commit it to `docs/reference/`. It is the
highest-fidelity source for real V3 usage available, because Google ships it.

---

## 4. Requirements

`[C]` offline contract · `[R]` live render · `[V]` visual · `[M]` manual.

### R-V3 — Format conformance

**R-V3-1 · The generated theme is a valid V3 theme**

- AC1 `[C]` `<html>` carries `b:layoutsVersion='3'`
- AC2 `[C]` **Every `b:widget` carries `version='2'`** ← F1, contract check #1
- AC3 `[C]` `<html>` does **not** carry `b:version` or `class='v2'`
- AC4 `[C]` Exactly one `<b:skin>`, containing CDATA
- AC5 `[C]` At least one `<b:section>` with a unique alphanumeric `id`
- AC6 `[C]` A `Header` widget is declared (else the blog title is uneditable from Layout)
- AC7 `[C]` No banned V2-era construct (V3-REFERENCE §8)
- AC8 `[C]` No `macro:*` tag
- AC9 `[C]` Well-formed XML, no undeclared entity outside CDATA
- AC10 `[R]` Renders in Layout mode without error

**R-V3-2 · Only documented V3 expressions**

- AC1 `[C]` No `&&` or `||` in any `cond` or `expr:`
- AC2 `[C]` No `.size`; no `gt`/`lt`/`gte`/`lte`
- AC3 `[C]` No `data:` tag containing parentheses
- AC4 `[C]` URLs composed with `path`, never string `+`
- AC5 `[C]` Every JSON-LD interpolation ends in `.jsonEscaped`

### R-RENDER — Post rendering

**R-RENDER-1 · Every index view renders every post for that view**

- AC1 `[R]` Home p1 contains `.post-lead` once, `.post-row` ≥ 1
- AC2 `[R]` Rendered count equals `min(numPosts, remaining)` from the feed
- AC3 `[R]` Label, search, archive each render ≥ 1 post when the feed says posts exist
- AC4 `[R]` Every post has non-empty title text and an `href` returning 200
- AC5 `[R]` **AC1–AC4 hold with `javaScriptEnabled: false`**
- AC6 `[C]` Blog widget declares every includable in V3-REFERENCE §6

**R-RENDER-2 · Post pages render the complete body**

- AC1 `[R]` `.article-body` text ≥ 95% of the feed's `content` for that post
- AC2 `[R]` Code blocks preserve whitespace
- AC3 `[R]` Embedded images render at intrinsic ratio, no shift
- AC4 `[C]` Body emitted via `postBody`, not inline `data:post.body`

**R-RENDER-3 · Pagination reaches every post**

- AC1 `[R]` Pager exists whenever `olderPageUrl` or `newerPageUrl` is set
- AC2 `[R]` Walking "Older" from p1 reaches every post ID, no repeats
- AC3 `[R]` p1 has no "Newer"; last page has no "Older"
- AC4 `[R]` Single-page result sets render no pager
- AC5 `[R]` Works on label, search, archive

**R-RENDER-4 · Static pages use page chrome**

- AC1 `[R]` Static page has zero `.share-bar`, `.author-bio`, `.related`, `.reading-progress`
- AC2 `[R]` Post page has exactly one of each
- AC3 `[C]` Post-only components sit inside `data:view.isPost`, not `isSingleItem`

### R-EMPTY — Failure visibility

**R-EMPTY-1 · No view renders a blank content area**

- AC1 `[R]` All ten views render `<main>` with ≥ 40 characters of visible text
- AC2 `[R]` Empty label renders `.empty-state` naming the label
- AC3 `[R]` Empty search renders `.empty-state` quoting the query + pre-filled input
- AC4 `[R]` 404 returns HTTP 404 **and** renders `.empty-state` + 5 recent posts
- AC5 `[C]` `status-message` has no branch producing empty output
- AC6 `[R]` Copy differs between no-results, no-label, no-posts

**R-EMPTY-2 · Content never depends on JavaScript**

- AC1 `[R]` Every R-RENDER assertion passes with JS disabled
- AC2 `[C]` No compiled CSS sets `opacity: 0` / `visibility: hidden` / `display: none` on `.post-*` or `.article-*` outside `:hover`, `:focus`, `[hidden]`
- AC3 `[R]` Walking each post's ancestors finds no computed `opacity: 0`
- AC4 `[R]` All content assertions pass under `prefers-reduced-motion: reduce`
- AC5 `[C]` No image relies on a JS lazy-loader; `loading` is a native attribute

### R-NAV — Navigation and taxonomy

**R-NAV-1 · No navigation element points at an empty destination**

- AC1 `[R]` Every `/search/label/*` href resolves to a view with ≥ 1 post
- AC2 `[C]` **No hardcoded `/search/label/` anywhere in `src/`** ← build-breaking
- AC3 `[R]` Topic nav derives from the Label widget; zero labels means no bar
- AC4 `[R]` Every masthead link returns 200

**R-NAV-2 · Every content zone is editable from Layout**

- AC1 `[C]` A `b:section` exists for all seven zones in §3.2
- AC2 `[M]` Each visible and editable in Blogger Layout
- AC3 `[R]` A section with no widget renders nothing, no empty container
- AC4 `[C]` Every overridden includable has a fallback branch
- AC5 `[C]` `b:defaultmarkup` declared for `Common`, `PopularPosts`, `FeaturedPost`, `ContactForm`, `BlogArchive`, `Label`
- AC6 `[C]` README zone table parsed and diffed against `dist/theme.xml`

### R-SEO

**R-SEO-1 · Structured data valid on every view**

- AC1 `[R]` Every `ld+json` block parses with `JSON.parse`
- AC2 `[R]` Posts emit `BlogPosting` with `headline`, `datePublished`, `author`, `publisher`, `mainEntityOfPage`
- AC3 `[R]` A post titled `🛡️ "Quotes" & <angles> — em dash` produces valid JSON
- AC4 `[C]` `dateModified` conditional, never empty
- AC5 `[M]` Google Rich Results Test passes for home and post

**R-SEO-2 · Share previews correct**

- AC1 `[R]` Every view emits `og:title`, `og:type`, `og:url`, `og:image`, `og:description`
- AC2 `[R]` `og:type` is `article` on `isPost`, `website` elsewhere
- AC3 `[R]` No featured image falls back to a site image; never omits `og:image`
- AC4 `[R]` `rel=canonical` matches `data:view.url.canonical`
- AC5 `[R]` Exactly one `<h1>` per view

### R-PERF

**R-PERF-1 · Fast on a mid-range phone**

- AC1 `[R]` Lighthouse mobile performance ≥ 90 on home and post (Moto G Power, 4G)
- AC2 `[R]` CLS ≤ 0.05
- AC3 `[R]` LCP ≤ 2.5s
- AC4 `[C]` `dist/theme.xml` ≤ 500 KB
- AC5 `[C]` Inline JS ≤ 8 KB minified
- AC6 `[C]` Every post image uses `resizeImage` or `sourceSet`, explicit `width`/`height`, `loading='lazy'` below the fold
- AC7 `[C]` `b:css='false'` set
- AC8 `[C]` Fonts preconnected, `display: swap`, system fallback declared

**R-PERF-2 · Useful before JavaScript runs**

- AC1 `[R]` First contentful paint contains article text with JS disabled
- AC2 `[C]` No render-blocking script before `</head>` except the init IIFE
- AC3 `[R]` Related posts never block or shift the article

### R-A11Y

**R-A11Y-1 · WCAG 2.2 AA**

- AC1 `[R]` axe-core: zero serious or critical violations, all ten views
- AC2 `[R]` Lighthouse accessibility ≥ 95
- AC3 `[R]` Body text ≥ 7:1; other text ≥ 4.5:1
- AC4 `[R]` Every interactive element has a focus indicator ≥ 3:1

**R-A11Y-2 · Keyboard operability**

- AC1 `[R]` Tab order follows visual order
- AC2 `[R]` Skip link first focusable and works
- AC3 `[R]` Mobile nav disclosure works by keyboard with JS disabled
- AC4 `[R]` No keyboard trap

**R-A11Y-3 · Heading hierarchy despite Blogger defaults**

- AC1 `[R]` Exactly one `h1` per view
- AC2 `[R]` No level skipped
- AC3 `[R]` Index: site title `h1`, post titles `h2`. Post: post title `h1`, site
  title demoted to `p` by the Header widget.

### R-BUILD

**R-BUILD-1 · Generation catches V3 mistakes before upload**

- AC1 `[C]` Fails on `b:widget` missing `version='2'`
- AC2 `[C]` Fails on `b:version` or `class='v2'` on `<html>`
- AC3 `[C]` Fails on any `data:` tag containing parentheses
- AC4 `[C]` Fails on banned V2 constructs
- AC5 `[C]` Fails on `&&` or `||` in an expression
- AC6 `[C]` Fails on undeclared XML entities outside CDATA
- AC7 `[C]` Fails on fabricated metadata (hardcoded reading time, blank Gravatar)
- AC8 `[C]` Fails if output is not well-formed XML
- AC9 `[C]` **Each lint rule has a self-test proving it flags a real violation and does not flag a comment describing one**

> AC9 exists because the predecessor's data-tag linter flagged its own
> documentation and broke the build.

**R-BUILD-2 · The deployed theme is always identifiable**

- AC1 `[C]` Output contains `<meta name='theme-build' content='{templateVersion}+{git-sha}'>`
- AC2 `[R]` The harness reads it and **refuses to run against a mismatch**, exiting STALE
- AC3 `[C]` Golden-file diff against a committed snapshot

---

## 5. Non-functional requirements

| ID | Requirement | Verified by |
|---|---|---|
| NFR-1 | Cold generate < 10s | CI timing |
| NFR-2 | Contract suite < 5s, zero network | CI timing |
| NFR-3 | Render harness < 4 min | CI timing |
| NFR-4 | Never parallel requests to one Blogger host; ≥ 4s pacing | Review + rate-limit log |
| NFR-5 | Harness distinguishes PASS / FAIL / BLOCKED / STALE, distinct exit codes | Contract test on the harness itself |
| NFR-6 | Zero `continue-on-error` in CI after M2 | Workflow lint |
| NFR-7 | Zero `\|\| true` in any CI step | Workflow lint |
| NFR-8 | Every release tagged and rollback-able in one step | Runbook drill |

> NFR-6 and NFR-7 exist because the predecessor's CI ran
> `npx stylelint … || true`. A permanently tolerated failure is a disabled test.

---

## 6. Business rules

| ID | Rule |
|---|---|
| BR-1 | The `Blog` and `Header` widgets are `locked='true'`. Removing either from Layout would break the site. |
| BR-2 | Author identity always from `data:post.author.*`. Never hardcoded. |
| BR-3 | Displayed metrics derived from content. A fabricated reading time is a build failure. |
| BR-4 | Taxonomy is content, not theme. The theme may only render labels that exist. |
| BR-5 | Production is never a test target. Automation runs against staging; production gets a read-only canary. |
| BR-6 | Uploads come from a tagged release artifact, never a local build. |
| BR-7 | Any change to `src/widgets/blog.pug` requires a staging render pass before merge. |
| BR-8 | Borrowed guidance (tutorials, AI prompts, marketplace themes) is a hypothesis until verified on staging. See §11. |

---

## 7. Edge cases

Beyond the state matrix in §2.6:

- **Bot challenge during verification** → harness reports BLOCKED, never FAIL
- **Feed unreachable** → fatal exit, distinct from theme failure
- **Post deleted between feed read and page fetch** → expected, not a failure
- **Two posts share a title** → related-posts dedupes by post ID
- **Label contains `/`, `#`, or a space** → URL-encoded, composed with `path`
- **Post body has an unclosed tag** (Blogger allows this) → layout survives outside `.article-body`
- **Comment author has no display name** → "Anonymous", never blank
- **`numPosts` set to 1 in the dashboard** → lead layout still correct
- **Wide code block or table** → scrolls within its container, never widens the page
- **Timezone** → `datePublished` uses the blog's configured timezone
- **Layout mode** → renders without throwing

---

## 8. Testing strategy

Four layers. **The predecessor had layer 1 only and mistook it for coverage.**

**Layer 1 · Contract** (offline, ~3s, every commit)
Parses `dist/theme.xml` and asserts the V3 contract: widget versions, required
includables, banned constructs, expression legality, entity validity, size
budget, build stamp. Cannot prove rendering. Catches F1 in under a second.

**Layer 2 · Golden file** (offline, ~1s, every commit)
Diffs generated XML against a committed snapshot. Any unintended change to the
render path appears in the PR diff as reviewable text. Updating the snapshot is a
deliberate, reviewed act.

**Layer 3 · Render harness** (live staging, ~4 min, every PR)
The one that matters. Asserts against real Blogger HTML across ten views and
three browser contexts. Non-negotiable properties, all from F5:

- **Serialized and paced.** One request at a time, 4s minimum, backoff honouring
  `Retry-After`. Playwright `workers: 1`, `retries: 0`. Retrying a throttled
  request is the one thing guaranteed to make throttling worse.
- **Build-stamp gated.** Compares deployed stamp to working tree before asserting
  anything. Mismatch exits STALE with upload instructions and zero assertions run.
- **Four states.** PASS, FAIL, BLOCKED, SKIP. BLOCKED is never PASS and never
  FAIL; any BLOCKED yields an inconclusive exit.
- **Discovery-driven.** URLs, labels, and search terms read from the feed at
  runtime. The search term is lifted from a real post title so a match is
  guaranteed by construction.
- **Requirement-tagged output.** Every assertion prints the requirement ID it
  verifies.

**Layer 4 · Visual regression** (live staging, on demand)
Screenshots at 375 / 768 / 1440 for all ten views, diffed against baselines at
0.1% tolerance.

**Permanently banned: fixture-based DOM tests.** No `mock.html`, ever. If a
test's subject is a file we wrote by hand, it is not a test (F4).

---

## 9. CI/CD

Three workflows. Full YAML is written in M0/M1; this is the contract they honour.

### `ci.yml` — PR gate

| Job | Steps | Notes |
|---|---|---|
| `generate` | lint → generate → contract → golden → size budget → upload artifact | No `\|\| true` anywhere (NFR-7) |
| `render` | stamp gate → HTTP harness → Playwright (JS/no-JS/reduced-motion) → axe | `concurrency: staging-blog` repo-wide, so runs cannot rate-limit each other (NFR-4) |
| `lighthouse` | performance budgets | Same concurrency group |

Environment: `NODE_VERSION: '24'`, `STAGING_URL`, `HARNESS_PACE_MS: '4000'`.
All results published to `$GITHUB_STEP_SUMMARY` so a red run is diagnosable
without opening raw logs.

### `release.yml` — on `v*` tag

Generate → contract → size → `sha256sum` → GitHub Release with `theme.xml` and
`theme.xml.sha256` attached. Every release stays downloadable, so **rollback is
one step** (NFR-8).

### `canary.yml` — every 6 hours

Read-only check that production renders posts (BR-5). On failure, opens a
`canary` + `P0` issue, deduplicated by title.

**Why the canary matters:** the render path can break with no commit. A dashboard
change, a widget deleted in Layout, or a Blogger platform update can blank the
site while the repo sits untouched. The predecessor's homepage was blank for an
unknown period with nobody watching.

### Branch protection

`main` requires `generate`, `render`, `lighthouse` green, one review, up-to-date
branch, linear history.

### Release procedure

1. Merge to `main` → CI generates and verifies against staging
2. Tag `v1.x.y` → release workflow attaches `theme.xml` + checksum
3. Upload to production (Theme → ⋮ → Restore)
4. `BLOG_URL=https://blogs.redwan.work npm run harness` confirms stamp and rendering
5. Rollback: download the previous release artifact, re-upload

---

## 10. Milestones

| M | Name | Exit criteria | Est. |
|---|---|---|---|
| **M0** | Repo + staging + harness | Repo scaffolded. Staging blog created and seeded from `fixtures/`. A Google native V3 theme exported into `docs/reference/`. Harness covers ten views, four-state results, build-stamp gate. **Runs red against an empty theme for the right reasons.** | 1 d |
| **M1** | Generation pipeline | Pug → V3 XML, SCSS → skin, TS → inline. Contract suite with all R-V3 and R-BUILD rules plus their self-tests. Golden snapshot. `generate` job green. | 1.5 d |
| **M2** | Render path | Header + Blog widgets against the full includable contract. All ten views render. R-RENDER and R-EMPTY pass **with JS disabled**. Comment rendering verified (RK-2). Every `continue-on-error` removed. | 2 d |
| **M3** | Design system | Tokens, type scale, layout. Lead + list index, article layout, all §2.6 states. Visual baselines captured. | 2 d |
| **M4** | Config zones | All seven zones in §3.2 live and editable. `defaultmarkup` for six widget types. R-NAV passes. Labels applied to production posts. | 1 d |
| **M5** | SEO + a11y | R-SEO and R-A11Y pass. axe clean, Rich Results clean. | 1 d |
| **M6** | Performance | R-PERF passes. Budgets enforced in CI. | 1 d |
| **M7** | Cutover | Back up current theme, tag `v1.0.0`, deploy, verify, canary armed, runbook written. | 0.5 d |

**M0 before M1 is deliberate and non-negotiable.** The predecessor's defining
mistake was building for days before discovering nothing rendered. The harness
exists before the thing it measures.

---

## 11. Risks and open decisions

### Risks

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| RK-1 | Blogger's rate limiter makes CI flaky | High | Med | 4s pacing, repo-level concurrency group, BLOCKED never reads as FAIL, inconclusive runs re-run rather than overridden |
| RK-2 | `b:defaultwidgetversion='2'` interferes with the comments area, as reported in some configurations | Med | Med | Explicit `version='2'` per widget regardless; comment rendering is an M2 exit criterion on staging; drop the global attribute if it misbehaves |
| RK-3 | Blogger changes widget behaviour with no notice | Low | High | Canary catches within 6 hours; contract tests pin assumptions |
| RK-4 | Manual upload lets staging and production drift | Med | High | Build stamp + deploy gate makes drift loud instead of silent |
| RK-5 | Pug adds a layer between source and the XML Blogger sees | Med | Med | Golden-file test makes every XML change visible in the PR diff |
| RK-6 | Undocumented V3 data tags behave unexpectedly | Med | Med | Verify each on staging before relying on it; never production first |
| RK-7 | Scope creep toward marketplace features | Med | Med | §1 non-goals are binding; changes need an explicit decision record |
| RK-8 | Borrowed guidance introduces V2 paradigms | Med | High | BR-8 plus contract bans. Worked example below. |

### Borrowed-guidance hygiene (BR-8)

Most circulating Blogger material is V1/V2-era, including recent posts and AI
prompts that claim to be modern. **Treat borrowed guidance as a hypothesis until
verified on staging.**

Worked example, from a "production-grade Layouts V3 / Widget V2" checklist
reviewed during planning. It was roughly two-thirds correct, which is the
dangerous ratio: right often enough to be trusted, wrong in a way that silently
destroys the theme.

#### Adopted

| Item | Where it landed |
|---|---|
| `preferred` on `b:section` | V3-REFERENCE §3; `main` uses it |
| **`Header` as an essential widget type** | V3-REFERENCE §7, §3.2 here, R-V3-1 AC6, R-A11Y-3 AC3, BR-1. **A real gap.** Without it the blog title is uneditable from Layout and Blogger may inject its own markup. |
| `b:loop` `index` to cap iteration without JS | V3-REFERENCE §3 and §7; used by the 404 and empty-search states |
| `b:with` to compute a resized image once and reuse it | V3-REFERENCE §3 and §7 |
| `b:defaultmarkup` for `PopularPosts`, `FeaturedPost`, `ContactForm`, `Label`, plus `BlogArchive` | R-NAV-2 AC5. Reframed as **defensive**, not decorative: a dashboard-added gadget would otherwise inject unstyled HTML. |
| `b:attr` / `b:class` over fragile inline conditionals | V3-REFERENCE §3 |
| Inspecting Google's native V3 themes (Contempo, Soho, Emporio) | §3.5, M0, V3-REFERENCE §9. Genuinely the best primary source available. |
| `visible` on `b:widget` | V3-REFERENCE §3 |

#### Rejected

| Claim | Verdict |
|---|---|
| "Strictly match `<html> b:version='2' class='v2'` with `<b:widget version='2'>`" | **Wrong, and dangerous.** `b:version='2'` is the V2 theme format; it cannot pair with Layouts V3. Following it reproduces F1 exactly: valid XML, no error, every custom includable silently discarded. Now contract-banned. |
| `https://google.com` given as "Google's Official Help Document System for Theme Customization" | **Not a documentation URL.** An agent told to research it will improvise. Real sources are in V3-REFERENCE §9. |
| "Roughly 5,000 to 10,000 lines of highly clean XML" | **Anti-goal.** The predecessor was 44 KB of valid XML that rendered nothing. Budget is 500 KB. Line count measures nothing. |
| "Expand `<b:skin>` with extensive `<Group>` and `<Variable>` declarations… naturally adds thousands of lines of high-value structural code" | **Padding dressed as value.** Written for marketplace resale, an explicit non-goal (§1). Every Theme Designer variable is also a surface for a user to break the contrast ratios in §2.2. |
| `b:attr` injecting `data-lazy-src` for a JS lazy-loader | **Rejected.** Native `loading='lazy'` needs no JavaScript. Making image visibility depend on a script is F3 in a new costume. Now banned. |
| `b:else` fallback "vector placeholder" for a missing featured image | **Rejected.** Zero of 16 posts have a featured image, so a placeholder would appear on every row. The layout is designed to be correct with no image at all. |
| `b:switch` routing Video / Audio / Gallery post formats | **Out of scope, not wrong.** A legitimate V3 technique with no content to serve here. See §2.4. |
| `data:view.isPage` to "change sidebar configuration" | **N/A.** No sidebar in this design. |
| "Start with the `b:skin` variables or the Blog1 grid loop" | **Neither.** That ordering is what produced a blank homepage. M0 comes first, always. |

The useful parts were adopted; the rest is banned by test. That is the process
for every future borrowed source.

### Open decisions

| ID | Question | Recommendation | Status |
|---|---|---|---|
| **OD-1** | Automate theme upload? | **Manual, stamp-gated.** Blogger API v3 has no theme endpoint. Reverse-engineering the upload endpoint breaks without warning and puts Google credentials in CI; browser automation is an account risk for a once-per-release step. | Recommended |
| **OD-2** | Serif article body? | **Yes, serif throughout the article.** Strongest differentiator in this category, suits long-form. | Recommended |
| **OD-3** | Dark mode? | **After this release.** Doubles the state matrix; the predecessor's toggle caused FOUC complexity. | Recommended |
| **OD-4** | Carry over the predecessor's audit and issues? | **Migrated.** See `POSTMORTEM.md`. | Done |
| **OD-5** | Label taxonomy for the 16 posts? | Suggested from the service lines: `Penetration Testing`, `Red Teaming`, `Digital Forensics`, `OSINT`, `Linux Hardening`, `Cloud Security`, `DevOps`, `AI Security`. | **Open — blocks M4** |
| **OD-6** | Reading time: compute or drop? | **Compute** from a word count over `data:post.body`. BR-3 makes a hardcoded value a build failure. | Recommended |
| **OD-7** | Keep `b:defaultwidgetversion='2'`? | **Keep, verify comments on staging in M2.** Per-widget `version='2'` is contract-enforced either way. | Recommended |

---

## 12. Definition of done

Ships when all are true, each verified by an automated check rather than a claim
in a README:

1. All 16 production posts render on home, search, label, and archive **with JavaScript disabled**
2. All ten views render correct, distinct layouts
3. Layout mode renders without error
4. Pagination reaches every post on every index view
5. Every empty and error state renders specific, human-readable copy
6. Zero navigation elements point at an empty destination
7. Structured data valid on every view, including emoji and quote-bearing titles
8. Lighthouse mobile ≥ 90 performance, ≥ 95 accessibility, on home and post
9. axe-core: zero serious or critical violations on all ten views
10. CI fails if any view stops rendering posts
11. Zero `continue-on-error` and zero `|| true` anywhere in CI
12. README zone table verified against `dist/theme.xml` by a test
13. Production canary armed and green for 48 hours
14. A rollback rehearsed end to end at least once
