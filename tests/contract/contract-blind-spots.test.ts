import { describe, expect, it } from 'vitest';
import { checkThemeContract } from '../../tools/contract-check.js';
import { generateTheme } from '../../tools/generate.js';

const sha = '0123456789abcdef0123456789abcdef01234567';
const rules = (xml: string): string[] => checkThemeContract(xml).map((finding) => finding.ruleId);

describe('contract audit regression cases', () => {
  it('rejects unterminated tags, raw attribute brackets, illegal characters, stray CDATA terminators, and repeated declarations', async () => {
    const { xml } = await generateTheme({ sha, write: false });
    const mutations = [
      xml.slice(0, xml.indexOf('>') + 5),
      xml.replace('id="main"', 'id="<main"'),
      xml.replace('</main>', `${String.fromCodePoint(0)}</main>`),
      xml.replace('</main>', ']]></main>'),
      xml.replace('<!DOCTYPE html>', '<?xml version="1.0"?><!DOCTYPE html>')
    ];
    for (const mutation of mutations) expect(rules(mutation)).toContain('well-formed');
  });

  it('finds V2 accessors in data tags and expressions outside cond', async () => {
    const { xml } = await generateTheme({ sha, write: false });
    expect(rules(xml.replace('</main>', '<data:blog.pageType/></main>'))).toContain('no-v2-accessors');
    expect(rules(xml.replace('</main>', '<b:include data="data:blog.searchQuery" name="x"/></main>'))).toContain('no-v2-accessors');
  });

  it('checks dynamically attributed JSON-LD scripts', async () => {
    const { xml } = await generateTheme({ sha, write: false });
    const mutation = xml.replace('</head>', '<script><b:attr name="type" value="application/ld+json"/>{"title":"<data:post.title/>"}</script></head>');
    expect(rules(mutation)).toContain('json-escaped');
  });

  it('requires the build stamp to be a unique direct child of head', async () => {
    const { xml } = await generateTheme({ sha, write: false });
    const nested = xml.replace('<meta content="0.0.0+', '<div><meta content="0.0.0+').replace('name="theme-build"/>', 'name="theme-build"/></div>');
    expect(rules(nested)).toContain('build-stamp');
  });
});
