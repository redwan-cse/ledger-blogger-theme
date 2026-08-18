import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';

const SHA = '0123456789abcdef0123456789abcdef01234567';

describe('M3b article and comments polish (#16)', () => {
  it('tightens article-to-comments rhythm without changing the reading measure', async () => {
    const { xml } = await generateTheme({ sha: SHA, write: false });
    expect(xml).toContain('.is-post .post,.is-page .post{border-bottom:none;padding-top:32px}');
    expect(xml).toContain('#comments,.comments-section{border-top:1px solid');
    expect(xml).toContain('margin-top:32px;padding-top:24px');
    expect(xml).toContain('max-width:68ch');
  });

  it('raises dark-mode comment and metadata contrast and wraps mobile actions', async () => {
    const { xml } = await generateTheme({ sha: SHA, write: false });
    expect(xml).toContain('html[data-theme=dark] .comments-title');
    expect(xml).toContain('html[data-theme=dark] .comment-footer');
    expect(xml).toContain('@media(max-width: 639px){.post-share-bar{align-items:stretch');
    expect(xml).toContain('.post-author-bio,.author-bio-card{flex-direction:column');
  });
});
