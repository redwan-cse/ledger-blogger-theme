import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('GitHub OAuth token helper contract', () => {
  it('uses the refresh-token grant and masks the access token before exporting it', async () => {
    const source = await readFile(new URL('../../tools/google-access-token.ts', import.meta.url), 'utf8');
    expect(source).toContain("grant_type: 'refresh_token'");
    expect(source).toContain('https://oauth2.googleapis.com/token');
    expect(source).toContain('::add-mask::');
    expect(source.indexOf('::add-mask::')).toBeLessThan(source.indexOf('appendFile(githubEnv'));
    expect(source).not.toContain('console.log(payload');
  });
});
