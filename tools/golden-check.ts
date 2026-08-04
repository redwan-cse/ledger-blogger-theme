import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAMP = /(?<=content=["'])0\.0\.0\+[0-9a-f]{40}(?=["']\s+name=["']theme-build["'])/i;

export function normalizeGoldenTheme(xml: string): string {
  const matches = xml.match(new RegExp(STAMP.source, 'gi')) ?? [];
  if (matches.length !== 1) throw new Error(`Expected exactly one full theme-build stamp, found ${matches.length}.`);
  return xml.replace(STAMP, '0.0.0+GOLDEN_SHA_40_CHARS________________');
}

export async function assertGoldenTheme(
  actualPath = path.join(ROOT, 'dist/theme.xml'),
  goldenPath = path.join(ROOT, 'tests/golden/theme.xml')
): Promise<void> {
  const [actual, golden] = await Promise.all([readFile(actualPath, 'utf8'), readFile(goldenPath, 'utf8')]);
  const normalized = normalizeGoldenTheme(actual);
  if (normalized !== golden) {
    let offset = 0;
    while (offset < normalized.length && normalized[offset] === golden[offset]) offset += 1;
    throw new Error(`Golden snapshot differs at byte ${offset}. Regenerate and review tests/golden/theme.xml deliberately.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await assertGoldenTheme();
  console.log('PASS: generated theme matches the committed golden snapshot.');
}
