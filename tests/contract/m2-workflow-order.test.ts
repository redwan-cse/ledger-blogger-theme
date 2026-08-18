import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('M2 live verification evidence order (#17)', () => {
  it('checks the generated artifact and public deployment stamp before OAuth and browser installation', async () => {
    const workflow = await readFile('.github/workflows/m2-staging.yml', 'utf8');
    const generate = workflow.indexOf('npm run generate');
    const deploy = workflow.indexOf('npm run deploy:check');
    const chromium = workflow.indexOf('playwright install');
    const oauth = workflow.indexOf('google-access-token.ts');
    expect(generate).toBeGreaterThan(0);
    expect(deploy).toBeGreaterThan(generate);
    expect(chromium).toBeGreaterThan(deploy);
    expect(oauth).toBeGreaterThan(chromium);
  });
});
