#!/usr/bin/env node
/**
 * CLI Tool to submit URLs to Bing Webmaster Tools & IndexNow
 *
 * Usage:
 *   npx tsx scripts/submit-urls.ts https://blogs.redwan.work/2026/09/example.html
 *   npx tsx scripts/submit-urls.ts --all
 *   npx tsx scripts/submit-urls.ts --dry-run --all
 */

import { submitUrlsToSearchEngines, normalizeUrls, submitSitemapsToBing } from './lib/search-engine-indexer.js';

interface FeedEntry {
  link?: Array<{
    rel?: string;
    type?: string;
    href?: string;
  }>;
}

interface BloggerFeedResponse {
  feed?: {
    entry?: FeedEntry[];
  };
}

async function fetchAllLiveUrls(siteUrl: string): Promise<string[]> {
  const base = new URL(siteUrl);
  const urls: string[] = [];
  let startIndex = 1;
  const maxResults = 150;

  console.log(`🔍 Fetching live post URLs from public feed: ${base.origin}...`);

  while (true) {
    const feedUrl = `${base.origin}/feeds/posts/default?alt=json&start-index=${startIndex}&max-results=${maxResults}`;
    try {
      const res = await fetch(feedUrl);
      if (!res.ok) {
        console.warn(`Feed request failed (${res.status}): ${feedUrl}`);
        break;
      }

      const data = (await res.json()) as BloggerFeedResponse;
      const entries = data.feed?.entry || [];
      if (entries.length === 0) break;

      for (const entry of entries) {
        const altLink = entry.link?.find((l) => l.rel === 'alternate' && l.type === 'text/html');
        if (altLink?.href) {
          urls.push(altLink.href);
        }
      }

      if (entries.length < maxResults) break;
      startIndex += maxResults;
    } catch (err: any) {
      console.warn(`Error fetching feed at index ${startIndex}: ${err.message}`);
      break;
    }
  }

  // Also include the homepage
  urls.unshift(base.origin + '/');
  return normalizeUrls(urls, base.origin);
}

async function main() {
  const args = process.argv.slice(2);

  const dryRun = args.includes('--dry-run');
  const submitAll = args.includes('--all');
  const submitSitemaps = args.includes('--sitemaps');

  let siteUrl = process.env.SITE_URL?.trim() || 'https://blogs.redwan.work/';
  let bingApiKey = process.env.BING_WEBMASTER_API_KEY?.trim();
  let indexNowKey = process.env.INDEXNOW_KEY?.trim();
  let indexNowKeyLocation = process.env.INDEXNOW_KEY_LOCATION?.trim();

  // Extract command line flags if provided
  const targetUrls: string[] = [];
  for (const arg of args) {
    if (arg === '--dry-run' || arg === '--all' || arg === '--sitemaps') continue;
    if (arg.startsWith('--bing-key=')) {
      bingApiKey = arg.slice('--bing-key='.length).trim();
    } else if (arg.startsWith('--indexnow-key=')) {
      indexNowKey = arg.slice('--indexnow-key='.length).trim();
    } else if (arg.startsWith('--key-location=')) {
      indexNowKeyLocation = arg.slice('--key-location='.length).trim();
    } else if (arg.startsWith('--site=')) {
      siteUrl = arg.slice('--site='.length).trim();
    } else if (arg.startsWith('http://') || arg.startsWith('https://') || arg.startsWith('/')) {
      targetUrls.push(arg);
    }
  }

  // 1. Submit Sitemaps if requested
  if (submitSitemaps) {
    console.log(`\n📡 Submitting Sitemaps to Bing Webmaster Tools...`);
    if (bingApiKey) {
      await submitSitemapsToBing(bingApiKey, siteUrl, undefined, dryRun);
    } else {
      console.log('ℹ️ BING_WEBMASTER_API_KEY not configured. Skipping automated sitemap submission.');
    }
  }

  let finalUrls: string[] = [];

  if (submitAll) {
    finalUrls = await fetchAllLiveUrls(siteUrl);
    console.log(`Found ${finalUrls.length} live URL(s) to submit.`);
  } else if (targetUrls.length > 0) {
    finalUrls = normalizeUrls(targetUrls, siteUrl);
  } else if (!submitSitemaps) {
    console.log(`
Usage:
  npx tsx scripts/submit-urls.ts <url1> [url2] ...
  npx tsx scripts/submit-urls.ts --all
  npx tsx scripts/submit-urls.ts --sitemaps
  npx tsx scripts/submit-urls.ts --dry-run --all

Flags:
  --all                 Submit all published blog posts found on the live site
  --sitemaps            Submit XML sitemaps to Bing Webmaster Tools
  --dry-run             Preview URLs without submitting to search engines
  --bing-key=<key>      Bing Webmaster API Key (or env BING_WEBMASTER_API_KEY)
  --indexnow-key=<key>  IndexNow Key (or env INDEXNOW_KEY)
  --key-location=<url>  IndexNow Key Location URL (or env INDEXNOW_KEY_LOCATION)
  --site=<url>          Base site URL (default: https://blogs.redwan.work/)
`);
    process.exit(0);
  }

  if (finalUrls.length === 0) {
    if (submitSitemaps) {
      console.log('✅ Sitemap submission finished.');
      return;
    }
    console.error('No valid URLs found to submit.');
    process.exit(1);
  }

  const results = await submitUrlsToSearchEngines({
    urls: finalUrls,
    bingApiKey,
    indexNowKey,
    indexNowKeyLocation,
    siteUrl,
    dryRun
  });

  const hasFailure = results.some((r) => r.status === 'failed');
  if (hasFailure) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal submission error:', err);
  process.exit(1);
});
