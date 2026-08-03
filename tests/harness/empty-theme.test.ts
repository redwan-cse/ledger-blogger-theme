import { describe, expect, it } from 'vitest';
import { renderEmptyTheme } from '../../tools/empty-theme.js';

describe('M0 empty theme', () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';

  it('emits an upload-oriented V3 document with explicit V2 widget markup', () => {
    const { build, xml } = renderEmptyTheme(sha);
    const widgetTags = xml.match(/<b:widget\b[^>]*>/g) ?? [];

    expect(build).toBe(`0.0.0+${sha}`);
    expect(xml).toContain("b:layoutsVersion='3'");
    expect(xml).toContain("b:defaultwidgetversion='2'");
    expect(widgetTags).toHaveLength(2);
    for (const widgetTag of widgetTags) {
      expect(widgetTag).toContain("version='2'");
    }
    expect(xml).toContain("<b:includable id='main'");
    expect(xml).not.toMatch(/<b:widget\b[^>]*\/>/);
  });

  it('stamps the deployment while deliberately emitting no Blog content', () => {
    const { build, xml } = renderEmptyTheme(sha);
    expect(xml).toContain(`<meta content='${build}' name='theme-build'/>`);
    expect(xml).toContain('M0 RED control: intentionally render no post content.');
    expect(xml).not.toContain('<data:post.body/>');
    expect(xml).not.toContain('<data:posts');
  });

  it('rejects an abbreviated or fabricated commit stamp', () => {
    expect(() => renderEmptyTheme('abc123')).toThrow('40-character');
  });
});
