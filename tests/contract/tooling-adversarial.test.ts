import { describe, expect, it } from 'vitest';
import { extractWidget, getWidgetPattern, replaceWidget, buildControls } from '../../tools/build-controls.js';
import {
  META_THEME_BUILD,
  STAMP_FORMAT,
  normalizeLineEndings,
  normalizeGoldenTheme,
  assertGoldenTheme,
  updateGoldenTheme
} from '../../tools/golden-check.js';
import { generateTheme } from '../../tools/generate.js';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const VALID_SHA = '0123456789abcdef0123456789abcdef01234567';


describe('Adversarial Stress Testing: tools/build-controls.ts', () => {
  describe('Quote variations', () => {
    it('extracts widget with single quotes for all attributes', () => {
      const xml = `<b:section id='page_body'><b:widget id='Blog1' type='Blog' version='2'><b:includable id='main'>Single</b:includable></b:widget></b:section>`;
      const extracted = extractWidget(xml, 'Blog1');
      expect(extracted).toBe("<b:widget id='Blog1' type='Blog' version='2'><b:includable id='main'>Single</b:includable></b:widget>");
    });

    it('extracts widget with double quotes for all attributes', () => {
      const xml = `<b:section id="page_body"><b:widget id="Blog1" type="Blog" version="2"><b:includable id="main">Double</b:includable></b:widget></b:section>`;
      const extracted = extractWidget(xml, 'Blog1');
      expect(extracted).toBe('<b:widget id="Blog1" type="Blog" version="2"><b:includable id="main">Double</b:includable></b:widget>');
    });

    it('extracts widget with mixed quotes across attributes', () => {
      const xml = `<b:section id="page_body"><b:widget version='2' id="Blog1" type='Blog' locked="true"><b:includable id='main'>Mixed</b:includable></b:widget></b:section>`;
      const extracted = extractWidget(xml, 'Blog1');
      expect(extracted).toBe(`<b:widget version='2' id="Blog1" type='Blog' locked="true"><b:includable id='main'>Mixed</b:includable></b:widget>`);
    });
  });

  describe('Attribute permutations', () => {
    const permutations = [
      `<b:widget id='Blog1' type='Blog' version='2'><b:includable id='main'/></b:widget>`,
      `<b:widget type='Blog' id='Blog1' version='2'><b:includable id='main'/></b:widget>`,
      `<b:widget version='2' type='Blog' id='Blog1'><b:includable id='main'/></b:widget>`,
      `<b:widget locked='true' title='Posts' id='Blog1' version='2' type='Blog' visible='true'><b:includable id='main'/></b:widget>`,
      `<b:widget mobile='yes' version='2' type='Blog' locked='false' id='Blog1'><b:includable id='main'/></b:widget>`
    ];

    for (let i = 0; i < permutations.length; i++) {
      it(`extracts widget with attribute permutation #${i + 1}`, () => {
        const fullXml = `<b:section id='page_body'>${permutations[i]}</b:section>`;
        expect(extractWidget(fullXml, 'Blog1')).toBe(permutations[i]);
      });
    }
  });

  describe('Whitespace, tabs, and newlines between attributes', () => {
    it('extracts widget with LF newlines between attributes', () => {
      const widget = `<b:widget\n  id='Blog1'\n  type='Blog'\n  version='2'>\n  <b:includable id='main'/>\n</b:widget>`;
      const xml = `<b:section id='page_body'>\n${widget}\n</b:section>`;
      expect(extractWidget(xml, 'Blog1')).toBe(widget);
    });

    it('extracts widget with CRLF newlines and irregular whitespace', () => {
      const widget = `<b:widget\r\n   type="Blog"\r\n\t  id="Blog1"\r\n   version="2"\r\n>\r\n  <b:includable id="main"/>\r\n</b:widget>`;
      const xml = `<b:section id="page_body">\r\n${widget}\r\n</b:section>`;
      expect(extractWidget(xml, 'Blog1')).toBe(widget);
    });
  });

  describe('Special dollar sign characters in replacement strings', () => {
    it('preserves $$, $1, $&, $\', and $` literals without regex expansion', () => {
      const targetXml = `<b:section id="page_body"><b:widget id="Blog1" type="Blog" version="2">OLD</b:widget></b:section>`;
      const adversarialReplacement = `<b:widget id="Blog1" type="Blog" version="2"><p>Price: $$99 | Group: $1 | Match: $&amp; | Post: $' | Pre: $\` | Dollars: $$$$$$</p></b:widget>`;

      const result = replaceWidget(targetXml, 'Blog1', adversarialReplacement);
      expect(result).toBe(`<b:section id="page_body">${adversarialReplacement}</b:section>`);
      expect(result).toContain('$$99');
      expect(result).toContain('$1');
      expect(result).toContain('$&amp;');
      expect(result).toContain("$'");
      expect(result).toContain('$`');
      expect(result).toContain('$$$$$$');
    });
  });

  describe('Boundary cases and near-match widget IDs', () => {
    it('does not match widget IDs that contain target as a prefix or substring', () => {
      const xml = `
        <b:section id='page_body'>
          <b:widget id='Blog10' type='Blog' version='2'><b:includable id='main'>10</b:includable></b:widget>
          <b:widget id='Blog1_backup' type='Blog' version='2'><b:includable id='main'>backup</b:includable></b:widget>
          <b:widget id='HeaderBlog1' type='Blog' version='2'><b:includable id='main'>prefix</b:includable></b:widget>
          <b:widget id='Blog1' type='Blog' version='2'><b:includable id='main'>target</b:includable></b:widget>
        </b:section>
      `;
      const extracted = extractWidget(xml, 'Blog1');
      expect(extracted).toBe("<b:widget id='Blog1' type='Blog' version='2'><b:includable id='main'>target</b:includable></b:widget>");
    });

    it('throws descriptive error when target widget is not present', () => {
      const xml = `<b:section id='page_body'><b:widget id='Header1' type='Header' version='2'/></b:section>`;
      expect(() => extractWidget(xml, 'Blog1')).toThrow('Could not locate Blog1 widget.');
      expect(() => replaceWidget(xml, 'Blog1', '<replacement/>')).toThrow('Could not locate Blog1 widget for replacement.');
    });

    it('handles special regex characters in widgetId', () => {
      const customId = 'Custom.Widget[1]+$';
      const pattern = getWidgetPattern(customId);
      const xml = `<b:section id='sec'><b:widget id='${customId}' type='Custom' version='2'><b:includable id='main'/></b:widget></b:section>`;
      expect(extractWidget(xml, customId)).toBe(`<b:widget id='${customId}' type='Custom' version='2'><b:includable id='main'/></b:widget>`);
      const replaced = replaceWidget(xml, customId, '<new-widget/>');
      expect(replaced).toBe(`<b:section id='sec'><new-widget/></b:section>`);
    });
  });

  describe('End-to-End buildControls execution', () => {
    it('generates control files with swapped widgets and valid build stamps', async () => {
      const writtenFiles = await buildControls(VALID_SHA);
      expect(writtenFiles.length).toBe(2);
      for (const file of writtenFiles) {
        const content = await readFile(file, 'utf8');
        expect(content).toMatch(/name=['"]theme-build['"]/);
        expect(content).toContain(VALID_SHA);
        expect(content).toContain('Blog1');
      }
    });
  });
});

describe('Adversarial Stress Testing: tools/golden-check.ts', () => {
  describe('Line endings normalization (normalizeLineEndings)', () => {
    it('normalizes pure LF (\\n)', () => {
      const input = 'line1\nline2\nline3\n';
      expect(normalizeLineEndings(input)).toBe('line1\nline2\nline3\n');
    });

    it('normalizes pure CRLF (\\r\\n)', () => {
      const input = 'line1\r\nline2\r\nline3\r\n';
      expect(normalizeLineEndings(input)).toBe('line1\nline2\nline3\n');
    });

    it('normalizes lone CR (\\r)', () => {
      const input = 'line1\rline2\rline3\r';
      expect(normalizeLineEndings(input)).toBe('line1\nline2\nline3\n');
    });

    it('normalizes mixed line endings (\\r\\n, \\r, \\n)', () => {
      const input = 'line1\r\nline2\rline3\nline4\r\n';
      expect(normalizeLineEndings(input)).toBe('line1\nline2\nline3\nline4\n');
    });

    it('appends trailing newline if missing', () => {
      const input = 'line1\nline2';
      expect(normalizeLineEndings(input)).toBe('line1\nline2\n');
    });

    it('handles empty string', () => {
      expect(normalizeLineEndings('')).toBe('\n');
    });
  });

  describe('Build stamp normalization (normalizeGoldenTheme)', () => {
    const makeDoc = (meta: string, extra = '') =>
      `<?xml version="1.0" encoding="UTF-8" ?>\n<html>\n<head>\n${meta}\n</head>\n<body>${extra}</body>\n</html>\n`;

    it('normalizes standard theme-build meta tag with double quotes', () => {
      const raw = makeDoc(`<meta content="0.0.0+${VALID_SHA}" name="theme-build"/>`);
      const normalized = normalizeGoldenTheme(raw);
      expect(normalized).toContain('<meta content="0.0.0+GOLDEN_SHA_40_CHARS________________" name="theme-build"/>');
    });

    it('normalizes meta tag with single quotes and reversed attribute order', () => {
      const raw = makeDoc(`<meta name='theme-build' content='0.0.0+${VALID_SHA}'/>`);
      const normalized = normalizeGoldenTheme(raw);
      expect(normalized).toContain("<meta name='theme-build' content='0.0.0+GOLDEN_SHA_40_CHARS________________'/>");
    });

    it('normalizes meta tag without self-closing slash', () => {
      const raw = makeDoc(`<meta content="1.2.3+${VALID_SHA}" name="theme-build">`);
      const normalized = normalizeGoldenTheme(raw);
      expect(normalized).toContain('<meta content="1.2.3+GOLDEN_SHA_40_CHARS________________" name="theme-build">');
    });

    it('handles multiple semver version bumps correctly', () => {
      const versions = [
        '0.0.0',
        '0.0.1',
        '0.1.0',
        '1.0.0',
        '2.14.3',
        '0.0.1-alpha.1',
        '1.0.0-beta-2.1',
        '2.0.0-rc.3.4.5'
      ];

      for (const ver of versions) {
        const raw = makeDoc(`<meta content="${ver}+${VALID_SHA}" name="theme-build"/>`);
        const normalized = normalizeGoldenTheme(raw);
        expect(normalized).toContain(`<meta content="${ver}+GOLDEN_SHA_40_CHARS________________" name="theme-build"/>`);
      }
    });

    it('is idempotent when re-normalizing already normalized golden content', () => {
      const raw = makeDoc(`<meta content="0.0.0+${VALID_SHA}" name="theme-build"/>`);
      const normalized1 = normalizeGoldenTheme(raw);
      const normalized2 = normalizeGoldenTheme(normalized1);
      expect(normalized2).toBe(normalized1);
    });

    it('normalizes documents with CRLF or lone CR in theme content alongside meta tag', () => {
      const rawCRLF = makeDoc(`<meta content="0.0.0+${VALID_SHA}" name="theme-build"/>`, '\r\n<div>CRLF</div>\r\n');
      const rawCR = makeDoc(`<meta content="0.0.0+${VALID_SHA}" name="theme-build"/>`, '\r<div>CR</div>\r');

      const normCRLF = normalizeGoldenTheme(rawCRLF);
      const normCR = normalizeGoldenTheme(rawCR);

      expect(normCRLF).not.toContain('\r');
      expect(normCR).not.toContain('\r');
      expect(normCRLF.endsWith('\n')).toBe(true);
      expect(normCR.endsWith('\n')).toBe(true);
    });
  });

  describe('Error handling & invalid stamps', () => {
    const makeDoc = (meta: string) => `<html><head>${meta}</head><body/></html>`;

    it('throws error when no theme-build stamp is present', () => {
      const doc = makeDoc('<meta name="description" content="test"/>');
      expect(() => normalizeGoldenTheme(doc)).toThrow('Expected exactly one full theme-build stamp, found 0.');
    });

    it('throws error when duplicate theme-build stamps are present', () => {
      const doc = makeDoc(`
        <meta content="0.0.0+${VALID_SHA}" name="theme-build"/>
        <meta content="0.0.0+${VALID_SHA}" name="theme-build"/>
      `);
      expect(() => normalizeGoldenTheme(doc)).toThrow('Expected exactly one full theme-build stamp, found 2.');
    });

    it('throws error when theme-build content has invalid format (missing sha)', () => {
      const doc = makeDoc('<meta content="0.0.0" name="theme-build"/>');
      expect(() => normalizeGoldenTheme(doc)).toThrow('Invalid theme-build content format: "0.0.0". Expected semver+sha.');
    });

    it('throws error when sha length is invalid', () => {
      const doc = makeDoc('<meta content="0.0.0+shortsha" name="theme-build"/>');
      expect(() => normalizeGoldenTheme(doc)).toThrow('Invalid theme-build content format: "0.0.0+shortsha". Expected semver+sha.');
    });
  });

  describe('assertGoldenTheme & diff diagnostics', () => {
    it('passes when actual and golden differ only by git sha and line endings', async () => {
      const tmpDir = path.join(os.tmpdir(), `golden-test-${Date.now()}`);
      await mkdir(tmpDir, { recursive: true });
      const actualPath = path.join(tmpDir, 'actual.xml');
      const goldenPath = path.join(tmpDir, 'golden.xml');

      const actualXml = `<?xml version="1.0" encoding="UTF-8" ?>\r\n<html>\r\n<head>\r\n<meta content="0.0.0+${VALID_SHA}" name="theme-build"/>\r\n</head>\r\n<body><main id="content"/></body>\r\n</html>\r\n`;
      const goldenXml = `<?xml version="1.0" encoding="UTF-8" ?>\n<html>\n<head>\n<meta content="0.0.0+GOLDEN_SHA_40_CHARS________________" name="theme-build"/>\n</head>\n<body><main id="content"/></body>\n</html>\n`;

      await writeFile(actualPath, actualXml, 'utf8');
      await writeFile(goldenPath, goldenXml, 'utf8');

      await expect(assertGoldenTheme(actualPath, goldenPath)).resolves.toBeUndefined();
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('throws detailed byte offset, line, and column diff when content differs', async () => {
      const tmpDir = path.join(os.tmpdir(), `golden-diff-${Date.now()}`);
      await mkdir(tmpDir, { recursive: true });
      const actualPath = path.join(tmpDir, 'actual.xml');
      const goldenPath = path.join(tmpDir, 'golden.xml');

      const actualXml = `<html><head><meta content="0.0.0+${VALID_SHA}" name="theme-build"/></head><body><p>Actual</p></body></html>`;
      const goldenXml = `<html><head><meta content="0.0.0+GOLDEN_SHA_40_CHARS________________" name="theme-build"/></head><body><p>Golden</p></body></html>`;

      await writeFile(actualPath, actualXml, 'utf8');
      await writeFile(goldenPath, goldenXml, 'utf8');

      await expect(assertGoldenTheme(actualPath, goldenPath)).rejects.toThrow(
        /Golden snapshot differs at byte \d+ \(line \d+, col \d+\)/
      );
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('updates golden file when updateGoldenTheme is called', async () => {
      const tmpDir = path.join(os.tmpdir(), `golden-upd-${Date.now()}`);
      await mkdir(tmpDir, { recursive: true });
      const actualPath = path.join(tmpDir, 'actual.xml');
      const goldenPath = path.join(tmpDir, 'golden.xml');

      const actualXml = `<html><head><meta content="0.0.0+${VALID_SHA}" name="theme-build"/></head><body><p>Updated</p></body></html>`;
      await writeFile(actualPath, actualXml, 'utf8');

      await updateGoldenTheme(actualPath, goldenPath);

      const updated = await readFile(goldenPath, 'utf8');
      expect(updated).toContain('<meta content="0.0.0+GOLDEN_SHA_40_CHARS________________" name="theme-build"/>');
      expect(updated).toContain('<p>Updated</p>');

      await expect(assertGoldenTheme(actualPath, goldenPath)).resolves.toBeUndefined();
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('verifies committed tests/golden/theme.xml contains the placeholder and no literal commit SHA', async () => {
      const golden = await readFile(path.join(ROOT, 'tests/golden/theme.xml'), 'utf8');
      expect(golden).toContain('<meta content="0.0.0+GOLDEN_SHA_40_CHARS________________" name="theme-build"/>');
      expect(golden).not.toMatch(/content="[^"]*\+[0-9a-f]{40}"/i);
    });
  });
});

