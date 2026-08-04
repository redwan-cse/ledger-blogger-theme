import { extractThemeBuild } from '../../tools/harness/build-stamp.js';
import { test, expect } from './fixture.js';

const stagingUrl = process.env.STAGING_URL?.trim();
const expectedBuild = process.env.EXPECTED_THEME_BUILD?.trim();

if (!stagingUrl || !expectedBuild) {
  throw new Error('STAGING_URL and EXPECTED_THEME_BUILD are required for M2 browser verification.');
}

const views = [
  ['home-p1', stagingUrl],
  ['home-p2', process.env.HOME_P2_URL],
  ['label', process.env.LABEL_URL],
  ['search', process.env.SEARCH_URL],
  ['archive', process.env.ARCHIVE_URL],
  ['post', process.env.POST_URL],
  ['static-page', process.env.STATIC_PAGE_URL],
  ['empty-result', process.env.EMPTY_RESULT_URL],
  ['error', process.env.ERROR_URL],
  ['layout-mode', process.env.LAYOUT_MODE_URL]
] as const;

test.beforeAll(async ({ request }) => {
  const response = await request.get(stagingUrl);
  expect(response.status(), 'staging homepage must be measurable').toBeLessThan(400);
  expect(extractThemeBuild(await response.text()), 'browser assertions must target the current build').toBe(expectedBuild);
});

for (const [name, url] of views) {
  test(`${name} renders visible server content`, async ({ page }) => {
    test.skip(!url, `${name} URL was not configured.`);
    const response = await page.goto(url!);
    expect(response, `${name} returned no navigation response`).not.toBeNull();
    if (name === 'error') expect(response!.status()).toBe(404);
    else expect(response!.status()).toBeLessThan(400);
    const main = page.locator('main');
    await expect(main).toBeVisible();
    expect((await main.innerText()).replace(/\s+/g, ' ').trim().length).toBeGreaterThanOrEqual(40);
    await expect(page.locator('.post-lead, .post-row, .article-body, .empty-state').first()).toBeVisible();
  });
}

test('static pages omit post-only chrome', async ({ page }) => {
  test.skip(!process.env.STATIC_PAGE_URL, 'STATIC_PAGE_URL was not configured.');
  await page.goto(process.env.STATIC_PAGE_URL!);
  await expect(page.locator('.share-bar, .author-bio, .related, .reading-progress')).toHaveCount(0);
});

test('post pages contain the complete structural path', async ({ page }) => {
  test.skip(!process.env.POST_URL, 'POST_URL was not configured.');
  await page.goto(process.env.POST_URL!);
  await expect(page.locator('.article-body')).toBeVisible();
  await expect(page.locator('.share-bar')).toHaveCount(1);
  await expect(page.locator('.author-bio')).toHaveCount(1);
  await expect(page.locator('.related')).toHaveCount(1);
  await expect(page.locator('.reading-progress')).toHaveCount(1);
});
