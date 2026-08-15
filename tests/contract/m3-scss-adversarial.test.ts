import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileString } from 'sass';
import { generateTheme } from '../../tools/generate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha = '0123456789abcdef0123456789abcdef01234567';

interface OklchColor {
  l: number; // 0 to 1
  c: number; // >= 0
  h: number; // 0 to 360 degrees
}

function parseOklch(str: string): OklchColor {
  const match = str.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)/i);
  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Invalid OKLCH color string: "${str}"`);
  }
  let l = parseFloat(match[1]);
  if (str.includes(`${match[1]}%`) || l > 1) {
    l = l / 100;
  }
  const c = parseFloat(match[2]);
  const h = parseFloat(match[3]);
  return { l, c, h };
}

function oklchToRelativeLuminance(color: OklchColor): number {
  const { l: L, c: C, h: H } = color;
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLinear = +4.0767439362 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

function calculateContrast(fg: OklchColor, bg: OklchColor): number {
  const lum1 = oklchToRelativeLuminance(fg);
  const lum2 = oklchToRelativeLuminance(bg);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractCssFromTheme(xml: string): string {
  const skinMatch = xml.match(/<b:skin[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/b:skin>/);
  if (!skinMatch || !skinMatch[1]) {
    throw new Error('Theme does not contain a valid b:skin CDATA block');
  }
  return skinMatch[1].trim();
}

/**
 * Robust CSS Rule Parser that correctly tracks top-level vs media-query rules
 */
interface ParsedCssRule {
  selector: string;
  declarations: string;
  mediaQuery: string | null;
}

function parseCssRules(css: string): ParsedCssRule[] {
  const rules: ParsedCssRule[] = [];
  let currentMediaQuery: string | null = null;
  let buffer = '';
  let depth = 0;
  let selectorBuffer = '';

  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    if (char === '{') {
      if (depth === 0) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('@media')) {
          currentMediaQuery = trimmed;
          buffer = '';
          depth = 1;
        } else {
          selectorBuffer = trimmed;
          buffer = '';
          depth = 1;
        }
      } else if (depth === 1 && currentMediaQuery) {
        selectorBuffer = buffer.trim();
        buffer = '';
        depth = 2;
      }
    } else if (char === '}') {
      if (depth === 2 && currentMediaQuery) {
        rules.push({
          selector: selectorBuffer,
          declarations: buffer.trim(),
          mediaQuery: currentMediaQuery
        });
        selectorBuffer = '';
        buffer = '';
        depth = 1;
      } else if (depth === 1) {
        if (currentMediaQuery) {
          currentMediaQuery = null;
          depth = 0;
          buffer = '';
        } else {
          rules.push({
            selector: selectorBuffer,
            declarations: buffer.trim(),
            mediaQuery: null
          });
          selectorBuffer = '';
          buffer = '';
          depth = 0;
        }
      }
    } else {
      buffer += char;
    }
  }

  return rules;
}

describe('Adversarial Stress Testing: M3.2 SCSS Architecture & OKLCH Design System', () => {
  describe('Target 1: SCSS Compilation, Deduplication, and Size Budget', () => {
    it('compiles dist/theme.xml strictly under 200,000 bytes', async () => {
      const generated = await generateTheme({ sha, write: false });
      expect(generated.bytes).toBeLessThan(200_000);
      expect(generated.bytes).toBeGreaterThan(0);
      // Ensure compiled XML is compact (typically ~10-25 KB)
      expect(generated.bytes).toBeLessThan(50_000);
    });

    it('generates a compact compiled CSS skin (< 20 KB compressed)', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      const css = extractCssFromTheme(xml);
      const cssBytes = Buffer.byteLength(css, 'utf8');

      // Compiled CSS should be compact and clean, well under budget
      expect(cssBytes).toBeLessThan(20_000);
      expect(cssBytes).toBeGreaterThan(1_000);
    });

    it('compiles all modular SCSS partials independently without undefined variable errors', async () => {
      const partials = ['base.scss', 'layout.scss', 'index.scss', 'article.scss', 'states.scss'];
      const stylesDir = path.join(ROOT, 'src/styles');

      for (const partial of partials) {
        const scssContent = await readFile(path.join(stylesDir, partial), 'utf8');
        // Compile partial directly with loadPaths pointing to styles dir
        const result = compileString(scssContent, {
          style: 'compressed',
          loadPaths: [stylesDir]
        });
        expect(result.css.length).toBeGreaterThan(0);
        // Ensure no uncompiled Sass variables ($var) remain in CSS output
        expect(result.css).not.toMatch(/\$[a-zA-Z0-9_-]+/);
      }
    });

    it('diagnoses all CSS rules and checks for selector duplication', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      const css = extractCssFromTheme(xml);
      const parsedRules = parseCssRules(css);

      // Verify that all selectors have non-empty declarations
      for (const rule of parsedRules) {
        expect(rule.selector.length).toBeGreaterThan(0);
        expect(rule.declarations.length).toBeGreaterThan(0);
      }

      // Check top-level rules for exact selector duplicates and explain why any split blocks occur
      const topLevelRules = parsedRules.filter((r) => r.mediaQuery === null);
      const selectorCounts = new Map<string, number>();
      for (const rule of topLevelRules) {
        selectorCounts.set(rule.selector, (selectorCounts.get(rule.selector) ?? 0) + 1);
      }

      // In Sass compilation of index.scss, .post-title properties before and after nested `a` block
      // are emitted in two contiguous chunks (.post-title -> .post-title a -> .post-title).
      // Verify that no selector is duplicated more than twice.
      for (const [selector, count] of selectorCounts.entries()) {
        expect(count, `Selector ${selector} duplicated ${count} times`).toBeLessThanOrEqual(2);
      }
    });

    it('contains zero uncompiled Sass artifacts or invalid template expressions in CSS', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      const css = extractCssFromTheme(xml);

      // Must not contain raw SCSS syntax like $var, @include, @mixin, @extend, #{...}
      expect(css).not.toMatch(/\$[a-zA-Z0-9_-]+/);
      expect(css).not.toMatch(/@include\b/);
      expect(css).not.toMatch(/@mixin\b/);
      expect(css).not.toMatch(/@extend\b/);
      expect(css).not.toMatch(/#\{[^}]+\}/);

      // Must not contain unbalanced braces
      const openBraces = (css.match(/\{/g) ?? []).length;
      const closeBraces = (css.match(/\}/g) ?? []).length;
      expect(openBraces).toBe(closeBraces);
    });
  });

  describe('Target 2: OKLCH Design Tokens & Color System Robustness', () => {
    it('strictly maintains 85-degree neutral hue family across all 5 neutral tokens', async () => {
      const tokensScss = await readFile(path.join(ROOT, 'src/styles/tokens.scss'), 'utf8');

      const neutralTokens = ['page', 'surface', 'ink', 'ink-muted', 'rule'];
      for (const token of neutralTokens) {
        const match = tokensScss.match(new RegExp(`\\$${token}:\\s*(oklch\\([^)]+\\));`));
        expect(match).not.toBeNull();
        const parsed = parseOklch(match?.[1] ?? '');
        // Hue must be 85 (neutral hue family)
        expect(parsed.h).toBe(85);
      }
    });

    it('strictly maintains 25-degree warm accent hue for accent and accent-wash', async () => {
      const tokensScss = await readFile(path.join(ROOT, 'src/styles/tokens.scss'), 'utf8');

      const accentTokens = ['accent', 'accent-wash'];
      for (const token of accentTokens) {
        const match = tokensScss.match(new RegExp(`\\$${token}:\\s*(oklch\\([^)]+\\));`));
        expect(match).not.toBeNull();
        const parsed = parseOklch(match?.[1] ?? '');
        // Hue must be 25 (warm oxidised red)
        expect(parsed.h).toBe(25);
      }
    });

    it('guarantees WCAG 2.2 AAA contrast (>= 7.0) for body ink against both page and surface', async () => {
      const tokensScss = await readFile(path.join(ROOT, 'src/styles/tokens.scss'), 'utf8');
      const pageMatch = tokensScss.match(/\$page:\s*(oklch\([^)]+\));/);
      const surfaceMatch = tokensScss.match(/\$surface:\s*(oklch\([^)]+\));/);
      const inkMatch = tokensScss.match(/\$ink:\s*(oklch\([^)]+\));/);

      const page = parseOklch(pageMatch?.[1] ?? '');
      const surface = parseOklch(surfaceMatch?.[1] ?? '');
      const ink = parseOklch(inkMatch?.[1] ?? '');

      const contrastOnPage = calculateContrast(ink, page);
      const contrastOnSurface = calculateContrast(ink, surface);

      expect(contrastOnPage).toBeGreaterThanOrEqual(7.0);
      expect(contrastOnSurface).toBeGreaterThanOrEqual(7.0);
    });

    it('guarantees WCAG 2.2 AA contrast (>= 4.5) for accent link text on page and surface', async () => {
      const tokensScss = await readFile(path.join(ROOT, 'src/styles/tokens.scss'), 'utf8');
      const pageMatch = tokensScss.match(/\$page:\s*(oklch\([^)]+\));/);
      const surfaceMatch = tokensScss.match(/\$surface:\s*(oklch\([^)]+\));/);
      const accentMatch = tokensScss.match(/\$accent:\s*(oklch\([^)]+\));/);

      const page = parseOklch(pageMatch?.[1] ?? '');
      const surface = parseOklch(surfaceMatch?.[1] ?? '');
      const accent = parseOklch(accentMatch?.[1] ?? '');

      const contrastOnPage = calculateContrast(accent, page);
      const contrastOnSurface = calculateContrast(accent, surface);

      expect(contrastOnPage).toBeGreaterThanOrEqual(4.5);
      expect(contrastOnSurface).toBeGreaterThanOrEqual(4.5);
    });

    it('guarantees WCAG 2.2 AA contrast (>= 4.5) for button text ($page) against button background ($accent)', async () => {
      const tokensScss = await readFile(path.join(ROOT, 'src/styles/tokens.scss'), 'utf8');
      const pageMatch = tokensScss.match(/\$page:\s*(oklch\([^)]+\));/);
      const accentMatch = tokensScss.match(/\$accent:\s*(oklch\([^)]+\));/);

      const page = parseOklch(pageMatch?.[1] ?? '');
      const accent = parseOklch(accentMatch?.[1] ?? '');

      const buttonContrast = calculateContrast(page, accent);
      expect(buttonContrast).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Target 3: Verification of All 10 View States and CSS Selectors', () => {
    it('verifies body state class hooks (.is-home-lead, .is-post, .is-page) exist in template and CSS', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      const css = extractCssFromTheme(xml);

      // Verify b:class declarations on body in XML
      expect(xml).toMatch(/<b:class cond="data:view\.isHomepage and not data:newerPageUrl" name="is-home-lead"\/>/);
      expect(xml).toMatch(/<b:class cond="data:view\.isPost" name="is-post"\/>/);
      expect(xml).toMatch(/<b:class cond="data:view\.isPage" name="is-page"\/>/);

      // Verify corresponding CSS selector rules exist in compiled CSS
      expect(css).toMatch(/body\.is-home-lead/);
      expect(css).toMatch(/\.is-post/);
      expect(css).toMatch(/\.is-page/);
    });

    it('verifies .empty-state renders visible, valid non-hidden styles across all empty views', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      const css = extractCssFromTheme(xml);

      // .empty-state must have a dedicated styling rule
      expect(css).toMatch(/\.empty-state\s*\{[^}]*\}/);

      // Extract .empty-state style block
      const match = css.match(/\.empty-state\s*\{([^}]+)\}/);
      expect(match).not.toBeNull();
      const rules = match![1];

      // Must NOT be hidden
      expect(rules).not.toMatch(/display:\s*none/);
      expect(rules).not.toMatch(/visibility:\s*hidden/);
      expect(rules).not.toMatch(/opacity:\s*0/);

      // Must span full width of 12-column grid and have surface background & padding
      expect(rules).toMatch(/grid-column:\s*1\s*\/\s*-1/);
      expect(rules).toMatch(/background:\s*oklch\(/);
      expect(rules).toMatch(/padding:/);
    });

    it('verifies .comment-tombstone renders visible, distinct italic styling without hiding', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      const css = extractCssFromTheme(xml);

      // .comment-tombstone must have styling
      expect(css).toMatch(/\.comment-tombstone\s*\{[^}]*\}/);

      const match = css.match(/\.comment-tombstone\s*\{([^}]+)\}/);
      expect(match).not.toBeNull();
      const rules = match![1];

      // Must NOT be hidden
      expect(rules).not.toMatch(/display:\s*none/);
      expect(rules).not.toMatch(/visibility:\s*hidden/);
      expect(rules).not.toMatch(/opacity:\s*0/);

      // Must have italic font style and muted ink color
      expect(rules).toMatch(/font-style:\s*italic/);
      expect(rules).toMatch(/color:\s*oklch\(/);
    });

    it('verifies .pagination and pager links (.newer-link, .older-link) render non-hidden, accessible touch targets', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      const css = extractCssFromTheme(xml);

      // .pagination must have flex layout and full grid column span
      const paginationMatch = css.match(/\.pagination\s*\{([^}]+)\}/);
      expect(paginationMatch).not.toBeNull();
      const paginationRules = paginationMatch![1];

      expect(paginationRules).toMatch(/display:\s*flex/);
      expect(paginationRules).toMatch(/justify-content:\s*space-between/);
      expect(paginationRules).toMatch(/grid-column:\s*1\s*\/\s*-1/);
      expect(paginationRules).not.toMatch(/display:\s*none/);

      // .newer-link and .older-link must be styled and satisfy >= 44px min-height
      expect(css).toMatch(/\.newer-link/);
      expect(css).toMatch(/\.older-link/);
      expect(css).toMatch(/(?:\.newer-link|\.older-link)[^{]*\{[^}]*min-height:\s*44px/);
    });

    it('verifies single post / page (.is-post, .is-page) article typography and layout', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      const css = extractCssFromTheme(xml);

      // Columns 3-10 on desktop
      expect(css).toMatch(/\.is-post\s+\.post,\s*\.is-page\s+\.post\s*\{[^}]*grid-column:\s*3\s*\/\s*11/);

      // .post-body long-form typography rules
      expect(css).toMatch(/\.post-body\s*\{[^}]*max-width:\s*68ch/);
      expect(css).toMatch(/\.post-body\s+blockquote\s*\{[^}]*border-left:\s*3px\s+solid/);
      expect(css).toMatch(/\.post-body\s+table\s*\{[^}]*border-collapse:\s*collapse/);
      expect(css).toMatch(/\.post-body\s+pre\s*\{[^}]*overflow-x:\s*auto/);
    });

    it('verifies lead post behavior on home page 1 vs subsequent rows', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      const css = extractCssFromTheme(xml);

      // Lead post on home p1 gets 8 columns on desktop (grid-column: 1 / 9)
      expect(css).toMatch(/body\.is-home-lead\s+\.post:first-of-type\s*\{[^}]*grid-column:\s*1\s*\/\s*9/);

      // Lead post displays excerpt on desktop / tablet
      expect(css).toMatch(/body\.is-home-lead\s+\.post:first-of-type\s+\.post-excerpt\s*\{[^}]*display:\s*(?:block|-webkit-box)/);

      // Excerpt is clamped to 2 lines on lead post
      expect(css).toMatch(/body\.is-home-lead\s+\.post:first-of-type\s+\.post-excerpt\s*\{[^}]*line-clamp:\s*2/);

      // On mobile (< 640px), lead joins the list and excerpt is suppressed
      expect(css).toMatch(/@media\s*\(max-width:\s*639px\)\s*\{[^}]*body\.is-home-lead\s+\.post:first-of-type\s+\.post-excerpt\s*\{[^}]*display:\s*none/);
    });

    it('verifies comments section (#comments, .comments-section, .comment-form) structure and CTA button', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      const css = extractCssFromTheme(xml);

      // Comments container aligned with article columns (3-10 on desktop)
      expect(css).toMatch(/#comments,\s*\.comments-section\s*\{[^}]*grid-column:\s*3\s*\/\s*11/);

      // Comment form CTA button with minimum 44px touch target
      expect(css).toMatch(/\.comment-form\s+a\s*\{[^}]*min-height:\s*44px/);
      expect(css).toMatch(/\.comment-form\s+a\s*\{[^}]*background:\s*oklch\(/);
    });

    it('verifies search recovery form (.search-box, .search-form) styling for 404 and empty search states', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      const css = extractCssFromTheme(xml);

      // Search inputs and submit buttons styled
      expect(css).toMatch(/\.search-box/);
      expect(css).toMatch(/\.search-form/);
      expect(css).toMatch(/input\[type=['"]?text['"]?\],/);
      expect(css).toMatch(/min-height:\s*44px/);
    });

    it('verifies all interactive elements have 44px touch targets and visible focus indicators', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      const css = extractCssFromTheme(xml);

      // Touch target rule
      expect(css).toMatch(/a,\s*button,\s*\.label-link,\s*\.newer-link,\s*\.older-link\s*\{[^}]*min-height:\s*44px/);

      // Focus-visible outline
      expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px\s+solid/);
      expect(css).toMatch(/:focus-visible\s*\{[^}]*outline-offset:\s*2px/);

      // Skip link accessible focus
      expect(css).toMatch(/\.skip-link\s*\{[^}]*top:\s*-48px/);
      expect(css).toMatch(/\.skip-link:focus\s*\{[^}]*top:\s*8px/);
    });
  });
});
