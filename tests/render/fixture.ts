import { expect, test as base } from '@playwright/test';
import { SerializedPacer } from '../../tools/harness/pacing.js';

const paceMs = Number.parseInt(process.env.HARNESS_PACE_MS ?? '4000', 10);

type PacingFixtures = {
  navigationPacing: void;
};

export const test = base.extend<PacingFixtures>({
  navigationPacing: [async ({ page }, use) => {
    const pacer = new SerializedPacer(paceMs);

    await page.route('**/*', async (route) => {
      const request = route.request();
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        await pacer.waitForTurn();
      }
      await route.continue();
    });

    await use();
  }, { auto: true }]
});

export { expect };
