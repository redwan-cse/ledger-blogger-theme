export interface CatalogPost {
  title: string;
  url: string;
}

const STOP_WORDS = new Set([
  'a', 'an', 'in', 'on', 'at', 'of', 'to', 'for', 'our', 'the', 'and', 'or',
  'see', 'guide', 'analysis', 'breakdown', 'deep', 'dive', 'overview',
  'companion', 'part', 'edition'
]);

function getSignificantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function normalizeTitle(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Matches an anchor text to a published post in the catalog.
 */
export function findMatchingCatalogPost(
  anchorText: string,
  catalog: CatalogPost[],
  currentPostTitle?: string
): CatalogPost | null {
  const cleanAnchor = anchorText.replace(/<[^>]+>/g, '').trim();
  const normAnchor = normalizeTitle(cleanAnchor);
  if (!normAnchor) return null;

  // 1. Exact title match
  const exact = catalog.find((p) => {
    if (currentPostTitle && p.title.toLowerCase() === currentPostTitle.toLowerCase()) return false;
    return normalizeTitle(p.title) === normAnchor;
  });
  if (exact) return exact;

  // 2. Significant tokens subset match
  const anchorTokens = getSignificantTokens(cleanAnchor);
  if (anchorTokens.length >= 2) {
    let bestMatch: CatalogPost | null = null;
    let maxOverlap = 0;

    for (const post of catalog) {
      if (currentPostTitle && post.title.toLowerCase() === currentPostTitle.toLowerCase()) continue;
      const postTokens = getSignificantTokens(post.title);
      if (postTokens.length === 0) continue;

      const overlap = postTokens.filter((t) => anchorTokens.includes(t)).length;
      const matchRatio = overlap / postTokens.length;

      if ((matchRatio >= 0.65 || overlap >= 3) && overlap > maxOverlap) {
        maxOverlap = overlap;
        bestMatch = post;
      }
    }
    if (bestMatch) return bestMatch;
  }

  // 3. Topic extraction when anchor is generic (e.g., "Deconstructing Breakdown" or "Companion Analysis")
  if (currentPostTitle) {
    const currentTokens = getSignificantTokens(currentPostTitle).filter(
      (t) => !['hardening', 'blue', 'team', 'defense', 'mechanics', 'deconstructing'].includes(t)
    );
    if (currentTokens.length >= 2) {
      for (const post of catalog) {
        if (post.title.toLowerCase() === currentPostTitle.toLowerCase()) continue;
        const postTokens = getSignificantTokens(post.title);
        const topicOverlap = currentTokens.filter((t) => postTokens.includes(t)).length;
        if (topicOverlap >= 2) {
          return post;
        }
      }
    }
  }

  return null;
}

/**
 * Scans markdown and HTML content for placeholder internal links
 * (pointing to the root https://blogs.redwan.work/ or search paths)
 * and resolves them to their exact published permalink.
 */
export function resolveCompanionLinks(
  content: string,
  catalog: CatalogPost[],
  currentPostTitle?: string
): { resolvedContent: string; replacementsCount: number } {
  if (!content || catalog.length === 0) {
    return { resolvedContent: content, replacementsCount: 0 };
  }

  let resolved = content;
  let replacementsCount = 0;

  // A. Replace Markdown links: [Anchor Text](https://blogs.redwan.work/ or /search...)
  // Excludes explicit anchor text like "[Home]" or "[Blog]"
  const mdLinkRegex = /\[([^\]]+)\]\((https:\/\/blogs\.redwan\.work\/?|\/search\?[^)]*|\/search\/label\/[^)]*)\)/gi;
  resolved = resolved.replace(mdLinkRegex, (match, anchorText, rawUrl) => {
    const cleanAnchor = anchorText.trim();
    if (/^(home|homepage|blog|index|back to top)$/i.test(cleanAnchor)) {
      return match;
    }

    const matchedPost = findMatchingCatalogPost(cleanAnchor, catalog, currentPostTitle);
    if (matchedPost?.url) {
      replacementsCount++;
      return `[${anchorText}](${matchedPost.url})`;
    }
    return match;
  });

  // B. Replace HTML links: <a href="https://blogs.redwan.work/ or /search...">Anchor</a>
  const htmlLinkRegex = /<a\s+([^>]*?)href=["'](https:\/\/blogs\.redwan\.work\/?|\/search\?[^"']*)["']([^>]*?)>([\s\S]*?)<\/a>/gi;
  resolved = resolved.replace(htmlLinkRegex, (match, beforeHref, rawUrl, afterHref, innerAnchor) => {
    const cleanAnchor = innerAnchor.replace(/<[^>]+>/g, '').trim();
    if (/^(home|homepage|blog|index|back to top)$/i.test(cleanAnchor)) {
      return match;
    }

    const matchedPost = findMatchingCatalogPost(cleanAnchor, catalog, currentPostTitle);
    if (matchedPost?.url) {
      replacementsCount++;
      return `<a ${beforeHref}href="${matchedPost.url}"${afterHref}>${innerAnchor}</a>`;
    }
    return match;
  });

  return { resolvedContent: resolved, replacementsCount };
}
