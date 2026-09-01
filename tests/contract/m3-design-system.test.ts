import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTheme } from '../../tools/generate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha = '0123456789abcdef0123456789abcdef01234567';

interface OklchColor {
  l: number; // 0 to 1
  c: number; // >= 0
  h: number; // 0 to 360 in degrees
}

/**
 * Parses an OKLCH CSS color string like "oklch(98.4% 0.004 85)" or "oklch(23% 0.012 85)"
 */
function parseOklch(str: string): OklchColor {
  const match = str.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)/i);
  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Invalid OKLCH color string: "${str}"`);
  }
  let l = parseFloat(match[1]);
  if (str.includes(`${match[1]}%`)) {
    l = l / 100;
  } else if (l > 1) {
    l = l / 100;
  }
  const c = parseFloat(match[2]);
  const h = parseFloat(match[3]);
  return { l, c, h };
}

/**
 * Converts OKLCH to linear sRGB and calculates WCAG relative luminance (ITU-R BT.709)
 */
function oklchToRelativeLuminance(color: OklchColor): number {
  const { l: L, c: C, h: H } = color;
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // Oklab to LMS
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS to linear sRGB
  const rLinear = +4.0767439362 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  // Relative luminance Y in sRGB
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculates WCAG 2.2 contrast ratio between two OKLCH colors
 */
function calculateContrast(fg: OklchColor, bg: OklchColor): number {
  const lum1 = oklchToRelativeLuminance(fg);
  const lum2 = oklchToRelativeLuminance(bg);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractToken(scss: string, tokenName: string): string {
  const match = scss.match(new RegExp(`\\$${tokenName}:\\s*(oklch\\([^)]+\\));`));
  if (!match || !match[1]) {
    throw new Error(`Token $${tokenName} not found in tokens.scss`);
  }
  return match[1];
}

describe('Milestone M3.2: Modular SCSS Architecture & OKLCH Design System', () => {
  describe('Modular SCSS Partition & File Structure', () => {
    it('has all 7 SCSS files defined in docs/PROJECT-PLAN.md §3.3', async () => {
      const files = [
        'src/styles/tokens.scss',
        'src/styles/base.scss',
        'src/styles/layout.scss',
        'src/styles/index.scss',
        'src/styles/article.scss',
        'src/styles/states.scss',
        'src/styles/main.scss'
      ];

      for (const file of files) {
        const content = await readFile(path.join(ROOT, file), 'utf8');
        expect(content.length).toBeGreaterThan(0);
      }
    });

    it('main.scss imports partials using Sass @use syntax', async () => {
      const mainScss = await readFile(path.join(ROOT, 'src/styles/main.scss'), 'utf8');
      expect(mainScss).toMatch(/@use\s+['"]tokens['"]/);
      expect(mainScss).toMatch(/@use\s+['"]base['"]/);
      expect(mainScss).toMatch(/@use\s+['"]layout['"]/);
      expect(mainScss).toMatch(/@use\s+['"]index['"]/);
      expect(mainScss).toMatch(/@use\s+['"]article['"]/);
      expect(mainScss).toMatch(/@use\s+['"]states['"]/);
    });
  });

  describe('OKLCH Design Tokens & Automated WCAG 2.2 Contrast Validation', () => {
    it('declares the 7 canonical OKLCH tokens in tokens.scss', async () => {
      const tokensScss = await readFile(path.join(ROOT, 'src/styles/tokens.scss'), 'utf8');
      expect(tokensScss).toMatch(/\$page:\s*oklch\(/);
      expect(tokensScss).toMatch(/\$surface:\s*oklch\(/);
      expect(tokensScss).toMatch(/\$ink:\s*oklch\(/);
      expect(tokensScss).toMatch(/\$ink-muted:\s*oklch\(/);
      expect(tokensScss).toMatch(/\$rule:\s*oklch\(/);
      expect(tokensScss).toMatch(/\$accent:\s*oklch\(/);
      expect(tokensScss).toMatch(/\$accent-wash:\s*oklch\(/);
    });

    it('satisfies WCAG 2.2 AAA body ink on page contrast (>= 7:1)', async () => {
      const tokensScss = await readFile(path.join(ROOT, 'src/styles/tokens.scss'), 'utf8');
      const pageColor = parseOklch(extractToken(tokensScss, 'page'));
      const inkColor = parseOklch(extractToken(tokensScss, 'ink'));

      const contrast = calculateContrast(inkColor, pageColor);
      expect(contrast).toBeGreaterThanOrEqual(7.0);
    });

    it('satisfies WCAG 2.2 AA accent link on page contrast (>= 4.5:1)', async () => {
      const tokensScss = await readFile(path.join(ROOT, 'src/styles/tokens.scss'), 'utf8');
      const pageColor = parseOklch(extractToken(tokensScss, 'page'));
      const accentColor = parseOklch(extractToken(tokensScss, 'accent'));

      const contrast = calculateContrast(accentColor, pageColor);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });

    it('satisfies WCAG 2.2 AA ink-muted on page contrast (>= 4.5:1)', async () => {
      const tokensScss = await readFile(path.join(ROOT, 'src/styles/tokens.scss'), 'utf8');
      const pageColor = parseOklch(extractToken(tokensScss, 'page'));
      const inkMutedColor = parseOklch(extractToken(tokensScss, 'ink-muted'));

      const contrast = calculateContrast(inkMutedColor, pageColor);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });

    it('satisfies WCAG 2.2 AA focus ring contrast (>= 3:1)', async () => {
      const tokensScss = await readFile(path.join(ROOT, 'src/styles/tokens.scss'), 'utf8');
      const pageColor = parseOklch(extractToken(tokensScss, 'page'));
      const accentColor = parseOklch(extractToken(tokensScss, 'accent'));

      const contrast = calculateContrast(accentColor, pageColor);
      expect(contrast).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe('Typography Scale & 68ch Reading Measure', () => {
    it('defines the 1.333 typography scale hierarchy in tokens and styles', async () => {
      const tokensScss = await readFile(path.join(ROOT, 'src/styles/tokens.scss'), 'utf8');
      expect(tokensScss).toContain('$font-size-h1: clamp(2.0rem, 1.4rem + 2.6vw, 3.15rem)');
      expect(tokensScss).toContain('$font-size-h2: 1.777rem');
      expect(tokensScss).toContain('$font-size-h3: 1.333rem');
      expect(tokensScss).toContain('$font-size-body: 1.0625rem');
      expect(tokensScss).toContain('$font-size-row: 1.15rem');
      expect(tokensScss).toContain('$font-size-meta: 0.8125rem');

      // Verify scale hierarchy: h2 > h3 > body > meta
      const h2 = 1.777;
      const h3 = 1.333;
      const body = 1.0625;
      const meta = 0.8125;

      expect(h2 / h3).toBeCloseTo(1.333, 2);
      expect(h3 / 1.0).toBeCloseTo(1.333, 2);
      expect(body).toBeGreaterThan(meta);
    });

    it('enforces 68ch reading measure on .post-body and .post-excerpt in compiled CSS', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      expect(xml).toMatch(/\.post-body\s*\{[^}]*max-width:\s*68ch/);
      expect(xml).toMatch(/post-excerpt[^{]*\{[^}]*max-width:\s*68ch/);
    });
  });

  describe('12-Column Responsive Layout & View Breakpoints', () => {
    it('declares 12-column grid at desktop breakpoint (>=1024px)', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      expect(xml).toMatch(/@media\s*\(min-width:\s*1024px\)\s*\{[^}]*\.main-content\s*\{[^}]*grid-template-columns:\s*repeat\(12,\s*1fr\)/);
    });

    it('allocates columns 1-9 for main content stream and columns 10-12 for sidebar on desktop', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      // Lead post on home p1: columns 1-8 (1 / 9)
      expect(xml).toMatch(/body\.is-home-lead\s+\.post:first-of-type\s*\{[^}]*grid-column:\s*1\s*\/\s*9/);
      // Main stream columns 1-9 and sidebar columns 10-12
      expect(xml).toContain('.main.section,#page_body,.widget.Blog{grid-column:1/10}');
      expect(xml).toContain('.desktop-sidebar{grid-column:10/13');
    });

    it('provides distinct layout rules for mobile (<640px) and tablet (640-1023px)', async () => {
      const layoutScss = await readFile(path.join(ROOT, 'src/styles/layout.scss'), 'utf8');
      expect(layoutScss).toMatch(/@media\s*\(max-width:\s*639px\)/);
      expect(layoutScss).toMatch(/@media\s*\(min-width:\s*640px\)\s*and\s*\(max-width:\s*1023px\)/);
      expect(layoutScss).toContain('20px'); // 20px mobile padding
      expect(layoutScss).toContain('$space-7'); // 48px tablet padding
    });
  });

  describe('Zero External CSS Dependencies', () => {
    it('has zero external stylesheet links, zero @import rules, and zero external url() references', async () => {
      const { xml } = await generateTheme({ sha, write: false });

      // 0 external <link rel="stylesheet">
      expect(xml).not.toMatch(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*>/i);

      // Extract b:skin content
      const skinMatch = xml.match(/<b:skin[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/b:skin>/);
      expect(skinMatch).not.toBeNull();
      const css = skinMatch![1];

      // 0 @import
      expect(css).not.toMatch(/@import\b/i);

      // 0 url() calls
      expect(css).not.toMatch(/\burl\s*\(/i);

      // b:css="false" on html
      expect(xml).toMatch(/<html\b[^>]*\bb:css=['"]false['"]/);
    });
  });

  describe('Accessibility & Motion Rules', () => {
    it('enforces touch targets >= 44px for interactive elements', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      expect(xml).toMatch(/(?:a|button|\.label-link|\.newer-link|\.older-link)[^{]*\{[^}]*min-height:\s*44px/);
    });

    it('enforces 2px solid focus ring with 2px offset on :focus-visible', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      expect(xml).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+oklch\((?:54\.615%|\.54615|0\.54615)\s+(?:0?\.2152)\s+262\.881\);[^}]*outline-offset:\s*2px/);
    });

    it('enforces prefers-reduced-motion rule disabling transitions/animations', async () => {
      const { xml } = await generateTheme({ sha, write: false });
      expect(xml).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[^}]*transition-duration:\s*0?\.001ms/);
    });
  });
});
