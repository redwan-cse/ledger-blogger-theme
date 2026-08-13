import { readFile, writeFile } from 'node:fs/promises';
import { normalizeGoldenTheme } from './tools/golden-check.ts';

const actualPath = 'dist/theme.xml';
const goldenPath = 'tests/golden/theme.xml';

const actual = await readFile(actualPath, 'utf8');
const normalized = normalizeGoldenTheme(actual);
await writeFile(goldenPath, normalized);
console.log('Golden snapshot updated.');
