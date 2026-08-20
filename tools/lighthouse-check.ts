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
    await new Promise((resolve) => setTimeout(resolve, 3000));

    execFileSync(process.execPath, [path.join(ROOT, 'node_modules/lighthouse/cli/index.js'), url, '--quiet', '--output=json', `--output-path=${output}`, '--only-categories=performance,accessibility', '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage'], { stdio: 'inherit' });


    const report = JSON.parse(await readFile(output, 'utf8'));
    const performance = report.categories.performance.score;
    const accessibility = report.categories.accessibility.score;
    const cls = report.audits['cumulative-layout-shift'].numericValue;
    const lcp = report.audits['largest-contentful-paint'].numericValue;
    if (performance < 0.9) throw new Error(`${name} (mobile): performance ${performance} < 0.90`);
    if (accessibility < 0.95) throw new Error(`${name} (mobile): accessibility ${accessibility} < 0.95`);
    if (cls > 0.05) throw new Error(`${name} (mobile): CLS ${cls} > 0.05`);
    if (lcp > 2500) throw new Error(`${name} (mobile): LCP ${lcp}ms > 2500ms`);
    console.log(`PASS ${name} (mobile): performance=${performance}, accessibility=${accessibility}, CLS=${cls}, LCP=${lcp}ms`);

  }




} finally { await rm(tmp, { recursive: true, force: true }); }
