# Ledger Blogger Theme — Cybersecurity Knowledge Platform Design System

## 1. Design Philosophy

- **Domain Identity**: Security Engineering × Editorial Research × Developer Tooling × Premium Personal Brand.
- **Visual Tone**: Intelligent, precise, technical, premium, trustworthy, calm, and distinctive.
- **Core Principles**:
  - Dark technical foundation with deep charcoal, obsidian, and subtle navy/slate tones.
  - OKLCH color space for mathematically uniform perceptual lightness, chroma, and hue.
  - Restrained, high-contrast typography hierarchy (system serif for long-form reading, sans-serif for UI, monospace for technical accents and code).
  - Subtle depth: 1px hairlines, soft accent glows, fine surface elevation, and micro-interactions.
  - Zero layout shifts, zero render-blocking dependencies, pure progressive enhancement.

---

## 2. Color System (OKLCH Tokens)

| Token | Lightness / Chroma / Hue | Purpose |
|---|---|---|
| `$bg-base` | `oklch(14% 0.015 260)` | Main canvas background (deep obsidian/slate) |
| `$bg-surface` | `oklch(18% 0.018 260)` | Elevated cards, sidebars, modals |
| `$bg-surface-hover` | `oklch(22% 0.022 260)` | Interactive card/panel hover state |
| `$text-primary` | `oklch(96% 0.005 260)` | Crisp off-white headings and primary copy (13:1+ AAA) |
| `$text-secondary` | `oklch(76% 0.012 260)` | Subdued body copy and excerpts (6:1+ AA) |
| `$text-muted` | `oklch(58% 0.015 260)` | Metadata, dates, footnotes (4.5:1+ AA) |
| `$border-subtle` | `oklch(26% 0.018 260)` | 1px section rules, dividers, card outlines |
| `$border-hover` | `oklch(38% 0.035 260)` | Card and interactive border highlight on focus/hover |
| `$accent` | `oklch(68% 0.19 250)` | Electric indigo / cyan-blue primary accent (5:1+ AA on dark) |
| `$accent-glow` | `oklch(68% 0.19 250 / 0.15)` | Subtle focus/hover aura |
| `$accent-wash` | `oklch(24% 0.045 250)` | Topic pills, badge backgrounds, code headers |

---

## 3. Typography Hierarchy

- **Editorial Headings & Titles**: `georgia, 'Iowan Old Style', 'Palatino Linotype', palatino, serif`
- **UI & Interface**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', roboto, sans-serif`
- **Code & Technical Accents**: `ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', consolas, monospace`

### Scale & Spacing Rhythm
- **Site Title**: `1.75rem` / `700`
- **Lead Hero / H1 Article**: `clamp(2.0rem, 1.4rem + 2.5vw, 3.0rem)` / `700` / line-height `1.15`
- **H2 Section**: `1.777rem` / `650`
- **H3 Subheading / Card Title**: `1.333rem` / `600`
- **Body Prose**: `1.0625rem` / line-height `1.7` / max-width `68ch`
- **Metadata / Badges**: `0.8125rem` / `500` / tracking `0.02em`
- **Monospace Tags**: `0.75rem` / `600` / uppercase / tracking `0.06em`

---

## 4. Components & Layout Structure

### 4.1 Header (Sticky Glassmorphic)
- Sticky at top with blur backdrop (`backdrop-filter: blur(12px)`).
- Site brand: **Md Redwan Ahmed** with subtitle `/ Security Notes`.
- Interactive search modal trigger + drawer navigation toggle.

### 4.2 Editorial Hero
- Compact security engineer header with status badge ("🟢 OPERATIONAL / RESEARCH JOURNAL").
- Value statement: "Security engineering notes, vulnerability analysis, and infrastructure resilience observations."
- Clean horizontal topic explorer rail.

### 4.3 Featured Story & Recent Posts
- **Lead Story (First Post on Home p1)**: Featured hero card (8 columns on desktop) with image thumbnail, category tag, large title, excerpt, and read button.
- **Recent Feed**: Clean list rows separated by 1px hairlines with category badge, title, date, and hover glow.

### 4.4 Technical Reading Experience (Single Post)
- Centered 8-column reading zone (`grid-column: 3 / 11;` on desktop).
- Share controls (Copy link toast, Twitter/X, LinkedIn, Facebook).
- Styled code blocks with monospaced font, scrollable pre tags, and clean background surface.
- Author Bio Card with photo, name, bio, and direct links to `redwan.work`.
- Prev / Next post navigation cards.
- Native Blogger threaded comments styled with dark theme panels.

### 4.5 Footer
- 3-column layout: Brand summary + Quick category links + Connect (Portfolio, Services, Fast Cyber Defense, Cal.com).
- Copyright notice and secure SSL indicator.

---

## 5. Responsive Breakpoints

- **Mobile (<640px)**: Single column with 20px gutters. Touch-friendly drawers and search modal.
- **Tablet (640px–1023px)**: Single column with 48px gutters, lead post returns full width.
- **Desktop (>=1024px)**: 12-column grid layout, max-width 1280px.

---

## 6. Accessibility (WCAG 2.2 AA)

- All text meets or exceeds 4.5:1 (normal text) and 7:1 (large text) contrast ratios.
- Visible `:focus-visible` ring: 2px solid `$accent` with 2px offset.
- `prefers-reduced-motion: reduce` disables all transforms, scaling, and animations.
- Skip link (`#content`) is first in DOM and tab order.
