// ---------------------------------------------------------------------------
// OKLCH -> linear sRGB -> WCAG contrast ratio.
//
// Exists so R-A11Y-1 AC3 ("Body text >= 7:1; other text >= 4.5:1") is
// asserted by computing the actual contrast from the actual token values in
// src/styles/tokens.scss, rather than the PROJECT-PLAN's hand-estimated
// "approx 14:1" / "approx 6.4:1" being taken on faith.
//
// The OKLab <-> linear sRGB matrices are Björn Ottosson's published
// constants (https://bottosson.github.io/posts/oklab/), the same reference
// every modern OKLCH implementation (browsers, Sass, color.js) is built on.
// ---------------------------------------------------------------------------

export type Oklch = readonly [lightness: number, chroma: number, hueDegrees: number];
export type LinearRgb = readonly [r: number, g: number, b: number];

export function oklchToLinearSrgb([L, C, hDegrees]: Oklch): LinearRgb {
  const hRadians = (hDegrees * Math.PI) / 180;
  const a = C * Math.cos(hRadians);
  const b = C * Math.sin(hRadians);

  const lPrime = L + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = L - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return [r, g, bl];
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * WCAG relative luminance, per https://www.w3.org/TR/WCAG21/#dfn-relative-luminance.
 * Destructures directly from the fixed-length LinearRgb tuple rather than
 * going through Array.map first: mapping a tuple returns a plain number[],
 * which loses the known length and makes every destructured element
 * `number | undefined` under noUncheckedIndexedAccess.
 */
export function relativeLuminance([r, g, b]: LinearRgb): number {
  return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);
}

/** WCAG contrast ratio between two OKLCH colours, always >= 1. */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const lumA = relativeLuminance(oklchToLinearSrgb(a));
  const lumB = relativeLuminance(oklchToLinearSrgb(b));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}
