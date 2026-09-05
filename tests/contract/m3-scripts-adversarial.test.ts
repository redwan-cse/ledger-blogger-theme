import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTheme } from '../../tools/generate.js';
import { checkThemeContract } from '../../tools/contract-check.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHA = '0123456789abcdef0123456789abcdef01234567';

describe('Milestone 3: Interactive Client Scripts (src/scripts/main.ts)', () => {
  describe('Source Code & Contract Alignment', () => {
    it('declares all 4 required M3 interactive modules in main.ts', async () => {
      const scriptSource = await readFile(path.join(ROOT, 'src/scripts/main.ts'), 'utf8');

      // Module 1: Reading Progress
      expect(scriptSource).toContain('initReadingProgress');
      expect(scriptSource).toContain('reading-progress');
      expect(scriptSource).toContain('reading-progress-bar');
      expect(scriptSource).toContain('requestAnimationFrame');
      expect(scriptSource).toMatch(/addEventListener\(\s*['"]scroll['"],\s*\w+,\s*\{\s*passive:\s*true\s*\}\s*\)/);
      expect(scriptSource).toMatch(/addEventListener\(\s*['"]resize['"],\s*\w+,\s*\{\s*passive:\s*true\s*\}\s*\)/);

      // Module 2: Mobile Navigation Drawer
      expect(scriptSource).toContain('initMobileDrawer');
      expect(scriptSource).toContain('#mobile-drawer');
      expect(scriptSource).toContain('.drawer-backdrop');
      expect(scriptSource).toContain('.drawer-toggle');
      expect(scriptSource).toContain('.drawer-close');
      expect(scriptSource).toContain('drawer-open');
      expect(scriptSource).toContain('aria-expanded');
      expect(scriptSource).toContain('aria-hidden');

      // Module 3: Live Search & Dropdown
      expect(scriptSource).toContain('initLiveSearch');
      expect(scriptSource).toContain('.sidebar-search-card');
      expect(scriptSource).toContain('.drawer-search-wrap');
      expect(scriptSource).toContain('.search-results-dropdown');
      expect(scriptSource).toContain('feeds/posts/summary');

      // Module 4: Share Copy & Toast
      expect(scriptSource).toContain('showToast');
      expect(scriptSource).toContain('initShareCopy');
      expect(scriptSource).toContain('copyToClipboard');
      expect(scriptSource).toContain('toast-container');
      expect(scriptSource).toContain('copy-link');
      expect(scriptSource).toContain('Link copied to clipboard!');

      // Module 13: Blogger Follow Centered Popup
      expect(scriptSource).toContain('initBloggerFollowPopup');
      expect(scriptSource).toContain('BloggerFollowPrompt');
      expect(scriptSource).toContain('followers/follow');

      // Progressive Enhancement
      expect(scriptSource).toContain('classList.add(\'js\')');
    });

    it('synchronizes DOM hooks between Pug templates and main.ts', async () => {
      const [themePug, headerPug, postPug, scriptSource] = await Promise.all([
        readFile(path.join(ROOT, 'src/theme.pug'), 'utf8'),
        readFile(path.join(ROOT, 'src/widgets/header.pug'), 'utf8'),
        readFile(path.join(ROOT, 'src/widgets/blog-post.pug'), 'utf8'),
        readFile(path.join(ROOT, 'src/scripts/main.ts'), 'utf8')
      ]);

      // Reading progress hooks
      expect(themePug).toContain('#reading-progress');
      expect(themePug).toContain('.reading-progress-bar');
      expect(scriptSource).toContain('reading-progress');

      // Drawer hooks
      expect(themePug).toContain('#mobile-drawer');
      expect(themePug).toContain('.drawer-backdrop');
      expect(themePug).toContain('.drawer-close');
      expect(headerPug).toContain('.drawer-toggle');

      // Search hooks
      expect(themePug).toContain('.sidebar-search-card');
      expect(themePug).toContain('.drawer-search-wrap');
      expect(themePug).toContain('.search-results-dropdown');

      // Share button & toast container hooks
      expect(postPug).toContain('data-action=\'copy-link\'');
      expect(themePug).toContain('#toast-container');

      // Blogger Follow hooks
      expect(themePug).toContain('followers/follow');
      expect(postPug).toContain('followers/follow');
      expect(scriptSource).toContain('followers/follow');
    });
  });

  describe('Theme Compilation & Inlined Client Script', () => {
    it('compiles theme XML with valid inlined script within CDATA', async () => {
      const { xml, bytes } = await generateTheme({ sha: SHA, write: false });
      expect(bytes).toBeLessThanOrEqual(500_000);
      expect(bytes).toBeGreaterThan(50_000);

      // Verify CDATA wrapping
      expect(xml).toContain('//<![CDATA[');
      expect(xml).toContain('//]]>');

      // Verify minified client script is present in compiled output
      expect(xml).toContain('document.documentElement.classList.add("js")');
      expect(xml).toContain('reading-progress');
      expect(xml).toContain('mobile-drawer');
      expect(xml).toContain('sidebar-search');
      expect(xml).toContain('toast-container');
      expect(xml).toContain('BloggerFollowPrompt');
    });

    it('passes all 37 contract checks with zero findings', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const findings = checkThemeContract(xml);
      expect(findings).toEqual([]);
    });

    it('ensures no external script dependencies are introduced', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      // Theme should not declare hardcoded external script dependencies (CDN, external frameworks)
      const externalScripts = xml.match(/<script\b[^>]*\bsrc=['"]https?:\/\/[^'"]+['"]/gi) ?? [];
      expect(externalScripts).toEqual([]);
    });
  });
});
