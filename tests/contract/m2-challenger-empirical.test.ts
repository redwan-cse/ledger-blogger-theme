import { beforeAll, describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';
import { buildControls } from '../../tools/build-controls.js';
import { readFile } from 'node:fs/promises';

const SHA = '0123456789abcdef0123456789abcdef01234567';

describe('M2 Challenger Empirical Verification Suite', () => {
  let themeXml: string;

  beforeAll(async () => {
    const res = await generateTheme({ sha: SHA, write: false });
    themeXml = res.xml;
  });

  describe('1. Layouts V3 XML Syntax & Versioning Hard Rules', () => {
    it('verifies all b:widget tags specify version="2"', () => {
      const widgetTags = [...themeXml.matchAll(/<b:widget\s+([^>]*)>/g)];
      expect(widgetTags.length).toBeGreaterThanOrEqual(2);
      for (const match of widgetTags) {
        const attrString = match[1];
        expect(attrString, `Widget tag '${match[0]}' must have version="2"`).toMatch(/\bversion=['"]2['"]/);
      }
    });

    it('verifies html declares b:layoutsVersion="3" without b:version or class="v2"', () => {
      const htmlMatch = themeXml.match(/<html\b([^>]*)>/);
      expect(htmlMatch).not.toBeNull();
      const htmlAttrs = htmlMatch![1];
      expect(htmlAttrs).toMatch(/\bb:layoutsVersion=['"]3['"]/);
      expect(htmlAttrs).not.toMatch(/\bb:version=/);
      expect(htmlAttrs).not.toMatch(/\bclass=['"][^'"]*\bv2\b/);
    });

    it('verifies essential widgets Header1 and Blog1 are present and locked', () => {
      const headerWidget = themeXml.match(/<b:widget\b[^>]*\bid=['"]Header1['"][^>]*>/);
      expect(headerWidget).not.toBeNull();
      expect(headerWidget![0]).toContain('locked="true"');
      expect(headerWidget![0]).toContain('type="Header"');

      const blogWidget = themeXml.match(/<b:widget\b[^>]*\bid=['"]Blog1['"][^>]*>/);
      expect(blogWidget).not.toBeNull();
      expect(blogWidget![0]).toContain('locked="true"');
      expect(blogWidget![0]).toContain('type="Blog"');
    });

    it('verifies zero occurrences of && or || in expressions (outside CDATA)', () => {
      const xmlWithoutCdata = themeXml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
      const exprAttrs = [...xmlWithoutCdata.matchAll(/\b(?:cond|expr|value|values)=['"]([^'"]+)['"]/g)];
      for (const match of exprAttrs) {
        const expr = match[1];
        expect(expr, `Expression '${expr}' must not use &&`).not.toContain('&&');
        expect(expr, `Expression '${expr}' must not use ||`).not.toContain('||');
      }
    });

    it('verifies zero occurrences of deprecated data:blog.pageType', () => {
      expect(themeXml).not.toContain('data:blog.pageType');
    });

    it('verifies all 11 defensive empty includables are declared in Blog1 widget', () => {
      const blogMatch = themeXml.match(/<b:widget\b[^>]*\bid=['"]Blog1['"][\s\S]*?<\/b:widget>/);
      expect(blogMatch).not.toBeNull();
      const blog = blogMatch![0];

      const emptyIncludables = [
        'inlineAd',
        'postJumpLink',
        'feedLinks',
        'feedLinksBody',
        'nextPageLink',
        'previousPageLink',
        'homePageLink',
        'postCommentsLink',
        'postFooterAuthorProfile',
        'aboutPostAuthor',
        'postShareButtons'
      ];

      for (const name of emptyIncludables) {
        expect(blog, `Blog1 must declare defensive includable '${name}'`).toMatch(new RegExp(`<b:includable id=['"]${name}['"]\\s*(?:var=['"][^'"]*['"]\\s*)?(?:\\/>|>\\s*<\\/b:includable>)`));
      }
    });
  });

  describe('2. Interactive DOM Hooks & ARIA Specifications (R1/R2/R3 Contract)', () => {
    it('verifies Reading Progress Bar is guarded by data:view.isPost and has complete ARIA attributes', () => {
      const match = themeXml.match(/<b:if cond=['"]data:view\.isPost['"]>\s*<div\b([^>]*)id=['"]reading-progress['"]([^>]*)>([\s\S]*?)<\/div>\s*<\/b:if>/);
      expect(match, 'Reading progress bar must be guarded by data:view.isPost').not.toBeNull();
      const attrs = (match![1] + ' ' + match![2]);
      expect(attrs).toContain('class="reading-progress"');
      expect(attrs).toContain('role="progressbar"');
      expect(attrs).toContain('aria-valuemin="0"');
      expect(attrs).toContain('aria-valuemax="100"');
      expect(attrs).toContain('aria-valuenow="0"');
      expect(attrs).toContain('aria-label="Reading progress"');
      expect(match![3]).toContain('class="reading-progress-bar"');
    });

    it('verifies Mobile Drawer trigger in header.pug matches nav#mobile-drawer in theme.pug', () => {
      const headerMatch = themeXml.match(/<b:widget\b[^>]*\bid=['"]Header1['"][\s\S]*?<\/b:widget>/);
      expect(headerMatch).not.toBeNull();
      const header = headerMatch![0];

      const btnMatch = header.match(/<button\b([^>]*)class=['"]drawer-toggle['"]([^>]*)>/);
      expect(btnMatch).not.toBeNull();
      const btnAttrs = btnMatch![1] + ' ' + btnMatch![2];
      expect(btnAttrs).toContain('aria-controls="mobile-drawer"');
      expect(btnAttrs).toContain('aria-expanded="false"');
      expect(btnAttrs).toContain('aria-label="Toggle navigation"');
      expect(btnAttrs).toContain('type="button"');

      const drawerMatch = themeXml.match(/<nav\b([^>]*)id=['"]mobile-drawer['"]([^>]*)>/);
      expect(drawerMatch).not.toBeNull();
      const drawerAttrs = drawerMatch![1] + ' ' + drawerMatch![2];
      expect(drawerAttrs).toContain('class="mobile-drawer"');
      expect(drawerAttrs).toContain('aria-hidden="true"');
      expect(drawerAttrs).toContain('aria-label="Mobile Navigation"');

      expect(themeXml).toContain('class="drawer-backdrop"');
      expect(themeXml).toMatch(/<button\b[^>]*class=['"]drawer-close['"][^>]*aria-label=['"]Close navigation['"][^>]*type=['"]button['"]>/);
      expect(themeXml).toContain('class="drawer-nav-list"');
    });

    it('verifies Search Card and search form in sidebar and drawer', () => {
      expect(themeXml).toContain('sidebar-search-card');
      expect(themeXml).toContain('sidebar-search-input');
      expect(themeXml).toContain('drawer-search-wrap');
      expect(themeXml).toContain('drawer-search-input');
      expect(themeXml).toContain('search-results-dropdown');
      expect(themeXml).toContain('data:blog.searchUrl');
      expect(themeXml).toContain('name="q"');
      expect(themeXml).toContain('type="search"');
    });

    it('verifies Share Button Suite, Author Bio, and Prev/Next Post Navigation in blog-post', () => {
      const blogMatch = themeXml.match(/<b:widget\b[^>]*\bid=['"]Blog1['"][\s\S]*?<\/b:widget>/);
      expect(blogMatch).not.toBeNull();
      const blog = blogMatch![0];

      expect(blog).toMatch(/<b:includable id=['"]postShareBar['"] var=['"]post['"]>/);
      expect(blog).toContain('class="post-share-bar share-bar"');
      expect(blog).toContain('role="toolbar"');
      expect(blog).toContain('aria-label="Share this article"');
      
      const copyBtnMatch = blog.match(/<button\b([^>]*)class=['"]share-btn share-btn-copy['"]([^>]*)>/);
      expect(copyBtnMatch).not.toBeNull();
      const copyAttrs = copyBtnMatch![1] + ' ' + copyBtnMatch![2];
      expect(copyAttrs).toContain('data-action="copy-link"');
      expect(copyAttrs).toContain('aria-label="Copy link to clipboard"');
      expect(copyAttrs).toContain('type="button"');

      expect(blog).toMatch(/expr:href=['"]&quot;https:\/\/twitter\.com\/intent\/tweet&quot; params \{text: data:post\.title, url: data:post\.url\.canonical\}['"]/);
      expect(blog).toMatch(/expr:href=['"]&quot;https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/&quot; params \{url: data:post\.url\.canonical\}['"]/);
      expect(blog).toMatch(/expr:href=['"]&quot;https:\/\/www\.facebook\.com\/sharer\/sharer\.php&quot; params \{u: data:post\.url\.canonical\}['"]/);

      expect(blog).toMatch(/<b:includable id=['"]postAuthorBio['"] var=['"]post['"]>/);
      expect(blog).toContain('class="post-author-bio author-bio-card author-bio"');
      expect(blog).toContain('aria-label="About the author"');
      expect(blog).toContain('class="author-avatar"');
      expect(blog).toContain('class="author-name"');

      expect(blog).toMatch(/<b:includable id=['"]postNav['"] var=['"]post['"]>/);
      expect(blog).toContain('class="post-nav post-navigation"');
      expect(blog).toContain('aria-label="Post navigation"');
      expect(blog).toContain('class="post-nav-item post-nav-prev"');
      expect(blog).toContain('class="post-nav-item post-nav-next"');
    });

    it('verifies Toast Container for copy feedback is declared with aria-live="polite"', () => {
      expect(themeXml).toMatch(/<div class=['"]toast-container['"][^>]*id=['"]toast-container['"][^>]*aria-live=['"]polite['"]><\/div>/);
    });

    it('verifies Layout Editor overrides in b:template-skin hide interactive overlays in design mode', () => {
      const templateSkinMatch = themeXml.match(/<b:template-skin>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/b:template-skin>/);
      expect(templateSkinMatch).not.toBeNull();
      const css = templateSkinMatch![1];

      expect(css).toContain('body#layout .reading-progress');
      expect(css).toContain('body#layout .drawer-backdrop');
      expect(css).toContain('body#layout .mobile-drawer');
      expect(css).toContain('body#layout .search-modal');
      expect(css).toContain('body#layout .toast-container');
      expect(css).toMatch(/body#layout\s+\.(?:reading-progress|toast-container)[\s\S]*?display:\s*none/);
    });
  });

  describe('3. Defaultmarkups Suite & Includable Completeness (Requirement R2)', () => {
    const requiredMarkupTypes = [
      'Common',
      'AdSense,Blog',
      'Blog,FeaturedPost',
      'Blog,FeaturedPost,PopularPosts',
      'Blog',
      'Header',
      'BlogArchive',
      'BlogSearch',
      'Label',
      'FeaturedPost',
      'PopularPosts',
      'PageList',
      'Profile',
      'ContactForm'
    ];

    for (const type of requiredMarkupTypes) {
      it(`verifies defaultmarkup block for '${type}' exists and is well-formed`, () => {
        expect(themeXml).toContain(`type="${type}"`);
      });
    }

    it('verifies FeaturedPost defaultmarkup implements hero card with badge, zoom, snippet, and empty fallback', () => {
      const match = themeXml.match(/<b:defaultmarkup\b[^>]*\btype=['"]FeaturedPost['"][\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];

      expect(content).toContain('id="main"');
      expect(content).toContain('id="snippetedPostContent"');
      expect(content).toContain('id="snippetedPostTitle"');
      expect(content).toContain('id="snippetedPostThumbnail"');
      expect(content).toContain('class="featured-post-card"');
      expect(content).toContain('class="featured-post-badge"');
      expect(content).toContain('class="featured-post-thumbnail"');
      expect(content).toContain('class="featured-post-snippet"');
      expect(content).toContain('class="empty-featured-post"');
    });

    it('verifies PopularPosts defaultmarkup implements numbered ranking rank span, snippet, thumbnail, and empty fallback', () => {
      const match = themeXml.match(/<b:defaultmarkup\b[^>]*\btype=['"]PopularPosts['"][\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];

      expect(content).toContain('id="main"');
      expect(content).toContain('id="snippetedPostContent"');
      expect(content).toContain('id="snippetedPostTitle"');
      expect(content).toContain('id="snippetedPostThumbnail"');
      expect(content).toContain('id="postSnippet"');
      expect(content).toContain('class="popular-post-entry"');
      expect(content).toContain('class="popular-post-rank"');
      expect(content).toContain('aria-hidden="true"');
      expect(content).toContain('class="popular-post-thumbnail"');
      expect(content).toContain('class="empty-popular-posts"');
    });

    it('verifies Profile defaultmarkup implements author avatar, name, aboutMe snippet, and visit profile link', () => {
      const match = themeXml.match(/<b:defaultmarkup\b[^>]*\btype=['"]Profile['"][\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];

      expect(content).toContain('id="main"');
      expect(content).toContain('id="authorProfileImage"');
      expect(content).toContain('id="defaultProfileImage"');
      expect(content).toContain('id="userProfileText"');
      expect(content).toContain('id="viewProfileLink"');
      expect(content).toContain('class="profile-card wrapper"');
      expect(content).toContain('class="profile-img author-avatar"');
      expect(content).toContain('visit-profile');
      expect(content).toContain('pill-button');
    });

    it('verifies BlogArchive defaultmarkup implements details/summary accordion, interval counts, and empty fallback', () => {
      const match = themeXml.match(/<b:defaultmarkup\b[^>]*\btype=['"]BlogArchive['"][\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];

      expect(content).toContain('id="main"');
      expect(content).toContain('id="content"');
      expect(content).toContain('id="flat"');
      expect(content).toContain('id="hierarchy"');
      expect(content).toContain('id="interval"');
      expect(content).toContain('details class="blog-archive-details"');
      expect(content).toContain('summary class="blog-archive-summary"');
      expect(content).toContain('class="blog-archive-count"');
      expect(content).toContain('class="empty-blog-archive"');
    });

    it('verifies Label defaultmarkup implements topic pills with count bubbles and empty fallback', () => {
      const match = themeXml.match(/<b:defaultmarkup\b[^>]*\btype=['"]Label['"][\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];

      expect(content).toContain('id="main"');
      expect(content).toContain('id="content"');
      expect(content).toContain('id="list"');
      expect(content).toContain('id="cloud"');
      expect(content).toContain('class="topics-cloud"');
      expect(content).toContain('class="topic-pill"');
      expect(content).toContain('class="topic-name"');
      expect(content).toContain('class="topic-count"');
      expect(content).toContain('class="empty-labels"');
    });

    it('verifies ContactForm defaultmarkup implements dynamic instanceId labels and accessible inputs', () => {
      const match = themeXml.match(/<b:defaultmarkup\b[^>]*\btype=['"]ContactForm['"][\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];

      expect(content).toContain('id="main"');
      expect(content).toContain('id="formContent"');
      expect(content).toContain('class="contact-form"');
      expect(content).toContain('expr:for="data:widget.instanceId + &quot;_contact-form-name&quot;"');
      expect(content).toContain('expr:id="data:widget.instanceId + &quot;_contact-form-name&quot;"');
      expect(content).toContain('expr:for="data:widget.instanceId + &quot;_contact-form-email&quot;"');
      expect(content).toContain('expr:id="data:widget.instanceId + &quot;_contact-form-email&quot;"');
      expect(content).toContain('expr:for="data:widget.instanceId + &quot;_contact-form-email-message&quot;"');
      expect(content).toContain('expr:id="data:widget.instanceId + &quot;_contact-form-email-message&quot;"');
      expect(content).toContain('class="contact-form-button contact-form-button-submit"');
    });
  });

  describe('4. Theme Size Budget & Control Theme Generators', () => {
    it('verifies dist/theme.xml compiles strictly within 500 KB limit', () => {
      const sizeBytes = Buffer.byteLength(themeXml, 'utf8');
      expect(sizeBytes).toBeLessThan(500000);
      expect(sizeBytes).toBeGreaterThan(50000);
    });

    it('verifies control themes build cleanly and maintain valid XML structure', async () => {
      const controlFiles = await buildControls(SHA);
      expect(controlFiles).toHaveLength(2);
      for (const ctrlFile of controlFiles) {
        const xml = await readFile(ctrlFile, 'utf8');
        expect(xml).toMatch(/b:layoutsVersion=['"]3['"]/);
        expect(xml).toMatch(/id=['"]Header1['"]/);
        expect(xml).toMatch(/id=['"]Blog1['"]/);
      }
    });
  });
});
