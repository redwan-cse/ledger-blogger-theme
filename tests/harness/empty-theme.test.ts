import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('M0 empty-theme generator contract', () => {
  it('keeps the RED artifact outside theme source and stamps the deployed build', async () => {
    const source = await readFile(new URL('../../tools/create-empty-theme.ts', import.meta.url), 'utf8');
    expect(source).toContain("name='theme-build'");
    expect(source).toContain("version='2'");
    expect(source).toContain("<main id='main'></main>");
    expect(source).toContain("visible='false'");
    expect(source).toContain("dist/m0/empty-theme.xml");
  });
});
