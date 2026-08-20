import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { BloggerDiscoveryClient } from './harness/blogger-api.js';
import { extractThemeBuild } from './harness/build-stamp.js';
import { HarnessHttpClient } from './harness/http.js';
import { createViewTargets } from './harness/views.js';

const STAGING_URL = process.env.STAGING_URL?.trim() || 'https://blogs.redwan.work/';
const BLOG_ID = process.env.BLOGGER_BLOG_ID?.trim() || '5972841034338492159';
const EXPECTED_BUILD = process.env.EXPECTED_THEME_BUILD?.trim();
const OUTPUT_DIR = path.resolve('artifacts/baselines');
const PACE_MS = Number.parseInt(process.env.HARNESS_PACE_MS ?? '4000', 10);

const VIEWPORT_BOUNDARIES = [
  { width: 375, height: 667, name: '375_mobile_small' },
  { width: 639, height: 800, name: '639_mobile_boundary_max' },
  { width: 640, height: 800, name: '640_tablet_boundary_min' },
  { width: 767, height: 900, name: '767_tablet_boundary_mid' },
  { width: 768, height: 900, name: '768_sidebar_boundary_min' },
  { width: 1023, height: 900, name: '1023_tablet_boundary_max' },
  { width: 1024, height: 900, name: '1024_desktop_12col_min' },
  { width: 1280, height: 900, name: '1280_desktop_standard' },
  { width: 1440, height: 900, name: '1440_desktop_wide' }
];

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`[M3b Baselines] Initializing baseline capture for: ${STAGING_URL}`);
  console.log(`[M3b Baselines] Rate-limit pacing: ${PACE_MS}ms between page loads`);

  // 1. Build Stamp Provenance Check
  const client = new HarnessHttpClient();
  const homeRes = await client.get(STAGING_URL);
  if (homeRes.status >= 400) {
    throw new Error(`[M3b Baselines] Cannot reach staging URL: ${STAGING_URL} (status ${homeRes.status})`);
  }
  const deployedStamp = extractThemeBuild(homeRes.body);
  console.log(`[M3b Baselines] Live deployed theme build stamp: ${deployedStamp}`);

  if (EXPECTED_BUILD && deployedStamp !== EXPECTED_BUILD) {
    throw new Error(`[M3b Baselines] STALE / PROVENANCE MISMATCH: Expected '${EXPECTED_BUILD}', but live blog serves '${deployedStamp}'. Upload the expected build before baselining.`);
  }

  // 2. Discover Target Views
  let posts: readonly any[] = [];
  let pages: readonly any[] = [];

  if (process.env.BLOGGER_API_KEY || process.env.BLOGGER_ACCESS_TOKEN) {
    console.log(`[M3b Baselines] Target discovery source: BLOGGER_API (Authenticated discovery)`);
    const discovery = new BloggerDiscoveryClient(client, {
      ...(process.env.BLOGGER_API_KEY ? { apiKey: process.env.BLOGGER_API_KEY } : {}),
      ...(process.env.BLOGGER_ACCESS_TOKEN ? { accessToken: process.env.BLOGGER_ACCESS_TOKEN } : {})
    });
    [posts, pages] = await Promise.all([
      discovery.listAllPosts(BLOG_ID).catch(() => []),
      discovery.listPages(BLOG_ID).catch(() => [])
    ]);
  } else {
    console.log(`[M3b Baselines] Target discovery source: HTML_SCRAPED (No Blogger API credentials in environment)`);
    // Scrape from rendered homepage HTML without invented values
    const postMatches = [...homeRes.body.matchAll(/<a\b[^>]*href=["']([^"']*\/(\d{4})\/(\d{2})\/[^"']*\.html)["']/g)];
    if (postMatches.length > 0) {
      posts = postMatches.map((m, i) => {
        const year = m[2] ?? '2026';
        const month = m[3] ?? '08';
        return {
          id: `scraped-post-${i}`,
          title: `Discovered Post ${i + 1}`,
          published: `${year}-${month}-01T00:00:00Z`,
          url: m[1],
          labels: []
        };
      });
    }
    const labelMatch = homeRes.body.match(/<a\b[^>]*href=["']([^"']*\/search\/label\/[^"']*)["']/);
    if (labelMatch && posts.length > 0) {
      const labelText = decodeURIComponent(labelMatch[1]?.split('/search/label/')[1]?.split('?')[0] ?? '');
      if (labelText) {
        posts = [{ ...posts[0], labels: [labelText] }, ...posts.slice(1)];
      }
    }
  }

  const targets = createViewTargets(STAGING_URL, posts, pages);
  const viewsToCapture: Array<{ id: string; name: string; url: string }> = [];

  const homeTarget = targets.find((t) => t.name === 'home-p1');
  if (homeTarget?.url) viewsToCapture.push({ id: 'home', name: 'Homepage (Page 1)', url: homeTarget.url });

  const postTarget = targets.find((t) => t.name === 'post');
  if (postTarget?.url) viewsToCapture.push({ id: 'post', name: 'Article / Single Post', url: postTarget.url });

  const labelTarget = targets.find((t) => t.name === 'label');
  if (labelTarget?.url) viewsToCapture.push({ id: 'label', name: 'Label Search View', url: labelTarget.url });

  const emptyTarget = targets.find((t) => t.name === 'empty-result');
  if (emptyTarget?.url) viewsToCapture.push({ id: 'empty', name: 'Empty Search View', url: emptyTarget.url });

  const errorTarget = targets.find((t) => t.name === 'error');
  if (errorTarget?.url) viewsToCapture.push({ id: 'error', name: '404 Error State', url: errorTarget.url });

  console.log(`[M3b Baselines] Configured ${viewsToCapture.length} views across ${VIEWPORT_BOUNDARIES.length} viewports (Total: ${viewsToCapture.length * VIEWPORT_BOUNDARIES.length * 2} snapshots):`);
  for (const v of viewsToCapture) {
    console.log(`  - [${v.id}] ${v.name}: ${v.url}`);
  }

  const browser = await chromium.launch({ headless: true });
  let totalCaptured = 0;

  async function capturePage(url: string, vp: typeof VIEWPORT_BOUNDARIES[number], mode: 'light' | 'dark', outPath: string): Promise<void> {
    await new Promise((r) => setTimeout(r, PACE_MS)); // Strict rate-limit pacing

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: mode
    });

    // Seed exact theme storage keys in browser context before DOM initialization
    await context.addInitScript((themeMode) => {
      try {
        localStorage.setItem('ledger_theme', themeMode);
        localStorage.setItem('theme', themeMode);
      } catch {}
      document.documentElement.setAttribute('data-theme', themeMode);
    }, mode);

    const page = await context.newPage();

    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    if (!response) {
      throw new Error(`[M3b Baselines] BLOCKED: Navigation returned null response for ${url} at ${vp.name}`);
    }

    // Explicitly verify and assert active theme mode before capturing
    const actualTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    if (actualTheme !== mode) {
      throw new Error(`[M3b Baselines] THEME ASSERTION FAILED: Expected data-theme='${mode}', but DOM has '${actualTheme}'. Capture aborted to prevent mislabeled evidence.`);
    }

    await page.screenshot({ path: outPath, fullPage: true });
    await context.close();
  }

  try {
    for (const view of viewsToCapture) {
      console.log(`\n========================================`);
      console.log(`Capturing View: ${view.name} (${view.url})`);
      console.log(`========================================`);

      for (const vp of VIEWPORT_BOUNDARIES) {
        // A. True Light Mode
        const lightPath = path.join(OUTPUT_DIR, `${view.id}_${vp.name}_light.png`);
        await capturePage(view.url, vp, 'light', lightPath);
        console.log(`  ✓ [${vp.name}] Light: ${lightPath}`);
        totalCaptured++;

        // B. True Dark Mode
        const darkPath = path.join(OUTPUT_DIR, `${view.id}_${vp.name}_dark.png`);
        await capturePage(view.url, vp, 'dark', darkPath);
        console.log(`  ✓ [${vp.name}] Dark:  ${darkPath}`);
        totalCaptured++;
      }
    }

    console.log(`\n[M3b Baselines] Complete: Successfully captured ${totalCaptured} full-page baseline snapshots across ${viewsToCapture.length} views and 9 breakpoint boundaries.`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[M3b Baselines] Execution failed:', err);
  process.exit(1);
});
