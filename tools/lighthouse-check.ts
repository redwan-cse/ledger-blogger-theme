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
const tmp = await mkdtemp(path.join(os.tmpdir(), 'ledger-lighthouse-'));
try {
  for (const [name, url] of [['home', home], ['post', postUrl]] as const) {
    const output = path.join(tmp, `${name}.json`);
    execFileSync(process.execPath, [path.join(ROOT, 'node_modules/lighthouse/cli/index.js'), url, '--quiet', '--output=json', `--output-path=${output}`, '--only-categories=performance,accessibility', '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage'], { stdio: 'inherit' });

    const report = JSON.parse(await readFile(output, 'utf8'));
    const performance = report.categories.performance.score;
    const accessibility = report.categories.accessibility.score;
    const cls = report.audits['cumulative-layout-shift'].numericValue;
    const lcp = report.audits['largest-contentful-paint'].numericValue;
    if (performance < 0.7) throw new Error(`${name} (mobile): performance ${performance} < 0.70`);
    if (accessibility < 0.95) throw new Error(`${name} (mobile): accessibility ${accessibility} < 0.95`);
    if (cls > 0.05) throw new Error(`${name} (mobile): CLS ${cls} > 0.05`);
    if (lcp > 3500) throw new Error(`${name} (mobile): LCP ${lcp}ms > 3500ms`);
    console.log(`PASS ${name} (mobile): performance=${performance}, accessibility=${accessibility}, CLS=${cls}, LCP=${lcp}ms`);
  }


} finally { await rm(tmp, { recursive: true, force: true }); }
