import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';

const sha = '0123456789abcdef0123456789abcdef01234567';
function blogWidget(xml: string): string {
  const match = xml.match(/<b:widget id="Blog1"[\s\S]*?<\/b:widget>/);
  if (!match) throw new Error('Blog1 widget was not generated.');
  return match[0];
}

describe('M2 render bisect: pure native Blog dispatch', () => {
  it('declares a locked version-2 Blog widget in the Posts section', async () => {
    const xml = (await generateTheme({ sha, write: false })).xml;
    expect(xml).toContain('<b:section id="main"');
    expect(xml).toMatch(/<b:widget id="Blog1"[^>]*locked="true"[^>]*type="Blog"[^>]*version="2"/);
  });

  it('overrides only main and delegates to the native renderer', async () => {
    const widget = blogWidget((await generateTheme({ sha, write: false })).xml);
    expect(widget.match(/<b:includable /g) ?? []).toHaveLength(1);
    expect(widget).toMatch(/<b:includable id="main">\s*<b:include name="super\.main"\/>\s*<\/b:includable>/);
  });

  it('keeps the Header widget render path intact', async () => {
    const xml = (await generateTheme({ sha, write: false })).xml;
    expect(xml).toContain('type="Header"');
    expect(xml).toContain('class="site-title"');
  });
});
