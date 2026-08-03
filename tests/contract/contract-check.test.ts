import { describe, expect, it } from 'vitest';
import { checkThemeContract, contractRules } from '../../tools/contract-check.js';
import { generateTheme } from '../../tools/generate.js';

const sha = '0123456789abcdef0123456789abcdef01234567';
interface RuleCase { id: string; violate(xml: string): string; comment: string; parserFailure?: boolean }
const inject = (xml: string, value: string): string => xml.replace('</main>', `${value}</main>`);

const cases: readonly RuleCase[] = [
  { id: 'well-formed', violate: (xml) => xml.replace('<main id="main">', '<main id="main" id="duplicate">'), comment: 'duplicate attributes are malformed XML', parserFailure: true },
  { id: 'layouts-v3', violate: (xml) => xml.replace('b:layoutsVersion="3"', 'b:layoutsVersion="2"'), comment: "b:layoutsVersion='2' is forbidden" },
  { id: 'widget-v2', violate: (xml) => xml.replace(' version="2"', ''), comment: "widget version='2' is required" },
  { id: 'no-v2-html', violate: (xml) => xml.replace('<html ', '<html class="foo v2 bar" '), comment: 'v2 class tokens are legacy' },
  { id: 'single-cdata-skin', violate: (xml) => xml.replace('<![CDATA[', 'literal<![CDATA['), comment: 'all skin content belongs in CDATA' },
  { id: 'section-ids', violate: (xml) => xml.replace('id="mainContent"', 'id="masthead"'), comment: 'duplicate section id masthead' },
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
  { id: 'css-disabled', violate: (xml) => xml.replace('b:css="false"', 'b:css="true"'), comment: "b:css='false' is required" }
];

describe('V3 contract checker blind-spot matrix', () => {
  it('covers every registered rule exactly once', () => {
    expect(cases.map((item) => item.id).sort()).toEqual(contractRules.map((rule) => rule.id).sort());
  });

  for (const testCase of cases) it(`${testCase.id}: isolates a violation and ignores both comment forms`, async () => {
    const { xml } = await generateTheme({ sha, write: false });
    const violated = testCase.violate(xml);
    expect(violated).not.toBe(xml);
    const findings = checkThemeContract(violated).map((finding) => finding.ruleId);
    if (testCase.parserFailure) expect(findings).toEqual(['well-formed', 'declared-entities']);
    else expect(findings).toEqual([testCase.id]);

    const safe = testCase.comment.replace(/--/g, '—').replace(/&/g, 'and');
    const htmlComment = xml.replace('</body>', `<!-- ${safe} --></body>`);
    const bloggerComment = xml.replace('</main>', `<b:comment>${safe}</b:comment></main>`);
    expect(checkThemeContract(htmlComment)).toEqual([]);
    expect(checkThemeContract(bloggerComment)).toEqual([]);
  });

  it('rejects malformed XML classes the regex checker missed', async () => {
    const { xml } = await generateTheme({ sha, write: false });
    const mutations = [
      xml.replace('</html>', '</html><extra/>'),
      xml.replace('<main id="main">', '<bad:main id="main">').replace('</main>', '</bad:main>'),
      xml.replace('<main id="main">', '<main id="main" broken>'),
      xml.replace('<main id="main">', '<main id="main"> stray < text')
    ];
    for (const mutation of mutations) expect(checkThemeContract(mutation).map((finding) => finding.ruleId)).toContain('well-formed');
  });

  it('accepts the actual generated M1 scaffold', async () => {
    const { xml } = await generateTheme({ sha, write: false });
    expect(checkThemeContract(xml)).toEqual([]);
  });
});
