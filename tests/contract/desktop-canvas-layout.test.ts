import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';

const SHA = '0123456789abcdef0123456789abcdef01234567';

describe('M3b desktop canvas composition (#15)', () => {
  it('uses a 1280px shell with a 9/3 stream-sidebar split', async () => {
    const { xml } = await generateTheme({ sha: SHA, write: false });
    expect(xml).toContain('max-width:1280px');
    expect(xml).toContain('.main.section,#page_body,.widget.Blog{grid-column:1/10}');
    expect(xml).toContain('.desktop-sidebar{grid-column:10/13');
  });

  it('keeps the article reading measure capped at 68ch', async () => {
    const { xml } = await generateTheme({ sha: SHA, write: false });
    expect(xml).toContain('.post-body{font-family:');
    expect(xml).toContain('max-width:68ch');
    expect(xml).toContain('.is-post .post,.is-page .post{');
  });
});
