import { HarnessHttpClient } from './http.js';

const BLOGGER_API_BASE = 'https://www.googleapis.com/blogger/v3';
const POST_FIELDS = 'nextPageToken,items(id,url,title,content,labels,published,updated)';
const PAGE_FIELDS = 'items(id,url,title)';

export interface BloggerApiCredentials { apiKey?: string; accessToken?: string }
export interface DiscoveredPost { id: string; url: string; title: string; content: string; labels: readonly string[]; published: string; updated: string }
export interface DiscoveredPage { id: string; url: string; title: string }
interface PostsPage { items: DiscoveredPost[]; nextPageToken?: string }

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Blogger API response has an invalid ${field}.`);
  return value;
}

function optionalString(value: unknown, field: string): string {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new Error(`Blogger API response has an invalid ${field}.`);
  return value;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error(`Blogger API returned an invalid ${name}.`);
  return value as Record<string, unknown>;
}

function parsePostsPage(body: string): PostsPage {
  let value: unknown;
  try { value = JSON.parse(body); } catch { throw new Error('Blogger API returned invalid JSON.'); }
  const root = record(value, 'posts page');
  const rawItems = root.items ?? [];
  if (!Array.isArray(rawItems)) throw new Error('Blogger API posts page has invalid items.');
  const items = rawItems.map((item, index): DiscoveredPost => {
    const post = record(item, `post ${index}`);
    const labels = post.labels ?? [];
    if (!Array.isArray(labels) || !labels.every((label) => typeof label === 'string')) throw new Error(`Blogger API post ${index} has invalid labels.`);
    return { id: requiredString(post.id, `items[${index}].id`), url: requiredString(post.url, `items[${index}].url`), title: requiredString(post.title, `items[${index}].title`), content: optionalString(post.content, `items[${index}].content`), labels, published: requiredString(post.published, `items[${index}].published`), updated: requiredString(post.updated, `items[${index}].updated`) };
  });
  if (root.nextPageToken !== undefined && typeof root.nextPageToken !== 'string') throw new Error('Blogger API posts page has an invalid nextPageToken.');
  return { items, ...(typeof root.nextPageToken === 'string' && root.nextPageToken ? { nextPageToken: root.nextPageToken } : {}) };
}

function parsePages(body: string): DiscoveredPage[] {
  let value: unknown;
  try { value = JSON.parse(body); } catch { throw new Error('Blogger API returned invalid JSON.'); }
  const rawItems = record(value, 'pages response').items ?? [];
  if (!Array.isArray(rawItems)) throw new Error('Blogger API pages response has invalid items.');
  return rawItems.map((item, index) => {
    const page = record(item, `page ${index}`);
    return { id: requiredString(page.id, `items[${index}].id`), url: requiredString(page.url, `items[${index}].url`), title: requiredString(page.title, `items[${index}].title`) };
  });
}

export class BloggerDiscoveryClient {
  readonly #http: HarnessHttpClient;
  readonly #credentials: BloggerApiCredentials;
  constructor(http: HarnessHttpClient, credentials: BloggerApiCredentials) {
    if (!credentials.apiKey?.trim() && !credentials.accessToken?.trim()) throw new Error('Blogger discovery requires an API key or OAuth access token.');
    this.#http = http;
    this.#credentials = credentials;
  }
  #url(blogId: string, resource: 'posts' | 'pages'): URL {
    const url = new URL(`${BLOGGER_API_BASE}/blogs/${encodeURIComponent(blogId)}/${resource}`);
    if (this.#credentials.apiKey) url.searchParams.set('key', this.#credentials.apiKey);
    return url;
  }
  #init(): RequestInit { return this.#credentials.accessToken ? { headers: { authorization: `Bearer ${this.#credentials.accessToken}` } } : {}; }
  async #read(url: URL): Promise<string> {
    const response = await this.#http.get(url, this.#init());
    if (response.blocked) throw new Error(response.blockedReason ?? 'Blogger API discovery was blocked.');
    if (response.status < 200 || response.status >= 300) throw new Error(`Blogger API returned HTTP ${response.status}.`);
    return response.body;
  }
  async listAllPosts(blogId: string): Promise<readonly DiscoveredPost[]> {
    if (!blogId.trim()) throw new Error('A Blogger blog ID is required for discovery.');
    const posts: DiscoveredPost[] = [];
    let pageToken: string | undefined;
    do {
      const url = this.#url(blogId, 'posts');
      url.searchParams.set('fetchBodies', 'true'); url.searchParams.set('maxResults', '500'); url.searchParams.set('status', 'live'); url.searchParams.set('fields', POST_FIELDS);
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const page = parsePostsPage(await this.#read(url));
      posts.push(...page.items); pageToken = page.nextPageToken;
    } while (pageToken);
    return posts;
  }
  async listPages(blogId: string): Promise<readonly DiscoveredPage[]> {
    if (!blogId.trim()) throw new Error('A Blogger blog ID is required for discovery.');
    const url = this.#url(blogId, 'pages');
    url.searchParams.set('fetchBodies', 'false'); url.searchParams.set('status', 'live'); url.searchParams.set('fields', PAGE_FIELDS);
    return parsePages(await this.#read(url));
  }
}
