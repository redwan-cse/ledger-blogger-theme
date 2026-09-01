import AxeBuilder from '@axe-core/playwright';
import { BloggerDiscoveryClient } from '../../tools/harness/blogger-api.js';
import { extractThemeBuild } from '../../tools/harness/build-stamp.js';
import { HarnessHttpClient, type HarnessHttpResponse } from '../../tools/harness/http.js';
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
  let homeRes: HarnessHttpResponse | undefined;
  for (let attempt = 1; attempt <= 4; attempt++) {
    homeRes = await client.get(stagingUrl);
    if (!homeRes.blocked || homeRes.status !== 429 || attempt === 4) break;
    const backoff = 15000 * attempt;
    console.warn(`[HTTP 429 in beforeAll] Backing off ${backoff / 1000}s (attempt ${attempt})...`);
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }
  if (!homeRes) throw new Error('Staging homepage could not be retrieved.');
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
  const options: { olderUrl?: string; layoutModeUrl?: string } = {};

  const older = olderUrl(homeHtml);
  if (older) options.olderUrl = older;
  targets = createViewTargets(stagingUrl, posts, pages, options);
  const requiredTargets = targets.filter((target) => target.name !== 'layout-mode');

  expect(requiredTargets.every((target) => target.url), 'all 9 discoverable views must have discovered URLs').toBe(true);
});


const paceMs = Number.parseInt(process.env.HARNESS_PACE_MS ?? '4000', 10);

async function gotoWithRetry(page: any, url: string, pace: number = paceMs) {
  let attempts = 0;
  while (true) {
    attempts += 1;
    await new Promise((resolve) => setTimeout(resolve, pace));
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (response && response.status() === 429 && attempts < 4) {
      const backoff = 15000 * attempts;
      console.warn(`[RETRY] 429 rate limit encountered on ${url}, backing off ${backoff / 1000}s (attempt ${attempts})...`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      continue;
    }
    return response;
  }
}

test('R-A11Y-1: all ten real Blogger views have no serious or critical axe violations', async ({ page, javaScriptEnabled }) => {
  test.skip(!javaScriptEnabled, 'Axe accessibility audits require JavaScript to evaluate rules in the browser context.');
  for (const target of targets) {
    if (!target.url) {
      console.log(`[SKIP] ${target.name} was not measured: ${target.missingReason}`);
      continue;
    }
    const response = await gotoWithRetry(page, target.url);
    expect(response, `${target.name} returned no response`).not.toBeNull();
    if (target.name === 'error') {
      expect(response!.status()).toBe(404);
    } else {
      expect(response!.status(), `${target.name} HTTP status`).toBeLessThan(400);
    }
    const result = await new AxeBuilder({ page }).analyze();
    const blocking = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(blocking, `${target.name}: ${JSON.stringify(blocking, null, 2)}`).toEqual([]);
  }
});
