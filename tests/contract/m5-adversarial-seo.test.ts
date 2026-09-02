import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';

// --- Blogger V3 Template Simulation Engine for SEO, Metadata & Shell ---

export interface MockBlogData {
  title: string;
  canonicalHomepageUrl: string;
  metaDescription?: string;
  postImageThumbnailUrl?: string;
  languageDirection?: string;
  locale?: { language: string };
}

export interface MockPostData {
  id?: string;
  title: string;
  body?: string;
  snippets?: { long?: string; short?: string };
  date?: { iso8601: string };
  lastUpdated?: { iso8601: string };
  author?: {
    name: string;
    profileUrl?: string;
    authorPhoto?: { image?: string };
  };
}

export interface MockViewData {
  title: string;
  description?: string;
  url: { canonical: string };
  featuredImage?: string;
  isHomepage?: boolean;
  isPost?: boolean;
  isPage?: boolean;
  isSearch?: boolean;
  isLabelSearch?: boolean;
  isArchive?: boolean;
  isMultipleItems?: boolean;
  isSingleItem?: boolean;
  isError?: boolean;
  isLayoutMode?: boolean;
}

export interface MockRenderContext {
  blog: MockBlogData;
  view: MockViewData;
  widgets?: {
    Blog?: {
      first?: {
        posts?: {
          first?: MockPostData;
        };
      };
    };
  };
  posts?: MockPostData[];
}

/**
 * Standard Blogger V3 JSON escaping (.jsonEscaped modifier)
 */
