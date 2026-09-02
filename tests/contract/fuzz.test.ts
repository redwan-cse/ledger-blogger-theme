import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkThemeContract } from '../../tools/contract-check.js';

describe('Property-based Fuzz Testing (FuzzingID)', () => {
  it('fuzzes contract check against arbitrary random unicode strings without crashing', () => {
    fc.assert(
      fc.property(fc.string(), (arbitraryInput) => {
        const findings = checkThemeContract(arbitraryInput);
        expect(Array.isArray(findings)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('fuzzes contract check against arbitrary XML-like structures without unhandled exceptions', () => {
    const xmlGenerator = fc.record({
      tag: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,10}$/),
      content: fc.string(),
      attr: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,10}$/),
      val: fc.string(),
    }).map(({ tag, content, attr, val }) => `<${tag} ${attr}="${val}">${content}</${tag}>`);

    fc.assert(
      fc.property(xmlGenerator, (xmlChunk) => {
        const findings = checkThemeContract(xmlChunk);
        expect(Array.isArray(findings)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
