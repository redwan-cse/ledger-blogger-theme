import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function combineContempo() {
  let theme = await readFile(path.join(ROOT, 'docs/contempo/theme.xml'), 'utf8');
  
  async function injectBlock(placeholder: string, inPath: string) {
    if (!theme.includes(placeholder)) return;
    const block = await readFile(path.join(ROOT, 'docs/contempo', inPath), 'utf8');
    theme = theme.replace(placeholder, block);
  }
  
  await injectBlock('<!-- INJECT_DEFAULTMARKUPS -->', 'defaultmarkups/common.xml');
  await injectBlock('<!-- INJECT_HEADER -->', 'widgets/header.xml');
  await injectBlock('<!-- INJECT_BLOG -->', 'widgets/blog.xml');
  await injectBlock('<!-- INJECT_SKIN -->', 'skin.xml');
  await injectBlock('<!-- INJECT_TEMPLATE_SKIN -->', 'template-skin.xml');
  
  await writeFile(path.join(ROOT, 'docs/contempo-1.3.3-recombined.xml'), theme, 'utf8');
  
  const original = await readFile(path.join(ROOT, 'docs/contempo-1.3.3.xml'), 'utf8');
  if (original === theme) {
    console.log('Recombination successful: Byte-for-byte match.');
  } else {
    console.error('Recombination failed: Output does not match original.');
  }
}

combineContempo().catch(console.error);
