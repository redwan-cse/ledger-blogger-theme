import { describe, expect, it } from 'vitest';
import {
  checkThemeContract,
  CONTRACT_RULES,
  contractRules
} from '../../tools/contract-check.js';
import { generateTheme } from '../../tools/generate.js';
import {
  extractWidget,
  getWidgetPattern,
  replaceWidget
} from '../../tools/build-controls.js';
import {
  normalizeGoldenTheme,
  normalizeLineEndings,
  META_THEME_BUILD,
  STAMP_FORMAT
} from '../../tools/golden-check.js';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const MAIN_OPEN = '<main class="main-content" id="content" role="main">';
const inject = (xml: string, value: string): string => xml.replace('</main>', `${value}</main>`);
const rules = (xml: string): string[] => checkThemeContract(xml).map((f) => f.ruleId);

describe('Adversarial Stress Test: All 33 Contract Rules', () => {
  it('verifies exact registration of all 33 rules', () => {
    expect(CONTRACT_RULES.length).toBe(33);
    expect(contractRules.length).toBe(33);
    const ids = contractRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(33);
  });

  it('validates baseline generated theme has zero findings', async () => {
    const { xml } = await generateTheme({ sha: SHA, write: false });
    const findings = checkThemeContract(xml);
    expect(findings).toEqual([]);
  });

  describe('Rule 1: well-formed (R-V3-1 AC9)', () => {
    it('catches various XML malformations', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const malformed = [
        xml.replace('</html>', ''),
        xml.replace(MAIN_OPEN, '<main role="main" unquoted=attr>'),
        xml.replace(MAIN_OPEN, '<main role="main" title="<bad">'),
        xml.replace(MAIN_OPEN, '<main role="main" id="a" id="b">'),
        xml.replace(MAIN_OPEN, '<p>stray ]]> sequence</p>'),
        xml.replace('<!DOCTYPE html>', '<?xml version="2.0"?><!DOCTYPE html>'),
        xml.replace('</main>', '<undeclared:tag/>')
      ];
      for (const m of malformed) {
        expect(rules(m)).toContain('well-formed');
      }
    });
  });

  describe('Rule 2: layouts-v3 (R-V3-1 AC1)', () => {
    it('catches missing or non-3 b:layoutsVersion on html', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(xml.replace('b:layoutsVersion="3"', 'b:layoutsVersion="2"'))).toEqual(['layouts-v3']);
      expect(rules(xml.replace('b:layoutsVersion="3"', 'b:layoutsVersion="1"'))).toEqual(['layouts-v3']);
      expect(rules(xml.replace('b:layoutsVersion="3"', ''))).toEqual(['layouts-v3']);
    });
  });

  describe('Rule 3: widget-v2 (R-V3-1 AC2)', () => {
    it('catches missing or non-2 widget version', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const badWidget = xml.replace('id="Header1" locked="true" title="Blog Header" type="Header" version="2"', 'id="Header1" locked="true" title="Blog Header" type="Header" version="1"');
      expect(rules(badWidget)).toContain('widget-v2');

      const noVersion = inject(xml, '<b:section id="sec_extra"><b:widget id="HTML1" type="HTML"/></b:section>');
      expect(rules(noVersion)).toContain('widget-v2');
    });
  });

  describe('Rule 4: no-v2-html (R-V3-1 AC3)', () => {
    it('catches b:version or v2 class on html root', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(xml.replace('<html ', '<html b:version="2" '))).toEqual(['no-v2-html']);
      expect(rules(xml.replace('<html ', '<html class="v2" '))).toEqual(['no-v2-html']);
      expect(rules(xml.replace('<html ', '<html class="theme v2 dark" '))).toEqual(['no-v2-html']);
    });

    it('allows class names containing v2 as substring but not token', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(xml.replace('<html ', '<html class="dev2" '))).toEqual([]);
      expect(rules(xml.replace('<html ', '<html class="v20" '))).toEqual([]);
    });
  });

  describe('Rule 5: single-cdata-skin (R-V3-1 AC4)', () => {
    it('catches missing, multiple, or non-CDATA b:skin', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(xml.replace(/<b:skin\b[\s\S]*?<\/b:skin>/, ''))).toEqual(['single-cdata-skin']);
      expect(rules(xml.replace('</b:skin>', '</b:skin><b:skin><![CDATA[body{}]]></b:skin>'))).toEqual(['single-cdata-skin']);
      expect(rules(xml.replace('<![CDATA[', 'raw css <![CDATA['))).toEqual(['single-cdata-skin']);
    });
  });

  describe('Rule 6: section-ids (R-V3-1 AC5)', () => {
    it('catches invalid or duplicate section ids', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<b:section id="123_invalid"/>'))).toEqual(['section-ids']);
      expect(rules(inject(xml, '<b:section id="hyphen-name"/>'))).toEqual(['section-ids']);
      expect(rules(inject(xml, '<b:section id="header"/>'))).toContain('section-ids');
    });

    it('allows valid alphanumeric and underscore section ids', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<b:section id="sidebar_secondary_1"/>'))).toEqual([]);
    });
  });

  describe('Rule 7: header-widget (R-V3-1 AC6)', () => {
    it('catches missing Header widget', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const noHeader = xml.replace('type="Header"', 'type="HTML"');
      expect(rules(noHeader)).toContain('header-widget');
    });
  });

  describe('Rule 8: no-v2-accessors (R-V3-1 AC7)', () => {
    it('catches legacy v2 accessors in expressions and data tags', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<b:if cond="data:blog.pageType == &quot;item&quot;"/>'))).toEqual(['no-v2-accessors']);
      expect(rules(inject(xml, '<b:if cond="data:blog.searchLabel"/>'))).toEqual(['no-v2-accessors']);
      expect(rules(inject(xml, '<b:if cond="data:blog.searchQuery"/>'))).toEqual(['no-v2-accessors']);
      expect(rules(inject(xml, '<b:if cond="data:post.dateHeader"/>'))).toEqual(['no-v2-accessors']);
      expect(rules(inject(xml, '<b:with value="data:blog.url == data:blog.homepageUrl" var="x"/>'))).toEqual(['no-v2-accessors']);
    });
  });

  describe('Rule 9: no-macro-tags (R-V3-1 AC8)', () => {
    it('catches macro:* tags', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const withMacro = xml
        .replace('xmlns:expr=', 'xmlns:macro="urn:macro" xmlns:expr=')
        .replace('</main>', '<macro:include id="test"/></main>');
      expect(rules(withMacro)).toEqual(['no-macro-tags']);
    });
  });

  describe('Rule 10: declared-entities (R-BUILD-1 AC6)', () => {
    it('catches undeclared entities or illegal numeric character references', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<p>&customEntity;</p>'))).toContain('declared-entities');
      expect(rules(inject(xml, '<p>&#0;</p>'))).toContain('declared-entities');
      expect(rules(inject(xml, '<p>&#xd800;</p>'))).toContain('declared-entities');
    });

    it('permits standard XML entities and valid numeric entities', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<p>&amp; &lt; &gt; &quot; &apos; &#169; &#x2014;</p>'))).toEqual([]);
    });
  });

  describe('Rule 11: word-logical-operators (R-V3-2 AC1)', () => {
    it('catches && and || in expressions', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<b:if cond="data:view.isPost &amp;&amp; data:view.isPage"/>'))).toEqual(['word-logical-operators']);
      expect(rules(inject(xml, '<b:with value="data:view.isPost || data:view.isPage" var="v"/>'))).toEqual(['word-logical-operators']);
    });

    it('permits and / or in expressions and words containing and/or', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<b:if cond="data:view.isPost and not data:view.isPage or data:view.isHomepage"/>'))).toEqual([]);
      expect(rules(inject(xml, '<b:with value="data:blog.title" var="brand_origin"/>'))).toEqual([]);
    });
  });

  describe('Rule 12: documented-comparisons (R-V3-2 AC2)', () => {
    it('catches .size, gt, lt, gte, lte in expressions', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<b:if cond="data:posts.size &gt; 0"/>'))).toEqual(['documented-comparisons']);
      expect(rules(inject(xml, '<b:if cond="data:posts.length gt 0"/>'))).toEqual(['documented-comparisons']);
      expect(rules(inject(xml, '<b:if cond="data:posts.length lt 5"/>'))).toEqual(['documented-comparisons']);
      expect(rules(inject(xml, '<b:if cond="data:posts.length gte 1"/>'))).toEqual(['documented-comparisons']);
      expect(rules(inject(xml, '<b:if cond="data:posts.length lte 10"/>'))).toEqual(['documented-comparisons']);
    });
  });

  describe('Rule 13: data-tags-are-paths (R-V3-2 AC3)', () => {
    it('catches invalid data: tags (non-self-closing, with children, or malformed paths)', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<data:post..title/>'))).toEqual(['data-tags-are-paths']);
      expect(rules(inject(xml, '<data:123invalid/>'))).toEqual(['data-tags-are-paths']);
      expect(rules(inject(xml, '<data:post.title>inner</data:post.title>'))).toEqual(['data-tags-are-paths']);
    });

    it('permits valid self-closing property paths', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<data:post.author.name/>'))).toEqual([]);
    });
  });

  describe('Rule 14: url-path-operator (R-V3-2 AC4)', () => {
    it('catches string concatenation (+) on expr:href, expr:src, expr:action, and b:attr', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<a expr:href="data:blog.homepageUrl + &quot;test&quot;"/>'))).toEqual(['url-path-operator']);
      expect(rules(inject(xml, '<img expr:src="data:post.featuredImage + &quot;?w=600&quot;"/>'))).toEqual(['url-path-operator']);
      expect(rules(inject(xml, '<form expr:action="data:blog.homepageUrl + &quot;search&quot;"/>'))).toEqual(['url-path-operator']);
      expect(rules(inject(xml, '<a><b:attr name="href" expr:value="data:blog.homepageUrl + &quot;x&quot;"/></a>'))).toEqual(['url-path-operator']);
    });

    it('permits arithmetic + on non-URL attributes', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<span expr:data-count="data:count + 1"/>'))).toEqual([]);
      expect(rules(inject(xml, '<div><b:attr name="data-index" expr:value="data:index + 1"/></div>'))).toEqual([]);
    });
  });

  describe('Rule 15: json-escaped (R-V3-2 AC5)', () => {
    it('catches unescaped interpolations in JSON-LD script blocks', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const badData = xml.replace('</head>', '<script type="application/ld+json">{"name":"<data:blog.title/>"}</script></head>');
      expect(rules(badData)).toEqual(['json-escaped']);

      const badEval = xml.replace('</head>', '<script type="application/ld+json">{"name":"<b:eval expr=\'data:blog.title\'/>"}</script></head>');
      expect(rules(badEval)).toEqual(['json-escaped']);

      const badDynamic = xml.replace('</head>', '<script><b:attr name="type" value="application/ld+json"/>{"name":"<data:blog.title/>"}</script></head>');
      expect(rules(badDynamic)).toEqual(['json-escaped']);
    });

    it('permits valid .jsonEscaped interpolations', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const good = xml.replace('</head>', '<script type="application/ld+json">{"name":"<data:blog.title.jsonEscaped/>","desc":"<b:eval expr=\'data:blog.title.jsonEscaped\'/>"}</script></head>');
      expect(rules(good)).toEqual([]);
    });
  });

  describe('Rule 16: no-fabricated-metadata (R-BUILD-1 AC7)', () => {
    it('catches hardcoded reading times, gravatar urls, and hardcoded author names', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<p>5 min read</p>'))).toEqual(['no-fabricated-metadata']);
      expect(rules(inject(xml, '<p>12 minutes read</p>'))).toEqual(['no-fabricated-metadata']);
      expect(rules(inject(xml, '<img src="https://gravatar.com/avatar/123456"/>'))).toEqual(['no-fabricated-metadata']);
      expect(rules(inject(xml, '<span class="author-name">John Doe</span>'))).toEqual(['no-fabricated-metadata']);
      expect(rules(inject(xml, '<div class="post-author">Jane Doe</div>'))).toEqual(['no-fabricated-metadata']);
    });

    it('permits dynamic author markup without literal text', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<span class="author-name"><data:post.author.name/></span>'))).toEqual([]);
    });
  });

  describe('Rule 17: build-stamp (R-BUILD-2 AC1)', () => {
    it('catches missing, duplicate, misplaced, or mismatched build stamp', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const noStamp = xml.replace(/<meta\s+content="[^"]+"\s+name="theme-build"\/>/, '');
      expect(rules(noStamp)).toEqual(['build-stamp']);

      const duplicateStamp = xml.replace('</head>', '<meta content="0.0.0+0123456789abcdef0123456789abcdef01234567" name="theme-build"/></head>');
      expect(rules(duplicateStamp)).toEqual(['build-stamp']);

      const badSha = xml.replace(SHA, '12345');
      expect(rules(badSha)).toEqual(['build-stamp']);

      const badVersion = xml.replace('b:templateVersion="0.0.0"', 'b:templateVersion="1.0.0"');
      expect(rules(badVersion)).toEqual(['build-stamp']);
    });
  });

  describe('Rule 18: size-budget (R-PERF-1 AC4)', () => {
    it('catches themes exceeding 200,000 bytes', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const padding = '<!-- ' + 'X'.repeat(200_000) + ' -->';
      const oversized = inject(xml, padding);
      expect(rules(oversized)).toEqual(['size-budget']);
    });
  });

  describe('Rule 19: css-disabled (R-PERF-1 AC7)', () => {
    it('catches b:css !== "false" on html', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(xml.replace('b:css="false"', 'b:css="true"'))).toEqual(['css-disabled']);
      expect(rules(xml.replace('b:css="false"', ''))).toEqual(['css-disabled']);
    });
  });

  describe('Rule 20: bound-section-and-widget-ids (BR-1)', () => {
    it('catches missing sections, missing widgets, wrong widget IDs, or unlocked widgets', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(xml.replace('id="header"', 'id="top_header"'))).toContain('bound-section-and-widget-ids');
      expect(rules(xml.replace('id="page_body"', 'id="main_body"'))).toContain('bound-section-and-widget-ids');
      expect(rules(xml.replace('id="Header1"', 'id="Header99"'))).toContain('bound-section-and-widget-ids');
      expect(rules(xml.replace('id="Blog1"', 'id="Blog99"'))).toContain('bound-section-and-widget-ids');
      expect(rules(xml.replace('id="Header1" locked="true"', 'id="Header1" locked="false"'))).toContain('bound-section-and-widget-ids');
      expect(rules(xml.replace('id="Blog1" locked="true"', 'id="Blog1" locked="false"'))).toContain('bound-section-and-widget-ids');
    });
  });

  describe('Rule 21: all-head-content-include (R-V3-1 AC1)', () => {
    it('catches missing, multiple, or misplaced all-head-content includes', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const missing = xml.replace('<b:include data="blog" name="all-head-content"/>', '');
      expect(rules(missing)).toEqual(['all-head-content-include']);

      const duplicate = xml.replace('</head>', '<b:include data="blog" name="all-head-content"/></head>');
      expect(rules(duplicate)).toEqual(['all-head-content-include']);

      const wrongData = xml.replace('data="blog"', 'data="post"');
      expect(rules(wrongData)).toContain('all-head-content-include');
    });
  });

  describe('Rule 22: main-container-structure (R-A11Y-2 AC1)', () => {
    it('catches page_body outside main role="main" container', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const divMain = xml.replace(MAIN_OPEN, '<div role="region">').replace('</main>', '</div><main class="main-content" id="content" role="main"><p/></main>');
      expect(rules(divMain)).toEqual(['main-container-structure']);

      const noRole = xml.replace(MAIN_OPEN, '<main class="main-content" id="content">').replace('</main>', '</main><main class="main-content" id="content-extra" role="main"><p/></main>');
      expect(rules(noRole)).toEqual(['main-container-structure']);
    });
  });

  describe('Rule 23: all-seven-config-zones (R-NAV-2 AC1)', () => {
    it('catches missing section or invalid showaddelement', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const badShowAdd = xml.replace('id="topics" maxwidgets="1" name="Topics" showaddelement="no"', 'id="topics" maxwidgets="1" name="Topics" showaddelement="yes"');
      expect(rules(badShowAdd)).toEqual(['all-seven-config-zones']);

      const missingSec = xml.replace(/<b:section\b[^>]*\bid="cta"[^>]*>[\s\S]*?<\/b:section>/, '');
      expect(rules(missingSec)).toContain('all-seven-config-zones');
    });
  });

  describe('Rule 24: defensive-defaultmarkups (R-NAV-2 AC5)', () => {
    it('catches missing or malformed defaultmarkups in head', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const missingPp = xml.replace(/<b:defaultmarkup\b[^>]*\btype="PopularPosts"[\s\S]*?<\/b:defaultmarkup>/, '');
      expect(rules(missingPp)).toEqual(['defensive-defaultmarkups']);

      const noDef = xml.replace(/<b:defaultmarkups>[\s\S]*?<\/b:defaultmarkups>/, '');
      expect(rules(noDef)).toEqual(['defensive-defaultmarkups']);
    });
  });

  describe('Rule 25: no-hardcoded-search-label (R-NAV-1 AC2)', () => {
    it('catches hardcoded /search/label/ in attributes or text', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(rules(inject(xml, '<a href="/search/label/Security">Topic</a>'))).toEqual(['no-hardcoded-search-label']);
      expect(rules(inject(xml, '<p>See /search/label/news for updates</p>'))).toEqual(['no-hardcoded-search-label']);
    });
  });

  describe('Rule 26: readme-zone-parity (R-NAV-2 AC6)', () => {
    it('catches maxwidgets mismatch against README table', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const badMax = xml.replace('id="intro" maxwidgets="1"', 'id="intro" maxwidgets="99"');
      expect(rules(badMax)).toEqual(['readme-zone-parity']);
    });
  });

  describe('Rule 27: clean-section-containers (R-NAV-2 AC3)', () => {
    it('catches missing isLayoutMode guards on optional sections', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const badGuard = xml.replace('<b:if cond="data:view.isLayoutMode or data:widgets any (w =&gt; w.sectionId == &quot;navlinks&quot;)">', '<b:if cond="data:view.isHomepage or data:widgets any (w =&gt; w.sectionId == &quot;navlinks&quot;)">');
      expect(rules(badGuard)).toEqual(['clean-section-containers']);
    });
  });

  describe('Rule 28: rel-canonical (R-SEO-2 AC4)', () => {
    it('catches missing or invalid rel=canonical link in head', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const noCanonical = xml.replace('<link rel="canonical" expr:href="data:view.url.canonical"/>', '');
      expect(rules(noCanonical)).toEqual(['rel-canonical']);

      const wrongHref = xml.replace('expr:href="data:view.url.canonical"', 'expr:href="data:blog.canonicalHomepageUrl"');
      expect(rules(wrongHref)).toEqual(['rel-canonical']);
    });
  });

  describe('Rule 29: opengraph-metadata (R-SEO-2 AC1)', () => {
    it('catches missing OpenGraph metadata tags in head', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const noTitle = xml.replace('<meta property="og:title" expr:content="data:view.title.escaped"/>', '');
      expect(rules(noTitle)).toEqual(['opengraph-metadata']);

      const noType = xml.replace('<meta property="og:type" content="article"/>', '').replace('<meta property="og:type" content="website"/>', '');
      expect(rules(noType)).toEqual(['opengraph-metadata']);
    });
  });

  describe('Rule 30: twitter-metadata (R-SEO-2 AC1)', () => {
    it('catches missing Twitter card metadata tags in head', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const noTitle = xml.replace('<meta name="twitter:title" expr:content="data:view.title.escaped"/>', '');
      expect(rules(noTitle)).toEqual(['twitter-metadata']);

      const noCard = xml.replace('<meta name="twitter:card" content="summary_large_image"/>', '').replace('<meta name="twitter:card" content="summary"/>', '');
      expect(rules(noCard)).toEqual(['twitter-metadata']);
    });
  });

  describe('Rule 31: single-h1-hierarchy (R-A11Y-3 AC1)', () => {
    it('catches missing single item demotion in Header1 or stray h1 elements', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const noDemotion = xml.replace('cond="not data:view.isSingleItem"', 'cond="data:view.isHomepage"');
      expect(rules(noDemotion)).toEqual(['single-h1-hierarchy']);

      const strayH1 = xml.replace('<b:widget id="HTML1" locked="false" title="Intro" type="HTML" version="2" visible="true">', '<b:widget id="HTML1" locked="false" title="Intro" type="HTML" version="2" visible="true"><b:includable id="extra"><h1>Stray Heading</h1></b:includable>');
      expect(rules(strayH1)).toContain('single-h1-hierarchy');
    });
  });

  describe('Rule 32: skip-link-structure (R-A11Y-2 AC2)', () => {
    it('catches missing skip link or missing main#content target', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const noSkipLink = xml.replace('<a class="skip-link" href="#content">Skip to content</a>', '');
      expect(rules(noSkipLink)).toEqual(['skip-link-structure']);

      const badTarget = xml.replace('href="#content"', 'href="#main"');
      expect(rules(badTarget)).toEqual(['skip-link-structure']);
    });
  });

  describe('Rule 33: clean-aria-landmarks (R-A11Y-1)', () => {
    it('catches missing landmarks or nested nav elements', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const noBanner = xml.replace('role="banner"', 'role="none"');
      expect(rules(noBanner)).toEqual(['clean-aria-landmarks']);

      const noContentInfo = xml.replace('role="contentinfo"', 'role="none"');
      expect(rules(noContentInfo)).toEqual(['clean-aria-landmarks']);

      const nestedNav = xml.replace('<nav class="site-nav" aria-label="Main Navigation">', '<nav class="site-nav" aria-label="Main Navigation"><nav class="nested-nav"></nav>');
      expect(rules(nestedNav)).toEqual(['clean-aria-landmarks']);
    });
  });

  describe('Comment Immunity for all violation patterns', () => {
    const commentPayloads = [
      'b:layoutsVersion="2"',
      '<b:widget id="W" type="HTML" version="1"/>',
      '<html b:version="2" class="v2">',
      'raw skin content outside CDATA',
      '<b:section id="bad-id"/>',
      'type="Header" missing',
      'data:blog.pageType == "item"',
      'data:blog.searchLabel',
      'data:blog.searchQuery',
      'data:post.dateHeader',
      'data:blog.url == data:blog.homepageUrl',
      '<macro:include name="m"/>',
      'data:view.isPost && data:view.isPage',
      'data:view.isPost || data:view.isPage',
      'data:posts.size > 0',
      'data:posts.length gt 0',
      'data:posts.length lt 5',
      '<data:bad..path/>',
      'expr:href="data:blog.homepageUrl + \\"x\\""',
      'script type="application/ld+json" with <data:post.title/>',
      'author-name Fake Author',
      'meta name="theme-build" duplicate',
      'b:css="true"',
      'locked="false" on Blog1',
      'all-head-content missing',
      'page_body outside main',
      'href="/search/label/tech"',
      'type="DisabledPosts" in defaultmarkup',
      'id="topics" maxwidgets="99"',
      'rel="canonical" missing',
      'og:title metadata missing',
      'twitter:title metadata missing',
      'Header1 cond="data:view.isHomepage"',
      'skip-link missing',
      'nested nav landmark'
    ];

    it('ignores violation patterns inside standard XML comments <!-- ... -->', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      for (const payload of commentPayloads) {
        const safePayload = payload.replace(/--/g, '—').replace(/&/g, 'and');
        const withComment = xml.replace('</body>', `<!-- ${safePayload} --></body>`);
        expect(rules(withComment), `Failed immunity for XML comment: ${safePayload}`).toEqual([]);
      }
    });

    it('ignores active tags and violation patterns inside <b:comment> ... </b:comment>', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      for (const payload of commentPayloads) {
        const safePayload = payload.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const withBloggerComment = inject(xml, `<b:comment>${safePayload}</b:comment>`);
        expect(rules(withBloggerComment), `Failed immunity for b:comment: ${payload}`).toEqual([]);
      }
    });

    it('ignores nested elements and widgets inside <b:comment>', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const withNested = inject(
        xml,
        `<b:comment>
          <b:widget id="BadWidget" type="HTML" version="1" locked="false"/>
          <data:post.author.name/>
          <a expr:href="data:blog.homepageUrl + 'search'"/>
        </b:comment>`
      );
      expect(rules(withNested)).toEqual([]);
    });
  });

  describe('build-controls and golden-check tool stress tests', () => {
    it('getWidgetPattern handles quotes and attribute ordering', () => {
      const pattern1 = getWidgetPattern('Blog1');
      expect(pattern1.test('<b:widget id="Blog1" type="Blog" version="2">...</b:widget>')).toBe(true);
      expect(pattern1.test("<b:widget type='Blog' id='Blog1' version='2'>...</b:widget>")).toBe(true);
      expect(pattern1.test('<b:widget id="Blog2" type="Blog" version="2">...</b:widget>')).toBe(false);
    });

    it('replaceWidget safely handles replacement strings with regex replacement patterns ($&, $1, etc.)', () => {
      const xml = '<b:section id="page_body"><b:widget id="Blog1" type="Blog" version="2"><b:includable id="main"/></b:widget></b:section>';
      const replacement = '<b:widget id="Blog1" type="Blog" version="2"><b:includable id="main"><p>$& $1 $\` $\'</p></b:includable></b:widget>';
      const replaced = replaceWidget(xml, 'Blog1', replacement);
      expect(replaced).toContain('<p>$& $1 $\` $\'</p>');
    });

    it('normalizeLineEndings handles CRLF, CR, LF, and ensures trailing newline', () => {
      expect(normalizeLineEndings('a\r\nb\r\nc')).toBe('a\nb\nc\n');
      expect(normalizeLineEndings('a\rb\rc\n')).toBe('a\nb\nc\n');
      expect(normalizeLineEndings('a\nb\nc\n')).toBe('a\nb\nc\n');
    });

    it('normalizeGoldenTheme standardizes build stamps regardless of quote style and SHA casing', () => {
      const xmlDouble = '<head><meta name="theme-build" content="1.2.3+0123456789abcdef0123456789abcdef01234567"/></head>';
      const normalizedDouble = normalizeGoldenTheme(xmlDouble);
      expect(normalizedDouble).toContain('content="1.2.3+GOLDEN_SHA_40_CHARS________________"');

      const xmlSingle = "<head><meta name='theme-build' content='1.2.3+ABCDEF0123456789ABCDEF0123456789ABCDEF01'/></head>";
      const normalizedSingle = normalizeGoldenTheme(xmlSingle);
      expect(normalizedSingle).toContain("content='1.2.3+GOLDEN_SHA_40_CHARS________________'");
    });

    it('META_THEME_BUILD and STAMP_FORMAT match valid semver-with-prerelease + SHA', () => {
      expect(STAMP_FORMAT.test('0.0.0+0123456789abcdef0123456789abcdef01234567')).toBe(true);
      expect(STAMP_FORMAT.test('1.0.0-beta.1+0123456789abcdef0123456789abcdef01234567')).toBe(true);
      expect(STAMP_FORMAT.test('0.0.0+GOLDEN_SHA_40_CHARS________________')).toBe(true);
      expect(STAMP_FORMAT.test('0.0.0+shortsha')).toBe(false);
      expect(STAMP_FORMAT.test('invalid+0123456789abcdef0123456789abcdef01234567')).toBe(false);
    });
  });
});
