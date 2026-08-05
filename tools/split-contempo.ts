import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function splitContempo() {
  const xml = await readFile(path.join(ROOT, 'docs/contempo-1.3.3.xml'), 'utf8');
  await mkdir(path.join(ROOT, 'docs/contempo'), { recursive: true });
  await mkdir(path.join(ROOT, 'docs/contempo/widgets'), { recursive: true });
  await mkdir(path.join(ROOT, 'docs/contempo/defaultmarkups'), { recursive: true });
  
  let remainder = xml;
  
  function extractBlock(startMarker: string, endMarker: string, outPath: string, placeholder: string) {
    const startIndex = remainder.indexOf(startMarker);
    if (startIndex === -1) return;
    const endIndex = remainder.indexOf(endMarker, startIndex) + endMarker.length;
    
    const block = remainder.slice(startIndex, endIndex);
    remainder = remainder.slice(0, startIndex) + placeholder + remainder.slice(endIndex);
    
    return writeFile(path.join(ROOT, 'docs/contempo', outPath), block, 'utf8');
  }
  
  await extractBlock(
    '<b:defaultmarkups>',
    '</b:defaultmarkups>',
    'defaultmarkups/common.xml',
    '<!-- INJECT_DEFAULTMARKUPS -->'
  );
  
  await extractBlock(
    "<b:widget id='Header1'",
    "</b:widget>",
    'widgets/header.xml',
    '<!-- INJECT_HEADER -->'
  );
  
  await extractBlock(
    "<b:widget id='Blog1'",
    "</b:widget>",
    'widgets/blog.xml',
    '<!-- INJECT_BLOG -->'
  );

  await extractBlock(
    "<b:skin version='1.3.3'><![CDATA[",
    "]]></b:skin>",
    'skin.xml',
    '<!-- INJECT_SKIN -->'
  );

  await extractBlock(
    "<b:template-skin>",
    "</b:template-skin>",
    'template-skin.xml',
    '<!-- INJECT_TEMPLATE_SKIN -->'
  );
  
  await writeFile(path.join(ROOT, 'docs/contempo/theme.xml'), remainder, 'utf8');
  console.log('Split complete.');
}

splitContempo().catch(console.error);
