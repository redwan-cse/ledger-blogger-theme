import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateTheme } from './generate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTEMPO = path.join(ROOT, 'docs/contempo-1.3.3.xml');
const OUT = path.join(ROOT, 'dist/controls');

export function getWidgetPattern(widgetId: string): RegExp {
  const escapedId = widgetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<b:widget\\b(?=[^>]*?\\bid=['"]${escapedId}['"])[^>]*?>[\\s\\S]*?<\\/b:widget>`, 'i');
}

export function extractWidget(xml: string, widgetId: string): string {
  const pattern = getWidgetPattern(widgetId);
  const match = xml.match(pattern);
  if (!match) throw new Error(`Could not locate ${widgetId} widget.`);
  return match[0];
}

export function replaceWidget(xml: string, widgetId: string, replacement: string): string {
  const pattern = getWidgetPattern(widgetId);
  if (!pattern.test(xml)) throw new Error(`Could not locate ${widgetId} widget for replacement.`);
  return xml.replace(pattern, () => replacement);
}

function stamp(xml: string, build: string): string {
  if (xml.includes("name='theme-build'") || xml.includes('name="theme-build"')) return xml;
  return xml.replace('<head>', `<head>\n<meta content='${build}' name='theme-build'/>`);
}

export async function buildControls(sha: string): Promise<string[]> {
  const ours = await generateTheme({ sha, write: false });
  const contempo = await readFile(CONTEMPO, 'utf8');
  const contempoBlog = extractWidget(contempo, 'Blog1');
  const ourBlog = extractWidget(ours.xml, 'Blog1');

  const controlA = stamp(replaceWidget(contempo, 'Blog1', ourBlog), ours.build);
  const controlB = stamp(replaceWidget(ours.xml, 'Blog1', contempoBlog), ours.build);

  await mkdir(OUT, { recursive: true });
  const written: string[] = [];
  for (const [name, xml] of [['control-a-contempo-shell-our-blog.xml', controlA], ['control-b-our-shell-contempo-blog.xml', controlB]] as const) {
    const file = path.join(OUT, name);
    await writeFile(file, xml, 'utf8');
    written.push(file);
  }
  return written;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { execFileSync } = await import('node:child_process');
  const sha = (process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })).trim();
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('GITHUB_SHA with a full 40-character SHA is required.');
  const files = await buildControls(sha);
  for (const file of files) console.log(`Wrote ${path.relative(ROOT, file)}`);
}
