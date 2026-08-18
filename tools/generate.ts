import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compileString } from 'sass';
import { transform } from 'esbuild';

interface PugRenderer {
  renderFile(filename: string, options: Record<string, unknown>): string;
}

const pug = createRequire(import.meta.url)('pug') as PugRenderer;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_VERSION = '0.0.0';

export interface GenerateThemeOptions {
  sha: string;
  write?: boolean;
}

export interface GeneratedTheme {
  build: string;
  xml: string;
  bytes: number;
}

function fullSha(value: string): string {
  const sha = value.trim();
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('Generation requires a full 40-character git SHA.');
  return sha.toLowerCase();
}

export async function generateTheme(options: GenerateThemeOptions): Promise<GeneratedTheme> {
  const sha = fullSha(options.sha);
  const build = `${TEMPLATE_VERSION}+${sha}`;
  const [scss, scriptSource] = await Promise.all([
    readFile(path.join(ROOT, 'src/styles/main.scss'), 'utf8'),
    readFile(path.join(ROOT, 'src/scripts/main.ts'), 'utf8')
  ]);
  const css = compileString(scss, { style: 'compressed', loadPaths: [path.join(ROOT, 'src/styles')] }).css;
  const script = (await transform(scriptSource, { loader: 'ts', format: 'iife', minify: true, target: 'es2023' })).code.trim();
  const xml = pug.renderFile(path.join(ROOT, 'src/theme.pug'), {
    doctype: 'html',
    pretty: true,
    build,
    css,
    script,
    templateVersion: TEMPLATE_VERSION,
    rootAttributes: {
      'b:css': 'false',
      'b:defaultwidgetversion': '2',
      'b:layoutsVersion': '3',
      'b:responsive': 'true',
      'b:templateUrl': 'indie.xml',
      'b:templateVersion': TEMPLATE_VERSION,
      'expr:dir': 'data:blog.languageDirection',
      'expr:lang': 'data:blog.locale',
      'data-theme': 'dark',
      'xmlns': 'http://www.w3.org/1999/xhtml',
      'xmlns:b': 'http://www.google.com/2005/gml/b',
      'xmlns:data': 'http://www.google.com/2005/gml/data',
      'xmlns:expr': 'http://www.google.com/2005/gml/expr'
    }
  });
  const output = `<?xml version="1.0" encoding="UTF-8" ?>\n${xml.trim()}\n`;
  const bytes = Buffer.byteLength(output, 'utf8');
  if (bytes > 500_000) throw new Error(`Generated theme is ${bytes} bytes; budget is 500000.`);
  if (options.write !== false) {
    await mkdir(path.join(ROOT, 'dist'), { recursive: true });
    await writeFile(path.join(ROOT, 'dist/theme.xml'), output, 'utf8');
  }
  return { build, xml: output, bytes };
}

function currentSha(): string {
  return (process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })).trim();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const generated = await generateTheme({ sha: currentSha() });
  console.log(`Generated dist/theme.xml (${generated.bytes} bytes, ${generated.build}).`);
}
