# Ledger Design System Specification (v1.6.0)

This document provides the complete, authoritative specification for the **Ledger** design system implemented in `src/styles/`.

---

## 1. OKLCH Perceptual Color Palette

Ledger uses the **OKLCH** (Lightness, Chroma, Hue) color space for predictable perceptual contrast and accessible color scaling across light and dark modes.

### Theme Modes

```scss
// Light Mode (Warm Editorial Paper)
--bg-page:        oklch(0.985 0.005 85);    // Warm off-white
--bg-card:        oklch(1.000 0.000 0);     // Crisp card surface
--text-primary:   oklch(0.180 0.020 60);    // Deep charcoal ink (WCAG AAA >= 12:1)
--text-secondary: oklch(0.420 0.020 60);    // Editorial muted slate
--accent:         oklch(0.550 0.160 30);    // Crimson editorial accent
--border:         oklch(0.900 0.010 85);    // Delicate warm border

// Dark Mode (Deep Technical Obsidian)
--bg-page:        oklch(0.120 0.015 260);   // Deep obsidian slate
--bg-card:        oklch(0.160 0.018 260);   // Elevated panel surface
--text-primary:   oklch(0.950 0.005 260);   // Luminous technical white
--text-secondary: oklch(0.720 0.015 260);   // Crisp secondary text
--accent:         oklch(0.680 0.150 35);    // High-visibility crimson
--border:         oklch(0.240 0.020 260);   // Muted slate border
```

### Contrast Guarantees
- **Body Text**: Exceeds WCAG AAA (`>= 7:1`) on all background surfaces.
- **Accents & Links**: Exceeds WCAG AA (`>= 4.5:1`) in both light and dark modes.
- **Interactive Focus Rings**: High-contrast outline `2px solid var(--accent)` with `2px` offset.

---

## 2. Typography Scale & Layout Metrics

### Type Scale
- **Display Heading (`h1`)**: `clamp(1.75rem, 3.5vw, 2.5rem)` (32px – 40px)
- **Section Heading (`h2`)**: `1.375rem` (22px)
- **Subheading (`h3`)**: `1.125rem` (18px)
- **Body Regular**: `1.0rem` (16px, line-height `1.75`)
- **Metadata & Badges**: `0.75rem` / `0.8125rem` (12px – 13px)
- **Code & Monospace**: `0.875rem` (14px, JetBrains Mono / SFMono / Consolas)

### Optical Center Alignment
In post headers, all inline elements share an exact mathematical baseline center:
```css
.post-header-line {
  display: inline-flex;
  align-items: center;
  /* Avatar (24px), Name (13px), Date (12px), Reading Time (12px), Audio Bar (26px) */
  /* align at exact centerY = 78.0px */
}
```

---

## 3. Responsive 12-Column Grid Architecture

Ledger employs a responsive layout with 3 key viewport tiers:

1. **Mobile (`< 640px`)**:
   - Single vertical stack.
   - Header brand with hamburger drawer toggle and quick search trigger.
   - Post cards stack vertically; author metadata wraps cleanly.
2. **Tablet (`640px – 1023px`)**:
   - Full-width hero card on index view.
   - 2-column post card grid.
   - Audio narration bar wraps cleanly to a dedicated row below metadata.
3. **Desktop (`>= 1024px`)**:
   - 12-column responsive layout (`repeat(12, 1fr)`).
   - Article content spans columns `1 / 9` (left 8 columns).
   - Sticky sidebar spans columns `9 / 13` (right 4 columns).
   - Audio narration bar displays inline with post metadata.

---

## 4. Components & Interactive UI

### 16:9 Post Cards & Compact Tag Pills
- **Image Aspect Ratio**: Framed `16:9` (`aspect-ratio: 16 / 9; object-fit: cover;`).
- **Tag Pills**: Compact box sizing (`min-height: unset; height: auto; padding: 2px 8px; border-radius: 4px; font-size: 0.6875rem;`).
- **Clamping**: Post titles clamped to 2 lines (`-webkit-line-clamp: 2`). Excerpts clamped to 2 lines.

### Audio Article Narration & Speed Control
- **Engine**: Client-side SpeechSynthesis with sentence boundary regex chunking to prevent browser timeout bugs.
- **Speed Cycling**: Interactive badge cycling through `1x` ➔ `1.25x` ➔ `1.5x` ➔ `0.5x` ➔ `0.75x` ➔ `1x`.
- **Live Adjustment**: Dynamic speed updates on active playback without restarting the article.

### Interactive Mermaid Diagrams
- **Floating Controls**: Transparent pill bar overlaid on diagrams providing step zoom (`100% – 250%`), fit-to-screen reset, and direct standalone SVG download with inlined stylesheet styles.

### Faceted Homepage Filter
- Real-time client-side text search with instant live filtering.
- Dynamic Year and Month dropdown selectors.
- Interactive Category pills with active counter indicators.