export function bloggerJsonEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/[\b]/g, '\\b')
    .replace(/[\u0000-\u001f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/**
 * Standard Blogger V3 HTML escaping (.escaped modifier)
 */
export function bloggerHtmlEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Unescape HTML entities for extracted attribute contents
 */
export function bloggerHtmlUnescape(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Standard Blogger V3 snippet function
 */
export function bloggerSnippet(
  text: string,
  options: { length?: number; links?: boolean; linebreaks?: boolean; ellipsis?: boolean } = {}
): string {
  if (!text) return '';
  let cleaned = text;
  let prevCleaned: string;
  do {
    prevCleaned = cleaned;
    cleaned = cleaned.replace(/<[^>]+>/g, '');
  } while (cleaned !== prevCleaned);
  if (options.linebreaks === false) {
    cleaned = cleaned.replace(/[\r\n\t]+/g, ' ');
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  const maxLen = options.length ?? 250;
  if (cleaned.length <= maxLen) {
    return cleaned;
  }
  const truncated = cleaned.slice(0, maxLen);
  return options.ellipsis ? `${truncated}...` : truncated;
}

/**
 * Renders the head metadata and JSON-LD from the theme XML for a given context
 */
export function renderHeadMetadata(themeXml: string, ctx: MockRenderContext): {
  html: string;
  jsonLdScripts: any[];
  metaTags: Record<string, string>;
  rawMetaTags: Record<string, string>;
  linkCanonical: string | null;
} {
  const headMatch = themeXml.match(/<head>([\s\S]*?)<\/head>/);
  if (!headMatch) throw new Error('No <head> found in theme XML');
  const headContent = headMatch[1] ?? '';

  let output = headContent;

  // 1. Resolve Link Canonical
  const canonicalUrl = ctx.view.url.canonical;
  output = output.replace(/<link rel="canonical" expr:href="data:view\.url\.canonical"\/>/g, `<link rel="canonical" href="${bloggerHtmlEscape(canonicalUrl)}"/>`);

  // 2. Resolve Meta Description block
  const viewDesc = ctx.view.description;
  const blogDesc = ctx.blog.metaDescription;
  let resolvedDesc = '';
  if (viewDesc) {
    resolvedDesc = `<meta name="description" content="${bloggerHtmlEscape(viewDesc)}"/>`;
  } else if (blogDesc) {
    resolvedDesc = `<meta name="description" content="${bloggerHtmlEscape(blogDesc)}"/>`;
  }
  output = output.replace(/<b:if cond="data:view\.description">\s*<meta name="description"[^>]+>\s*<\/b:if>\s*<b:if cond="not data:view\.description and data:blog\.metaDescription">\s*<meta name="description"[^>]+>\s*<\/b:if>/g, resolvedDesc);

  // 3. Resolve OpenGraph Site Name
  output = output.replace(/<meta property="og:site_name" expr:content="data:blog\.title\.escaped"\/>/g, `<meta property="og:site_name" content="${bloggerHtmlEscape(ctx.blog.title)}"/>`);

  // 4. Resolve OpenGraph Type (article on isPost, website elsewhere)
  const ogType = ctx.view.isPost ? 'article' : 'website';
  output = output.replace(/<b:if cond="data:view\.isPost">\s*<meta property="og:type" content="article"\/>\s*<\/b:if>\s*<b:if cond="not data:view\.isPost">\s*<meta property="og:type" content="website"\/>\s*<\/b:if>/g, `<meta property="og:type" content="${ogType}"/>`);

  // 5. Resolve OpenGraph Title & URL
  output = output.replace(/<meta\b[^>]*property="og:title"[^>]*\/?>/g, `<meta property="og:title" content="${bloggerHtmlEscape(ctx.view.title)}"/>`);
  output = output.replace(/<meta\b[^>]*property="og:url"[^>]*\/?>/g, `<meta property="og:url" content="${bloggerHtmlEscape(canonicalUrl)}"/>`);

  // 6. Resolve OpenGraph Description
  const ogDesc = viewDesc || blogDesc || ctx.view.title;
  output = output.replace(/<b:if cond="data:view\.description">\s*<meta [^>]*property="og:description"[^>]*\/>\s*<\/b:if>\s*<b:if cond="not data:view\.description and data:blog\.metaDescription">\s*<meta [^>]*property="og:description"[^>]*\/>\s*<\/b:if>\s*<b:if cond="not data:view\.description and not data:blog\.metaDescription">\s*<meta [^>]*property="og:description"[^>]*\/>\s*<\/b:if>/g, `<meta property="og:description" content="${bloggerHtmlEscape(ogDesc)}"/>`);

  // 7. Resolve OpenGraph Image
  let resolvedOgImg = '';
  if (ctx.view.featuredImage) {
    resolvedOgImg = `<meta property="og:image" content="${bloggerHtmlEscape(ctx.view.featuredImage)}"/>`;
  } else if (ctx.blog.postImageThumbnailUrl) {
    resolvedOgImg = `<meta property="og:image" content="${bloggerHtmlEscape(ctx.blog.postImageThumbnailUrl)}"/>`;
  }
  output = output.replace(/<b:if cond="data:view\.featuredImage">\s*<meta [^>]*property="og:image"[^>]*\/>\s*<\/b:if>\s*<b:if cond="not data:view\.featuredImage and data:blog\.postImageThumbnailUrl">\s*<meta [^>]*property="og:image"[^>]*\/>\s*<\/b:if>/g, resolvedOgImg);

  // 8. Resolve Twitter Card & Image
  let resolvedTwitter = '';
  if (ctx.view.featuredImage) {
    resolvedTwitter = `<meta name="twitter:card" content="summary_large_image"/>\n<meta name="twitter:image" content="${bloggerHtmlEscape(ctx.view.featuredImage)}"/>`;
  } else if (ctx.blog.postImageThumbnailUrl) {
    resolvedTwitter = `<meta name="twitter:card" content="summary_large_image"/>\n<meta name="twitter:image" content="${bloggerHtmlEscape(ctx.blog.postImageThumbnailUrl)}"/>`;
  } else {
    resolvedTwitter = `<meta name="twitter:card" content="summary"/>`;
  }
  output = output.replace(/<b:if cond="data:view\.featuredImage">\s*<meta [^>]*name="twitter:card"[^>]*\/>\s*<meta [^>]*name="twitter:image"[^>]*\/>\s*<\/b:if>\s*<b:if cond="not data:view\.featuredImage and data:blog\.postImageThumbnailUrl">\s*<meta [^>]*name="twitter:card"[^>]*\/>\s*<meta [^>]*name="twitter:image"[^>]*\/>\s*<\/b:if>\s*<b:if cond="not data:view\.featuredImage and not data:blog\.postImageThumbnailUrl">\s*<meta [^>]*name="twitter:card"[^>]*\/>\s*<\/b:if>/g, resolvedTwitter);

  // 9. Resolve Twitter Title & Description
  output = output.replace(/<meta\b[^>]*name="twitter:title"[^>]*\/?>/g, `<meta name="twitter:title" content="${bloggerHtmlEscape(ctx.view.title)}"/>`);
  output = output.replace(/<b:if cond="data:view\.description">\s*<meta [^>]*name="twitter:description"[^>]*\/>\s*<\/b:if>\s*<b:if cond="not data:view\.description and data:blog\.metaDescription">\s*<meta [^>]*name="twitter:description"[^>]*\/>\s*<\/b:if>\s*<b:if cond="not data:view\.description and not data:blog\.metaDescription">\s*<meta [^>]*name="twitter:description"[^>]*\/>\s*<\/b:if>/g, `<meta name="twitter:description" content="${bloggerHtmlEscape(ogDesc)}"/>`);

  // 10. Resolve WebSite JSON-LD
  const shouldRenderWebSite = Boolean(ctx.view.isHomepage || ctx.view.isSearch);
  if (shouldRenderWebSite) {
    const webSiteJson = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: ctx.blog.title,
      url: ctx.blog.canonicalHomepageUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${ctx.blog.canonicalHomepageUrl.replace(/\/+$/, '')}/search?q={search_term_string}`
        },
        'query-input': 'required name=search_term_string'
      }
    }, null, 2);

    output = output.replace(/<b:if cond="data:view\.isHomepage or data:view\.isSearch">[\s\S]*?<script type="application\/ld\+json">([\s\S]*?)<\/script>\s*<\/b:if>/g, `<script type="application/ld+json">\n${webSiteJson}\n</script>`);
  } else {
    output = output.replace(/<b:if cond="data:view\.isHomepage or data:view\.isSearch">[\s\S]*?<\/b:if>/g, '');
  }

  // 11. Resolve BlogPosting JSON-LD
  const shouldRenderBlogPosting = Boolean(ctx.view.isPost);
  if (shouldRenderBlogPosting) {
    const post = ctx.widgets?.Blog?.first?.posts?.first ?? ctx.posts?.[0];
    const postSnippetRaw = post?.snippets?.long || ctx.view.description || ctx.view.title;
    const postSnippetClean = bloggerSnippet(postSnippetRaw, { length: 250, links: false, linebreaks: false, ellipsis: true });

    const blogPostingObj: any = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl
      },
      headline: ctx.view.title,
      description: postSnippetClean,
      datePublished: post?.date?.iso8601 ?? '2026-08-16T00:00:00Z'
    };

    if (post?.lastUpdated?.iso8601) {
      blogPostingObj.dateModified = post.lastUpdated.iso8601;
    }

    if (ctx.view.featuredImage) {
      blogPostingObj.image = ctx.view.featuredImage;
    }

    const authorObj: any = {
      '@type': 'Person',
      name: post?.author?.name ?? 'Admin'
    };
    if (post?.author?.profileUrl) {
      authorObj.url = post.author.profileUrl;
    }
    if (post?.author?.authorPhoto?.image) {
      authorObj.image = post.author.authorPhoto.image;
    }
    blogPostingObj.author = authorObj;

    blogPostingObj.publisher = {
      '@type': 'Organization',
      name: ctx.blog.title
    };

    const blogPostingJson = JSON.stringify(blogPostingObj, null, 2);
    output = output.replace(/<b:if cond="data:view\.isPost">[\s\S]*?<script type="application\/ld\+json">([\s\S]*?)<\/script>\s*<\/b:with>\s*<\/b:if>/g, `<script type="application/ld+json">\n${blogPostingJson}\n</script>`);
  } else {
    output = output.replace(/<b:if cond="data:view\.isPost">[\s\S]*?<script type="application\/ld\+json">([\s\S]*?)<\/script>\s*<\/b:with>\s*<\/b:if>/g, '');
  }

  // Extract all script tags and parse JSON
  const scriptMatches = [...output.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const jsonLdScripts = scriptMatches.map((m) => JSON.parse(m[1] ?? '{}'));

  // Extract meta tags
  const rawMetaTags: Record<string, string> = {};
  const metaTags: Record<string, string> = {};
  const metaMatches = [...output.matchAll(/<meta\s+([^>]+)\/?>/g)];
  for (const m of metaMatches) {
    const attrs = m[1] ?? '';
    const nameMatch = attrs.match(/(?:name|property)="([^"]+)"/);
    const contentMatch = attrs.match(/content="([^"]*)"/);
    if (nameMatch && contentMatch) {
      const key = nameMatch[1]!;
      const rawVal = contentMatch[1]!;
      rawMetaTags[key] = rawVal;
      metaTags[key] = bloggerHtmlUnescape(rawVal);
    }
  }

  // Extract canonical link
  const canonicalMatch = output.match(/<link rel="canonical"\s+href="([^"]+)"\/>/);
  const linkCanonical = canonicalMatch ? bloggerHtmlUnescape(canonicalMatch[1] ?? '') : null;

  return { html: output, jsonLdScripts, metaTags, rawMetaTags, linkCanonical };
}

/**
 * Direct XML Literal JSON Escaping Evaluator for Edge Cases
 */
export function evaluateRawXmlJsonLd(
  templateSnippet: string,
  options: {
    canonicalUrl: string;
    title: string;
    snippet: string;
    datePublished: string;
    dateModified?: string | null;
    featuredImage?: string | null;
    authorName: string;
    authorProfileUrl?: string | null;
    authorPhotoImage?: string | null;
    blogTitle: string;
    canonicalHomepageUrl: string;
  }
): any {
  let rendered = templateSnippet;

  // 1. Mandatory replacements
  rendered = rendered.replace(/<data:view\.url\.canonical\.jsonEscaped\/>/g, bloggerJsonEscape(options.canonicalUrl));
  rendered = rendered.replace(/<data:view\.title\.jsonEscaped\/>/g, bloggerJsonEscape(options.title));
  rendered = rendered.replace(/<b:eval expr='snippet\([^']+\)\.jsonEscaped'\/>/g, bloggerJsonEscape(options.snippet));
  rendered = rendered.replace(/<data:post\.date\.iso8601\.jsonEscaped\/>/g, bloggerJsonEscape(options.datePublished));
  rendered = rendered.replace(/<data:post\.author\.name\.jsonEscaped\/>/g, bloggerJsonEscape(options.authorName));
  rendered = rendered.replace(/<data:blog\.title\.jsonEscaped\/>/g, bloggerJsonEscape(options.blogTitle));
  rendered = rendered.replace(/<b:eval expr='\(data:blog\.canonicalHomepageUrl path "favicon\.ico"\)\.jsonEscaped'\/>/g, bloggerJsonEscape(options.canonicalHomepageUrl + '/favicon.ico'));

  // 2. Conditional: dateModified
  if (options.dateModified) {
    rendered = rendered.replace(
      /<b:if cond=['"]data:post\.lastUpdated['"]>([\s\S]*?)<\/b:if>/g,
      `, "dateModified": "${bloggerJsonEscape(options.dateModified)}"`
    );
  } else {
    rendered = rendered.replace(/<b:if cond=['"]data:post\.lastUpdated['"]>[\s\S]*?<\/b:if>/g, '');
  }

  // 3. Conditional: featuredImage
  if (options.featuredImage) {
    rendered = rendered.replace(
      /<b:if cond=['"]data:view\.featuredImage['"]>([\s\S]*?)<\/b:if>/g,
      `, "image": "${bloggerJsonEscape(options.featuredImage)}"`
    );
  } else {
    rendered = rendered.replace(/<b:if cond=['"]data:view\.featuredImage['"]>[\s\S]*?<\/b:if>/g, '');
  }

  // 4. Conditional: author.profileUrl
  if (options.authorProfileUrl) {
    rendered = rendered.replace(
      /<b:if cond=['"]data:post\.author\.profileUrl['"]>([\s\S]*?)<\/b:if>/g,
      `, "url": "${bloggerJsonEscape(options.authorProfileUrl)}"`
    );
  } else {
    rendered = rendered.replace(/<b:if cond=['"]data:post\.author\.profileUrl['"]>[\s\S]*?<\/b:if>/g, '');
  }

  // 5. Conditional: authorPhoto.image
  if (options.authorPhotoImage) {
    rendered = rendered.replace(
      /<b:if cond=['"]data:post\.author\.authorPhoto\.image['"]>([\s\S]*?)<\/b:if>/g,
      `, "image": "${bloggerJsonEscape(options.authorPhotoImage)}"`
    );
  } else {
    rendered = rendered.replace(/<b:if cond=['"]data:post\.author\.authorPhoto\.image['"]>[\s\S]*?<\/b:if>/g, '');
  }

  return JSON.parse(rendered);
}

/**
 * Evaluates H1 heading hierarchy for a simulated view
 */
export function evaluateHeadingHierarchy(ctx: MockRenderContext): {
  headerHeadingTag: 'h1' | 'p';
  blogHeadingTags: string[];
  totalH1Count: number;
} {
  const isSingleItem = Boolean(ctx.view.isSingleItem);
  const headerHeadingTag: 'h1' | 'p' = isSingleItem ? 'p' : 'h1';

  const blogHeadingTags: string[] = [];
  if (ctx.view.isError) {
    blogHeadingTags.push('h2');
  } else if (ctx.view.isMultipleItems) {
    const postCount = ctx.posts?.length ?? 0;
    if (postCount === 0) {
      blogHeadingTags.push('h2'); // empty state title
    } else {
      for (let i = 0; i < postCount; i++) {
        blogHeadingTags.push('h2'); // each post title is h2
      }
    }
  } else if (ctx.view.isSingleItem) {
    blogHeadingTags.push('h1'); // single item post title is h1
  }

  let totalH1Count = 0;
  if (headerHeadingTag === 'h1') totalH1Count += 1;
  for (const t of blogHeadingTags) {
    if (t === 'h1') totalH1Count += 1;
  }

  return { headerHeadingTag, blogHeadingTags, totalH1Count };
}

const SHA = '0123456789abcdef0123456789abcdef01234567';

describe('Empirical Challenge: Milestone M5 SEO, JSON-LD, & Social Metadata Robustness', () => {
  let themeXml = '';

  it('compiles theme XML cleanly before running empirical stress tests', async () => {
    const res = await generateTheme({ sha: SHA, write: false });
    expect(res.xml.length).toBeGreaterThan(0);
    themeXml = res.xml;
  });

  describe('Suite 1: JSON.parse Validity & Structure Across All 10 View Types', () => {
    const baseBlog: MockBlogData = {
      title: 'Ledger Official Test Blog',
      canonicalHomepageUrl: 'https://test-ledger.blogspot.com',
      metaDescription: 'A clean, modern financial & architectural blog theme.'
    };

    const basePost: MockPostData = {
      id: 'post-101',
      title: 'Deep Dive: Layouts V3 Engine Mechanics',
      snippets: { long: 'Exploring how Blogger V3 compiles expressions into native server-side trees.' },
      date: { iso8601: '2026-08-16T00:00:00Z' },
      lastUpdated: { iso8601: '2026-08-16T08:30:00Z' },
      author: {
        name: 'Jane Architect',
        profileUrl: 'https://www.blogger.com/profile/01928374',
        authorPhoto: { image: 'https://resources.blogblog.com/img/avatar.png' }
      }
    };

    const tenViews: Array<{ name: string; view: MockViewData }> = [
      {
        name: '1. home-p1 (Homepage index)',
        view: {
          title: 'Ledger Official Test Blog',
          url: { canonical: 'https://test-ledger.blogspot.com/' },
          isHomepage: true,
          isMultipleItems: true
        }
      },
      {
        name: '2. home-p2 (Paged Homepage)',
        view: {
          title: 'Ledger Official Test Blog',
          url: { canonical: 'https://test-ledger.blogspot.com/search?updated-max=2026-01-01' },
          isHomepage: false,
          isMultipleItems: true
        }
      },
      {
        name: '3. label (Label Search Filter)',
        view: {
          title: 'Posts tagged Architecture - Ledger',
          url: { canonical: 'https://test-ledger.blogspot.com/search/label/Architecture' },
          isLabelSearch: true,
          isSearch: true,
          isMultipleItems: true
        }
      },
      {
        name: '4. search (Keyword Query Search)',
        view: {
          title: 'Search results for "Blogger V3" - Ledger',
          url: { canonical: 'https://test-ledger.blogspot.com/search?q=Blogger+V3' },
          isSearch: true,
          isMultipleItems: true
        }
      },
      {
        name: '5. archive (Monthly/Yearly Archive)',
        view: {
          title: 'August 2026 Archive - Ledger',
          url: { canonical: 'https://test-ledger.blogspot.com/2026/08/' },
          isArchive: true,
          isMultipleItems: true
        }
      },
      {
        name: '6. post (Single Article View)',
        view: {
          title: 'Deep Dive: Layouts V3 Engine Mechanics',
          url: { canonical: 'https://test-ledger.blogspot.com/2026/08/v3-mechanics.html' },
          featuredImage: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b',
          isPost: true,
          isSingleItem: true
        }
      },
      {
        name: '7. static-page (Static Page / About)',
        view: {
          title: 'About Ledger Theme',
          url: { canonical: 'https://test-ledger.blogspot.com/p/about.html' },
          isPage: true,
          isSingleItem: true
        }
      },
      {
        name: '8. empty-result (Zero Search Matches)',
        view: {
          title: 'Search: No matching posts',
          url: { canonical: 'https://test-ledger.blogspot.com/search?q=empty_match_term' },
          isSearch: true,
          isMultipleItems: true
        }
      },
      {
        name: '9. error (404 Page Not Found)',
        view: {
          title: '404 Page Not Found - Ledger',
          url: { canonical: 'https://test-ledger.blogspot.com/404.html' },
          isError: true
        }
      },
      {
        name: '10. layout-mode (Blogger Theme Customizer / Admin Preview)',
        view: {
          title: 'Ledger Theme Preview',
          url: { canonical: 'https://test-ledger.blogspot.com/?b_preview=1' },
          isLayoutMode: true
        }
      }
    ];

    for (const testCase of tenViews) {
      it(`renders valid metadata & JSON-LD without parse errors on: ${testCase.name}`, () => {
        const result = renderHeadMetadata(themeXml, {
          blog: baseBlog,
          view: testCase.view,
          widgets: { Blog: { first: { posts: { first: basePost } } } },
          posts: [basePost]
        });

        expect(result.linkCanonical).toBe(testCase.view.url.canonical);
        expect(result.metaTags['og:title']).toBe(testCase.view.title);
        expect(result.metaTags['twitter:title']).toBe(testCase.view.title);

        if (testCase.view.isPost) {
          expect(result.metaTags['og:type']).toBe('article');
          expect(result.jsonLdScripts.length).toBe(1);
          const posting = result.jsonLdScripts[0];
          expect(posting['@type']).toBe('BlogPosting');
          expect(posting.headline).toBe(testCase.view.title);
          expect(posting.mainEntityOfPage['@id']).toBe(testCase.view.url.canonical);
          expect(posting.publisher['@type']).toBe('Organization');
          expect(posting.publisher.name).toBe(baseBlog.title);
          expect(posting.author['@type']).toBe('Person');
          expect(posting.author.name).toBe(basePost.author?.name);
        } else if (testCase.view.isHomepage || testCase.view.isSearch) {
          expect(result.metaTags['og:type']).toBe('website');
          expect(result.jsonLdScripts.length).toBe(1);
          const site = result.jsonLdScripts[0];
          expect(site['@type']).toBe('WebSite');
          expect(site.name).toBe(baseBlog.title);
          expect(site.url).toBe(baseBlog.canonicalHomepageUrl);
          expect(site.potentialAction['@type']).toBe('SearchAction');
          expect(site.potentialAction.target.urlTemplate).toContain('{search_term_string}');
        } else {
          expect(result.metaTags['og:type']).toBe('website');
          expect(result.jsonLdScripts.length).toBe(0);
        }
      });
    }
  });

  describe('Suite 2: Adversarial Character & Stress Injection Payloads', () => {
    const adversarialPayloads = [
      {
        name: 'Mixed quotes, emojis, angle brackets and em dash',
        title: '🛡️ "Quotes" & <angles> — em dash',
        snippet: 'A snippet containing <b>HTML tags</b> & "nested quotes" + <script>alert(1)</script>',
        authorName: 'O\'Connor & "Partners" <Devs>'
      },
      {
        name: 'Backslashes, windows paths, and escape sequences',
        title: 'C:\\Users\\admin\\documents\\test\\ "quoted\\path"',
        snippet: 'Escape sequences like \\n, \\r, \\t, and trailing backslash \\',
        authorName: 'Jane \\"Hacker\\" Doe'
      },
      {
        name: 'Control characters and multiline breaks',
        title: 'Title with\nNewline and\tTabs\r\nand \u0000 Null Byte \u001f Unit Separator',
        snippet: 'Multiline snippet:\nLine 1\r\nLine 2\tTabbed\nLine 3',
        authorName: 'Admin\nUser\r\n'
      },
      {
        name: 'HTML/XSS injection attempts',
        title: '<script>alert("XSS")</script><img src=x onerror=alert(1)>',
        snippet: '"><script>document.location="http://evil.com"</script>',
        authorName: '<b onmouseover=evil()>Evil Author</b>'
      },
      {
        name: 'Double quotes boundary torture',
        title: '"""""""""All Quotes"""""""""',
        snippet: '"""Triple""" and """"Quadruple"""" and ""Double""',
        authorName: '""Anonymous""'
      },
      {
        name: 'Unicode complex scripts (Arabic, Cyrillic, CJK, Math symbols)',
        title: 'العربية / 中文 / Русский / 𝕸𝖆𝖙𝖍 / 🚀 🌟 🔒',
        snippet: 'مرحبا بالعالم - 你好世界 - Привет мир - ∑(x) = ∫ y dt',
        authorName: 'مطور البرمجيات'
      },
      {
        name: 'Empty and whitespace-only attributes',
        title: '   ',
        snippet: '',
        authorName: ' '
      },
      {
        name: 'Massive 5000-character payload with continuous symbols',
        title: 'Long Title '.repeat(100) + ' "Quotes" & <Tags>',
        snippet: 'Long Snippet '.repeat(500) + ' C:\\Path\\To\\File',
        authorName: 'Long Author '.repeat(20)
      }
    ];

    const rawBlogPostingTemplate = `
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "<data:view.url.canonical.jsonEscaped/>"
      },
      "headline": "<data:view.title.jsonEscaped/>",
      "description": "<b:eval expr='snippet(data:post.snippets.long ?: (data:view.description ?: data:view.title), {length: 250, links: false, linebreaks: false, ellipsis: true}).jsonEscaped'/>",
      "datePublished": "<data:post.date.iso8601.jsonEscaped/>"
      <b:if cond='data:post.lastUpdated'>
      , "dateModified": "<data:post.lastUpdated.iso8601.jsonEscaped/>"
      </b:if>
      <b:if cond='data:view.featuredImage'>
      , "image": "<data:view.featuredImage.jsonEscaped/>"
      </b:if>
      , "author": {
        "@type": "Person",
        "name": "<data:post.author.name.jsonEscaped/>"
        <b:if cond='data:post.author.profileUrl'>
        , "url": "<data:post.author.profileUrl.jsonEscaped/>"
        </b:if>
        <b:if cond='data:post.author.authorPhoto.image'>
        , "image": "<data:post.author.authorPhoto.image.jsonEscaped/>"
        </b:if>
      },
      "publisher": {
        "@type": "Organization",
        "name": "<data:blog.title.jsonEscaped/>",
        "logo": {
          "@type": "ImageObject",
          "url": "<b:eval expr='(data:blog.canonicalHomepageUrl path "favicon.ico").jsonEscaped'/>"
        }
      }
    }
    `;

    for (const payload of adversarialPayloads) {
      it(`parses cleanly under stress test: ${payload.name}`, () => {
        const cleanedSnippet = bloggerSnippet(payload.snippet || payload.title, { length: 250, linebreaks: false, ellipsis: true });

        const parsed = evaluateRawXmlJsonLd(rawBlogPostingTemplate, {
          canonicalUrl: 'https://test-ledger.blogspot.com/2026/08/stress.html',
          title: payload.title,
          snippet: cleanedSnippet,
          datePublished: '2026-08-16T00:00:00Z',
          dateModified: '2026-08-16T12:00:00Z',
          featuredImage: 'https://test-ledger.blogspot.com/img.jpg',
          authorName: payload.authorName,
          authorProfileUrl: 'https://www.blogger.com/profile/999',
          authorPhotoImage: 'https://resources.blogblog.com/avatar.jpg',
          blogTitle: 'Stress "Test" Blog & <Hub>',
          canonicalHomepageUrl: 'https://test-ledger.blogspot.com'
        });

        expect(parsed).toBeDefined();
        expect(parsed['@type']).toBe('BlogPosting');
        expect(typeof parsed.headline).toBe('string');
        expect(typeof parsed.description).toBe('string');
        expect(typeof parsed.author.name).toBe('string');
      });
    }
  });

  describe('Suite 3: BlogPosting Field Combinations & Optional Branch Matrices', () => {
    const rawBlogPostingTemplate = `
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "<data:view.url.canonical.jsonEscaped/>"
      },
      "headline": "<data:view.title.jsonEscaped/>",
      "description": "<b:eval expr='snippet(data:post.snippets.long ?: (data:view.description ?: data:view.title), {length: 250, links: false, linebreaks: false, ellipsis: true}).jsonEscaped'/>",
      "datePublished": "<data:post.date.iso8601.jsonEscaped/>"
      <b:if cond='data:post.lastUpdated'>
      , "dateModified": "<data:post.lastUpdated.iso8601.jsonEscaped/>"
      </b:if>
      <b:if cond='data:view.featuredImage'>
      , "image": "<data:view.featuredImage.jsonEscaped/>"
      </b:if>
      , "author": {
        "@type": "Person",
        "name": "<data:post.author.name.jsonEscaped/>"
        <b:if cond='data:post.author.profileUrl'>
        , "url": "<data:post.author.profileUrl.jsonEscaped/>"
        </b:if>
        <b:if cond='data:post.author.authorPhoto.image'>
        , "image": "<data:post.author.authorPhoto.image.jsonEscaped/>"
        </b:if>
      },
      "publisher": {
        "@type": "Organization",
        "name": "<data:blog.title.jsonEscaped/>",
        "logo": {
          "@type": "ImageObject",
          "url": "<b:eval expr='(data:blog.canonicalHomepageUrl path "favicon.ico").jsonEscaped'/>"
        }
      }
    }
    `;

    // Test all 2^4 = 16 combinations of optional fields in BlogPosting
    const optionalCombinations = [
      { lastUpdated: false, featuredImage: false, profileUrl: false, authorPhoto: false },
      { lastUpdated: true,  featuredImage: false, profileUrl: false, authorPhoto: false },
      { lastUpdated: false, featuredImage: true,  profileUrl: false, authorPhoto: false },
      { lastUpdated: false, featuredImage: false, profileUrl: true,  authorPhoto: false },
      { lastUpdated: false, featuredImage: false, profileUrl: false, authorPhoto: true },
      { lastUpdated: true,  featuredImage: true,  profileUrl: false, authorPhoto: false },
      { lastUpdated: true,  featuredImage: false, profileUrl: true,  authorPhoto: false },
      { lastUpdated: true,  featuredImage: false, profileUrl: false, authorPhoto: true },
      { lastUpdated: false, featuredImage: true,  profileUrl: true,  authorPhoto: false },
      { lastUpdated: false, featuredImage: true,  profileUrl: false, authorPhoto: true },
      { lastUpdated: false, featuredImage: false, profileUrl: true,  authorPhoto: true },
      { lastUpdated: true,  featuredImage: true,  profileUrl: true,  authorPhoto: false },
      { lastUpdated: true,  featuredImage: true,  profileUrl: false, authorPhoto: true },
      { lastUpdated: true,  featuredImage: false, profileUrl: true,  authorPhoto: true },
      { lastUpdated: false, featuredImage: true,  profileUrl: true,  authorPhoto: true },
      { lastUpdated: true,  featuredImage: true,  profileUrl: true,  authorPhoto: true }
    ];

    for (const [idx, combo] of optionalCombinations.entries()) {
      it(`produces valid JSON-LD on optional field matrix permutation ${idx + 1}/16`, () => {
        const parsed = evaluateRawXmlJsonLd(rawBlogPostingTemplate, {
          canonicalUrl: 'https://test-ledger.blogspot.com/2026/08/matrix-test.html',
          title: 'Matrix Combination Test',
          snippet: 'Snippet content',
          datePublished: '2026-08-16T00:00:00Z',
          dateModified: combo.lastUpdated ? '2026-08-16T12:00:00Z' : null,
          featuredImage: combo.featuredImage ? 'https://test-ledger.blogspot.com/featured.png' : null,
          authorName: 'Matrix Tester',
          authorProfileUrl: combo.profileUrl ? 'https://www.blogger.com/profile/111' : null,
          authorPhotoImage: combo.authorPhoto ? 'https://resources.blogblog.com/photo.png' : null,
          blogTitle: 'Ledger Blog',
          canonicalHomepageUrl: 'https://test-ledger.blogspot.com'
        });

        expect(parsed).toBeDefined();
        expect(parsed['@type']).toBe('BlogPosting');

        if (combo.lastUpdated) {
          expect(parsed.dateModified).toBe('2026-08-16T12:00:00Z');
        } else {
          expect(parsed.dateModified).toBeUndefined();
        }

        if (combo.featuredImage) {
          expect(parsed.image).toBe('https://test-ledger.blogspot.com/featured.png');
        } else {
          expect(parsed.image).toBeUndefined();
        }

        if (combo.profileUrl) {
          expect(parsed.author.url).toBe('https://www.blogger.com/profile/111');
        } else {
          expect(parsed.author.url).toBeUndefined();
        }

        if (combo.authorPhoto) {
          expect(parsed.author.image).toBe('https://resources.blogblog.com/photo.png');
        } else {
          expect(parsed.author.image).toBeUndefined();
        }
      });
    }
  });

  describe('Suite 4: OpenGraph and Twitter Fallback Chains Verification', () => {
    it('verifies OpenGraph image fallback: featuredImage -> postThumbnail -> omitted', () => {
      // 1. featuredImage present
      const res1 = renderHeadMetadata(themeXml, {
        blog: { title: 'B', canonicalHomepageUrl: 'https://b.blogspot.com', postImageThumbnailUrl: 'https://b.blogspot.com/thumb.jpg' },
        view: { title: 'V', url: { canonical: 'https://b.blogspot.com/p1.html' }, featuredImage: 'https://b.blogspot.com/feat.jpg' }
      });
      expect(res1.metaTags['og:image']).toBe('https://b.blogspot.com/feat.jpg');
      expect(res1.metaTags['twitter:card']).toBe('summary_large_image');

      // 2. featuredImage absent, thumbnail present
      const res2 = renderHeadMetadata(themeXml, {
        blog: { title: 'B', canonicalHomepageUrl: 'https://b.blogspot.com', postImageThumbnailUrl: 'https://b.blogspot.com/thumb.jpg' },
        view: { title: 'V', url: { canonical: 'https://b.blogspot.com/p1.html' } }
      });
      expect(res2.metaTags['og:image']).toBe('https://b.blogspot.com/thumb.jpg');
      expect(res2.metaTags['twitter:card']).toBe('summary_large_image');

      // 3. both absent, og:image is cleanly omitted and twitter:card defaults to summary
      const res3 = renderHeadMetadata(themeXml, {
        blog: { title: 'B', canonicalHomepageUrl: 'https://b.blogspot.com' },
        view: { title: 'V', url: { canonical: 'https://b.blogspot.com/p1.html' } }
      });
      expect(res3.metaTags['og:image']).toBeUndefined();
      expect(res3.metaTags['twitter:card']).toBe('summary');
    });

    it('verifies description fallback: view.description -> blog.metaDescription -> view.title', () => {
      // 1. view.description present
      const res1 = renderHeadMetadata(themeXml, {
        blog: { title: 'B', canonicalHomepageUrl: 'https://b.blogspot.com', metaDescription: 'Blog Desc' },
        view: { title: 'View Title', url: { canonical: 'https://b.blogspot.com/' }, description: 'View Desc' }
      });
      expect(res1.metaTags['og:description']).toBe('View Desc');
      expect(res1.metaTags['twitter:description']).toBe('View Desc');
      expect(res1.metaTags['description']).toBe('View Desc');

      // 2. view.description absent, blog.metaDescription present
      const res2 = renderHeadMetadata(themeXml, {
        blog: { title: 'B', canonicalHomepageUrl: 'https://b.blogspot.com', metaDescription: 'Blog Desc' },
        view: { title: 'View Title', url: { canonical: 'https://b.blogspot.com/' } }
      });
      expect(res2.metaTags['og:description']).toBe('Blog Desc');
      expect(res2.metaTags['twitter:description']).toBe('Blog Desc');
      expect(res2.metaTags['description']).toBe('Blog Desc');

      // 3. both absent, falls back to view.title for social
      const res3 = renderHeadMetadata(themeXml, {
        blog: { title: 'B', canonicalHomepageUrl: 'https://b.blogspot.com' },
        view: { title: 'View Title', url: { canonical: 'https://b.blogspot.com/' } }
      });
      expect(res3.metaTags['og:description']).toBe('View Title');
      expect(res3.metaTags['twitter:description']).toBe('View Title');
      expect(res3.metaTags['description']).toBeUndefined();
    });
  });

  describe('Suite 5: Exactly One H1 Invariant & Landmark Hierarchy Across All 10 Views', () => {
    const viewsToTest: Array<{ name: string; ctx: MockRenderContext }> = [
      {
        name: 'home-p1 (index with 3 posts)',
        ctx: {
          blog: { title: 'Ledger', canonicalHomepageUrl: 'https://example.com' },
          view: { title: 'Ledger', url: { canonical: 'https://example.com/' }, isHomepage: true, isMultipleItems: true },
          posts: [{ title: 'P1' }, { title: 'P2' }, { title: 'P3' }]
        }
      },
      {
        name: 'home-p2 (paged with 2 posts)',
        ctx: {
          blog: { title: 'Ledger', canonicalHomepageUrl: 'https://example.com' },
          view: { title: 'Ledger', url: { canonical: 'https://example.com/search?p=2' }, isHomepage: false, isMultipleItems: true },
          posts: [{ title: 'P4' }, { title: 'P5' }]
        }
      },
      {
        name: 'label (search by label with 1 post)',
        ctx: {
          blog: { title: 'Ledger', canonicalHomepageUrl: 'https://example.com' },
          view: { title: 'Label View', url: { canonical: 'https://example.com/search/label/tech' }, isLabelSearch: true, isSearch: true, isMultipleItems: true },
          posts: [{ title: 'P1' }]
        }
      },
      {
        name: 'search (keyword query with 1 post)',
        ctx: {
          blog: { title: 'Ledger', canonicalHomepageUrl: 'https://example.com' },
          view: { title: 'Search View', url: { canonical: 'https://example.com/search?q=test' }, isSearch: true, isMultipleItems: true },
          posts: [{ title: 'P1' }]
        }
      },
      {
        name: 'archive (monthly archive with 2 posts)',
        ctx: {
          blog: { title: 'Ledger', canonicalHomepageUrl: 'https://example.com' },
          view: { title: 'Archive View', url: { canonical: 'https://example.com/2026/08/' }, isArchive: true, isMultipleItems: true },
          posts: [{ title: 'P1' }, { title: 'P2' }]
        }
      },
      {
        name: 'post (single article)',
        ctx: {
          blog: { title: 'Ledger', canonicalHomepageUrl: 'https://example.com' },
          view: { title: 'Single Post', url: { canonical: 'https://example.com/2026/08/p.html' }, isPost: true, isSingleItem: true },
          posts: [{ title: 'Single Post' }]
        }
      },
      {
        name: 'static-page (single page)',
        ctx: {
          blog: { title: 'Ledger', canonicalHomepageUrl: 'https://example.com' },
          view: { title: 'About Page', url: { canonical: 'https://example.com/p/about.html' }, isPage: true, isSingleItem: true },
          posts: [{ title: 'About Page' }]
        }
      },
      {
        name: 'empty-result (zero matches)',
        ctx: {
          blog: { title: 'Ledger', canonicalHomepageUrl: 'https://example.com' },
          view: { title: 'Empty Search', url: { canonical: 'https://example.com/search?q=zero' }, isSearch: true, isMultipleItems: true },
          posts: []
        }
      },
      {
        name: 'error (404 page not found)',
        ctx: {
          blog: { title: 'Ledger', canonicalHomepageUrl: 'https://example.com' },
          view: { title: '404', url: { canonical: 'https://example.com/404.html' }, isError: true },
          posts: []
        }
      },
      {
        name: 'layout-mode (admin preview)',
        ctx: {
          blog: { title: 'Ledger', canonicalHomepageUrl: 'https://example.com' },
          view: { title: 'Preview', url: { canonical: 'https://example.com/?b_preview=1' }, isLayoutMode: true, isMultipleItems: true },
          posts: [{ title: 'Preview Post' }]
        }
      }
    ];

    for (const item of viewsToTest) {
      it(`enforces strictly 1 H1 element on view: ${item.name}`, () => {
        const res = evaluateHeadingHierarchy(item.ctx);
        expect(res.totalH1Count).toBe(1);

        if (item.ctx.view.isSingleItem) {
          expect(res.headerHeadingTag).toBe('p');
          expect(res.blogHeadingTags).toEqual(['h1']);
        } else {
          expect(res.headerHeadingTag).toBe('h1');
          expect(res.blogHeadingTags.every((t) => t === 'h2')).toBe(true);
        }
      });
    }

    it('verifies accessibility landmarks in compiled theme XML', () => {
      // 1. Skip link is first navigable element in body before banner
      const bodyBannerOrder = themeXml.match(/<body[^>]*>[\s\S]*?<a class="skip-link" href="#content">Skip to content<\/a>[\s\S]*?<div class="header-outer" role="banner">/);
      expect(bodyBannerOrder).not.toBeNull();

      // 2. Main landmark targets #content
      const mainLandmark = themeXml.match(/<main\s+class="main-content"\s+id="content"\s+role="main">/);
      expect(mainLandmark).not.toBeNull();

      // 3. Footer landmark
      const footerLandmark = themeXml.match(/<footer\s+class="footer-container"\s+role="contentinfo">/);
      expect(footerLandmark).not.toBeNull();

      // 4. Nav landmark is clean without nesting
      expect(themeXml).toContain('<div class="nav-container">');
      expect(themeXml).toMatch(/<nav\s+class="site-nav"\s+aria-label="Main Navigation">/);
      expect(themeXml).not.toMatch(/<nav\b[^>]*>(?:(?!<\/nav>)[\s\S])*<nav\b/i);
    });
  });
});
