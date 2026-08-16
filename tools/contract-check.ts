import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ContractFinding { ruleId: string; requirementId: string; message: string }
export interface ContractRule { id: string; requirementId: string; message: string; check(document: XmlDocument, xml: string): boolean }
type XmlChild = XmlElement | XmlText | XmlCdata | XmlComment;
interface XmlText { kind: 'text'; value: string }
interface XmlCdata { kind: 'cdata'; value: string }
interface XmlComment { kind: 'comment'; value: string }
interface XmlElement { kind: 'element'; name: string; prefix: string | null; localName: string; namespaceUri: string | null; attributes: Map<string, string>; children: XmlChild[]; parent: XmlElement | null; selfClosing: boolean }
interface XmlDocument { root: XmlElement; elements: XmlElement[] }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const BLOGGER_NS = 'http://www.google.com/2005/gml/b';
const NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const LEGAL_XML_CODEPOINT = (value: number): boolean => value === 0x9 || value === 0xa || value === 0xd || (value >= 0x20 && value <= 0xd7ff) || (value >= 0xe000 && value <= 0xfffd) || (value >= 0x10000 && value <= 0x10ffff);
class XmlSyntaxError extends Error {}
function assertLegalCharacters(value: string): void { for (const char of value) if (!LEGAL_XML_CODEPOINT(char.codePointAt(0) ?? 0)) throw new XmlSyntaxError('Illegal XML character.'); }
function splitName(name: string): { prefix: string | null; localName: string } { const parts = name.split(':'); if (parts.length > 2 || parts.some((part) => !part)) throw new XmlSyntaxError(`Invalid qualified name ${name}.`); return parts.length === 2 ? { prefix: parts[0] ?? null, localName: parts[1] ?? '' } : { prefix: null, localName: name }; }
function decodeEntities(value: string): string { assertLegalCharacters(value); let output = ''; for (let index = 0; index < value.length;) { const char = value[index]; if (char !== '&') { output += char; index += 1; continue; } const end = value.indexOf(';', index + 1); if (end < 0) throw new XmlSyntaxError('Unterminated entity reference.'); const entity = value.slice(index + 1, end); const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }; if (entity in named) output += named[entity]; else if (/^#x[0-9a-f]+$/i.test(entity) || /^#[0-9]+$/.test(entity)) { const hex = entity[1]?.toLowerCase() === 'x'; const codePoint = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10); if (!LEGAL_XML_CODEPOINT(codePoint)) throw new XmlSyntaxError(`Illegal XML code point ${entity}.`); output += String.fromCodePoint(codePoint); } else throw new XmlSyntaxError(`Undeclared entity &${entity};.`); index = end + 1; } return output; }

function parseXml(xml: string): XmlDocument {
  assertLegalCharacters(xml); let index = 0; const stack: Array<{ element: XmlElement; namespaces: Map<string, string> }> = []; const elements: XmlElement[] = []; let root: XmlElement | null = null; let doctypeSeen = false; let processingInstructionSeen = false;
  const currentChildren = (): XmlChild[] | null => stack.at(-1)?.element.children ?? null;
  const addText = (raw: string): void => { if (!raw) return; if (raw.includes(']]>')) throw new XmlSyntaxError(']]> is forbidden in character data.'); const value = decodeEntities(raw); if (!currentChildren()) { if (value.trim()) throw new XmlSyntaxError('Text is not allowed outside the document element.'); } else currentChildren()?.push({ kind: 'text', value }); };
  const readName = (): string => { const start = index; while (index < xml.length && /[A-Za-z0-9_.:-]/.test(xml[index] ?? '')) index += 1; const name = xml.slice(start, index); if (!NAME.test(name)) throw new XmlSyntaxError(`Invalid XML name near byte ${start}.`); return name; };
  const whitespace = (): void => { while (/\s/.test(xml[index] ?? '')) index += 1; };
  while (index < xml.length) {
    if (xml[index] !== '<') { const next = xml.indexOf('<', index); addText(xml.slice(index, next < 0 ? xml.length : next)); index = next < 0 ? xml.length : next; continue; }
    if (xml.startsWith('<!--', index)) { const end = xml.indexOf('-->', index + 4); if (end < 0 || xml.slice(index + 4, end).includes('--')) throw new XmlSyntaxError('Malformed XML comment.'); currentChildren()?.push({ kind: 'comment', value: xml.slice(index + 4, end) }); index = end + 3; continue; }
    if (xml.startsWith('<![CDATA[', index)) { if (!currentChildren()) throw new XmlSyntaxError('CDATA is not allowed outside the document element.'); const end = xml.indexOf(']]>', index + 9); if (end < 0) throw new XmlSyntaxError('Unterminated CDATA section.'); currentChildren()?.push({ kind: 'cdata', value: xml.slice(index + 9, end) }); index = end + 3; continue; }
    if (xml.startsWith('<?', index)) { const end = xml.indexOf('?>', index + 2); const body = end < 0 ? '' : xml.slice(index + 2, end).trim(); if (end < 0 || stack.length > 0 || root || processingInstructionSeen || !/^xml\s+version=(['"])1\.0\1(?:\s+encoding=(['"])UTF-8\2)?\s*$/i.test(body)) throw new XmlSyntaxError('Malformed or misplaced XML declaration.'); processingInstructionSeen = true; index = end + 2; continue; }
    if (/^<!DOCTYPE\b/i.test(xml.slice(index))) { if (doctypeSeen || root || stack.length > 0) throw new XmlSyntaxError('DOCTYPE must appear once before the root.'); let end = index + 9; let quote: string | null = null; let subset = 0; for (; end < xml.length; end += 1) { const char = xml[end] ?? ''; if (quote) { if (char === quote) quote = null; continue; } if (char === '"' || char === "'") quote = char; else if (char === '[') subset += 1; else if (char === ']') subset -= 1; else if (char === '>' && subset === 0) break; } if (end >= xml.length || subset !== 0) throw new XmlSyntaxError('Unterminated DOCTYPE.'); doctypeSeen = true; index = end + 1; continue; }
    if (xml.startsWith('</', index)) { index += 2; whitespace(); const name = readName(); whitespace(); if (xml[index] !== '>') throw new XmlSyntaxError('Malformed closing tag.'); index += 1; if (stack.pop()?.element.name !== name) throw new XmlSyntaxError(`Mismatched closing tag ${name}.`); continue; }
    if (xml.startsWith('<!', index)) throw new XmlSyntaxError('Unsupported declaration.');
    index += 1; whitespace(); const name = readName(); const rawAttributes: Array<[string, string]> = []; let selfClosing = false; let terminated = false;
    while (index < xml.length) { whitespace(); if (xml.startsWith('/>', index)) { selfClosing = true; index += 2; terminated = true; break; } if (xml[index] === '>') { index += 1; terminated = true; break; } const attributeName = readName(); whitespace(); if (xml[index] !== '=') throw new XmlSyntaxError(`Attribute ${attributeName} has no value.`); index += 1; whitespace(); const quote = xml[index]; if (quote !== '"' && quote !== "'") throw new XmlSyntaxError(`Attribute ${attributeName} must be quoted.`); index += 1; const end = xml.indexOf(quote, index); if (end < 0) throw new XmlSyntaxError(`Unterminated attribute ${attributeName}.`); const rawValue = xml.slice(index, end); if (rawValue.includes('<')) throw new XmlSyntaxError(`Attribute ${attributeName} contains raw <.`); rawAttributes.push([attributeName, decodeEntities(rawValue)]); index = end + 1; }
    if (!terminated) throw new XmlSyntaxError(`Unterminated start tag ${name}.`);
    const inherited = new Map(stack.at(-1)?.namespaces ?? [['xml', XML_NS]]); for (const [attributeName, value] of rawAttributes) { if (attributeName === 'xmlns') inherited.set('', value); else if (attributeName.startsWith('xmlns:')) inherited.set(attributeName.slice(6), value); }
    const qualified = splitName(name); const namespaceUri = inherited.get(qualified.prefix ?? '') ?? null; if (qualified.prefix && !namespaceUri) throw new XmlSyntaxError(`Undeclared prefix ${qualified.prefix}.`);
    const attributes = new Map<string, string>(); const expanded = new Set<string>(); for (const [attributeName, value] of rawAttributes) { if (attributes.has(attributeName)) throw new XmlSyntaxError(`Duplicate attribute ${attributeName}.`); attributes.set(attributeName, value); const attributeQualified = splitName(attributeName); let uri = ''; if (attributeName === 'xmlns' || attributeQualified.prefix === 'xmlns') uri = XMLNS_NS; else if (attributeQualified.prefix) { uri = inherited.get(attributeQualified.prefix) ?? ''; if (!uri) throw new XmlSyntaxError(`Undeclared attribute prefix ${attributeQualified.prefix}.`); } const expandedName = `{${uri}}${attributeQualified.localName}`; if (expanded.has(expandedName)) throw new XmlSyntaxError(`Duplicate expanded attribute ${expandedName}.`); expanded.add(expandedName); }
    const element: XmlElement = { kind: 'element', name, prefix: qualified.prefix, localName: qualified.localName, namespaceUri, attributes, children: [], parent: stack.at(-1)?.element ?? null, selfClosing }; if (!root) root = element; else if (!element.parent) throw new XmlSyntaxError('XML must contain exactly one root element.'); currentChildren()?.push(element); elements.push(element); if (!selfClosing) stack.push({ element, namespaces: inherited });
  }
  if (stack.length || !root) throw new XmlSyntaxError('Unclosed element or missing root.'); return { root, elements };
}

function ignored(element: XmlElement): boolean { for (let current: XmlElement | null = element; current; current = current.parent) if (current.namespaceUri === BLOGGER_NS && current.localName === 'comment') return true; return false; }
function active(document: XmlDocument): XmlElement[] { return document.elements.filter((element) => !ignored(element)); }
function attr(element: XmlElement, name: string): string | null { return element.attributes.get(name) ?? null; }
function named(document: XmlDocument, namespaceUri: string | null, localName: string): XmlElement[] { return active(document).filter((element) => element.namespaceUri === namespaceUri && element.localName === localName); }
function expressions(document: XmlDocument): string[] { const values: string[] = []; for (const element of active(document)) for (const [name, value] of element.attributes) { const expression = name === 'cond' || name.startsWith('expr:') || (element.namespaceUri === BLOGGER_NS && ['with', 'loop', 'include', 'attr', 'class', 'eval', 'case', 'switch'].includes(element.localName) && ['value', 'values', 'data', 'name', 'var'].includes(name)); if (expression) values.push(value); } return values; }
function semanticValues(document: XmlDocument): string[] { return [...expressions(document), ...active(document).filter((element) => element.prefix === 'data').map((element) => element.name)]; }
function descendants(element: XmlElement): XmlElement[] { const result: XmlElement[] = []; for (const child of element.children) if (child.kind === 'element') { result.push(child, ...descendants(child)); } return result; }
function literalText(element: XmlElement): string { return element.children.filter((child): child is XmlText => child.kind === 'text').map((child) => child.value).join('').trim(); }
function jsonLdScript(element: XmlElement): boolean {
  if (element.localName !== 'script') return false;
  if ((attr(element, 'type') ?? '').toLowerCase() === 'application/ld+json') return true;
  for (const child of element.children) {
    if (child.kind !== 'element' || child.namespaceUri !== BLOGGER_NS || child.localName !== 'attr' || attr(child, 'name') !== 'type') continue;
    const dynamicType = attr(child, 'value') ?? attr(child, 'expr:value') ?? '';
    if (dynamicType.replace(/["']/g, '').toLowerCase() === 'application/ld+json') return true;
  }
  return false;
}

export const contractRules: readonly ContractRule[] = [
  { id: 'well-formed', requirementId: 'R-V3-1 AC9', message: 'Generated output must be namespace-aware, well-formed XML.', check: () => true },
  { id: 'layouts-v3', requirementId: 'R-V3-1 AC1', message: "<html> must carry b:layoutsVersion='3'.", check: (doc) => attr(doc.root, 'b:layoutsVersion') === '3' },
  { id: 'widget-v2', requirementId: 'R-V3-1 AC2', message: "Every b:widget must carry version='2'.", check: (doc) => { const widgets = named(doc, BLOGGER_NS, 'widget'); return widgets.length > 0 && widgets.every((element) => attr(element, 'version') === '2'); } },
  { id: 'no-v2-html', requirementId: 'R-V3-1 AC3', message: "<html> must not carry b:version or a v2 class token.", check: (doc) => attr(doc.root, 'b:version') === null && !(attr(doc.root, 'class') ?? '').split(/\s+/).includes('v2') },
  { id: 'single-cdata-skin', requirementId: 'R-V3-1 AC4', message: 'Theme must contain exactly one b:skin whose non-whitespace content is one CDATA node.', check: (doc) => { const skins = named(doc, BLOGGER_NS, 'skin'); if (skins.length !== 1) return false; const content = skins[0]?.children.filter((child) => child.kind !== 'text' || child.value.trim()) ?? []; return content.length === 1 && content[0]?.kind === 'cdata'; } },
  { id: 'section-ids', requirementId: 'R-V3-1 AC5', message: 'Section IDs must be unique and letter-first, using only letters, numbers, and underscores (Google native V3 themes use underscores).', check: (doc) => { const ids = named(doc, BLOGGER_NS, 'section').map((element) => attr(element, 'id')); return ids.length > 0 && ids.every((id) => id !== null && /^[A-Za-z][A-Za-z0-9_]*$/.test(id)) && new Set(ids).size === ids.length; } },
  { id: 'header-widget', requirementId: 'R-V3-1 AC6', message: 'Theme must declare a Header widget.', check: (doc) => named(doc, BLOGGER_NS, 'widget').some((element) => attr(element, 'type') === 'Header') },
  { id: 'no-v2-accessors', requirementId: 'R-V3-1 AC7', message: 'Banned V2-era accessors and URL-based view dispatch are not allowed.', check: (doc) => semanticValues(doc).every((value) => !/data:blog\.(?:pageType|searchLabel|searchQuery)|data:post\.dateHeader|data:blog\.url\s*==\s*data:blog\.homepageUrl/i.test(value)) },
  { id: 'no-macro-tags', requirementId: 'R-V3-1 AC8', message: 'macro:* tags are not allowed.', check: (doc) => active(doc).every((element) => element.prefix !== 'macro') },
  { id: 'declared-entities', requirementId: 'R-BUILD-1 AC6', message: 'Entities and numeric code points must be valid XML.', check: () => true },
  { id: 'word-logical-operators', requirementId: 'R-V3-2 AC1', message: 'Expressions must use and/or, never && or ||.', check: (doc) => expressions(doc).every((value) => !/&&|\|\|/.test(value)) },
  { id: 'documented-comparisons', requirementId: 'R-V3-2 AC2', message: 'Expressions must not use .size or gt/lt/gte/lte.', check: (doc) => expressions(doc).every((value) => !/\.size\b|\b(?:gt|lt|gte|lte)\b/i.test(value)) },
  { id: 'data-tags-are-paths', requirementId: 'R-V3-2 AC3', message: 'data:* tags must be self-closing property paths.', check: (doc) => active(doc).filter((element) => element.prefix === 'data').every((element) => element.selfClosing && element.children.length === 0 && /^data:[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)*$/.test(element.name)) },
  { id: 'url-path-operator', requirementId: 'R-V3-2 AC4', message: 'Computed URL expressions must use path, never string +.', check: (doc) => active(doc).every((element) => { const direct = ['expr:href', 'expr:src', 'expr:action'].map((name) => attr(element, name)).filter((value): value is string => value !== null); const injectedName = element.namespaceUri === BLOGGER_NS && element.localName === 'attr' ? attr(element, 'name') : null; const injected = injectedName && ['href', 'src', 'action'].includes(injectedName) ? [attr(element, 'expr:value') ?? attr(element, 'value') ?? ''] : []; return [...direct, ...injected].every((value) => !/\+/.test(value)); }) },
  { id: 'json-escaped', requirementId: 'R-V3-2 AC5', message: 'Every JSON-LD interpolation must end in .jsonEscaped.', check: (doc) => active(doc).filter(jsonLdScript).every((script) => descendants(script).filter((element) => element.prefix === 'data' || (element.namespaceUri === BLOGGER_NS && element.localName === 'eval')).every((element) => element.prefix === 'data' ? element.name.endsWith('.jsonEscaped') : /\.jsonEscaped\s*$/.test(attr(element, 'expr') ?? ''))) },
  { id: 'no-fabricated-metadata', requirementId: 'R-BUILD-1 AC7', message: 'Fabricated reading time, author identity, or Gravatar fallback is not allowed.', check: (doc, xml) => { if (/\b\d+\s+min(?:ute)?s?\s+read\b|gravatar\.com\/avatar/i.test(xml)) return false; return active(doc).filter((element) => /(?:^|\s)(?:author-name|post-author)(?:\s|$)/.test(attr(element, 'class') ?? '')).every((element) => !/[A-Za-z0-9]/.test(literalText(element))); } },
  { id: 'build-stamp', requirementId: 'R-BUILD-2 AC1', message: 'A unique direct-child head meta stamp must equal b:templateVersion plus a full SHA.', check: (doc) => { const heads = doc.root.children.filter((child): child is XmlElement => child.kind === 'element' && child.localName === 'head'); if (heads.length !== 1) return false; const stamps = heads[0]!.children.filter((child): child is XmlElement => child.kind === 'element' && child.localName === 'meta' && attr(child, 'name') === 'theme-build'); const version = attr(doc.root, 'b:templateVersion'); return stamps.length === 1 && version !== null && new RegExp(`^${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\+[0-9a-f]{40}$`, 'i').test(attr(stamps[0]!, 'content') ?? ''); } },
  { id: 'size-budget', requirementId: 'R-PERF-1 AC4', message: 'Generated theme must not exceed 200000 bytes.', check: (_doc, xml) => Buffer.byteLength(xml, 'utf8') <= 200_000 },
  { id: 'css-disabled', requirementId: 'R-PERF-1 AC7', message: "<html> must carry b:css='false'.", check: (doc) => attr(doc.root, 'b:css') === 'false' },
  {
    id: 'bound-section-and-widget-ids',
    requirementId: 'BR-1',
    message: "Theme must bind section 'header' to locked widget 'Header1' (version='2') and section 'page_body' to locked widget 'Blog1' (version='2').",
    check: (doc) => {
      const sections = named(doc, BLOGGER_NS, 'section');
      const headerSection = sections.find((s) => attr(s, 'id') === 'header');
      const bodySection = sections.find((s) => attr(s, 'id') === 'page_body');
      if (!headerSection || !bodySection) return false;
      const headerWidgets = headerSection.children.filter((c): c is XmlElement => c.kind === 'element' && c.namespaceUri === BLOGGER_NS && c.localName === 'widget');
      const bodyWidgets = bodySection.children.filter((c): c is XmlElement => c.kind === 'element' && c.namespaceUri === BLOGGER_NS && c.localName === 'widget');
      const header1 = headerWidgets.find((w) => attr(w, 'id') === 'Header1');
      const blog1 = bodyWidgets.find((w) => attr(w, 'id') === 'Blog1');
      if (!header1 || !blog1) return false;
      return attr(header1, 'version') === '2' && attr(header1, 'locked') === 'true' && attr(blog1, 'version') === '2' && attr(blog1, 'locked') === 'true';
    }
  },
  {
    id: 'all-head-content-include',
    requirementId: 'R-V3-1 AC1',
    message: "<head> must contain exactly one <b:include data='blog' name='all-head-content'/>.",
    check: (doc) => {
      const heads = doc.root.children.filter((child): child is XmlElement => child.kind === 'element' && child.localName === 'head');
      if (heads.length !== 1) return false;
      const includes = descendants(heads[0]!).filter((element) => element.namespaceUri === BLOGGER_NS && element.localName === 'include' && attr(element, 'name') === 'all-head-content' && attr(element, 'data') === 'blog');
      return includes.length === 1;
    }
  },
  {
    id: 'main-container-structure',
    requirementId: 'R-A11Y-2 AC1',
    message: "The 'page_body' section must be enclosed inside a <main role='main'> container.",
    check: (doc) => {
      const bodySection = named(doc, BLOGGER_NS, 'section').find((s) => attr(s, 'id') === 'page_body');
      if (!bodySection) return false;
      for (let cur = bodySection.parent; cur; cur = cur.parent) {
        if (cur.localName === 'main' && attr(cur, 'role') === 'main') return true;
      }
      return false;
    }
  },
  {
    id: 'all-seven-config-zones',
    requirementId: 'R-NAV-2 AC1',
    message: "Theme must declare all seven editable layout zones: 'header', 'navlinks', 'intro', 'topics', 'page_body', 'cta', and 'footer' with valid showaddelement attributes.",
    check: (doc) => {
      const sections = named(doc, BLOGGER_NS, 'section');
      const expected: Record<string, { showaddelement: string }> = {
        header: { showaddelement: 'no' },
        navlinks: { showaddelement: 'no' },
        intro: { showaddelement: 'no' },
        topics: { showaddelement: 'no' },
        page_body: { showaddelement: 'no' },
        cta: { showaddelement: 'no' },
        footer: { showaddelement: 'yes' }
      };
      for (const [id, exp] of Object.entries(expected)) {
        const sec = sections.find((s) => attr(s, 'id') === id);
        if (!sec) return false;
        if (attr(sec, 'showaddelement') !== exp.showaddelement) return false;
      }
      return sections.length >= 7;
    }
  },
  {
    id: 'defensive-defaultmarkups',
    requirementId: 'R-NAV-2 AC5',
    message: 'Theme must declare <b:defaultmarkups> in <head> covering Common, PopularPosts, FeaturedPost, ContactForm, BlogArchive, and Label.',
    check: (doc) => {
      const heads = doc.root.children.filter((child): child is XmlElement => child.kind === 'element' && child.localName === 'head');
      if (heads.length !== 1) return false;
      const defMarkups = descendants(heads[0]!).filter((e) => e.namespaceUri === BLOGGER_NS && e.localName === 'defaultmarkups');
      if (defMarkups.length !== 1) return false;
      const markups = descendants(defMarkups[0]!).filter((e) => e.namespaceUri === BLOGGER_NS && e.localName === 'defaultmarkup');
      const types = new Set<string>();
      for (const m of markups) {
        const typeAttr = attr(m, 'type');
        if (typeAttr) {
          for (const t of typeAttr.split(',')) {
            types.add(t.trim());
          }
        }
      }
      const required = ['Common', 'PopularPosts', 'FeaturedPost', 'ContactForm', 'BlogArchive', 'Label'];
      return required.every((req) => types.has(req));
    }
  },
  {
    id: 'no-hardcoded-search-label',
    requirementId: 'R-NAV-1 AC2',
    message: 'Hardcoded /search/label/ URLs are forbidden; use data:label.url or dynamic path composition.',
    check: (doc) => {
      for (const element of active(doc)) {
        for (const [, value] of element.attributes) {
          if (/\/search\/label\//i.test(value)) return false;
        }
        for (const child of element.children) {
          if (child.kind === 'text' && /\/search\/label\//i.test(child.value)) return false;
        }
      }
      return true;
    }
  },
  {
    id: 'readme-zone-parity',
    requirementId: 'R-NAV-2 AC6',
    message: 'Layout zone declarations in README.md must match the seven sections declared in theme.xml exactly.',
    check: (doc) => {
      try {
        const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
        const match = readme.match(/## Layout zones[\s\S]*?(?=\n##|$)/);
        if (!match) return false;
        const rows = match[0].split('\n').filter((l) => l.startsWith('|') && !l.includes('---') && !l.includes('Zone'));
        const readmeZones: Array<{ id: string; max: string }> = [];
        for (const row of rows) {
          const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
          if (cells.length >= 4) {
            const rawId = cells[1]?.replace(/[`]/g, '') ?? '';
            const max = cells[3] ?? '';
            if (rawId && max) readmeZones.push({ id: rawId, max });
          }
        }
        if (readmeZones.length !== 7) return false;
        const sections = named(doc, BLOGGER_NS, 'section');
        for (const rz of readmeZones) {
          const sec = sections.find((s) => attr(s, 'id') === rz.id);
          if (!sec) return false;
          if (attr(sec, 'maxwidgets') !== rz.max) return false;
        }
        return true;
      } catch {
        return false;
      }
    }
  },
  {
    id: 'clean-section-containers',
    requirementId: 'R-NAV-2 AC3',
    message: 'Optional layout sections must be guarded with layout mode checks to prevent empty HTML containers on live views.',
    check: (doc) => {
      const optionalIds = ['navlinks', 'intro', 'topics', 'cta', 'footer'];
      const sections = named(doc, BLOGGER_NS, 'section');
      for (const optId of optionalIds) {
        const section = sections.find((s) => attr(s, 'id') === optId);
        if (!section) return false;
        let hasGuard = false;
        for (let cur: XmlElement | null = section.parent; cur; cur = cur.parent) {
          if (cur.namespaceUri === BLOGGER_NS && cur.localName === 'if') {
            const cond = attr(cur, 'cond') ?? '';
            if (/data:view\.isLayoutMode/i.test(cond) && (/data:widgets/i.test(cond) || new RegExp(optId, 'i').test(cond))) {
              hasGuard = true;
              break;
            }
          }
        }
        if (!hasGuard) return false;
      }
      return true;
    }
  },
  {
    id: 'rel-canonical',
    requirementId: 'R-SEO-2 AC4',
    message: "<head> must contain a <link rel='canonical'> element binding expr:href to data:view.url.canonical.",
    check: (doc) => {
      const heads = doc.root.children.filter((c): c is XmlElement => c.kind === 'element' && c.localName === 'head');
      if (heads.length !== 1) return false;
      const links = descendants(heads[0]!).filter((e) => e.localName === 'link' && attr(e, 'rel') === 'canonical');
      return links.length === 1 && attr(links[0]!, 'expr:href') === 'data:view.url.canonical';
    }
  },
  {
    id: 'opengraph-metadata',
    requirementId: 'R-SEO-2 AC1',
    message: "<head> must declare OpenGraph meta tags for og:title, og:type, og:url, og:image, and og:description with dynamic bindings.",
    check: (doc) => {
      const heads = doc.root.children.filter((c): c is XmlElement => c.kind === 'element' && c.localName === 'head');
      if (heads.length !== 1) return false;
      const metas = descendants(heads[0]!).filter((e) => e.localName === 'meta');
      const ogProperties = metas.map((m) => attr(m, 'property')).filter((p): p is string => p !== null && p.startsWith('og:'));
      const required = ['og:title', 'og:type', 'og:url', 'og:image', 'og:description'];
      return required.every((req) => ogProperties.includes(req));
    }
  },
  {
    id: 'twitter-metadata',
    requirementId: 'R-SEO-2 AC1',
    message: "<head> must declare Twitter card meta tags for twitter:card, twitter:title, twitter:description, and twitter:image.",
    check: (doc) => {
      const heads = doc.root.children.filter((c): c is XmlElement => c.kind === 'element' && c.localName === 'head');
      if (heads.length !== 1) return false;
      const metas = descendants(heads[0]!).filter((e) => e.localName === 'meta');
      const twitterNames = metas.map((m) => attr(m, 'name')).filter((n): n is string => n !== null && n.startsWith('twitter:'));
      const required = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
      return required.every((req) => twitterNames.includes(req));
    }
  },
  {
    id: 'single-h1-hierarchy',
    requirementId: 'R-A11Y-3 AC1',
    message: "Theme must enforce exactly one <h1> per view: Header1 must demote site title on single item views (data:view.isSingleItem) while post titles use <h1> on single items and <h2> elsewhere.",
    check: (doc) => {
      const headerWidget = named(doc, BLOGGER_NS, 'widget').find((w) => attr(w, 'id') === 'Header1');
      if (!headerWidget) return false;
      const headerIfs = descendants(headerWidget).filter((e) => e.namespaceUri === BLOGGER_NS && e.localName === 'if');
      const headerHasSingleItemDemotion = headerIfs.some((i) => {
        const cond = attr(i, 'cond') ?? '';
        return /isSingleItem/i.test(cond);
      });
      if (!headerHasSingleItemDemotion) return false;

      const otherWidgets = named(doc, BLOGGER_NS, 'widget').filter((w) => attr(w, 'id') !== 'Header1' && attr(w, 'id') !== 'Blog1');
      for (const w of otherWidgets) {
        const strayH1 = descendants(w).some((e) => e.localName === 'h1');
        if (strayH1) return false;
      }
      return true;
    }
  },
  {
    id: 'skip-link-structure',
    requirementId: 'R-A11Y-2 AC2',
    message: "Theme body must start with a functional skip link (<a class='skip-link' href='#content'>) targeting the main content landmark (<main id='content'>).",
    check: (doc) => {
      const bodies = doc.root.children.filter((c): c is XmlElement => c.kind === 'element' && c.localName === 'body');
      if (bodies.length !== 1) return false;
      const bodyChildren = bodies[0]!.children.filter((c): c is XmlElement => c.kind === 'element' && !ignored(c));
      const skipLink = bodyChildren.find((e) => e.localName === 'a' && attr(e, 'class') === 'skip-link' && attr(e, 'href') === '#content');
      const mainContent = descendants(bodies[0]!).find((e) => e.localName === 'main' && attr(e, 'id') === 'content');
      return Boolean(skipLink && mainContent);
    }
  },
  {
    id: 'clean-aria-landmarks',
    requirementId: 'R-A11Y-1',
    message: "Theme must declare top-level landmarks (role='banner', role='main', role='contentinfo') without illegal landmark nesting.",
    check: (doc) => {
      const activeElements = active(doc);
      const hasBanner = activeElements.some((e) => attr(e, 'role') === 'banner');
      const hasMain = activeElements.some((e) => e.localName === 'main' && attr(e, 'role') === 'main');
      const hasContentInfo = activeElements.some((e) => attr(e, 'role') === 'contentinfo');
      if (!hasBanner || !hasMain || !hasContentInfo) return false;

      const navElements = activeElements.filter((e) => e.localName === 'nav');
      for (const n of navElements) {
        const nestedNav = descendants(n).some((e) => e.localName === 'nav');
        if (nestedNav) return false;
      }
      return true;
    }
  },
  {
    id: 'no-control-flow-hazards',
    requirementId: 'R-RENDER-1',
    message: 'Control-flow conditionals must avoid flat <b:elseif> or self-closing <b:else/> tags; use clean distinct <b:if> blocks or <b:switch>.',
    check: (doc) => {
      const activeEls = active(doc);
      for (const el of activeEls) {
        if (el.namespaceUri === BLOGGER_NS && (el.localName === 'elseif' || el.localName === 'else')) {
          return false;
        }
      }
      return true;
    }
  },
  {
    id: 'skin-before-defaultmarkups',
    requirementId: 'R-V3-1',
    message: '<head> must declare <b:skin> before <b:defaultmarkups> matching native Blogger V3 ordering.',
    check: (doc) => {
      const heads = doc.root.children.filter((c): c is XmlElement => c.kind === 'element' && c.localName === 'head');
      if (heads.length !== 1) return true;
      const headChildren = heads[0]!.children.filter((c): c is XmlElement => c.kind === 'element');
      const skinIdx = headChildren.findIndex((c) => c.namespaceUri === BLOGGER_NS && c.localName === 'skin');
      const defIdx = headChildren.findIndex((c) => c.namespaceUri === BLOGGER_NS && c.localName === 'defaultmarkups');
      if (skinIdx === -1 || defIdx === -1) return true;
      return skinIdx < defIdx;
    }
  },
  {
    id: 'section-v3-attributes',
    requirementId: 'R-NAV-2',
    message: "All <b:section> elements must declare required V3 attributes: id, class, name, maxwidgets, and valid showaddelement ('false', 'true', 'no', 'yes').",
    check: (doc) => {
      const sections = named(doc, BLOGGER_NS, 'section');
      if (sections.length === 0) return false;
      return sections.every((sec) => {
        const id = attr(sec, 'id');
        const className = attr(sec, 'class');
        const name = attr(sec, 'name');
        const maxwidgets = attr(sec, 'maxwidgets');
        const showadd = attr(sec, 'showaddelement');
        return Boolean(
          id &&
          className &&
          name &&
          maxwidgets &&
          showadd &&
          ['false', 'true', 'no', 'yes'].includes(showadd)
        );
      });
    }
  }
];
export const CONTRACT_RULES = contractRules;
export function checkThemeContract(xml: string): ContractFinding[] { let document: XmlDocument; try { document = parseXml(xml); } catch (error) { const message = error instanceof Error ? error.message : String(error); return [{ ruleId: 'well-formed', requirementId: 'R-V3-1 AC9', message }, { ruleId: 'declared-entities', requirementId: 'R-BUILD-1 AC6', message }]; } return contractRules.filter((rule) => !rule.check(document, xml)).map((rule) => ({ ruleId: rule.id, requirementId: rule.requirementId, message: rule.message })); }
export function assertThemeContract(xml: string): void { const findings = checkThemeContract(xml); if (findings.length) throw new Error(findings.map((finding) => `[${finding.requirementId}] ${finding.ruleId}: ${finding.message}`).join('\n')); }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { const filename = path.resolve(process.argv[2] ?? path.join(ROOT, 'dist/theme.xml')); assertThemeContract(await readFile(filename, 'utf8')); console.log(`PASS: ${contractRules.length} V3 contract rules verified.`); }
