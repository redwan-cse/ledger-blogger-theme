import { describe, expect, it } from 'vitest';
import { checkThemeContract, contractRules } from '../../tools/contract-check.js';
import { generateTheme } from '../../tools/generate.js';

const sha = '0123456789abcdef0123456789abcdef01234567';

interface RuleCase {
  id: string;
  violate(xml: string): string;
  comment: string;
}

const cases: readonly RuleCase[] = [
  { id: 'layouts-v3', violate: (xml) => xml.replace('b:layoutsVersion="3"', 'b:layoutsVersion="2"'), comment: "b:layoutsVersion='2' is forbidden" },
  { id: 'widget-v2', violate: (xml) => xml.replace(' version="2"', ''), comment: "a widget without version='2' is forbidden" },
  { id: 'no-v2-html', violate: (xml) => xml.replace('<html ', '<html b:version="2" '), comment: "b:version='2' is the legacy format" },
  { id: 'single-cdata-skin', violate: (xml) => xml.replace('<![CDATA[', '').replace(']]>', ''), comment: 'a skin without CDATA is invalid' },
  { id: 'section-ids', violate: (xml) => xml.replace('id="mainContent"', 'id="masthead"'), comment: 'duplicate section id masthead' },
  { id: 'header-widget', violate: (xml) => xml.replace('type="Header"', 'type="HTML"'), comment: 'missing Header widget' },
  { id: 'no-v2-accessors', violate: (xml) => xml.replace('</main>', '<b:if cond="data:blog.pageType == &quot;item&quot;"></b:if></main>'), comment: 'data:blog.pageType is V2-era' },
  { id: 'no-macro-tags', violate: (xml) => xml.replace('</main>', '<macro:include name="x"/></main>'), comment: 'macro:include is banned' },
  { id: 'well-formed', violate: (xml) => xml.replace('</main>', '</section></main>'), comment: 'mismatched closing tags are invalid' },
  { id: 'declared-entities', violate: (xml) => xml.replace('</main>', '<p>&bogus;</p></main>'), comment: 'undeclared entity &bogus; is invalid' },
  { id: 'word-logical-operators', violate: (xml) => xml.replace('</main>', '<b:if cond="data:view.isPost || data:view.isPage"></b:if></main>'), comment: '|| must be written as or' },
  { id: 'documented-comparisons', violate: (xml) => xml.replace('</main>', '<b:if cond="data:posts.size gt 0"></b:if></main>'), comment: '.size and gt do not exist' },
  { id: 'data-tags-are-paths', violate: (xml) => xml.replace('</main>', '<data:post.body()></data:post.body()></main>'), comment: 'data:post.body() is a method call' },
  { id: 'url-path-operator', violate: (xml) => xml.replace('</main>', '<a expr:href="data:blog.homepageUrl + &quot;search&quot;">bad</a></main>'), comment: 'URL string + is forbidden' },
  { id: 'json-escaped', violate: (xml) => xml.replace('</head>', '<script type="application/ld+json">{"headline":"<data:post.title/>"}</script></head>'), comment: 'JSON-LD data must use .jsonEscaped' },
  { id: 'no-fabricated-metadata', violate: (xml) => xml.replace('</main>', '<p>5 min read</p></main>'), comment: '5 min read would be fabricated' },
  { id: 'build-stamp', violate: (xml) => xml.replace(/0\.0\.0\+[0-9a-f]{40}/, '0.0.0+abc123'), comment: 'abbreviated theme-build stamps are invalid' },
  { id: 'size-budget', violate: (xml) => `${xml}${'x'.repeat(200_001)}`, comment: 'output over 200000 bytes is invalid' },
  { id: 'css-disabled', violate: (xml) => xml.replace('b:css="false"', 'b:css="true"'), comment: "b:css='false' is required" }
];

describe('V3 contract checker', () => {
  it('covers every registered rule with a paired violation case', () => {
    expect(cases.map((item) => item.id).sort()).toEqual(contractRules.map((rule) => rule.id).sort());
  });

  for (const testCase of cases) {
    it(`${testCase.id}: flags a real violation and ignores a comment describing it`, async () => {
      const { xml } = await generateTheme({ sha, write: false });
      const violated = testCase.violate(xml);
      expect(violated).not.toBe(xml);
      expect(checkThemeContract(violated).map((finding) => finding.ruleId)).toContain(testCase.id);

      const withComment = xml.replace('</body>', `<!-- ${testCase.comment.replace(/--/g, '—')} --></body>`);
      expect(checkThemeContract(withComment).map((finding) => finding.ruleId)).not.toContain(testCase.id);
    });
  }

  it('accepts the actual generated M1 scaffold', async () => {
    const { xml } = await generateTheme({ sha, write: false });
    expect(checkThemeContract(xml)).toEqual([]);
  });
});
