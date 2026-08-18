import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';
import { buildControls } from '../../tools/build-controls.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHA = '0123456789abcdef0123456789abcdef01234567';

describe('Adversarial Widget & Rendering Engine Challenger Suite', () => {
  it('verifies Header widget image replacement, title demotion, and behindImageStyle in theme.xml', async () => {
    const { xml } = await generateTheme({ sha: SHA, write: false });

    // Extract Header1 widget
    const headerMatch = xml.match(/<b:widget\b[^>]*\bid="Header1"[\s\S]*?<\/b:widget>/);
    expect(headerMatch).not.toBeNull();
    const header = headerMatch![0];

    // Verify version="2", locked="true"
    expect(header).toContain('version="2"');
    expect(header).toContain('locked="true"');

    // Verify main includable
    expect(header).toMatch(/<b:includable id="main" var="this">[\s\S]*?<a class="header-brand"/);
    expect(header).toContain('cond="data:imagePlacement in {&quot;REPLACE&quot;, &quot;BEFORE_DESCRIPTION&quot;}"');
    expect(header).toContain('cond="data:imagePlacement not in {&quot;REPLACE&quot;, &quot;BEFORE_DESCRIPTION&quot;}"');
    expect(header).toContain('cond="data:imagePlacement != &quot;REPLACE&quot;"');
    expect(header).toContain('cond="data:imagePlacement == &quot;BEHIND&quot;"');

    // Verify title demotion logic on single item
    expect(header).toContain('cond="not data:view.isSingleItem"');
    expect(header).toContain('<h1 class="site-title">');
    expect(header).toContain('cond="data:view.isSingleItem"');
    expect(header).toContain('<p class="site-title">');

    // Verify description includable
    expect(header).toMatch(/<b:includable id="description">[\s\S]*?p class="site-tagline"/);

    // Verify image includable calling super.image and title for REPLACE mode
    expect(header).toMatch(/<b:includable id="image">[\s\S]*?<b:include name="super\.image"\/>[\s\S]*?<b:include cond="data:this\.imagePlacement == &quot;REPLACE&quot;" name="title"\/>/);

    // Verify behindImageStyle includable
    expect(header).toContain('<b:includable id="behindImageStyle">');
  });

  it('verifies Blog widget super.main dispatch, post structure, comment threading, and pagination', async () => {
    const { xml } = await generateTheme({ sha: SHA, write: false });

    // Extract Blog1 widget
    const blogMatch = xml.match(/<b:widget\b[^>]*\bid="Blog1"[\s\S]*?<\/b:widget>/);
    expect(blogMatch).not.toBeNull();
    const blog = blogMatch![0];

    // Verify version="2", locked="true"
    expect(blog).toContain('version="2"');
    expect(blog).toContain('locked="true"');

    // Verify super.main invocation
    expect(blog).toMatch(/<b:includable id="main">[\s\S]*?<b:include name="super\.main"\/>/);

    // Verify postCommentsAndAd dispatches to post and commentPicker for single item
    expect(blog).toMatch(/<b:includable id="postCommentsAndAd" var="post">[\s\S]*?<b:include data="post" name="post"\/>[\s\S]*?<b:if cond="data:view\.isSingleItem">[\s\S]*?<b:include data="post" name="commentPicker"\/>/);

    // Verify post includable branching (postBody on isSingleItem vs postBodySnippet on multiple items)
    expect(blog).toMatch(/<b:includable id="post" var="post">[\s\S]*?<b:if cond="data:view\.isSingleItem">[\s\S]*?<b:include name="postBody" data="post"\/>[\s\S]*?<b:if cond="not data:view\.isSingleItem">[\s\S]*?<b:include name="postBodySnippet" data="post"\/>/);

    // Verify commentPicker dispatches to threadedComments vs comments
    expect(blog).toMatch(/<b:includable id="commentPicker" var="post">[\s\S]*?<b:if cond="data:post\.showThreadedComments">[\s\S]*?<b:include data="post" name="threadedComments"\/>[\s\S]*?<b:if cond="not data:post\.showThreadedComments">[\s\S]*?<b:include data="post" name="comments"\/>/);

    // Verify comments & threadedComments includables
    expect(blog).toContain('id="comments"');
    expect(blog).toContain('id="threadedComments"');
    expect(blog).toContain('id="threadedCommentJs"');
    expect(blog).toContain('id="threadedCommentForm"');
    expect(blog).toContain('id="commentList"');
    expect(blog).toContain('id="commentItem"');

    // Verify defensive empty includables (all 11)
    const defensiveIncludables = [
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
    for (const inc of defensiveIncludables) {
      expect(blog, `Blog widget must declare empty includable '${inc}'`).toContain(`id="${inc}"`);
    }
  });

  it('verifies Loud Failure Principle: all 5 empty state branches render visible UI without blank page scenarios', async () => {
    const { xml } = await generateTheme({ sha: SHA, write: false });

    // Extract status-message includable in Blog1
    const statusMatch = xml.match(/<b:includable id="status-message">[\s\S]*?<\/b:includable>/);
    expect(statusMatch).not.toBeNull();
    const status = statusMatch![0];

    // Branch 1: Error 404
    expect(status).toContain('cond="data:view.isError"');
    expect(status).toContain("That page doesn't exist.");

    // Branch 2: Search without Label
    expect(status).toContain('cond="data:view.isSearch and not data:view.isLabelSearch"');
    expect(status).toContain('Nothing matched your search.');

    // Branch 3: Label Search
    expect(status).toContain('cond="data:view.isLabelSearch"');
    expect(status).toContain('Nothing filed under this label yet.');

    // Branch 4: Archive
    expect(status).toContain('cond="data:view.isArchive"');
    expect(status).toContain('No posts in this period.');

    // Branch 5: Homepage / Index fallback
    expect(status).toContain('cond="not data:view.isError and not data:view.isSearch and not data:view.isArchive"');
    expect(status).toContain('No posts published yet.');

    // Actionable fallback button
    expect(status).toContain('class="pill-button"');
    expect(status).toContain('expr:href="data:blog.homepageUrl"');
    expect(status).toContain('Return to home');
  });

  it('verifies Control Themes generation and structure in dist/controls/', async () => {
    const files = await buildControls(SHA);
    expect(files).toHaveLength(2);

    const controlAFile = path.join(ROOT, 'dist/controls/control-a-contempo-shell-our-blog.xml');
    const controlBFile = path.join(ROOT, 'dist/controls/control-b-our-shell-contempo-blog.xml');

    const controlA = await readFile(controlAFile, 'utf8');
    const controlB = await readFile(controlBFile, 'utf8');

    // Both control themes must have XML declaration, V3 shell, Header1, Blog1, and build stamp
    for (const [name, xml] of [['Control A', controlA], ['Control B', controlB]] as const) {
      expect(xml, `${name} must have XML declaration`).toMatch(/^<\?xml version=['"]1\.0['"]/);
      expect(xml, `${name} must declare b:layoutsVersion="3"`).toMatch(/b:layoutsVersion=['"]3['"]/);
      expect(xml, `${name} must include Header1`).toMatch(/id=['"]Header1['"]/);
      expect(xml, `${name} must include Blog1`).toMatch(/id=['"]Blog1['"]/);
      expect(xml, `${name} must include theme-build meta tag`).toMatch(/name=['"]theme-build['"]/);
    }

    // Control A: Contempo shell + Ledger Blog1
    expect(controlA).toContain('postCommentsAndAd');
    expect(controlA).toContain('threadedComments');

    // Control B: Ledger shell + Contempo Blog1
    expect(controlB).toContain('class="header-outer"');
    expect(controlB).toContain('class="main-content"');
  });
});
