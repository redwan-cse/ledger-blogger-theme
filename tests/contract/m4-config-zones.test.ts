import { describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTheme } from '../../tools/generate.js';
import { checkThemeContract, CONTRACT_RULES } from '../../tools/contract-check.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHA = '0123456789abcdef0123456789abcdef01234567';

describe('Milestone M4: Config Zones & Defensive Defaultmarkups', () => {
  describe('Suite 1: Seven Editable Layout Zones (R-NAV-2 AC1, AC6, BR-1)', () => {
    it('declares all seven required layout sections in theme.xml', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const sectionMatches = [...xml.matchAll(/<b:section\b([^>]*)\/?>/g)];
      expect(sectionMatches.length).toBeGreaterThanOrEqual(7);

      const sectionIds = sectionMatches.map((m) => {
        const idMatch = m[1]?.match(/\bid=["']([^"']+)["']/);
        return idMatch ? idMatch[1] : null;
      });

      const requiredSections = ['header', 'navlinks', 'intro', 'topics', 'page_body', 'cta', 'footer'];
      for (const required of requiredSections) {
        expect(sectionIds, `Section '${required}' must be declared`).toContain(required);
      }
    });

    it('enforces showaddelement attributes per zone specification', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const expected: Record<string, { showaddelement: string }> = {
        header: { showaddelement: 'false' },
        navlinks: { showaddelement: 'false' },
        intro: { showaddelement: 'false' },
        topics: { showaddelement: 'false' },
        page_body: { showaddelement: 'false' },
        cta: { showaddelement: 'false' },
        footer: { showaddelement: 'yes' }
      };

      for (const [id, exp] of Object.entries(expected)) {
        const pattern = new RegExp(`<b:section\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i');
        const match = xml.match(pattern);
        expect(match, `Section <b:section id="${id}"> must exist`).not.toBeNull();
        expect(match![0]).toContain(`showaddelement="${exp.showaddelement}"`);
      }
    });

    it('locks Header1 and Blog1 while keeping other widgets editable', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const headerWidget = xml.match(/<b:widget\b[^>]*\bid=["']Header1["'][^>]*>/);
      const blogWidget = xml.match(/<b:widget\b[^>]*\bid=["']Blog1["'][^>]*>/);
      expect(headerWidget).not.toBeNull();
      expect(headerWidget![0]).toContain('locked="true"');
      expect(headerWidget![0]).toContain('version="2"');

      expect(blogWidget).not.toBeNull();
      expect(blogWidget![0]).toContain('locked="true"');
      expect(blogWidget![0]).toContain('version="2"');
      // 'preferred' is a b:section attribute, not a b:widget attribute; Contempo's
      // Blog1 does not carry it and it is an import hazard. It must stay absent.
      expect(blogWidget![0]).not.toContain('preferred=');

      const otherWidgets = ['LinkList1', 'HTML1', 'Label1', 'HTML2', 'HTML3'];
      for (const id of otherWidgets) {
        const match = xml.match(new RegExp(`<b:widget\\b[^>]*\\bid=["']${id}["'][^>]*>`));
        expect(match, `Widget ${id} must exist`).not.toBeNull();
        expect(match![0]).toContain('locked="false"');
        expect(match![0]).toContain('version="2"');
      }
    });

    it('synchronizes layout zones table in README.md with generated theme sections (R-NAV-2 AC6)', async () => {
      const readme = (await readFile(path.join(ROOT, 'README.md'), 'utf8')).replace(/\r\n/g, '\n');
      const match = readme.match(/## Layout zones[\s\S]*?(?=\n##|$)/);
      expect(match, 'README.md must contain a ## Layout zones section').not.toBeNull();

      const rows = match![0].split('\n').filter((l) => l.startsWith('|') && !l.includes('---') && !l.includes('Zone'));
      expect(rows.length).toBe(7);

      const { xml } = await generateTheme({ sha: SHA, write: false });
      for (const row of rows) {
        const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
        const zoneId = cells[1]?.replace(/[`]/g, '') ?? '';
        expect(zoneId.length).toBeGreaterThan(0);

        const secMatch = xml.match(new RegExp(`<b:section\\b[^>]*\\bid=["']${zoneId}["'][^>]*>`));
        expect(secMatch, `Section '${zoneId}' from README must exist in theme.xml`).not.toBeNull();
      }
    });
  });

  describe('Suite 2: Defensive Defaultmarkups across 6 Widget Types (R-NAV-2 AC5)', () => {
    it('declares <b:defaultmarkups> in <head> containing all six widget types', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(xml).toMatch(/<head>[\s\S]*<b:defaultmarkups>[\s\S]*<\/b:defaultmarkups>[\s\S]*<\/head>/);

      const requiredTypes = ['Common', 'PopularPosts', 'FeaturedPost', 'ContactForm', 'BlogArchive', 'Label'];
      for (const type of requiredTypes) {
        const pattern = new RegExp(`<b:defaultmarkup\\b[^>]*\\btype=["'][^"']*\\b${type}\\b[^"']*["']`, 'i');
        expect(xml, `Defaultmarkup for type '${type}' must be declared`).toMatch(pattern);
      }
    });

    it('implements Common defaultmarkup with widgetTitle and preview fallback', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const commonMatch = xml.match(/<b:defaultmarkup\b[^>]*\btype=["']Common["'][\s\S]*?<\/b:defaultmarkup>/);
      expect(commonMatch).not.toBeNull();
      const content = commonMatch![0];
      expect(content).toContain('id="widgetTitle"');
      expect(content).toContain('id="widget-title"');
      expect(content).toContain('id="widgetNotAvailableInPreview"');
    });

    it('implements PopularPosts defaultmarkup with defensive thumbnails and empty fallback', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const ppMatch = xml.match(/<b:defaultmarkup\b[^>]*\btype=["']PopularPosts["'][\s\S]*?<\/b:defaultmarkup>/);
      expect(ppMatch).not.toBeNull();
      const content = ppMatch![0];
      expect(content).toContain('id="snippetedPostContent"');
      expect(content).toContain('id="snippetedPostTitle"');
      expect(content).toContain('id="snippetedPostThumbnail"');
      expect(content).toContain('id="postSnippet"');
      expect(content).toContain('data:messages.noPosts');
      expect(content).toContain('resizeImage');
      expect(content).toContain('loading="lazy"');
    });

    it('implements FeaturedPost defaultmarkup with high-res hero image and empty fallback', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const fpMatch = xml.match(/<b:defaultmarkup\b[^>]*\btype=["']FeaturedPost["'][\s\S]*?<\/b:defaultmarkup>/);
      expect(fpMatch).not.toBeNull();
      const content = fpMatch![0];
      expect(content).toContain('id="snippetedPostContent"');
      expect(content).toContain('id="snippetedPostTitle"');
      expect(content).toContain('id="snippetedPostThumbnail"');
      expect(content).toContain('data:messages.noPosts');
      expect(content).toContain('loading="lazy"');
    });

    it('implements ContactForm defaultmarkup with accessible label bindings and button', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const cfMatch = xml.match(/<b:defaultmarkup\b[^>]*\btype=["']ContactForm["'][\s\S]*?<\/b:defaultmarkup>/);
      expect(cfMatch).not.toBeNull();
      const content = cfMatch![0];
      expect(content).toContain('id="formContent"');
      expect(content).toContain('contact-form-name');
      expect(content).toContain('contact-form-email');
      expect(content).toContain('contact-form-email-message');
      expect(content).toContain('contact-form-button-submit');
      expect(content).toContain('contact-form-error-message');
      expect(content).toContain('contact-form-success-message');
    });

    it('implements BlogArchive defaultmarkup with semantic details/summary disclosure', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const baMatch = xml.match(/<b:defaultmarkup\b[^>]*\btype=["']BlogArchive["'][\s\S]*?<\/b:defaultmarkup>/);
      expect(baMatch).not.toBeNull();
      const content = baMatch![0];
      expect(content).toContain('<details class="blog-archive-details"');
      expect(content).toContain('<summary class="blog-archive-summary"');
      expect(content).toContain('id="flat"');
      expect(content).toContain('id="hierarchy"');
      expect(content).toContain('id="interval"');
    });

    it('implements Label defaultmarkup with list and cloud modes, and empty fallback', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const labelMatch = xml.match(/<b:defaultmarkup\b[^>]*\btype=["']Label["'][\s\S]*?<\/b:defaultmarkup>/);
      expect(labelMatch).not.toBeNull();
      const content = labelMatch![0];
      expect(content).toContain('id="list"');
      expect(content).toContain('id="cloud"');
      expect(content).toContain('data:messages.noLabels');
      expect(content).toContain('expr:href="data:label.url"');
    });
  });

  describe('Suite 3: Navigation & Strict URL Composition Rules (R-NAV-1 AC2, R-V3-2 AC4)', () => {
    it('strictly forbids hardcoded /search/label/ anywhere in src/ source files', async () => {
      async function scanDirectory(dir: string): Promise<string[]> {
        const entries = await readdir(dir, { withFileTypes: true });
        const files: string[] = [];
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...(await scanDirectory(fullPath)));
          } else if (/\.(pug|ts|scss|js)$/.test(entry.name)) {
            files.push(fullPath);
          }
        }
        return files;
      }

      const sourceFiles = await scanDirectory(path.join(ROOT, 'src'));
      for (const file of sourceFiles) {
        const content = await readFile(file, 'utf8');
        expect(content, `File ${file} must not contain hardcoded /search/label/`).not.toMatch(/\/search\/label\//i);
      }
    });

    it('strictly forbids hardcoded /search/label/ anywhere in generated dist/theme.xml', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      expect(xml).not.toMatch(/\/search\/label\//i);
    });

    it('ensures all label links dynamically bind expr:href="data:label.url"', async () => {
      const labelWidget = await readFile(path.join(ROOT, 'src/widgets/label.pug'), 'utf8');
      const labelDefaultmarkup = await readFile(path.join(ROOT, 'src/defaultmarkups/label.pug'), 'utf8');

      expect(labelWidget).toContain("expr:href='data:label.url'");
      expect(labelDefaultmarkup).toContain("expr:href='data:label.url'");
    });
  });

  describe('Suite 4: Zero Empty Container Defensiveness (R-NAV-2 AC3)', () => {
    it('declares all optional layout sections statically without conditional wrappers in theme.pug', async () => {
      const themePug = await readFile(path.join(ROOT, 'src/theme.pug'), 'utf8');
      expect(themePug).not.toMatch(/b:if\b[^)]*b:section/);
      expect(themePug).not.toMatch(/data:view\.isLayoutMode/);
    });

    it('enforces CSS :empty suppression rules on all optional container classes', async () => {
      const layoutScss = await readFile(path.join(ROOT, 'src/styles/layout.scss'), 'utf8');
      expect(layoutScss).toContain('.nav-container:empty');
      expect(layoutScss).toContain('.intro-container:empty');
      expect(layoutScss).toContain('.topics-container:empty');
      expect(layoutScss).toContain('.cta-container:empty');
      expect(layoutScss).toContain('.footer-container:empty');
      expect(layoutScss).toContain('.section:empty');
      expect(layoutScss).toContain('display: none !important');
    });
  });

  describe('Suite 5: Modular Source File Structure & Layout (PROJECT-PLAN §3.3)', () => {
    it('confirms all six defaultmarkup files exist in src/defaultmarkups/', async () => {
      const expected = ['common.pug', 'popular-posts.pug', 'featured-post.pug', 'contact-form.pug', 'blog-archive.pug', 'label.pug'];
      for (const file of expected) {
        const content = await readFile(path.join(ROOT, 'src/defaultmarkups', file), 'utf8');
        expect(content.length).toBeGreaterThan(0);
      }
    });

    it('confirms all required widget files exist in src/widgets/', async () => {
      const expected = ['header.pug', 'blog.pug', 'linklist.pug', 'intro.pug', 'label.pug', 'cta.pug', 'footer.pug', 'html.pug'];
      for (const file of expected) {
        const content = await readFile(path.join(ROOT, 'src/widgets', file), 'utf8');
        expect(content.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Suite 6: Adversarial & Mutation Stress Matrix for M4 Rules', () => {
    it('catches missing section via all-seven-config-zones rule', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const mutated = xml.replace(/<b:section\b[^>]*\bid=["']topics["'][^>]*>[\s\S]*?<\/b:section>/, '');
      const findings = checkThemeContract(mutated).map((f) => f.ruleId);
      expect(findings).toContain('all-seven-config-zones');
    });

    it('catches missing defaultmarkup via defensive-defaultmarkups rule', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const mutated = xml.replace(/<b:defaultmarkup\b[^>]*\btype=["']PopularPosts["'][\s\S]*?<\/b:defaultmarkup>/, '');
      const findings = checkThemeContract(mutated).map((f) => f.ruleId);
      expect(findings).toContain('defensive-defaultmarkups');
    });

    it('catches injected hardcoded /search/label/ URL via no-hardcoded-search-label rule', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const mutated = xml.replace('</main>', '<a href="/search/label/Technology">Tech</a></main>');
      const findings = checkThemeContract(mutated).map((f) => f.ruleId);
      expect(findings).toContain('no-hardcoded-search-label');
    });

    it('catches section discrepancy via readme-zone-parity rule', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const mutated = xml.replace('id="footer"', 'id="footer_changed"');
      const findings = checkThemeContract(mutated).map((f) => f.ruleId);
      expect(findings).toContain('readme-zone-parity');
    });

    it('catches conditional wrapper around section via clean-section-containers rule', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const mutated = xml.replace(/<b:section\b[^>]*\bid=["']navlinks["'][\s\S]*?<\/b:section>/, (m) => `<b:if cond="data:view.isLayoutMode">${m}</b:if>`);
      const findings = checkThemeContract(mutated).map((f) => f.ruleId);
      expect(findings).toContain('clean-section-containers');
    });

    it('maintains comment immunity across all new M4 rule violation patterns', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const commentPayloads = [
        '<a href="/search/label/Banned">Link</a>',
        '<b:defaultmarkup type="PopularPosts"/> missing',
        'missing section topics',
        'footer mismatch'
      ];

      for (const payload of commentPayloads) {
        const safeXmlComment = payload.replace(/--/g, '—').replace(/&/g, 'and');
        const withXmlComment = xml.replace('</body>', `<!-- ${safeXmlComment} --></body>`);
        expect(checkThemeContract(withXmlComment)).toEqual([]);

        const safeBloggerComment = payload.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const withBloggerComment = xml.replace('</main>', `<b:comment>${safeBloggerComment}</b:comment></main>`);
        expect(checkThemeContract(withBloggerComment)).toEqual([]);
      }
    });
  });
});
