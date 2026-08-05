import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';

const sha = '0123456789abcdef0123456789abcdef01234567';
function blogWidget(xml: string): string {
  const match = xml.match(/<b:widget id="Blog1"[\s\S]*?<\/b:widget>/);
  if (!match) throw new Error('Blog1 widget was not generated.');
  return match[0];
}

describe('M2 render bisect: Contempo-aligned shell with native Blog dispatch', () => {
  it('carries the Blogger locale and direction expressions on html', async () => {
    const xml = (await generateTheme({ sha, write: false })).xml;
    expect(xml).toContain('expr:dir="data:blog.languageDirection"');
    expect(xml).toContain('expr:lang="data:blog.locale.language"');
  });

  it('includes all-head-content exactly once inside head', async () => {
    const xml = (await generateTheme({ sha, write: false })).xml;
    expect(xml.match(/<b:include data="blog" name="all-head-content"\/>/g) ?? []).toHaveLength(1);
    expect(xml).toMatch(/<head>[\s\S]*<b:include data="blog" name="all-head-content"\/>[\s\S]*<\/head>/);
  });

  it('wraps the Posts section in a main element using Contempo section conventions', async () => {
    const xml = (await generateTheme({ sha, write: false })).xml;
    expect(xml).toMatch(/<main class="main-content" id="content" role="main">[\s\S]*<b:section class="main" id="pageBody"/);
  });

  it('keeps every section id letter-first alphanumeric', async () => {
    const xml = (await generateTheme({ sha, write: false })).xml;
    const ids = [...xml.matchAll(/<b:section [^>]*id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
  });

  it('overrides only main and delegates to the native renderer', async () => {
    const widget = blogWidget((await generateTheme({ sha, write: false })).xml);
    expect(widget.match(/<b:includable /g) ?? []).toHaveLength(1);
    expect(widget).toMatch(/<b:includable id="main">\s*<b:include name="super\.main"\/>\s*<\/b:includable>/);
  });

  it('keeps both widgets locked and explicitly version 2', async () => {
    const xml = (await generateTheme({ sha, write: false })).xml;
    const widgets = xml.match(/<b:widget [^>]*>/g) ?? [];
    expect(widgets).toHaveLength(2);
    for (const widget of widgets) {
      expect(widget).toContain('locked="true"');
      expect(widget).toContain('version="2"');
    }
  });
});
