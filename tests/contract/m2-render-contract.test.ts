import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';

const sha = '0123456789abcdef0123456789abcdef01234567';
function blogWidget(xml: string): string {
  const match = xml.match(/<b:widget id="Blog1"[\s\S]*?<\/b:widget>/);
  if (!match) throw new Error('Blog1 widget was not generated.');
  return match[0];
}

describe('M2 render path: Contempo-aligned shell and widget bindings', () => {
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
    expect(xml).toMatch(/<main class="main-content" id="content" role="main">[\s\S]*<b:section class="main" id="page_body"/);
  });

  it('uses the exact section ids Blogger already has bound in its layout database', async () => {
    const xml = (await generateTheme({ sha, write: false })).xml;
    const ids = [...xml.matchAll(/<b:section [^>]*id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toContain('header');
    expect(ids).toContain('page_body');
  });

  it('uses the exact widget ids Blogger already has bound in its layout database', async () => {
    const xml = (await generateTheme({ sha, write: false })).xml;
    const ids = [...xml.matchAll(/<b:widget [^>]*id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toContain('Header1');
    expect(ids).toContain('Blog1');
  });

  it('dispatches main via explicit V3 data:posts loop while providing child overrides', async () => {
    const widget = blogWidget((await generateTheme({ sha, write: false })).xml);
    expect(widget.match(/<b:includable /g)?.length ?? 0).toBeGreaterThan(1);
    expect(widget).toMatch(/<b:includable id="main">[\s\S]*<b:loop values="data:posts" var="post">/);
  });

  it('keeps both essential widgets locked and all widgets explicitly version 2', async () => {
    const xml = (await generateTheme({ sha, write: false })).xml;
    const headerWidget = xml.match(/<b:widget\b[^>]*\bid="Header1"[^>]*>/);
    const blogWidgetMatch = xml.match(/<b:widget\b[^>]*\bid="Blog1"[^>]*>/);
    expect(headerWidget).not.toBeNull();
    expect(headerWidget![0]).toContain('locked="true"');
    expect(headerWidget![0]).toContain('version="2"');
    expect(blogWidgetMatch).not.toBeNull();
    expect(blogWidgetMatch![0]).toContain('locked="true"');
    expect(blogWidgetMatch![0]).toContain('version="2"');

    const widgets = xml.match(/<b:widget [^>]*>/g) ?? [];
    expect(widgets.length).toBeGreaterThanOrEqual(2);
    for (const widget of widgets) {
      expect(widget).toContain('version="2"');
    }
  });
});
