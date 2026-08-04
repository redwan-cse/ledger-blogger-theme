import { expect, test as base } from '@playwright/test';
import { SerializedPacer } from '../../tools/harness/pacing.js';

const paceMs = Number.parseInt(process.env.HARNESS_PACE_MS ?? '4000', 10);
const browserPacer = new SerializedPacer(paceMs);
type PacingFixtures = { navigationPacing: void };

export const test = base.extend<PacingFixtures>({
  navigationPacing: [async ({ page }, use, testInfo) => {
    if (testInfo.project.name === 'reduced-motion') {
      await page.emulateMedia({ reducedMotion: 'reduce' });
    }
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        await browserPacer.waitForTurn();
      }
      await route.continue();
    });
    await use();
  }, { auto: true }]
});

export { expect };
