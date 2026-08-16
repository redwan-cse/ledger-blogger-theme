import { describe, expect, it } from 'vitest';
import { CONTRACT_RULES, checkThemeContract, contractRules } from '../../tools/contract-check.js';
import { generateTheme } from '../../tools/generate.js';

const sha = '0123456789abcdef0123456789abcdef01234567';
interface RuleCase { id: string; violate(xml: string): string; comment: string; parserFailure?: boolean }
const inject = (xml: string, value: string): string => xml.replace('</main>', `${value}</main>`);
const MAIN_OPEN = '<main class="main-content" id="content" role="main">';
const cases: readonly RuleCase[] = [
  { id: 'well-formed', violate: (xml) => xml.replace(MAIN_OPEN, '<main class="main-content" id="content" id="duplicate" role="main">'), comment: 'duplicate attributes are malformed XML', parserFailure: true },
  { id: 'layouts-v3', violate: (xml) => xml.replace('b:layoutsVersion="3"', 'b:layoutsVersion="2"'), comment: "b:layoutsVersion='2' is forbidden" },
  { id: 'widget-v2', violate: (xml) => xml.replace('id="HTML1" locked="false" title="Intro" type="HTML" version="2"', 'id="HTML1" locked="false" title="Intro" type="HTML"'), comment: "widget version='2' is required" },
  { id: 'no-v2-html', violate: (xml) => xml.replace('<html ', '<html class="foo v2 bar" '), comment: 'v2 class tokens are legacy' },
  { id: 'single-cdata-skin', violate: (xml) => xml.replace('<![CDATA[', 'literal<![CDATA['), comment: 'all skin content belongs in CDATA' },
  { id: 'section-ids', violate: (xml) => inject(xml, '<b:section class="sidebar" id="invalid-hyphen" maxwidgets="1" name="Sidebar" showaddelement="no"/>'), comment: 'section ids must use underscores rather than hyphens' },
  { id: 'header-widget', violate: (xml) => xml.replace('type="Header"', 'type="HTML"'), comment: 'missing Header widget' },
  { id: 'no-v2-accessors', violate: (xml) => inject(xml, '<b:with value="data:blog.url == data:blog.homepageUrl" var="wrong"/>'), comment: 'URL equality is fragile view dispatch' },
  { id: 'no-macro-tags', violate: (xml) => xml.replace('xmlns:expr=', 'xmlns:macro="urn:macro" xmlns:expr=').replace('</main>', '<macro:include name="x"/></main>'), comment: 'macro:include is banned' },
  { id: 'declared-entities', violate: (xml) => inject(xml, '<p>&#0;</p>'), comment: 'illegal numeric entities are invalid', parserFailure: true },
  { id: 'word-logical-operators', violate: (xml) => inject(xml, '<b:with value="data:view.isPost &amp;&amp; data:view.isPage" var="wrong"/>'), comment: 'encoded logical operators are forbidden' },
  { id: 'documented-comparisons', violate: (xml) => inject(xml, '<b:loop values="data:posts.size" var="post"/>'), comment: '.size in loop values is invalid' },
  { id: 'data-tags-are-paths', violate: (xml) => inject(xml, '<data:post..body/>'), comment: 'data tags must be property paths' },
  { id: 'url-path-operator', violate: (xml) => inject(xml, '<a><b:attr name="href" expr:value="data:blog.homepageUrl + &quot;search&quot;"/></a>'), comment: 'injected URL string addition is forbidden' },
  { id: 'json-escaped', violate: (xml) => xml.replace('</head>', '<script type="application/ld+json">{"headline":"<data:post.title.jsonEscaped.extra/>"}</script></head>'), comment: 'jsonEscaped must be terminal' },
  { id: 'no-fabricated-metadata', violate: (xml) => inject(xml, '<span class="author-name">Fake Author</span>'), comment: 'hardcoded author identity is fabricated' },
  { id: 'build-stamp', violate: (xml) => xml.replace('</head>', '<meta content="0.0.0+0123456789abcdef0123456789abcdef01234567" name="theme-build"/></head>'), comment: 'duplicate build stamps are invalid' },
  { id: 'size-budget', violate: (xml) => `${xml.slice(0, -1)}<!--${'x'.repeat(200_001)}-->\n`, comment: 'output over 200000 bytes is invalid' },
  { id: 'css-disabled', violate: (xml) => xml.replace('b:css="false"', 'b:css="true"'), comment: "b:css='false' is required" },
  { id: 'bound-section-and-widget-ids', violate: (xml) => xml.replace('id="Blog1" locked="true"', 'id="Blog1" locked="false"'), comment: 'Blog1 widget must remain locked' },
  { id: 'all-head-content-include', violate: (xml) => xml.replace('<b:include data="blog" name="all-head-content"/>', ''), comment: 'all-head-content include is mandatory in head' },
  { id: 'main-container-structure', violate: (xml) => xml.replace(MAIN_OPEN, '<div role="region">').replace('</main>', '</div><main class="main-content" id="content" role="main"><p/></main>'), comment: 'main container must enclose page body' },
  { id: 'all-seven-config-zones', violate: (xml) => xml.replace('id="topics" maxwidgets="1" name="Topics" showaddelement="no"', 'id="topics" maxwidgets="1" name="Topics" showaddelement="yes"'), comment: 'section showaddelement must match zone configuration' },
  { id: 'defensive-defaultmarkups', violate: (xml) => xml.replace('<b:defaultmarkup type="PopularPosts">', '<b:defaultmarkup type="DisabledPosts">'), comment: 'defensive defaultmarkups must cover PopularPosts' },
  { id: 'no-hardcoded-search-label', violate: (xml) => inject(xml, '<a href="/search/label/tech">Tech</a>'), comment: 'hardcoded search label URLs are forbidden' },
  { id: 'readme-zone-parity', violate: (xml) => xml.replace('id="intro" maxwidgets="1"', 'id="intro" maxwidgets="99"'), comment: 'intro maxwidgets must match README table' },
  { id: 'clean-section-containers', violate: (xml) => xml.replace('<b:if cond="data:view.isLayoutMode or data:widgets any (w =&gt; w.sectionId == &quot;navlinks&quot;)">', '<b:if cond="data:view.isHomepage or data:widgets any (w =&gt; w.sectionId == &quot;navlinks&quot;)">'), comment: 'optional sections must be guarded with isLayoutMode' },
  { id: 'rel-canonical', violate: (xml) => xml.replace('<link rel="canonical" expr:href="data:view.url.canonical"/>', ''), comment: 'canonical link is mandatory in head' },
  { id: 'opengraph-metadata', violate: (xml) => xml.replace('<meta property="og:title" expr:content="data:view.title.escaped"/>', ''), comment: 'og:title metadata is mandatory in head' },
  { id: 'twitter-metadata', violate: (xml) => xml.replace('<meta name="twitter:title" expr:content="data:view.title.escaped"/>', ''), comment: 'twitter:title metadata is mandatory in head' },
  { id: 'single-h1-hierarchy', violate: (xml) => xml.replaceAll('isSingleItem', 'isHomepage'), comment: 'header must demote H1 on single items' },
  { id: 'skip-link-structure', violate: (xml) => xml.replace('<a class="skip-link" href="#content">Skip to content</a>', ''), comment: 'skip link must target main content' },
  { id: 'clean-aria-landmarks', violate: (xml) => xml.replace('role="banner"', 'role="none"'), comment: 'theme must declare all top-level landmarks' },
  {
    id: 'no-control-flow-hazards',
    violate: (xml) => inject(xml, '<b:if cond="data:view.isPost"><p>Post</p><b:else/><p>Not Post</p></b:if>'),
    comment: 'flat elseif and self-closing else tags are banned control-flow hazards'
  },
  {
    id: 'skin-before-defaultmarkups',
    violate: (xml) => {
      const skinMatch = xml.match(/<b:skin\b[\s\S]*?<\/b:skin>/);
      const defMatch = xml.match(/<b:defaultmarkups\b[\s\S]*?<\/b:defaultmarkups>/);
      if (!skinMatch || !defMatch) return xml;
      return xml.replace(skinMatch[0], '').replace(defMatch[0], `${defMatch[0]}\n${skinMatch[0]}`);
    },
    comment: 'b:skin must appear before b:defaultmarkups in head'
  },
  {
    id: 'section-v3-attributes',
    violate: (xml) => xml.replace('id="header" maxwidgets="1" name="Header"', 'id="header" maxwidgets="1"'),
    comment: 'all sections must declare name, class, and maxwidgets'
  }
];

