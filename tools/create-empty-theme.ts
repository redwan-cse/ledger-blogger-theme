import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { renderEmptyTheme } from './empty-theme.js';

const sha = (process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })).trim();
const { build, xml } = renderEmptyTheme(sha);
await mkdir('dist/m0', { recursive: true });
await writeFile('dist/m0/empty-theme.xml', xml, 'utf8');
await writeFile('dist/m0/build.txt', `${build}\n`, 'utf8');
console.log(`Generated dist/m0/empty-theme.xml with EXPECTED_THEME_BUILD=${build}`);
