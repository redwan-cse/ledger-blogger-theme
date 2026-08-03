import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ContractFinding {
  ruleId: string;
  requirementId: string;
  message: string;
}

export interface ContractRule {
  id: string;
  requirementId: string;
  message: string;
  check(xml: string): boolean;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const namedEntities = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

function withoutComments(xml: string): string {
  return xml
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<b:comment\b[^>]*>[\s\S]*?<\/b:comment>/gi, '');
}

function withoutCommentsOrCdata(xml: string): string {
  return withoutComments(xml).replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
}

function htmlTag(xml: string): string {
  return withoutComments(xml).match(/<html\b[^>]*>/i)?.[0] ?? '';
}

function startTags(xml: string, name: string): string[] {
  return withoutComments(xml).match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

function attribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(['"])(.*?)\\1`, 'i'))?.[2] ?? null;
}

function expressionAttributes(xml: string): string[] {
  const source = withoutCommentsOrCdata(xml);
  return [...source.matchAll(/\b(?:cond|expr:[\w-]+)\s*=\s*(['"])(.*?)\1/gi)].map((match) => match[2] ?? '');
}

function isWellFormed(xml: string): boolean {
  const source = withoutComments(xml)
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  const stack: string[] = [];
  for (const match of source.matchAll(/<\s*(\/)?\s*([A-Za-z_][\w:.-]*)\b[^>]*?(\/)?\s*>/g)) {
    const closing = Boolean(match[1]);
    const name = match[2]?.toLowerCase();
    const selfClosing = Boolean(match[3]);
    if (!name) return false;
    if (closing) {
      if (stack.pop() !== name) return false;
    } else if (!selfClosing && !['meta', 'link', 'img', 'input', 'br', 'hr'].includes(name)) {
      stack.push(name);
    }
  }
  return stack.length === 0;
}

function hasOnlyDeclaredEntities(xml: string): boolean {
  const source = withoutCommentsOrCdata(xml);
  for (const match of source.matchAll(/&(#x?[0-9a-f]+|[A-Za-z][\w.-]*);/gi)) {
    const entity = match[1] ?? '';
    if (!entity.startsWith('#') && !namedEntities.has(entity)) return false;
  }
  return !/(^|[^&])&(?!#x?[0-9a-f]+;|(?:amp|lt|gt|quot|apos);)/i.test(source);
}

function jsonLdIsEscaped(xml: string): boolean {
  const blocks = withoutComments(xml).match(/<script\b[^>]*type=(['"])application\/ld\+json\1[^>]*>[\s\S]*?<\/script>/gi) ?? [];
  return blocks.every((block) => {
    const tags = block.match(/<data:[^>]+\/>|<b:eval\b[^>]*>/gi) ?? [];
    return tags.every((tag) => /\.jsonEscaped\b/i.test(tag));
  });
}

export const contractRules: readonly ContractRule[] = [
  { id: 'layouts-v3', requirementId: 'R-V3-1 AC1', message: "<html> must carry b:layoutsVersion='3'.", check: (xml) => attribute(htmlTag(xml), 'b:layoutsVersion') === '3' },
  { id: 'widget-v2', requirementId: 'R-V3-1 AC2', message: "Every b:widget must carry version='2'.", check: (xml) => { const widgets = startTags(xml, 'b:widget'); return widgets.length > 0 && widgets.every((tag) => attribute(tag, 'version') === '2'); } },
  { id: 'no-v2-html', requirementId: 'R-V3-1 AC3', message: "<html> must not carry b:version or class='v2'.", check: (xml) => { const tag = htmlTag(xml); return attribute(tag, 'b:version') === null && attribute(tag, 'class') !== 'v2'; } },
  { id: 'single-cdata-skin', requirementId: 'R-V3-1 AC4', message: 'Theme must contain exactly one b:skin with CDATA.', check: (xml) => { const skins = withoutComments(xml).match(/<b:skin\b[^>]*>[\s\S]*?<\/b:skin>/gi) ?? []; return skins.length === 1 && /<!\[CDATA\[[\s\S]*\]\]>/.test(skins[0] ?? ''); } },
  { id: 'section-ids', requirementId: 'R-V3-1 AC5', message: 'Section IDs must be unique and alphanumeric.', check: (xml) => { const ids = startTags(xml, 'b:section').map((tag) => attribute(tag, 'id')); return ids.length > 0 && ids.every((id) => id !== null && /^[A-Za-z][A-Za-z0-9]*$/.test(id)) && new Set(ids).size === ids.length; } },
  { id: 'header-widget', requirementId: 'R-V3-1 AC6', message: 'Theme must declare a Header widget.', check: (xml) => startTags(xml, 'b:widget').some((tag) => attribute(tag, 'type') === 'Header') },
  { id: 'no-v2-accessors', requirementId: 'R-V3-1 AC7', message: 'Banned V2-era data accessors are not allowed.', check: (xml) => !/data:blog\.(?:pageType|searchLabel|searchQuery)|data:post\.dateHeader/i.test(withoutCommentsOrCdata(xml)) },
  { id: 'no-macro-tags', requirementId: 'R-V3-1 AC8', message: 'macro:* tags are not allowed.', check: (xml) => !/<\/?macro:/i.test(withoutCommentsOrCdata(xml)) },
  { id: 'well-formed', requirementId: 'R-V3-1 AC9', message: 'Generated output must be well-formed XML.', check: isWellFormed },
  { id: 'declared-entities', requirementId: 'R-BUILD-1 AC6', message: 'Undeclared XML entities are not allowed outside CDATA.', check: hasOnlyDeclaredEntities },
  { id: 'word-logical-operators', requirementId: 'R-V3-2 AC1', message: 'Expressions must use and/or, never && or ||.', check: (xml) => expressionAttributes(xml).every((value) => !/&&|\|\|/.test(value)) },
  { id: 'documented-comparisons', requirementId: 'R-V3-2 AC2', message: 'Expressions must not use .size or gt/lt/gte/lte.', check: (xml) => expressionAttributes(xml).every((value) => !/\.size\b|\b(?:gt|lt|gte|lte)\b/i.test(value)) },
  { id: 'data-tags-are-paths', requirementId: 'R-V3-2 AC3', message: 'data:* tags must be property paths, not method calls.', check: (xml) => !(withoutCommentsOrCdata(xml).match(/<data:[^>]*>/gi) ?? []).some((tag) => /[()]/.test(tag)) },
  { id: 'url-path-operator', requirementId: 'R-V3-2 AC4', message: 'URL expressions must use path, never string +.', check: (xml) => { const source = withoutCommentsOrCdata(xml); const values = [...source.matchAll(/\bexpr:(?:href|src|action)\s*=\s*(['"])(.*?)\1/gi)].map((match) => match[2] ?? ''); return values.every((value) => !/\+/.test(value)); } },
  { id: 'json-escaped', requirementId: 'R-V3-2 AC5', message: 'Every JSON-LD interpolation must end in .jsonEscaped.', check: jsonLdIsEscaped },
  { id: 'no-fabricated-metadata', requirementId: 'R-BUILD-1 AC7', message: 'Fabricated reading times, authors, or blank Gravatar fallbacks are not allowed.', check: (xml) => !/\b\d+\s+min(?:ute)?s?\s+read\b|gravatar\.com\/avatar|data:post\.author[^<]*\?:\s*['"][^'"]+/i.test(withoutCommentsOrCdata(xml)) },
  { id: 'build-stamp', requirementId: 'R-BUILD-2 AC1', message: 'Theme must contain a full-SHA theme-build meta stamp.', check: (xml) => /<meta\b(?=[^>]*\bname=(['"])theme-build\1)(?=[^>]*\bcontent=(['"])[^'"]+\+[0-9a-f]{40}\2)[^>]*>/i.test(withoutComments(xml)) },
  { id: 'size-budget', requirementId: 'R-PERF-1 AC4', message: 'Generated theme must not exceed 200000 bytes.', check: (xml) => Buffer.byteLength(xml, 'utf8') <= 200_000 },
  { id: 'css-disabled', requirementId: 'R-PERF-1 AC7', message: "<html> must carry b:css='false'.", check: (xml) => attribute(htmlTag(xml), 'b:css') === 'false' }
];

export function checkThemeContract(xml: string): ContractFinding[] {
  return contractRules
    .filter((rule) => !rule.check(xml))
    .map((rule) => ({ ruleId: rule.id, requirementId: rule.requirementId, message: rule.message }));
}

export function assertThemeContract(xml: string): void {
  const findings = checkThemeContract(xml);
  if (findings.length > 0) {
    throw new Error(findings.map((finding) => `[${finding.requirementId}] ${finding.ruleId}: ${finding.message}`).join('\n'));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const filename = path.resolve(process.argv[2] ?? path.join(ROOT, 'dist/theme.xml'));
  assertThemeContract(await readFile(filename, 'utf8'));
  console.log(`PASS: ${contractRules.length} V3 contract rules verified.`);
}
