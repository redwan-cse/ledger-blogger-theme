import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../tools/color-contrast.js';
import type { Oklch } from '../../tools/color-contrast.js';

// Mirrors src/styles/tokens.scss exactly. If the tokens ever change, this
// file must change with them; a mismatch here means the test is no longer
// verifying what actually ships. docs/PROJECT-PLAN.md §2.2.
const PAGE: Oklch = [0.984, 0.004, 85];
const INK: Oklch = [0.23, 0.012, 85];
const ACCENT: Oklch = [0.46, 0.148, 25];

describe('color-contrast — sanity against known values', () => {
  it('pure black on pure white is 21:1', () => {
    expect(contrastRatio([0, 0, 0], [1, 0, 0])).toBeCloseTo(21, 0);
  });

  it('a colour against itself is 1:1', () => {
    expect(contrastRatio(INK, INK)).toBeCloseTo(1, 5);
  });
});

describe('token contrast — R-A11Y-1 AC3, computed from src/styles/tokens.scss', () => {
  it('ink on page meets AAA body text (>= 7:1)', () => {
    expect(contrastRatio(INK, PAGE)).toBeGreaterThanOrEqual(7);
  });

  it('accent on page meets AA for other text (>= 4.5:1)', () => {
    expect(contrastRatio(ACCENT, PAGE)).toBeGreaterThanOrEqual(4.5);
  });
});
