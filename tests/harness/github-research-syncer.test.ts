import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateProfileReadmeResearchFeed,
  updateCatalogReadmeResearchFeed,
  syncPostToGitHubBacklinkRepos
} from '../../scripts/lib/github-research-syncer.js';

describe('github-research-syncer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateProfileReadmeResearchFeed', () => {
    const sampleReadme = `# Profile
<!-- RESEARCH-FEED-START -->
| Topic / Primitive | Attack Mechanics & Threat Model | Blue Team Hardening & Detection |
|---|---|---|
| **Cloud** | [Old Post](https://blogs.redwan.work/old.html) | [Old Defense](https://blogs.redwan.work/old-defense.html) |
<!-- RESEARCH-FEED-END -->
## Footer
`;

    it('prepends a new post to the profile research feed', () => {
      const updated = updateProfileReadmeResearchFeed(sampleReadme, {
        title: 'New Post',
        url: 'https://blogs.redwan.work/new.html',
        category: 'AI Security'
      });

      expect(updated).toContain('[New Post](https://blogs.redwan.work/new.html)');
      expect(updated).toContain('[Old Post](https://blogs.redwan.work/old.html)');
      // New post appears before old post
      expect(updated.indexOf('new.html')).toBeLessThan(updated.indexOf('old.html'));
    });

    it('deduplicates and does not insert existing URLs', () => {
      const updated = updateProfileReadmeResearchFeed(sampleReadme, {
        title: 'Old Post',
        url: 'https://blogs.redwan.work/old.html'
      });

      expect(updated).toBe(sampleReadme);
    });

    it('caps the feed to maxItems rows', () => {
      let current = sampleReadme;
      for (let i = 1; i <= 20; i++) {
        current = updateProfileReadmeResearchFeed(
          current,
          {
            title: `Post ${i}`,
            url: `https://blogs.redwan.work/post-${i}.html`
          },
          5 // cap at 5
        );
      }

      const rows = current.match(/\|\s*\*\*Cybersecurity\*\*\s*\|/g) || [];
      expect(rows.length).toBeLessThanOrEqual(5);
    });
  });

  describe('updateCatalogReadmeResearchFeed', () => {
    const sampleCatalog = `# Catalog
<!-- RESEARCH-CATALOG-START -->
| Date | Research Publication | Category | Full Technical Writeup |
|---|---|---|---|
| 2026-09-01 | **Old Post** | \`Cloud\` | [Read Full Analysis](https://blogs.redwan.work/old.html) |
<!-- RESEARCH-CATALOG-END -->
`;

    it('prepends new post to catalog without capping rows', () => {
      const updated = updateCatalogReadmeResearchFeed(sampleCatalog, {
        title: 'New Article',
        url: 'https://blogs.redwan.work/new.html',
        category: 'Kernel',
        date: '2026-10-06'
      });

      expect(updated).toContain('| 2026-10-06 | **New Article** | `Kernel` | [Read Full Analysis & Threat Model](https://blogs.redwan.work/new.html) |');
      expect(updated).toContain('Old Post');
      expect(updated.indexOf('new.html')).toBeLessThan(updated.indexOf('old.html'));
    });
  });

  describe('syncPostToGitHubBacklinkRepos', () => {
    it('skips sync when token is not provided', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await syncPostToGitHubBacklinkRepos({
        title: 'Test',
        url: 'https://blogs.redwan.work/test.html',
        token: ''
      });

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
