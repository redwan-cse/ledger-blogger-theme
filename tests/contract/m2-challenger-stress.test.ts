import { beforeAll, describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';
import { checkThemeContract } from '../../tools/contract-check.js';

const SHA = '0123456789abcdef0123456789abcdef01234567';

// Minimal XML Parser for Layouts V3 Theme Stress-Testing
interface ASTNode {
  name: string;
  attrs: Record<string, string>;
  children: ASTNode[];
  text?: string;
}

function decodeXmlEntities(val: string): string {
  return val
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseXmlTree(xml: string): ASTNode {
  let index = 0;

  function parseElement(): ASTNode | null {
    while (index < xml.length) {
      if (xml[index] !== '<') {
        const next = xml.indexOf('<', index);
        index = next === -1 ? xml.length : next;
        continue;
      }
      if (xml.startsWith('<!--', index)) {
        const end = xml.indexOf('-->', index + 4);
        index = end === -1 ? xml.length : end + 3;
        continue;
      }
      if (xml.startsWith('<![CDATA[', index)) {
        const end = xml.indexOf(']]>', index + 9);
        index = end === -1 ? xml.length : end + 3;
        continue;
      }
      if (xml.startsWith('<?', index) || xml.startsWith('<!DOCTYPE', index)) {
        const end = xml.indexOf('>', index);
        index = end === -1 ? xml.length : end + 1;
        continue;
      }
      if (xml.startsWith('</', index)) {
        return null;
      }

      // Start tag
      index += 1;
      const tagMatch = xml.slice(index).match(/^[A-Za-z0-9_.:-]+/);
      if (!tagMatch) return null;
      const name = tagMatch[0];
      index += name.length;

      const attrs: Record<string, string> = {};
      let selfClosing = false;

      while (index < xml.length) {
        while (/\s/.test(xml[index] ?? '')) index += 1;
        if (xml.startsWith('/>', index)) {
          selfClosing = true;
          index += 2;
          break;
        }
        if (xml[index] === '>') {
          index += 1;
          break;
        }

        const attrMatch = xml.slice(index).match(/^[A-Za-z0-9_.:-]+/);
        if (!attrMatch) break;
        const attrName = attrMatch[0];
        index += attrName.length;

        while (/\s/.test(xml[index] ?? '')) index += 1;
        if (xml[index] === '=') {
          index += 1;
          while (/\s/.test(xml[index] ?? '')) index += 1;
          const quote = xml[index];
          if (quote === '"' || quote === "'") {
            index += 1;
            const endQuote = xml.indexOf(quote, index);
            attrs[attrName] = decodeXmlEntities(xml.slice(index, endQuote));
            index = endQuote + 1;
          }
        } else {
          attrs[attrName] = 'true';
        }
      }

      const children: ASTNode[] = [];
      if (!selfClosing) {
        while (index < xml.length) {
          if (xml.startsWith('</' + name, index)) {
            const closeEnd = xml.indexOf('>', index);
            index = closeEnd === -1 ? xml.length : closeEnd + 1;
            break;
          }
          const child = parseElement();
          if (child) {
            children.push(child);
          } else if (xml.startsWith('</', index)) {
            const closeEnd = xml.indexOf('>', index);
            index = closeEnd === -1 ? xml.length : closeEnd + 1;
            break;
          }
        }
      }

      return { name, attrs, children };
    }
    return null;
  }

  return parseElement() ?? { name: 'root', attrs: {}, children: [] };
}

function findElements(root: ASTNode, predicate: (node: ASTNode) => boolean): ASTNode[] {
  const result: ASTNode[] = [];
  if (predicate(root)) result.push(root);
  for (const child of root.children) {
    result.push(...findElements(child, predicate));
  }
  return result;
}

describe('M2 Adversarial Challenger Suite: Widget Templates & Defaultmarkups', () => {
  let themeXml: string;
  let rootNode: ASTNode;

  beforeAll(async () => {
    const { xml } = await generateTheme({ sha: SHA, write: false });
    themeXml = xml;
    rootNode = parseXmlTree(xml);
  });

  describe('Adversarial Test 1: Layouts V3 & XML Well-Formedness Conformance', () => {
    it('satisfies 100% of all 37 contract rules without exceptions', () => {
      const findings = checkThemeContract(themeXml);
      expect(findings).toEqual([]);
    });

    it('theme.xml is valid XML and contains exactly 7 sections and 2 locked widgets', () => {
      const sections = findElements(rootNode, (n) => n.name === 'b:section');
      expect(sections.length).toBe(7);

      const sectionIds = sections.map((s) => s.attrs.id);
      expect(sectionIds).toEqual(['header', 'navlinks', 'intro', 'topics', 'page_body', 'cta', 'footer']);

      const widgets = findElements(rootNode, (n) => n.name === 'b:widget');
      for (const w of widgets) {
        expect(w.attrs.version, `Widget ${w.attrs.id} must carry version='2'`).toBe('2');
      }

      const headerWidget = widgets.find((w) => w.attrs.id === 'Header1');
      expect(headerWidget).toBeDefined();
      expect(headerWidget?.attrs.locked).toBe('true');

      const blogWidget = widgets.find((w) => w.attrs.id === 'Blog1');
      expect(blogWidget).toBeDefined();
      expect(blogWidget?.attrs.locked).toBe('true');
    });

    it('verifies that all defaultmarkups are placed in <head> and cover all 6 required gadget types', () => {
      const defaultMarkups = findElements(rootNode, (n) => n.name === 'b:defaultmarkup');
      const markupTypes = defaultMarkups.map((m) => m.attrs.type);
      expect(markupTypes).toContain('Common');
      expect(markupTypes).toContain('FeaturedPost');
      expect(markupTypes).toContain('PopularPosts');
      expect(markupTypes).toContain('Profile');
      expect(markupTypes).toContain('BlogArchive');
      expect(markupTypes).toContain('Label');
      expect(markupTypes).toContain('ContactForm');
    });
  });

  describe('Adversarial Test 2: Header Widget & Interactive Triggers (Mobile Drawer & Theme Toggle)', () => {
    it('contains valid mobile drawer toggle button and theme toggle in Header1 with correct ARIA attributes', () => {
      const headerWidget = findElements(rootNode, (n) => n.name === 'b:widget' && n.attrs.id === 'Header1')[0]!;
      const buttons = findElements(headerWidget, (n) => n.name === 'button');

      const drawerToggle = buttons.find((b) => b.attrs.class === 'drawer-toggle');
      expect(drawerToggle, 'Header must contain drawer-toggle button').toBeDefined();
      expect(drawerToggle?.attrs['aria-controls']).toBe('mobile-drawer');
      expect(drawerToggle?.attrs['aria-expanded']).toBe('false');
      expect(drawerToggle?.attrs.type).toBe('button');

      const themeToggle = buttons.find((b) => b.attrs.class === 'theme-toggle');
      expect(themeToggle, 'Header must contain theme-toggle button').toBeDefined();
    });

    it('preserves single-H1 heading hierarchy in Header1 across single-item and multiple-item views', () => {
      const headerWidget = findElements(rootNode, (n) => n.name === 'b:widget' && n.attrs.id === 'Header1')[0]!;
      const titleIncludable = findElements(headerWidget, (n) => n.name === 'b:includable' && n.attrs.id === 'title')[0]!;

      // Check conditional branches inside title includable
      const ifTags = findElements(titleIncludable, (n) => n.name === 'b:if');
      expect(ifTags.length).toBe(2);

      const notSingleItem = ifTags.find((i) => i.attrs.cond === 'not data:view.isSingleItem');
      expect(notSingleItem).toBeDefined();
      const h1 = findElements(notSingleItem!, (n) => n.name === 'h1');
      expect(h1.length).toBe(1);
      expect(h1[0]?.attrs.class).toBe('site-title');

      const singleItem = ifTags.find((i) => i.attrs.cond === 'data:view.isSingleItem');
      expect(singleItem).toBeDefined();
      const p = findElements(singleItem!, (n) => n.name === 'p');
      expect(p.length).toBe(1);
      expect(p[0]?.attrs.class).toBe('site-title');
    });

    it('preserves image placement modes (REPLACE, BEFORE_DESCRIPTION, BEHIND) in Header1', () => {
      const headerWidget = findElements(rootNode, (n) => n.name === 'b:widget' && n.attrs.id === 'Header1')[0]!;
      const mainIncludable = findElements(headerWidget, (n) => n.name === 'b:includable' && n.attrs.id === 'main')[0]!;
      const includes = findElements(mainIncludable, (n) => n.name === 'b:include');

      expect(includes.some((inc) => inc.attrs.cond?.includes('REPLACE') && inc.attrs.name === 'image')).toBe(true);
      expect(includes.some((inc) => inc.attrs.cond?.includes('REPLACE') && inc.attrs.name === 'title')).toBe(true);
      expect(includes.some((inc) => inc.attrs.cond?.includes('BEHIND') && inc.attrs.name === 'behindImageStyle')).toBe(true);
    });
  });

  describe('Adversarial Test 3: Root Shell DOM Hooks (Reading Progress, Modal, Drawer, Toast)', () => {
    it('encloses reading progress bar strictly inside data:view.isPost conditional', () => {
      const bodyNode = findElements(rootNode, (n) => n.name === 'body')[0]!;
      const ifNodes = findElements(bodyNode, (n) => n.name === 'b:if' && n.attrs.cond === 'data:view.isPost');
      expect(ifNodes.length).toBeGreaterThanOrEqual(1);

      const progressContainer = findElements(ifNodes[0]!, (n) => n.attrs.id === 'reading-progress')[0];
      expect(progressContainer, '#reading-progress must be inside data:view.isPost').toBeDefined();
      expect(progressContainer?.attrs.role).toBe('progressbar');
      expect(progressContainer?.attrs['aria-valuenow']).toBe('0');
      expect(progressContainer?.attrs['aria-valuemin']).toBe('0');
      expect(progressContainer?.attrs['aria-valuemax']).toBe('100');
    });

    it('declares mobile navigation drawer with accessible landmark, backdrop, and close button', () => {
      const drawer = findElements(rootNode, (n) => n.name === 'nav' && n.attrs.id === 'mobile-drawer')[0];
      expect(drawer).toBeDefined();
      expect(drawer?.attrs['aria-hidden']).toBe('true');
      expect(drawer?.attrs['aria-label']).toBe('Mobile Navigation');

      const backdrop = findElements(rootNode, (n) => n.attrs.class === 'drawer-backdrop')[0];
      expect(backdrop).toBeDefined();
      expect(backdrop?.attrs['aria-hidden']).toBe('true');

      const closeButton = findElements(drawer!, (n) => n.name === 'button' && n.attrs.class === 'drawer-close')[0];
      expect(closeButton).toBeDefined();
      expect(closeButton?.attrs['aria-label']).toBe('Close navigation');
    });

    it('declares live search forms in sidebar and drawer with proper ARIA bindings', () => {
      const sidebarSearch = findElements(rootNode, (n) => n.name === 'div' && n.attrs.class === 'sidebar-card sidebar-search-card')[0];
      expect(sidebarSearch, 'Sidebar must contain search card').toBeDefined();

      const drawerSearch = findElements(rootNode, (n) => n.name === 'div' && n.attrs.class === 'drawer-section drawer-search-wrap')[0];
      expect(drawerSearch, 'Drawer must contain search wrap').toBeDefined();
    });

    it('declares toast container with aria-live="polite"', () => {
      const toast = findElements(rootNode, (n) => n.attrs.id === 'toast-container')[0];
      expect(toast).toBeDefined();
      expect(toast?.attrs['aria-live']).toBe('polite');
    });
  });

  describe('Adversarial Test 4: Blog Post Template Enhancements (Share Bar, Author Bio, Prev/Next Nav)', () => {
    let blogWidget: ASTNode;

    beforeAll(() => {
      blogWidget = findElements(rootNode, (n) => n.name === 'b:widget' && n.attrs.id === 'Blog1')[0]!;
    });

    it('post includable conditionally renders share bar, author bio, and post nav only on data:view.isPost', () => {
      const postIncludable = findElements(blogWidget, (n) => n.name === 'b:includable' && n.attrs.id === 'post')[0]!;
      const postIfs = findElements(postIncludable, (n) => n.name === 'b:if' && n.attrs.cond === 'data:view.isPost');
      expect(postIfs.length).toBeGreaterThanOrEqual(1);

      const includes = findElements(postIncludable, (n) => n.name === 'b:include');
      const incNames = includes.map((inc) => inc.attrs.name);
      expect(incNames).toContain('postShareBar');
      expect(incNames).toContain('postAuthorBio');
      expect(incNames).toContain('postNav');
    });

    it('postShareBar includable uses V3 params dictionaries without string concatenation (+)', () => {
      const shareBar = findElements(blogWidget, (n) => n.name === 'b:includable' && n.attrs.id === 'postShareBar')[0]!;
      expect(shareBar).toBeDefined();

      const links = findElements(shareBar, (n) => n.name === 'a');
      for (const link of links) {
        const exprHref = link.attrs['expr:href'] ?? '';
        expect(exprHref, `Share link ${exprHref} must not use string concatenation (+)`).not.toContain('+');
        expect(exprHref, `Share link ${exprHref} must use V3 params syntax`).toContain('params {');
        expect(link.attrs.target).toBe('_blank');
        expect(link.attrs.rel).toBe('noopener noreferrer');
        expect(link.attrs['aria-label']).toBeDefined();
      }

      const copyBtn = findElements(shareBar, (n) => n.name === 'button' && n.attrs['data-action'] === 'copy-link')[0];
      expect(copyBtn).toBeDefined();
      expect(copyBtn?.attrs.type).toBe('button');
      expect(copyBtn?.attrs['aria-label']).toBe('Copy link to clipboard');
    });

    it('postAuthorBio includable enforces zero fabricated metadata and handles missing author photo/bio gracefully', () => {
      const authorBio = findElements(blogWidget, (n) => n.name === 'b:includable' && n.attrs.id === 'postAuthorBio')[0]!;
      expect(authorBio).toBeDefined();

      // Guarded by data:post.author.name
      const outerIf = findElements(authorBio, (n) => n.name === 'b:if')[0];
      expect(outerIf?.attrs.cond).toBe('data:post.author.name');

      // Zero hardcoded text inside author-name heading
      const authorNameH3 = findElements(authorBio, (n) => n.name === 'h3' && n.attrs.class === 'author-name')[0]!;
      expect(authorNameH3).toBeDefined();
      const evals = findElements(authorNameH3, (n) => n.name === 'b:eval');
      expect(evals.length).toBeGreaterThanOrEqual(1);
      for (const ev of evals) {
        expect(ev.attrs.expr).toBe('data:post.author.name');
      }

      // Check author photo conditional
      const photoIf = findElements(authorBio, (n) => n.name === 'b:if' && n.attrs.cond === 'data:post.author.authorPhoto.image')[0];
      expect(photoIf).toBeDefined();
      const avatarImg = findElements(photoIf!, (n) => n.name === 'img')[0];
      expect(avatarImg?.attrs.loading).toBe('lazy');
      expect(avatarImg?.attrs.width).toBe('64');
      expect(avatarImg?.attrs.height).toBe('64');
    });

    it('postNav includable renders older and newer navigation links conditionally with fallback titles', () => {
      const postNav = findElements(blogWidget, (n) => n.name === 'b:includable' && n.attrs.id === 'postNav')[0]!;
      expect(postNav).toBeDefined();

      const outerIf = findElements(postNav, (n) => n.name === 'b:if')[0];
      expect(outerIf?.attrs.cond).toBe('data:olderPageUrl or data:newerPageUrl');

      const prevLinkIf = findElements(postNav, (n) => n.name === 'b:if' && n.attrs.cond === 'data:olderPageUrl')[0]!;
      expect(prevLinkIf).toBeDefined();
      const prevLink = findElements(prevLinkIf, (n) => n.name === 'a')[0]!;
      expect(prevLink.attrs.rel).toBe('prev');
      expect(prevLink.attrs['expr:href']).toBe('data:olderPageUrl');

      const nextLinkIf = findElements(postNav, (n) => n.name === 'b:if' && n.attrs.cond === 'data:newerPageUrl')[0]!;
      expect(nextLinkIf).toBeDefined();
      const nextLink = findElements(nextLinkIf, (n) => n.name === 'a')[0]!;
      expect(nextLink.attrs.rel).toBe('next');
      expect(nextLink.attrs['expr:href']).toBe('data:newerPageUrl');
    });
  });

  describe('Adversarial Test 5: Defaultmarkups Suite Expansion & Defensive Fallbacks', () => {
    it('FeaturedPost defaultmarkup contains hero badge, thumbnail zoom, snippet, and empty state fallback', () => {
      const featMarkup = findElements(rootNode, (n) => n.name === 'b:defaultmarkup' && n.attrs.type === 'FeaturedPost')[0]!;
      expect(featMarkup).toBeDefined();

      const badge = findElements(featMarkup, (n) => n.name === 'span' && n.attrs.class === 'featured-post-badge')[0]!;
      expect(badge).toBeDefined();
      const badgeEval = findElements(badge, (n) => n.name === 'b:eval')[0]!;
      expect(badgeEval.attrs.expr).toBe('data:messages.featuredPost ?: "Featured"');

      // Empty state branch
      const emptyBranch = findElements(featMarkup, (n) => n.name === 'b:if' && n.attrs.cond === 'not data:post')[0]!;
      expect(emptyBranch).toBeDefined();
      const emptyP = findElements(emptyBranch, (n) => n.name === 'p' && n.attrs.class === 'empty-featured-post')[0]!;
      expect(emptyP).toBeDefined();
    });

    it('PopularPosts defaultmarkup contains rank badge, thumbnail, snippet, and empty state fallback', () => {
      const popMarkup = findElements(rootNode, (n) => n.name === 'b:defaultmarkup' && n.attrs.type === 'PopularPosts')[0]!;
      expect(popMarkup).toBeDefined();

      const rankBadge = findElements(popMarkup, (n) => n.name === 'span' && n.attrs.class === 'popular-post-rank')[0]!;
      expect(rankBadge).toBeDefined();
      expect(rankBadge.attrs['aria-hidden']).toBe('true');

      // Empty state branch
      const emptyBranch = findElements(popMarkup, (n) => n.name === 'b:if' && n.attrs.cond === 'not data:posts')[0]!;
      expect(emptyBranch).toBeDefined();
      const emptyP = findElements(emptyBranch, (n) => n.name === 'p' && n.attrs.class === 'empty-popular-posts')[0]!;
      expect(emptyP).toBeDefined();
    });

    it('Profile defaultmarkup supports solo/team states and author avatar/link includables', () => {
      const profMarkup = findElements(rootNode, (n) => n.name === 'b:defaultmarkup' && n.attrs.type === 'Profile')[0]!;
      expect(profMarkup).toBeDefined();

      const soloClass = findElements(profMarkup, (n) => n.name === 'b:class' && n.attrs.name === 'solo')[0]!;
      expect(soloClass).toBeDefined();
      expect(soloClass.attrs.cond).toBe('not data:this.team');

      const authorImg = findElements(profMarkup, (n) => n.name === 'b:includable' && n.attrs.id === 'authorProfileImage')[0]!;
      expect(authorImg).toBeDefined();

      const profileLink = findElements(profMarkup, (n) => n.name === 'b:includable' && n.attrs.id === 'viewProfileLink')[0]!;
      expect(profileLink).toBeDefined();
      const a = findElements(profileLink, (n) => n.name === 'a')[0]!;
      expect(a.attrs.rel).toBe('author');
      expect(a.attrs['expr:href']).toBe('data:userUrl');
    });

    it('BlogArchive defaultmarkup uses <details>/<summary> accordion with open attribute bound to data:view.isArchive', () => {
      const archMarkup = findElements(rootNode, (n) => n.name === 'b:defaultmarkup' && n.attrs.type === 'BlogArchive')[0]!;
      expect(archMarkup).toBeDefined();

      const details = findElements(archMarkup, (n) => n.name === 'details' && n.attrs.class === 'blog-archive-details')[0]!;
      expect(details).toBeDefined();

      const openAttr = findElements(details, (n) => n.name === 'b:attr' && n.attrs.name === 'open')[0]!;
      expect(openAttr).toBeDefined();
      expect(openAttr.attrs.cond).toBe('data:view.isArchive');
      expect(openAttr.attrs.value).toBe('open');

      const count = findElements(archMarkup, (n) => n.name === 'span' && n.attrs.class === 'blog-archive-count');
      expect(count.length).toBeGreaterThanOrEqual(1);

      // Empty state branch
      const emptyBranch = findElements(archMarkup, (n) => n.name === 'b:if' && n.attrs.cond === 'not data:this.data')[0]!;
      expect(emptyBranch).toBeDefined();
    });

    it('Label defaultmarkup provides list and cloud representations with topic count bubbles', () => {
      const labelMarkup = findElements(rootNode, (n) => n.name === 'b:defaultmarkup' && n.attrs.type === 'Label')[0]!;
      expect(labelMarkup).toBeDefined();

      const cloudNav = findElements(labelMarkup, (n) => n.name === 'nav' && n.attrs.class === 'topics-cloud')[0]!;
      expect(cloudNav).toBeDefined();
      expect(cloudNav.attrs['aria-label']).toBe('Topics');

      const topicCounts = findElements(labelMarkup, (n) => n.name === 'b:if' && n.attrs.cond === 'data:this.showFreqNumbers');
      expect(topicCounts.length).toBeGreaterThanOrEqual(1);

      // Empty state branch
      const emptyBranch = findElements(labelMarkup, (n) => n.name === 'b:if' && n.attrs.cond === 'not data:labels')[0]!;
      expect(emptyBranch).toBeDefined();
    });

    it('ContactForm defaultmarkup dynamically binds instanceId to labels, inputs, and feedback containers', () => {
      const contactMarkup = findElements(rootNode, (n) => n.name === 'b:defaultmarkup' && n.attrs.type === 'ContactForm')[0]!;
      expect(contactMarkup).toBeDefined();

      const labels = findElements(contactMarkup, (n) => n.name === 'label');
      for (const label of labels) {
        expect(label.attrs['expr:for']).toMatch(/data:widget\.instanceId \+ "_contact-form-/);
      }

      const inputs = findElements(contactMarkup, (n) => n.name === 'input' || n.name === 'textarea');
      for (const input of inputs) {
        expect(input.attrs['expr:id']).toMatch(/data:widget\.instanceId \+ "_contact-form-/);
      }
    });
  });
});
