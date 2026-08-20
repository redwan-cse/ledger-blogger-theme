import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.STAGING_URL || 'https://blogs.redwan.work/';
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
  console.log(`[M3b Baselines] Capturing viewport boundary matrix at: ${BASE_URL}`);

  const browser = await chromium.launch({ headless: true });

  try {
    for (const vp of VIEWPORT_BOUNDARIES) {
      console.log(`\n--- Capturing Viewport: ${vp.width}x${vp.height} (${vp.name}) ---`);

      // 1. Light Mode Context
      const lightContext = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: 'light'
      });
      const lightPage = await lightContext.newPage();
      await lightPage.goto(BASE_URL, { waitUntil: 'networkidle' });
      await new Promise((r) => setTimeout(r, 1000));

      const lightHomePath = path.join(OUTPUT_DIR, `home_${vp.name}_light.png`);
      await lightPage.screenshot({ path: lightHomePath, fullPage: false });
      console.log(`  ✓ Light viewport: ${lightHomePath}`);

      // 2. Dark Mode Context
      const darkContext = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: 'dark'
      });
      const darkPage = await darkContext.newPage();
      await darkPage.goto(BASE_URL, { waitUntil: 'networkidle' });
      await new Promise((r) => setTimeout(r, 1000));

      const darkHomePath = path.join(OUTPUT_DIR, `home_${vp.name}_dark.png`);
      await darkPage.screenshot({ path: darkHomePath, fullPage: false });
      console.log(`  ✓ Dark viewport: ${darkHomePath}`);

      await lightContext.close();
      await darkContext.close();
    }

    console.log(`\n[M3b Baselines] Successfully captured all 18 baseline snapshots across 9 boundary viewports.`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[M3b Baselines] Failed:', err);
  process.exit(1);
});
