import seed from '../fixtures/staging-seed.json' with { type: 'json' };
import { PacedBloggerClient, createSeedPlan, type SeedResource } from './blogger-seed-lib.js';
const API = 'https://www.googleapis.com/blogger/v3'; const PREFIX = '[Ledger M0 Fixture]'; const LIVE_BLOG_ID = '5972841034338492159';
interface ResourceList { items?: SeedResource[] }
function env(name: 'BLOGGER_BLOG_ID' | 'BLOGGER_ACCESS_TOKEN'): string { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required.`); return value; }
function words(count: number): string { return 'Security engineering evidence must come from rendered behavior, not assumptions. '.repeat(Math.ceil(count / 9)).trim(); }
function postFixtures(): Array<{ title: string; content: string; labels?: string[] }> { const fallback = seed.labels[0]; if (!fallback) throw new Error('Seed requires a label.'); return Array.from({ length: seed.postCount }, (_, index) => { const n = index + 1; const title = n === 1 ? `${PREFIX} ${seed.fixtureClasses.escaping.title}` : n === 2 ? `${PREFIX} ${'Long title '.repeat(20).slice(0, seed.fixtureClasses.longTitle.length)}` : `${PREFIX} Pagination post ${String(n).padStart(2, '0')}`; const labels = n === 3 ? undefined : n === 4 ? seed.labels.slice(0, 6) : [seed.labels[index % seed.labels.length] ?? fallback]; const body = n === 5 ? words(seed.fixtureClasses.longForm.words) : `Fixture post ${n}. ${words(120)}`; return { title, content: `<p>${body}</p><pre><code>const fixture = ${n};\nconsole.log(fixture);</code></pre>`, ...(labels ? { labels } : {}) }; }); }
const pages = [{ title: `${PREFIX} About page`, content: '<p>Static page fixture for page chrome.</p>' }, { title: `${PREFIX} Contact page`, content: '<p>Second static page fixture.</p>' }, { title: `${PREFIX} Long static page`, content: `<p>${words(500)}</p>` }];
const posts = postFixtures(); const blogId = env('BLOGGER_BLOG_ID');
if (blogId === LIVE_BLOG_ID && process.env.ALLOW_LIVE_BLOG_TESTING !== 'I_ACCEPT_PUBLIC_DOWNTIME') throw new Error('Live-blog acknowledgement missing.');
const client = new PacedBloggerClient(env('BLOGGER_ACCESS_TOKEN'));
const blog = await client.request(`${API}/blogs/${encodeURIComponent(blogId)}`).then((r) => r.json()) as { id?: unknown };
if (blog.id !== blogId) throw new Error(`OAuth preflight resolved unexpected blog ID ${String(blog.id)}.`);
async function list(kind: 'posts' | 'pages'): Promise<SeedResource[]> { const params = kind === 'posts' ? '?status=live&fetchBodies=false&maxResults=500' : '?status=live&fetchBodies=false'; const value = await client.request(`${API}/blogs/${encodeURIComponent(blogId)}/${kind}${params}`).then((r) => r.json()) as ResourceList; return value.items ?? []; }
const existingPosts = await list('posts'); const existingPages = await list('pages');
console.log('Seed plan:', JSON.stringify({ posts: createSeedPlan(posts.map((x) => x.title), existingPosts), pages: createSeedPlan(pages.map((x) => x.title), existingPages) }));
async function upsert(kind: 'posts' | 'pages', fixtures: Array<{ title: string; content: string; labels?: string[] }>, existing: SeedResource[]): Promise<void> { const byTitle = new Map(existing.map((item) => [item.title, item])); for (const fixture of fixtures) { const current = byTitle.get(fixture.title); const path = current ? `/blogs/${blogId}/${kind}/${encodeURIComponent(current.id)}` : `/blogs/${blogId}/${kind}`; await client.request(`${API}${path}`, { method: current ? 'PUT' : 'POST', body: JSON.stringify(fixture) }); console.log(`${current ? 'updated' : 'created'} ${kind.slice(0, -1)}: ${fixture.title}`); } }
await upsert('posts', posts, existingPosts); await upsert('pages', pages, existingPages);
const afterPosts = await list('posts'); const afterPages = await list('pages');
const postTitles = new Set(afterPosts.map((x) => x.title)); const pageTitles = new Set(afterPages.map((x) => x.title));
const missingPosts = posts.filter((x) => !postTitles.has(x.title)).map((x) => x.title); const missingPages = pages.filter((x) => !pageTitles.has(x.title)).map((x) => x.title);
console.log('Seed reconciliation:', JSON.stringify({ expectedPosts: posts.length, presentPosts: posts.length - missingPosts.length, expectedPages: pages.length, presentPages: pages.length - missingPages.length }));
if (missingPosts.length || missingPages.length) throw new Error(`Seed reconciliation failed: ${missingPosts.length} posts and ${missingPages.length} pages missing.`);
