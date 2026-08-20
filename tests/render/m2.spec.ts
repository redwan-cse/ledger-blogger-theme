import { BloggerDiscoveryClient } from '../../tools/harness/blogger-api.js';
import { extractThemeBuild } from '../../tools/harness/build-stamp.js';
import { HarnessHttpClient } from '../../tools/harness/http.js';
import { createViewTargets, type ViewTarget } from '../../tools/harness/views.js';
import { test, expect } from './fixture.js';

function required(name: 'STAGING_URL' | 'EXPECTED_THEME_BUILD' | 'BLOGGER_BLOG_ID'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for conclusive M2 browser verification.`);
  return value;
}
function olderUrl(html: string): string | undefined {
  return html.match(/<a\b[^>]*(?:id=(['"])Blog1_blog-pager-older-link\1|class=(['"])[^'"]*(?:blog-pager-older-link|older-link)[^'"]*\2)[^>]*href=(['"])(.*?)\3/i)?.[4];
}
let targets: ViewTarget[] = [];

test.beforeAll(async () => {
  const stagingUrl = required('STAGING_URL');
  const expectedBuild = required('EXPECTED_THEME_BUILD');
  const client = new HarnessHttpClient();
  const homeRes = await client.get(stagingUrl);
  expect(homeRes.status, 'staging homepage must be measurable').toBeLessThan(400);
  const homeHtml = homeRes.body;
  expect(extractThemeBuild(homeHtml), 'browser assertions must target the current build').toBe(expectedBuild);


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


test('all ten views render visible server content', async ({ page }) => {
  for (const target of targets) {
    if (!target.url) {
      console.log(`[SKIP] ${target.name} was not measured: ${target.missingReason}`);
      continue;
    }
    const response = await page.goto(target.url);
    expect(response, `${target.name} returned no navigation response`).not.toBeNull();
    if (target.name === 'error') expect(response!.status()).toBe(404);
    else expect(response!.status(), target.name).toBeLessThan(400);
    const main = page.locator('main');
    await expect(main, target.name).toBeVisible();
    expect((await main.innerText()).replace(/\s+/g, ' ').trim().length, target.name).toBeGreaterThanOrEqual(40);
    await expect(page.locator('.post, .post-body, .empty-state').first(), target.name).toBeVisible();
  }
});

test('static pages omit post-only chrome', async ({ page }) => {
  const target = targets.find((item) => item.name === 'static-page');
  if (!target?.url) {
    console.log('[SKIP] static page target was not discovered.');
    return;
  }
  await page.goto(target.url);
  await expect(page.locator('.share-bar, .author-bio, .post-navigation, .reading-progress')).toHaveCount(0);
});

test('post pages contain the shipped post-only structural path', async ({ page }) => {
  const target = targets.find((item) => item.name === 'post');
  if (!target?.url) {
    console.log('[SKIP] post page target was not discovered.');
    return;
  }
  await page.goto(target.url);
  await expect(page.locator('.post-body')).toBeVisible();
  await expect(page.locator('.share-bar')).toHaveCount(1);
  await expect(page.locator('.author-bio')).toHaveCount(1);
  await expect(page.locator('.post-navigation')).toHaveCount(1);
  await expect(page.locator('.reading-progress')).toHaveCount(1);
});
