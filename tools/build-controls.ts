import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateTheme } from './generate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTEMPO = path.join(ROOT, 'docs/contempo-1.3.3.xml');
const OUT = path.join(ROOT, 'dist/controls');

const BLOG_WIDGET = /<b:widget id='Blog1'[\s\S]*?<\/b:widget>/;
const OUR_BLOG_WIDGET = /<b:widget id="Blog1"[\s\S]*?<\/b:widget>/;

function requireMatch(source: string, pattern: RegExp, label: string): string {
  const match = source.match(pattern);
  if (!match) throw new Error(`Could not locate ${label}.`);
  return match[0];
}

function stamp(xml: string, build: string): string {
  if (xml.includes("name='theme-build'") || xml.includes('name="theme-build"')) return xml;
  return xml.replace('<head>', `<head>\n<meta content='${build}' name='theme-build'/>`);
}

export async function buildControls(sha: string): Promise<string[]> {
  const ours = await generateTheme({ sha, write: false });
  const contempo = await readFile(CONTEMPO, 'utf8');
  const contempoBlog = requireMatch(contempo, BLOG_WIDGET, "Contempo's Blog1 widget");
  const ourBlog = requireMatch(ours.xml, OUR_BLOG_WIDGET, 'our Blog1 widget');

  const controlA = stamp(contempo.replace(BLOG_WIDGET, ourBlog), ours.build);
  const controlB = stamp(ours.xml.replace(OUR_BLOG_WIDGET, contempoBlog), ours.build);

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
  const sha = (process.env.GITHUB_SHA ?? '').trim();
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('GITHUB_SHA with a full 40-character SHA is required.');
  const files = await buildControls(sha);
  for (const file of files) console.log(`Wrote ${path.relative(ROOT, file)}`);
}