describe('V3 contract checker blind-spot matrix', () => {
  it('covers every registered rule exactly once', () => {
    expect(CONTRACT_RULES).toBe(contractRules);
    expect(cases.map((item) => item.id).sort()).toEqual(contractRules.map((rule) => rule.id).sort());
  });
  it('anchors every mutation against the real generated output', async () => {
    const { xml } = await generateTheme({ sha, write: false });
    expect(xml, 'MAIN_OPEN must match the generated main element exactly').toContain(MAIN_OPEN);
    expect(xml, 'the Posts section must stay bound to page_body').toContain('id="page_body"');
  });
  for (const testCase of cases) it(`${testCase.id}: isolates a violation and ignores both comment forms`, async () => {
    const { xml } = await generateTheme({ sha, write: false }); const violated = testCase.violate(xml); expect(violated).not.toBe(xml);
    const findings = checkThemeContract(violated).map((finding) => finding.ruleId);
    if (testCase.parserFailure) expect(findings).toEqual(['well-formed', 'declared-entities']); else expect(findings).toEqual([testCase.id]);
    const safe = testCase.comment.replace(/--/g, '—').replace(/&/g, 'and');
    expect(checkThemeContract(xml.replace('</body>', `<!-- ${safe} --></body>`))).toEqual([]);
    expect(checkThemeContract(xml.replace('</main>', `<b:comment>${safe}</b:comment></main>`))).toEqual([]);
  });
  it('rejects malformed XML classes the regex checker missed', async () => {
    const { xml } = await generateTheme({ sha, write: false });
    const mutations = [xml.replace('</html>', '</html><extra/>'), xml.replace(MAIN_OPEN, '<bad:main class="main-content" id="content" role="main">').replace('</main>', '</bad:main>'), xml.replace(MAIN_OPEN, '<main class="main-content" id="content" role="main" broken>'), xml.replace(MAIN_OPEN, `${MAIN_OPEN} stray < text`)];
    for (const mutation of mutations) { expect(mutation).not.toBe(xml); expect(checkThemeContract(mutation).map((finding) => finding.ruleId)).toContain('well-formed'); }
  });
  it('accepts the actual generated M2 render skeleton', async () => { expect(checkThemeContract((await generateTheme({ sha, write: false })).xml)).toEqual([]); });
});
