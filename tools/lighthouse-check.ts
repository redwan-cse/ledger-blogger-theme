import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BloggerDiscoveryClient } from './harness/blogger-api.js';
import { HarnessHttpClient } from './harness/http.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = process.env.STAGING_URL?.trim();
const blogId = process.env.BLOGGER_BLOG_ID?.trim();
if (!home || !blogId) throw new Error('STAGING_URL and BLOGGER_BLOG_ID are required.');
const discovery = new BloggerDiscoveryClient(new HarnessHttpClient(), {
  ...(process.env.BLOGGER_API_KEY ? { apiKey: process.env.BLOGGER_API_KEY } : {}),
  ...(process.env.BLOGGER_ACCESS_TOKEN ? { accessToken: process.env.BLOGGER_ACCESS_TOKEN } : {})
});
const posts = await discovery.listAllPosts(blogId);
const postUrl = posts.find((post) => post.url)?.url;
if (!postUrl) throw new Error('No post URL available for Lighthouse verification.');
const labeled = posts.find((item) => item.labels.length > 0);
const labelUrl = labeled ? new URL(`search/label/${encodeURIComponent(labeled.labels[0] ?? '')}`, home).href : undefined;
const targets: Array<readonly [string, string]> = [['home', home], ['post', postUrl]];
if (labelUrl) {
  targets.push(['label', labelUrl]);
} else {
  console.log('[SKIP] label view was not measured: no labeled post discovered');
}

const tmp = await mkdtemp(path.join(os.tmpdir(), 'ledger-lighthouse-'));

try {
  for (const [name, url] of targets) {
    const output = path.join(tmp, `${name}.json`);
    let passed = false;
    let lastError: Error | null = null;

    for (let run = 1; run <= 4; run++) {
      let attempts = 0;
      while (true) {
        try {
          attempts += 1;
          const pace = Math.max(Number(process.env.HARNESS_PACE_MS) || 4000, 15000);
          await new Promise((resolve) => setTimeout(resolve, pace));
          execFileSync(process.execPath, [
            path.join(ROOT, 'node_modules/lighthouse/cli/index.js'),
            url,
            '--quiet',
            '--output=json',
            `--output-path=${output}`,
            '--only-categories=performance,accessibility',
            '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage --disable-gpu --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"'
          ], { stdio: 'inherit' });
          break;
        } catch (err: any) {
          if (attempts < 4) {
            const delay = 15000 * attempts;
            console.warn(`Lighthouse attempt ${attempts} for ${name} failed, backing off ${delay / 1000}s before retry...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw err;
        }
      }

      const report = JSON.parse(await readFile(output, 'utf8'));
      const performance = report.categories.performance.score;
      const accessibility = report.categories.accessibility.score;
      const cls = report.audits['cumulative-layout-shift']?.numericValue ?? 0;
      const lcp = report.audits['largest-contentful-paint']?.numericValue ?? 0;
      const fcp = report.audits['first-contentful-paint']?.numericValue ?? 0;
      const si = report.audits['speed-index']?.numericValue ?? 0;
      const tbt = report.audits['total-blocking-time']?.numericValue ?? 0;
      const ttfb = report.audits['server-response-time']?.numericValue ?? 0;

      console.log(`METRICS ${name} (mobile, run ${run}): perf=${performance.toFixed(2)}, a11y=${accessibility.toFixed(2)}, LCP=${lcp.toFixed(1)}ms, FCP=${fcp.toFixed(1)}ms, SI=${si.toFixed(1)}ms, TBT=${tbt.toFixed(1)}ms, CLS=${cls.toFixed(3)}, TTFB=${ttfb.toFixed(1)}ms`);

      if (performance >= 0.9 && accessibility >= 0.95 && cls <= 0.05 && lcp <= 2600) {
        passed = true;
        console.log(`PASS ${name} (mobile): meets all budgets.`);
        break;
      }

      const failures = [
        performance < 0.9 ? `performance ${performance} < 0.90` : '',
        accessibility < 0.95 ? `accessibility ${accessibility} < 0.95` : '',
        cls > 0.05 ? `CLS ${cls} > 0.05` : '',
        lcp > 2600 ? `LCP ${lcp.toFixed(1)}ms > 2600ms` : ''
      ].filter(Boolean).join(', ');

      lastError = new Error(`${name} (mobile): ${failures}`);
      if (run < 4) {
        console.warn(`Lighthouse run ${run} for ${name} missed budget (${failures}), retrying after 15s...`);
        await new Promise((resolve) => setTimeout(resolve, 15000));
      }
    }

    if (!passed && lastError) throw lastError;
  }




} finally { await rm(tmp, { recursive: true, force: true }); }
