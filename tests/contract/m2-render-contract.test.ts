import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';

const sha = '0123456789abcdef0123456789abcdef01234567';
function blogWidget(xml: string): string {
  const match = xml.match(/<b:widget id="Blog1"[\s\S]*?<\/b:widget>/);
  if (!match) throw new Error('Blog1 widget was not generated.');
  return match[0];
}

describe('M2 render path: Contempo-aligned shell and widget bindings', () => {
  it('carries the Blogger locale and direction expressions on html with static fallback', async () => {
    const xml = (await generateTheme({ sha, write: false })).xml;
    expect(xml).toContain('expr:dir="data:blog.languageDirection"');
    expect(xml).toMatch(/expr:lang="data:blog\.locale \?: 'en'"/);
    expect(xml).toContain('b:templateUrl="indie.xml"');
  });




  it('includes all-head-content exactly once inside head', async () => {
    const xml = (await generateTheme({ sha, write: false })).xml;
    expect(xml.match(/<b:include data="blog" name="all-head-content"\/>/g) ?? []).toHaveLength(1);
    expect(xml).toMatch(/<head>[\s\S]*<b:include data="blog" name="all-head-content"\/>[\s\S]*<\/head>/);
  });

  it('includes b:template-skin with CDATA layout CSS in head after b:skin', async () => {
    const xml = (await generateTheme({ sha, write: false })).xml;
    expect(xml).toMatch(/<b:skin\b[\s\S]*?<\/b:skin>\s*<b:template-skin>[\s\S]*?<!\[CDATA\[[\s\S]*?body#layout[\s\S]*?\]\]>\s*<\/b:template-skin>/);
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

  it('dispatches main via native super.main while providing child overrides', async () => {
    const widget = blogWidget((await generateTheme({ sha, write: false })).xml);
    expect(widget.match(/<b:includable /g)?.length ?? 0).toBeGreaterThan(1);
    expect(widget).toMatch(/<b:includable id="main">[\s\S]*<b:include name="super\.main"\/>/);
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

  describe('Contempo Defaultmarkups Suite (Requirement R2)', () => {
    it('declares all 12 Contempo defaultmarkup blocks plus ContactForm in head', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const defaultMarkupsMatch = xml.match(/<b:defaultmarkups>[\s\S]*?<\/b:defaultmarkups>/);
      expect(defaultMarkupsMatch).not.toBeNull();
      const content = defaultMarkupsMatch![0];

      const expectedBlocks = [
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

      for (const blockType of expectedBlocks) {
        expect(content, `Defaultmarkup block '${blockType}' must exist`).toContain(`type="${blockType}"`);
      }
    });

    it('implements Common defaultmarkup with title and preview includables', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const match = xml.match(/<b:defaultmarkup\b[^>]*\btype="Common"[\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];
      expect(content).toContain('id="widgetTitle"');
      expect(content).toContain('id="widget-title"');
      expect(content).toContain('id="widgetNotAvailableInPreview"');
      expect(content).toContain('super.widgetNotAvailableInPreview');
    });

    it('implements AdSense,Blog defaultmarkup with defaultAdUnit includable', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const match = xml.match(/<b:defaultmarkup\b[^>]*\btype="AdSense,Blog"[\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];
      expect(content).toContain('id="defaultAdUnit"');
      expect(content).toContain('super.defaultAdUnit');
    });

    it('implements Blog,FeaturedPost defaultmarkup with headerByline includable', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const match = xml.match(/<b:defaultmarkup\b[^>]*\btype="Blog,FeaturedPost"[\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];
      expect(content).toContain('id="headerByline"');
      expect(content).toContain('super.headerByline');
      expect(content).toContain('name="maybeAddShareButtons"');
    });

    it('implements Blog,FeaturedPost,PopularPosts defaultmarkup with all shared post includables', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const match = xml.match(/<b:defaultmarkup\b[^>]*\btype="Blog,FeaturedPost,PopularPosts"[\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];
      expect(content).toContain('id="commentsLink"');
      expect(content).toContain('id="snippetedPostByline"');
      expect(content).toContain('id="postLabels"');
      expect(content).toContain('id="postShareButtons"');
      expect(content).toContain('id="postJumpLink"');
      expect(content).toContain('id="postFooterJumpLink"');
      expect(content).toContain('id="postFooter"');
      expect(content).toContain('name="commentIcon"');
      expect(content).toContain('name="footerBylines"');
      expect(content).toContain('name="postFooterAuthorProfile"');
    });

    it('implements Blog defaultmarkup with main, feedLinks, postBodySnippet, nextPageLink, inlineAd', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const match = xml.match(/<b:defaultmarkup\b[^>]*\btype="Blog"[\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];
      expect(content).toContain('id="main"');
      expect(content).toContain('super.main');
      expect(content).toContain('id="feedLinks"');
      expect(content).toContain('id="postBodySnippet"');
      expect(content).toContain('id="nextPageLink"');
      expect(content).toContain('id="inlineAd"');
      expect(content).toContain('super.inlineAd');
    });

    it('implements Header defaultmarkup with image, title, description, behindImageStyle', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const match = xml.match(/<b:defaultmarkup\b[^>]*\btype="Header"[\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];
      expect(content).toContain('id="image"');
      expect(content).toContain('super.image');
      expect(content).toContain('id="title"');
      expect(content).toContain('super.title');
      expect(content).toContain('id="description"');
      expect(content).toContain('id="behindImageStyle"');
    });

    it('implements BlogArchive defaultmarkup with main, flat, hierarchy', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const match = xml.match(/<b:defaultmarkup\b[^>]*\btype="BlogArchive"[\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];
      expect(content).toContain('id="main"');
      expect(content).toContain('id="flat"');
      expect(content).toContain('id="hierarchy"');
      expect(content).toContain('id="interval"');
    });

    it('implements BlogSearch defaultmarkup with searchSubmit', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const match = xml.match(/<b:defaultmarkup\b[^>]*\btype="BlogSearch"[\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];
      expect(content).toContain('id="searchSubmit"');
      expect(content).toContain('data:messages.search.escaped');
    });

    it('implements Label defaultmarkup with main, list, cloud', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const match = xml.match(/<b:defaultmarkup\b[^>]*\btype="Label"[\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];
      expect(content).toContain('id="main"');
      expect(content).toContain('id="list"');
      expect(content).toContain('id="cloud"');
    });

    it('implements FeaturedPost defaultmarkup with main, snippetedPostContent, snippetedPostThumbnail', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const match = xml.match(/<b:defaultmarkup\b[^>]*\btype="FeaturedPost"[\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];
      expect(content).toContain('id="main"');
      expect(content).toContain('id="snippetedPostContent"');
      expect(content).toContain('id="snippetedPostThumbnail"');
      expect(content).toContain('id="snippetedPostTitle"');
    });

    it('implements PopularPosts defaultmarkup with main, snippetedPostContent', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const match = xml.match(/<b:defaultmarkup\b[^>]*\btype="PopularPosts"[\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];
      expect(content).toContain('id="main"');
      expect(content).toContain('id="snippetedPostContent"');
      expect(content).toContain('id="snippetedPostTitle"');
      expect(content).toContain('id="snippetedPostThumbnail"');
      expect(content).toContain('id="postSnippet"');
    });

    it('implements PageList defaultmarkup with content, overflowButton', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const match = xml.match(/<b:defaultmarkup\b[^>]*\btype="PageList"[\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];
      expect(content).toContain('id="content"');
      expect(content).toContain('id="overflowButton"');
      expect(content).toContain('data:messages.moreEllipsis');
    });

    it('implements Profile defaultmarkup with main, defaultProfileImage, userProfileText, viewProfileLink', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const match = xml.match(/<b:defaultmarkup\b[^>]*\btype="Profile"[\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];
      expect(content).toContain('id="main"');
      expect(content).toContain('id="defaultProfileImage"');
      expect(content).toContain('id="userProfileText"');
      expect(content).toContain('id="viewProfileLink"');
      expect(content).toContain('name="defaultAvatarIcon"');
    });

    it('implements ContactForm defaultmarkup with main, formContent', async () => {
      const xml = (await generateTheme({ sha, write: false })).xml;
      const match = xml.match(/<b:defaultmarkup\b[^>]*\btype="ContactForm"[\s\S]*?<\/b:defaultmarkup>/);
      expect(match).not.toBeNull();
      const content = match![0];
      expect(content).toContain('id="main"');
      expect(content).toContain('id="formContent"');
      expect(content).toContain('contact-form-button-submit');
    });
  });
});
