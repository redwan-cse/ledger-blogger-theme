import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';

describe('M1 generation pipeline', () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';

  it('deterministically compiles Pug, SCSS, and TypeScript into a stamped V3 theme', async () => {
    const first = await generateTheme({ sha, write: false });
    const second = await generateTheme({ sha, write: false });

    expect(second).toEqual(first);
    expect(first.build).toBe(`0.0.0+${sha}`);
    expect(first.xml).toContain("b:layoutsVersion=\"3\"");
    expect(first.xml).toContain("version=\"2\"");
    expect(first.xml).toContain(`content=\"${first.build}\" name=\"theme-build\"`);
    expect(first.xml).toContain('<![CDATA[');
    expect(first.xml).toContain('document.documentElement.classList.add("js")');
    expect(first.bytes).toBeLessThanOrEqual(500_000);
  });

  it('rejects abbreviated or fabricated deployment identities', async () => {
    await expect(generateTheme({ sha: 'abc123', write: false })).rejects.toThrow('40-character');
  });
});
