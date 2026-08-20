import AxeBuilder from '@axe-core/playwright';
import { BloggerDiscoveryClient } from '../../tools/harness/blogger-api.js';
import { extractThemeBuild } from '../../tools/harness/build-stamp.js';
import { HarnessHttpClient } from '../../tools/harness/http.js';
import { createViewTargets, type ViewTarget } from '../../tools/harness/views.js';
import { test, expect } from './fixture.js';

function required(name: 'STAGING_URL' | 'EXPECTED_THEME_BUILD' | 'BLOGGER_BLOG_ID'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for conclusive accessibility verification.`);
  return value;
}

function olderUrl(html: string): string | undefined {
  return html.match(/<a\b[^>]*(?:id=(['"])Blog1_blog-pager-older-link\1|class=(['"])[^'"]*(?:blog-pager-older-link|older-link)[^'"]*\2)[^>]*href=(['"])(.*?)\3/i)?.[4];
}

let targets: ViewTarget[] = [];

test.beforeAll(async () => {
  const stagingUrl = required('STAGING_URL');
  const client = new HarnessHttpClient();
  const homeRes = await client.get(stagingUrl);
  expect(homeRes.status).toBeLessThan(400);
  const homeHtml = homeRes.body;
  expect(extractThemeBuild(homeHtml)).toBe(required('EXPECTED_THEME_BUILD'));


  const discovery = new BloggerDiscoveryClient(client, {
    ...(process.env.BLOGGER_API_KEY ? { apiKey: process.env.BLOGGER_API_KEY } : {}),
    ...(process.env.BLOGGER_ACCESS_TOKEN ? { accessToken: process.env.BLOGGER_ACCESS_TOKEN } : {})
  });
  const [posts, pages] = await Promise.all([
    discovery.listAllPosts(required('BLOGGER_BLOG_ID')),
    discovery.listPages(required('BLOGGER_BLOG_ID'))
  ]);
  const layoutModeUrl = process.env.LAYOUT_MODE_URL?.trim();
  const options: { olderUrl?: string; layoutModeUrl?: string } = {};
  if (layoutModeUrl) options.layoutModeUrl = layoutModeUrl;
  const older = olderUrl(homeHtml);
  if (older) options.olderUrl = older;
  targets = createViewTargets(stagingUrl, posts, pages, options);
  const requiredTargets = targets.filter((target) => target.name !== 'layout-mode');
  expect(requiredTargets.every((target) => target.url), 'all 9 discoverable views must have discovered URLs').toBe(true);
});


test('R-A11Y-1: all ten real Blogger views have no serious or critical axe violations', async ({ page, javaScriptEnabled }) => {
  test.skip(!javaScriptEnabled, 'Axe accessibility audits require JavaScript to evaluate rules in the browser context.');
  for (const target of targets) {
    if (!target.url) {
      console.log(`[SKIP] ${target.name} was not measured: ${target.missingReason}`);
      continue;
    }
    await page.goto(target.url);
    const result = await new AxeBuilder({ page }).analyze();
    const blocking = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(blocking, `${target.name}: ${JSON.stringify(blocking, null, 2)}`).toEqual([]);
  }
});

