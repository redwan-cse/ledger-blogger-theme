import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';

const SHA = '0123456789abcdef0123456789abcdef01234567';

describe('Blogger header wrapper layout regression', () => {
  it('flattens only the Header section/widget wrappers so brand, nav, and actions share one flex row', async () => {
    const { xml } = await generateTheme({ sha: SHA, write: false });
    expect(xml).toContain('.header-bar>.header.section,.header-bar>.header.section>.widget.Header{display:contents}');
    expect(xml).toContain('.header-brand{order:1');
    expect(xml).toContain('.nav-container{order:2');
    expect(xml).toContain('.header-actions{order:3');
  });

  it('does not flatten generic Blogger sections or widgets', async () => {
    const { xml } = await generateTheme({ sha: SHA, write: false });
    expect(xml).not.toContain('.section,.widget{display:contents}');
    expect(xml).toContain('.section,.widget{width:100%}');
  });
});
