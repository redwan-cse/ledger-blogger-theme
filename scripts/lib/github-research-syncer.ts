export interface ResearchPostEntry {
  title: string;
  url: string;
  category?: string;
  date?: string;
}

/**
 * Updates the research feed table in the personal profile README.
 * Keeps only the latest `maxItems` (default: 15) articles.
 */
export function updateProfileReadmeResearchFeed(
  readmeContent: string,
  newPost: ResearchPostEntry,
  maxItems = 15
): string {
  const startMarker = '<!-- RESEARCH-FEED-START -->';
  const endMarker = '<!-- RESEARCH-FEED-END -->';

  const startIdx = readmeContent.indexOf(startMarker);
  const endIdx = readmeContent.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return readmeContent;
  }

  const before = readmeContent.slice(0, startIdx + startMarker.length);
  const inside = readmeContent.slice(startIdx + startMarker.length, endIdx);
  const after = readmeContent.slice(endIdx);

  // Parse lines inside the feed
  const lines = inside.trim().split('\n').filter((l) => l.trim().length > 0);
  const headerLines = lines.slice(0, 2); // | Topic / Primitive | ... | and |---|---|---|
  const dataRows = lines.slice(2);

  // Check if URL already exists
  const isDuplicate = dataRows.some((row) => row.includes(newPost.url));
  let updatedRows = dataRows;

  if (!isDuplicate) {
    const cat = newPost.category || 'Cybersecurity';
    const newRow = `| **${cat}** | [${newPost.title}](${newPost.url}) | [Read Full Analysis & Threat Model](${newPost.url}) |`;
    updatedRows = [newRow, ...dataRows].slice(0, maxItems);
  }

  const newInside = '\n' + [...headerLines, ...updatedRows].join('\n') + '\n';
  return before + newInside + after;
}

/**
 * Updates the permanent research catalog in cybersecurity-research repository.
 * Keeps all posts permanently, prepending new articles to give them top priority.
 */
export function updateCatalogReadmeResearchFeed(
  readmeContent: string,
  newPost: ResearchPostEntry
): string {
  const startMarker = '<!-- RESEARCH-CATALOG-START -->';
  const endMarker = '<!-- RESEARCH-CATALOG-END -->';

  const startIdx = readmeContent.indexOf(startMarker);
  const endIdx = readmeContent.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return readmeContent;
  }

  const before = readmeContent.slice(0, startIdx + startMarker.length);
  const inside = readmeContent.slice(startIdx + startMarker.length, endIdx);
  const after = readmeContent.slice(endIdx);

  const lines = inside.trim().split('\n').filter((l) => l.trim().length > 0);
  const headerLines = lines.slice(0, 2);
  const dataRows = lines.slice(2);

  const isDuplicate = dataRows.some((row) => row.includes(newPost.url));
  let updatedRows = dataRows;

  if (!isDuplicate) {
    const cat = newPost.category || 'Cybersecurity';
    const dateStr = newPost.date || new Date().toISOString().slice(0, 10);
    const newRow = `| ${dateStr} | **${newPost.title}** | \`${cat}\` | [Read Full Analysis & Threat Model](${newPost.url}) |`;
    updatedRows = [newRow, ...dataRows];
  }

  const newInside = '\n' + [...headerLines, ...updatedRows].join('\n') + '\n';
  return before + newInside + after;
}

/**
 * High-level coordinator: Uses GitHub REST API to synchronize newly published
 * articles across profile and research repositories.
 */
export async function syncPostToGitHubBacklinkRepos(options: {
  title: string;
  url: string;
  category?: string | undefined;
  date?: string | undefined;
  token?: string | undefined;
}): Promise<void> {
  const token = options.token?.trim();
  if (!token) {
    console.log('ℹ️ GitHub backlink sync: No GITHUB_TOKEN or BLOG_ASSETS_TOKEN available. Skipping repository sync.');
    return;
  }

  const post: ResearchPostEntry = {
    title: options.title,
    url: options.url,
    category: options.category || 'Cybersecurity',
    date: options.date || new Date().toISOString().slice(0, 10)
  };

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ledger-backlink-syncer',
    'Content-Type': 'application/json'
  };

  console.log(`\n======================================================`);
  console.log(`🔗 Synchronizing GitHub Research Backlinks: "${post.title}"`);
  console.log(`======================================================`);

  // 1. Sync Profile README (redwan-cse/redwan-cse) - Rolling latest 10-15 posts
  try {
    const profileRes = await fetch('https://api.github.com/repos/redwan-cse/redwan-cse/contents/README.md?ref=main', { headers });
    if (profileRes.ok) {
      const data = (await profileRes.json()) as { content: string; sha: string };
      const rawMd = Buffer.from(data.content, 'base64').toString('utf8');
      const updatedMd = updateProfileReadmeResearchFeed(rawMd, post, 15);

      if (updatedMd !== rawMd) {
        const putRes = await fetch('https://api.github.com/repos/redwan-cse/redwan-cse/contents/README.md', {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: `docs: auto-sync latest research publication "${post.title.slice(0, 45)}..."`,
            content: Buffer.from(updatedMd, 'utf8').toString('base64'),
            sha: data.sha,
            branch: 'main'
          })
        });
        if (putRes.ok) {
          console.log(`✅ [GitHub Profile] Updated profile README research feed (github.com/redwan-cse)`);
        } else {
          console.warn(`⚠️ [GitHub Profile] Update returned HTTP ${putRes.status}`);
        }
      } else {
        console.log(`ℹ️ [GitHub Profile] Post already present in profile feed.`);
      }
    }
  } catch (err: any) {
    console.warn(`⚠️ [GitHub Profile] Error syncing profile README: ${err.message}`);
  }

  // 2. Sync Dedicated Research Repo (redwan-cse/cybersecurity-research) - Permanent Archive
  try {
    const catalogRes = await fetch('https://api.github.com/repos/redwan-cse/cybersecurity-research/contents/README.md?ref=main', { headers });
    if (catalogRes.ok) {
      const data = (await catalogRes.json()) as { content: string; sha: string };
      const rawMd = Buffer.from(data.content, 'base64').toString('utf8');
      const updatedMd = updateCatalogReadmeResearchFeed(rawMd, post);

      if (updatedMd !== rawMd) {
        const putRes = await fetch('https://api.github.com/repos/redwan-cse/cybersecurity-research/contents/README.md', {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: `feat(catalog): add research publication "${post.title.slice(0, 45)}..."`,
            content: Buffer.from(updatedMd, 'utf8').toString('base64'),
            sha: data.sha,
            branch: 'main'
          })
        });
        if (putRes.ok) {
          console.log(`✅ [Research Catalog] Updated cybersecurity-research repository catalog (github.com/redwan-cse/cybersecurity-research)`);
        } else {
          console.warn(`⚠️ [Research Catalog] Update returned HTTP ${putRes.status}`);
        }
      } else {
        console.log(`ℹ️ [Research Catalog] Post already present in catalog.`);
      }
    }
  } catch (err: any) {
    console.warn(`⚠️ [Research Catalog] Error syncing research catalog: ${err.message}`);
  }

  console.log(`======================================================\n`);
}
