import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';
import { checkThemeContract } from '../../tools/contract-check.js';

const SHA = '0123456789abcdef0123456789abcdef01234567';

describe('Milestone M5: SEO & Accessibility Verification Suite', () => {
  it('generates a theme that satisfies all contract rules with 0 findings', async () => {
    const { xml } = await generateTheme({ sha: SHA, write: false });
    const findings = checkThemeContract(xml);
    expect(findings).toEqual([]);
  });

  describe('SEO Metadata in <head> (R-SEO-2)', () => {
    it('declares canonical link bound to data:view.url.canonical (R-SEO-2 AC4)', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(xml).toMatch(/<head>[\s\S]*<link rel="canonical" expr:href="data:view\.url\.canonical"\/>[\s\S]*<\/head>/);
    });

    it('declares full suite of OpenGraph tags with dynamic fallback (R-SEO-2 AC1, AC2, AC3)', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(xml).toMatch(/<meta property="og:site_name" expr:content="data:blog\.title\.escaped"\/>/);
      expect(xml).toMatch(/<meta property="og:type" content="article"\/>/);
      expect(xml).toMatch(/<meta property="og:type" content="website"\/>/);
      expect(xml).toMatch(/<meta property="og:title" expr:content="data:view\.title\.escaped"\/>/);
      expect(xml).toMatch(/<meta property="og:url" expr:content="data:view\.url\.canonical"\/>/);
      expect(xml).toMatch(/property="og:description"/);
      expect(xml).toMatch(/property="og:image"/);
    });

    it('declares Twitter card meta tags (R-SEO-2 AC1)', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(xml).toMatch(/<meta name="twitter:card" content="summary_large_image"\/>/);
      expect(xml).toMatch(/<meta name="twitter:card" content="summary"\/>/);
      expect(xml).toMatch(/<meta name="twitter:title" expr:content="data:view\.title\.escaped"\/>/);
      expect(xml).toMatch(/name="twitter:description"/);
      expect(xml).toMatch(/name="twitter:image"/);
    });
  });

  describe('Schema.org JSON-LD Structured Data (R-SEO-1)', () => {
    it('declares WebSite structured data with SearchAction on homepage and search views', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(xml).toMatch(/<b:if cond="data:view\.isHomepage or data:view\.isSearch">[\s\S]*?"@type": "WebSite"[\s\S]*?"@type": "SearchAction"[\s\S]*?<\/b:if>/);
    });

    it('declares BlogPosting structured data on single post views', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(xml).toMatch(/<b:if cond="data:view\.isPost">[\s\S]*?"@type": "BlogPosting"[\s\S]*?"headline": "<data:view\.title\.jsonEscaped\/>"[\s\S]*?"@type": "Person"[\s\S]*?"@type": "Organization"[\s\S]*?<\/b:if>/);
    });

    it('ensures all JSON-LD interpolations use .jsonEscaped (R-V3-2 AC5)', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const scriptBlocks = [...xml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      expect(scriptBlocks.length).toBeGreaterThanOrEqual(2);

      for (const match of scriptBlocks) {
        const body = match[1] ?? '';
        const dataTags = [...body.matchAll(/<data:([^>]+)\/>/g)];
        for (const dataMatch of dataTags) {
          const expr = dataMatch[1] ?? '';
          expect(expr.endsWith('.jsonEscaped'), `<data:${expr}/> must end with .jsonEscaped`).toBe(true);
        }

        const evalTags = [...body.matchAll(/<b:eval\s+expr=['"]([^'"]+)['"]\/>/g)];
        for (const evalMatch of evalTags) {
          const expr = evalMatch[1] ?? '';
          expect(expr.trim().endsWith('.jsonEscaped'), `<b:eval expr="${expr}"/> must end with .jsonEscaped`).toBe(true);
        }
      }
    });
  });

  describe('Heading Hierarchy & Accessibility Landmarks (R-A11Y-1, R-A11Y-2, R-A11Y-3)', () => {
    it('demotes Header1 site-title to p on single item views and emits h1 on index views (R-A11Y-3 AC1)', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const headerWidget = xml.match(/<b:widget\b[^>]*\bid="Header1"[\s\S]*?<\/b:widget>/);
      expect(headerWidget).not.toBeNull();
      const content = headerWidget![0];
      expect(content).toContain('cond="not data:view.isSingleItem"');
      expect(content).toMatch(/<h1 class="site-title">[\s\S]*?<p class="site-title">/);
    });

    it('emits h1 for post title on single items and h2 on multiple items (R-A11Y-3 AC1)', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const blogWidget = xml.match(/<b:widget\b[^>]*\bid="Blog1"[\s\S]*?<\/b:widget>/);
      expect(blogWidget).not.toBeNull();
      const content = blogWidget![0];
      expect(content).toMatch(/<b:includable id="postTitle" var="post">[\s\S]*?<h1 class="post-title" itemprop="name headline">[\s\S]*?<h2 class="post-title" itemprop="name headline">/);
    });

    it('places skip link before banner targeting main#content (R-A11Y-2 AC2)', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(xml).toMatch(/<body[^>]*>[\s\S]*<a class="skip-link" href="#content">Skip to content<\/a>[\s\S]*<div class="header-outer" role="banner">[\s\S]*<main class="main-content" id="content" role="main">/);
    });

    it('contains no nested nav landmarks (R-A11Y-1)', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(xml).toContain('<div class="nav-container">');
      expect(xml).not.toMatch(/<nav\b[^>]*>(?:(?!<\/nav>)[\s\S])*<nav\b/i);
    });
  });

  describe('Blog1 Widget Dispatch & 21 Defensive Empty Includables', () => {
    it('dispatches views via explicit V3 data:posts loop without super.main', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const blogWidget = xml.match(/<b:widget\b[^>]*\bid="Blog1"[\s\S]*?<\/b:widget>/);
      expect(blogWidget).not.toBeNull();
      const content = blogWidget![0];
      expect(content).not.toContain('super.main');
      expect(content).toContain('cond="data:view.isError"');
      expect(content).toContain('cond="data:view.isMultipleItems"');
      expect(content).toContain('cond="data:view.isSingleItem"');
      expect(content).toContain('<b:loop values="data:posts" var="post">');
    });

    it('declares all 21 defensive empty includables to prevent unwanted Blogger chrome', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const blogWidget = xml.match(/<b:widget\b[^>]*\bid="Blog1"[\s\S]*?<\/b:widget>/);
      expect(blogWidget).not.toBeNull();
      const content = blogWidget![0];

      const expectedIncludables = [
        'inlineAd',
        'postJumpLink',
        'feedLinks',
        'feedLinksBody',
        'nextPageLink',
        'previousPageLink',
        'homePageLink',
        'postCommentsAndAd',
        'postCommentsLink',
        'postFooterAuthorProfile',
        'aboutPostAuthor',
        'commentPicker',
        'addComments',
        'commentAuthorAvatar',
        'commentDeleteIcon',
        'commentsTitle',
        'commentList',
        'commentItem',
        'commentForm',
        'commentFormIframeSrc',
        'threadedCommentJs'
      ];

      for (const id of expectedIncludables) {
        expect(content, `Blog1 must declare defensive empty includable '${id}'`).toMatch(new RegExp(`<b:includable id="${id}"\\s*\\/>`));
      }
    });
  });
});
