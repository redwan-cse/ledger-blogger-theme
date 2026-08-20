import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { BloggerDiscoveryClient } from './harness/blogger-api.js';
import { extractThemeBuild } from './harness/build-stamp.js';
import { HarnessHttpClient } from './harness/http.js';
import { createViewTargets, type ViewTarget } from './harness/views.js';

const STAGING_URL = process.env.STAGING_URL?.trim() || 'https://blogs.redwan.work/';
const BLOG_ID = process.env.BLOGGER_BLOG_ID?.trim() || '5972841034338492159';
const EXPECTED_BUILD = process.env.EXPECTED_THEME_BUILD?.trim();
const OUTPUT_DIR = path.resolve('artifacts/baselines');

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
  const discovery = new BloggerDiscoveryClient(client, {
    ...(process.env.BLOGGER_API_KEY ? { apiKey: process.env.BLOGGER_API_KEY } : {}),
    ...(process.env.BLOGGER_ACCESS_TOKEN ? { accessToken: process.env.BLOGGER_ACCESS_TOKEN } : {})
  });

  const [posts, pages] = await Promise.all([
    discovery.listAllPosts(BLOG_ID).catch(() => []),
    discovery.listPages(BLOG_ID).catch(() => [])
  ]);

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

  console.log(`[M3b Baselines] Discovered ${viewsToCapture.length} views to baseline:`);
  for (const v of viewsToCapture) {
    console.log(`  - [${v.id}] ${v.name}: ${v.url}`);
  }

  const browser = await chromium.launch({ headless: true });
  let totalCaptured = 0;

  try {
    for (const view of viewsToCapture) {
      console.log(`\n========================================`);
      console.log(`Capturing View: ${view.name} (${view.url})`);
      console.log(`========================================`);

      for (const vp of VIEWPORT_BOUNDARIES) {
        // A. True Light Mode (Seeding localStorage & setting data-theme attribute)
        const lightContext = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: 'light'
        });
        await lightContext.addInitScript(() => {
          try {
            localStorage.setItem('theme', 'light');
          } catch {}
          document.documentElement.setAttribute('data-theme', 'light');
        });
        const lightPage = await lightContext.newPage();
        await lightPage.goto(view.url, { waitUntil: 'networkidle' });
        await lightPage.evaluate(() => {
          document.documentElement.setAttribute('data-theme', 'light');
        });
        await new Promise((r) => setTimeout(r, 600));

        const lightPath = path.join(OUTPUT_DIR, `${view.id}_${vp.name}_light.png`);
        await lightPage.screenshot({ path: lightPath, fullPage: true });
        console.log(`  ✓ [${vp.name}] Light: ${lightPath}`);
        await lightContext.close();
        totalCaptured++;

        // B. True Dark Mode (Seeding localStorage & setting data-theme attribute)
        const darkContext = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: 'dark'
        });
        await darkContext.addInitScript(() => {
          try {
            localStorage.setItem('theme', 'dark');
          } catch {}
          document.documentElement.setAttribute('data-theme', 'dark');
        });
        const darkPage = await darkContext.newPage();
        await darkPage.goto(view.url, { waitUntil: 'networkidle' });
        await darkPage.evaluate(() => {
          document.documentElement.setAttribute('data-theme', 'dark');
        });
        await new Promise((r) => setTimeout(r, 600));

        const darkPath = path.join(OUTPUT_DIR, `${view.id}_${vp.name}_dark.png`);
        await darkPage.screenshot({ path: darkPath, fullPage: true });
        console.log(`  ✓ [${vp.name}] Dark:  ${darkPath}`);
        await darkContext.close();
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
