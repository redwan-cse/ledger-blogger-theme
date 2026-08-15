import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const META_THEME_BUILD = /<meta\b(?=[^>]*?\bname=['"]theme-build['"])(?=[^>]*?\bcontent=['"](?<content>[^'"]+)['"])[^>]*\/?>/gi;
export const STAMP_FORMAT = /^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\+([0-9a-f]{40}|GOLDEN_SHA_40_CHARS_{16})$/i;

export function normalizeLineEndings(text: string): string {
  const normalized = text.replace(/\r\n|\r/g, '\n');
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

export function normalizeGoldenTheme(xml: string): string {
  let normalized = normalizeLineEndings(xml);
  const regex = new RegExp(META_THEME_BUILD.source, 'gi');
  const matches = [...normalized.matchAll(regex)];
  if (matches.length !== 1) throw new Error(`Expected exactly one full theme-build stamp, found ${matches.length}.`);
  const match = matches[0]!;
  const rawTag = match[0];
  const content = match.groups?.content ?? '';
  const stampMatch = content.match(STAMP_FORMAT);
  if (!stampMatch) throw new Error(`Invalid theme-build content format: "${content}". Expected semver+sha.`);
  const version = stampMatch[1];
  const goldenContent = `${version}+GOLDEN_SHA_40_CHARS________________`;
  const replacedTag = rawTag.replace(content, goldenContent);
  normalized = normalized.replace(rawTag, () => replacedTag);
  return normalizeLineEndings(normalized);
}

export async function assertGoldenTheme(
  actualPath = path.join(ROOT, 'dist/theme.xml'),
  goldenPath = path.join(ROOT, 'tests/golden/theme.xml')
): Promise<void> {
  const [actual, golden] = await Promise.all([readFile(actualPath, 'utf8'), readFile(goldenPath, 'utf8')]);
  const normalizedActual = normalizeGoldenTheme(actual);
  const normalizedGolden = normalizeGoldenTheme(golden);

  if (normalizedActual !== normalizedGolden) {
    let line = 1;
    let col = 1;
    let offset = 0;
    const minLen = Math.min(normalizedActual.length, normalizedGolden.length);
    while (offset < minLen && normalizedActual[offset] === normalizedGolden[offset]) {
      if (normalizedActual[offset] === '\n') {
        line += 1;
        col = 1;
      } else {
        col += 1;
      }
      offset += 1;
    }
    const actualSnippet = normalizedActual.slice(Math.max(0, offset - 20), Math.min(normalizedActual.length, offset + 40)).replace(/\n/g, '\\n');
    const goldenSnippet = normalizedGolden.slice(Math.max(0, offset - 20), Math.min(normalizedGolden.length, offset + 40)).replace(/\n/g, '\\n');
    throw new Error(
      `Golden snapshot differs at byte ${offset} (line ${line}, col ${col}).\n` +
      `Expected: "${goldenSnippet}"\n` +
      `Actual:   "${actualSnippet}"\n` +
      `Regenerate and review tests/golden/theme.xml deliberately (run with --update).`
    );
  }
}

export async function updateGoldenTheme(
  actualPath = path.join(ROOT, 'dist/theme.xml'),
  goldenPath = path.join(ROOT, 'tests/golden/theme.xml')
): Promise<void> {
  const actual = await readFile(actualPath, 'utf8');
  const normalized = normalizeGoldenTheme(actual);
  await writeFile(goldenPath, normalized, 'utf8');
  console.log(`Updated golden snapshot at ${path.relative(ROOT, goldenPath)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--update')) {
    await updateGoldenTheme();
  } else {
    await assertGoldenTheme();
    console.log('PASS: generated theme matches the committed golden snapshot.');
  }
}
