import { BloggerDiscoveryClient } from './harness/blogger-api.js';
import { extractThemeBuild } from './harness/build-stamp.js';
import { HarnessHttpClient } from './harness/http.js';
import { fatalHarnessSummary, summarizeHarnessRun, type HarnessAssertion, type HarnessSummary } from './harness/result.js';
import { assessView, createViewTargets } from './harness/views.js';

function required(name: 'STAGING_URL' | 'EXPECTED_THEME_BUILD' | 'BLOGGER_BLOG_ID'): string { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required.`); return value; }
function olderUrl(html: string): string | undefined { return html.match(/<a\b[^>]*(?:id=(['"])Blog1_blog-pager-older-link\1|class=(['"])[^'"]*blog-pager-older-link[^'"]*\2)[^>]*href=(['"])(.*?)\3/i)?.[4]; }

async function main(): Promise<HarnessSummary> {
  try {
    const stagingUrl = new URL(required('STAGING_URL'));
    const expectedBuild = required('EXPECTED_THEME_BUILD');
    const client = new HarnessHttpClient();
    const home = await client.get(stagingUrl);
    if (home.blocked) return summarizeHarnessRun([{ requirementId: 'R-BUILD-2 AC2', status: 'BLOCKED', message: 'Build-stamp gate could not be measured.', evidence: home.blockedReason ?? `HTTP ${home.status}` }]);
    if (home.status < 200 || home.status >= 400) return fatalHarnessSummary(`Staging homepage returned HTTP ${home.status}; no render assertions ran.`);
    const deployed = extractThemeBuild(home.body);
    if (deployed !== expectedBuild) return summarizeHarnessRun([], { expected: expectedBuild, deployed });

    const discovery = new BloggerDiscoveryClient(client, { ...(process.env.BLOGGER_API_KEY ? { apiKey: process.env.BLOGGER_API_KEY } : {}), ...(process.env.BLOGGER_ACCESS_TOKEN ? { accessToken: process.env.BLOGGER_ACCESS_TOKEN } : {}) });
    const [posts, pages] = await Promise.all([discovery.listAllPosts(required('BLOGGER_BLOG_ID')), discovery.listPages(required('BLOGGER_BLOG_ID'))]);
    const discoveredOlderUrl = olderUrl(home.body);
    const layoutModeUrl = process.env.LAYOUT_MODE_URL?.trim();
    const targetOptions: { olderUrl?: string; layoutModeUrl?: string } = {};
    if (discoveredOlderUrl) targetOptions.olderUrl = discoveredOlderUrl;
    if (layoutModeUrl) targetOptions.layoutModeUrl = layoutModeUrl;
    const targets = createViewTargets(stagingUrl.href, posts, pages, targetOptions);
    const assertions: HarnessAssertion[] = [];
    for (const target of targets) {

      if (!target.url) { assertions.push(assessView(target, 0, '')); continue; }
      let response = target.name === 'home-p1' ? home : await client.get(target.url);
      if (response.blocked && response.status === 429) {
        await new Promise((r) => setTimeout(r, 6000));
        response = await client.get(target.url);
      }
      if (response.blocked && response.status === 429) {
        await new Promise((r) => setTimeout(r, 8000));
        response = await client.get(target.url);
      }
      if (response.blocked) assertions.push({ requirementId: target.requirementId, status: 'BLOCKED', message: `${target.name} could not be measured.`, evidence: response.blockedReason ?? `HTTP ${response.status}` });
      else assertions.push(assessView(target, response.status, response.body));
    }

    return summarizeHarnessRun(assertions, { expected: expectedBuild, deployed });
  } catch (error) { return fatalHarnessSummary(error instanceof Error ? error.message : String(error)); }
}

const summary = await main();
for (const assertion of summary.assertions) {
  const evidence = assertion.evidence ? ` Evidence: ${assertion.evidence}` : '';
  console.log(`[${assertion.status}] ${assertion.requirementId} ${assertion.message}${evidence}`);
}
console.log(JSON.stringify({ outcome: summary.outcome, counts: summary.counts, reason: summary.reason }, null, 2));
process.exitCode = summary.exitCode;
