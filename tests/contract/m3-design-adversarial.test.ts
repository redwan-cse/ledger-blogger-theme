import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTheme } from '../../tools/generate.js';
import { checkThemeContract } from '../../tools/contract-check.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHA = '0123456789abcdef0123456789abcdef01234567';

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

/**
 * Validates CSS against banned content hiding / zero-dependency rules
 */
function auditCssRules(css: string): {
  hasExternalLink: boolean;
  hasImport: boolean;
  hasUrl: boolean;
  hasHiddenPostBody: boolean;
  hasReadingMeasure: boolean;
  hasAccessibleTouchTargets: boolean;
  hasFocusRing: boolean;
  hasReducedMotion: boolean;
} {
  return {
    hasExternalLink: /<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*>/i.test(css),
    hasImport: /@import\b/i.test(css),
    hasUrl: /\burl\s*\(/i.test(css),
    hasHiddenPostBody: /(?:\.post-body|\.post)\s*\{[^}]*display:\s*none/i.test(css),
    hasReadingMeasure: /\.post-body\s*\{[^}]*max-width:\s*68ch/.test(css) && /post-excerpt[^{]*\{[^}]*max-width:\s*68ch/.test(css),
    hasAccessibleTouchTargets: /(?:a|button|\.label-link|\.newer-link|\.older-link)[^{]*\{[^}]*min-height:\s*44px/.test(css),
    hasFocusRing: /:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+oklch\((?:46%|\.46|0\.46)\s+0?\.148\s+25\);[^}]*outline-offset:\s*2px/.test(css),
    hasReducedMotion: /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[^}]*transition-duration:\s*0?\.001ms/.test(css)
  };
}

describe('M3.2 Adversarial Stress Testing: OKLCH Math & Contract Violations', () => {
  describe('Target 1: OKLCH Contrast Mathematics Stress Testing', () => {
    describe('Boundary & Extreme Value Invariants', () => {
      it('yields exactly 0 luminance for pure black OKLCH(0, 0, 0)', () => {
        const black = parseOklch('oklch(0% 0 0)');
        const lum = oklchToRelativeLuminance(black);
        expect(lum).toBeCloseTo(0, 5);
      });

      it('yields exactly 1.0 luminance for pure white OKLCH(1, 0, 0)', () => {
        const white = parseOklch('oklch(100% 0 0)');
        const lum = oklchToRelativeLuminance(white);
        expect(lum).toBeCloseTo(1.0, 4);
      });

      it('calculates theoretical maximum contrast of 21.0:1 for pure black on pure white', () => {
        const black = parseOklch('oklch(0% 0 0)');
        const white = parseOklch('oklch(100% 0 0)');
        const contrast = calculateContrast(black, white);
        expect(contrast).toBeCloseTo(21.0, 2);
      });

      it('enforces reflexivity: calculateContrast(C, C) === 1.0 for any color C', () => {
        const testColors = [
          'oklch(0% 0 0)',
          'oklch(100% 0 0)',
          'oklch(50% 0.1 180)',
          'oklch(98.4% 0.004 85)',
          'oklch(23% 0.012 85)',
          'oklch(46% 0.148 25)',
          'oklch(10% 0.3 330)',
          'oklch(90% 0.2 45)'
        ];

        for (const str of testColors) {
          const color = parseOklch(str);
          const contrast = calculateContrast(color, color);
          expect(contrast).toBeCloseTo(1.0, 5);
        }
      });

      it('enforces symmetry: calculateContrast(A, B) === calculateContrast(B, A) for all pairs', () => {
        const pairs: [string, string][] = [
          ['oklch(98.4% 0.004 85)', 'oklch(23% 0.012 85)'],
          ['oklch(98.4% 0.004 85)', 'oklch(46% 0.148 25)'],
          ['oklch(100% 0 0)', 'oklch(0% 0 0)'],
          ['oklch(70% 0.15 120)', 'oklch(30% 0.1 270)'],
          ['oklch(15% 0.25 45)', 'oklch(95% 0.05 200)']
        ];

        for (const [aStr, bStr] of pairs) {
          const a = parseOklch(aStr);
          const b = parseOklch(bStr);
          expect(calculateContrast(a, b)).toBeCloseTo(calculateContrast(b, a), 6);
        }
      });

      it('guarantees strictly monotonic luminance along the achromatic axis (C=0, L=0..1)', () => {
        const lightnessSteps = [0.0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95, 1.0];
        let previousLuminance = -1;

        for (const L of lightnessSteps) {
          const color: OklchColor = { l: L, c: 0, h: 0 };
          const lum = oklchToRelativeLuminance(color);
          expect(lum).toBeGreaterThanOrEqual(previousLuminance);
          // On achromatic axis, Y = L^3
          expect(lum).toBeCloseTo(Math.pow(L, 3), 4);
          previousLuminance = lum;
        }
      });

      it('handles near-zero and near-one edge cases gracefully without NaN or Infinity', () => {
        const epsilon = 1e-6;
        const nearZero = parseOklch(`oklch(${epsilon} 0 0)`);
        const nearOne = parseOklch(`oklch(${1 - epsilon} 0 0)`);

        const lumZero = oklchToRelativeLuminance(nearZero);
        const lumOne = oklchToRelativeLuminance(nearOne);

        expect(Number.isFinite(lumZero)).toBe(true);
        expect(Number.isFinite(lumOne)).toBe(true);
        expect(lumZero).toBeGreaterThanOrEqual(0);
        expect(lumOne).toBeLessThanOrEqual(1.0);

        const contrast = calculateContrast(nearZero, nearOne);
        expect(Number.isFinite(contrast)).toBe(true);
        expect(contrast).toBeLessThanOrEqual(21.0);
        expect(contrast).toBeGreaterThan(20.9);
      });
    });

    describe('Synthetic Chroma & Hue Sweeps', () => {
      it('computes finite, non-NaN luminance across 360-degree hue sweep at various chromas', () => {
        const testChromaList = [0.01, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4];
        const testLightnessList = [0.2, 0.5, 0.8];

        for (const c of testChromaList) {
          for (const l of testLightnessList) {
            for (let h = 0; h <= 360; h += 30) {
              const color: OklchColor = { l, c, h };
              const lum = oklchToRelativeLuminance(color);
              expect(Number.isFinite(lum)).toBe(true);
              expect(isNaN(lum)).toBe(false);

              // Contrast against page must always be >= 1.0 and finite
              const page: OklchColor = { l: 0.984, c: 0.004, h: 85 };
              const contrast = calculateContrast(color, page);
              expect(Number.isFinite(contrast)).toBe(true);
              expect(contrast).toBeGreaterThanOrEqual(1.0);
            }
          }
        }
      });

      it('handles extreme out-of-gamut chroma values (C = 0.5 .. 1.0) without throwing or crashing', () => {
        const extremeColors = [
          { l: 0.5, c: 0.5, h: 0 },
          { l: 0.5, c: 0.8, h: 120 },
          { l: 0.5, c: 1.0, h: 240 }
        ];

        for (const color of extremeColors) {
          const lum = oklchToRelativeLuminance(color);
          expect(Number.isFinite(lum)).toBe(true);
        }
      });

      it('handles hue angle wrapping and negative angles correctly', () => {
        const h0 = oklchToRelativeLuminance({ l: 0.5, c: 0.1, h: 0 });
        const h360 = oklchToRelativeLuminance({ l: 0.5, c: 0.1, h: 360 });
        const h720 = oklchToRelativeLuminance({ l: 0.5, c: 0.1, h: 720 });
        const hNeg360 = oklchToRelativeLuminance({ l: 0.5, c: 0.1, h: -360 });

        expect(h0).toBeCloseTo(h360, 6);
        expect(h0).toBeCloseTo(h720, 6);
        expect(h0).toBeCloseTo(hNeg360, 6);

        const h90 = oklchToRelativeLuminance({ l: 0.5, c: 0.1, h: 90 });
        const hNeg270 = oklchToRelativeLuminance({ l: 0.5, c: 0.1, h: -270 });
        expect(h90).toBeCloseTo(hNeg270, 6);
      });
    });

    describe('Parser Robustness & Formats', () => {
      it('correctly parses percentage, decimal, and unit variations', () => {
        const parsedPct = parseOklch('oklch(98.4% 0.004 85)');
        const parsedDec = parseOklch('oklch(0.984 0.004 85)');
        const parsedDeg = parseOklch('oklch(98.4% 0.004 85deg)');
        const parsedSpaces = parseOklch('oklch(  98.4%   0.004   85  )');

        expect(parsedPct.l).toBeCloseTo(0.984, 4);
        expect(parsedDec.l).toBeCloseTo(0.984, 4);
        expect(parsedDeg.h).toBe(85);
        expect(parsedSpaces.c).toBe(0.004);
      });

      it('throws descriptive error on invalid OKLCH strings', () => {
        expect(() => parseOklch('rgb(255, 255, 255)')).toThrowError(/Invalid OKLCH/);
        expect(() => parseOklch('oklch(50%)')).toThrowError(/Invalid OKLCH/);
        expect(() => parseOklch('#ffffff')).toThrowError(/Invalid OKLCH/);
        expect(() => parseOklch('')).toThrowError(/Invalid OKLCH/);
      });
    });

    describe('Standard Color Ground-Truth Oracles', () => {
      it('matches sRGB reference primaries relative luminance', () => {
        // Red sRGB (1,0,0) in OKLCH: L=0.627955, C=0.257683, H=29.23 deg -> sRGB Y = 0.2126
        const redLum = oklchToRelativeLuminance({ l: 0.627955, c: 0.257683, h: 29.233885 });
        expect(redLum).toBeCloseTo(0.2126, 3);

        // Green sRGB (0,1,0) in OKLCH: L=0.86644, C=0.29483, H=142.5 deg -> sRGB Y = 0.7152
        const greenLum = oklchToRelativeLuminance({ l: 0.86644, c: 0.29483, h: 142.495339 });
        expect(greenLum).toBeCloseTo(0.7152, 3);

        // Blue sRGB (0,0,1) in OKLCH: L=0.452014, C=0.313214, H=264.05 deg -> sRGB Y = 0.0722
        const blueLum = oklchToRelativeLuminance({ l: 0.452014, c: 0.313214, h: 264.052021 });
        expect(blueLum).toBeCloseTo(0.0722, 3);
      });

      it('validates canonical design tokens matrix against PROJECT-PLAN.md §2.2', async () => {
        const tokensScss = await readFile(path.join(ROOT, 'src/styles/tokens.scss'), 'utf8');
        const page = parseOklch(extractToken(tokensScss, 'page'));
        const surface = parseOklch(extractToken(tokensScss, 'surface'));
        const ink = parseOklch(extractToken(tokensScss, 'ink'));
        const inkMuted = parseOklch(extractToken(tokensScss, 'ink-muted'));
        const rule = parseOklch(extractToken(tokensScss, 'rule'));
        const accent = parseOklch(extractToken(tokensScss, 'accent'));
        const accentWash = parseOklch(extractToken(tokensScss, 'accent-wash'));

        // Body ink on page >= 7.0 (AAA)
        const inkPageContrast = calculateContrast(ink, page);
        expect(inkPageContrast).toBeGreaterThanOrEqual(7.0);
        expect(inkPageContrast).toBeCloseTo(16.13, 1);

        // Body ink on surface >= 7.0 (AAA)
        const inkSurfaceContrast = calculateContrast(ink, surface);
        expect(inkSurfaceContrast).toBeGreaterThanOrEqual(7.0);

        // Accent on page >= 4.5 (AA)
        const accentPageContrast = calculateContrast(accent, page);
        expect(accentPageContrast).toBeGreaterThanOrEqual(4.5);
        expect(accentPageContrast).toBeCloseTo(7.35, 1);

        // Ink-muted on page >= 4.5 (AA)
        const inkMutedPageContrast = calculateContrast(inkMuted, page);
        expect(inkMutedPageContrast).toBeGreaterThanOrEqual(4.5);
        expect(inkMutedPageContrast).toBeCloseTo(6.24, 1);

        // Accent wash on page is subtle background tint
        const accentWashContrast = calculateContrast(accentWash, page);
        expect(accentWashContrast).toBeLessThan(2.0);

        // Rule border on page is subtle divider
        const ruleContrast = calculateContrast(rule, page);
        expect(ruleContrast).toBeLessThan(3.0);
      });
    });
  });

  describe('Target 2: Intentional Contract Violations & Detection Verification', () => {
    describe('Token Contrast Violations', () => {
      it('fails contrast verification when $ink has low contrast (e.g. 1.5:1)', async () => {
        const pageColor = parseOklch('oklch(98.4% 0.004 85)');
        const poorInkColor = parseOklch('oklch(80% 0.012 85)'); // light gray ink

        const contrast = calculateContrast(poorInkColor, pageColor);
        expect(contrast).toBeLessThan(7.0); // Fails WCAG AAA
        expect(contrast).toBeLessThan(4.5); // Fails WCAG AA
      });

      it('fails contrast verification when $accent has low contrast (e.g. 2.0:1)', async () => {
        const pageColor = parseOklch('oklch(98.4% 0.004 85)');
        const poorAccentColor = parseOklch('oklch(85% 0.05 25)'); // pale orange accent

        const contrast = calculateContrast(poorAccentColor, pageColor);
        expect(contrast).toBeLessThan(4.5); // Fails WCAG AA
      });

      it('fails contrast verification when $ink-muted has low contrast (e.g. 1.8:1)', async () => {
        const pageColor = parseOklch('oklch(98.4% 0.004 85)');
        const poorInkMuted = parseOklch('oklch(88% 0.010 85)');

        const contrast = calculateContrast(poorInkMuted, pageColor);
        expect(contrast).toBeLessThan(4.5); // Fails WCAG AA
      });
    });

    describe('External CSS & URL Dependencies Violations', () => {
      it('catches external <link rel="stylesheet"> in theme markup', () => {
        const badMarkup = '<head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"/></head>';
        const audit = auditCssRules(badMarkup);
        expect(audit.hasExternalLink).toBe(true);
      });

      it('catches @import rules in compiled CSS', () => {
        const badCss = '@import "https://cdn.example.com/styles.css"; body { margin: 0; }';
        const audit = auditCssRules(badCss);
        expect(audit.hasImport).toBe(true);
      });

      it('catches url() references in compiled CSS', () => {
        const badCss1 = 'body { background-image: url("https://example.com/bg.png"); }';
        const badCss2 = 'body { background-image: url(\'data:image/svg+xml;utf8,<svg></svg>\'); }';
        const badCss3 = '@font-face { font-family: "Custom"; src: url(/fonts/custom.woff2); }';

        expect(auditCssRules(badCss1).hasUrl).toBe(true);
        expect(auditCssRules(badCss2).hasUrl).toBe(true);
        expect(auditCssRules(badCss3).hasUrl).toBe(true);
      });

      it('catches b:css="true" via contract-check rule', async () => {
        const { xml } = await generateTheme({ sha: SHA, write: false });
        const withCssTrue = xml.replace('b:css="false"', 'b:css="true"');
        const findings = checkThemeContract(withCssTrue);
        expect(findings.map((f) => f.ruleId)).toContain('css-disabled');
      });
    });

    describe('Content Hiding & Banned CSS Rules (Rule 2: Failure Must Be Loud)', () => {
      it('catches display:none on .post-body or .post', () => {
        const hiddenPostBody = '.post-body { display: none; color: black; }';
        const hiddenPost = '.post { display: none; }';
        const visiblePost = '.post-body { max-width: 68ch; display: block; }';

        expect(auditCssRules(hiddenPostBody).hasHiddenPostBody).toBe(true);
        expect(auditCssRules(hiddenPost).hasHiddenPostBody).toBe(true);
        expect(auditCssRules(visiblePost).hasHiddenPostBody).toBe(false);
      });

      it('verifies baseline generated theme has no hidden post body or external dependencies', async () => {
        const { xml } = await generateTheme({ sha: SHA, write: false });
        const skinMatch = xml.match(/<b:skin[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/b:skin>/);
        expect(skinMatch).not.toBeNull();
        const css = skinMatch?.[1] ?? '';

        const audit = auditCssRules(css);
        expect(audit.hasExternalLink).toBe(false);
        expect(audit.hasImport).toBe(false);
        expect(audit.hasUrl).toBe(false);
        expect(audit.hasHiddenPostBody).toBe(false);
        expect(audit.hasReadingMeasure).toBe(true);
        expect(audit.hasAccessibleTouchTargets).toBe(true);
        expect(audit.hasFocusRing).toBe(true);
        expect(audit.hasReducedMotion).toBe(true);
      });
    });

    describe('Design System Constraint Violations', () => {
      it('catches missing 68ch reading measure', () => {
        const badCss = '.post-body { max-width: 100ch; } .post-excerpt { max-width: 100ch; }';
        expect(auditCssRules(badCss).hasReadingMeasure).toBe(false);
      });

      it('catches undersized touch targets (< 44px)', () => {
        const badCss = 'a { min-height: 24px; }';
        expect(auditCssRules(badCss).hasAccessibleTouchTargets).toBe(false);
      });

      it('catches missing or invalid focus ring style', () => {
        const badCss1 = ':focus-visible { outline: none; }';
        const badCss2 = ':focus-visible { outline: 1px dotted red; }';
        expect(auditCssRules(badCss1).hasFocusRing).toBe(false);
        expect(auditCssRules(badCss2).hasFocusRing).toBe(false);
      });

      it('catches missing prefers-reduced-motion rule', () => {
        const badCss = '* { transition: all 200ms ease; }';
        expect(auditCssRules(badCss).hasReducedMotion).toBe(false);
      });
    });
  });
});
