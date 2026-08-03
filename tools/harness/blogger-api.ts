import { HarnessHttpClient } from './http.js';

const BLOGGER_API_BASE = 'https://www.googleapis.com/blogger/v3';
const POST_FIELDS = 'nextPageToken,items(id,url,title,content,labels,published,updated)';

export interface BloggerApiCredentials {
  apiKey?: string;
  accessToken?: string;
}

export interface DiscoveredPost {
  id: string;
  url: string;
  title: string;
  content: string;
  labels: readonly string[];
  published: string;
  updated: string;
}

interface PostsPage {
  items: DiscoveredPost[];
  nextPageToken?: string;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Blogger API response has an invalid ${field}.`);
  }
  return value;
}

function parsePostsPage(body: string): PostsPage {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new Error('Blogger API returned invalid JSON.');
  }
  if (typeof value !== 'object' || value === null) {
    throw new Error('Blogger API returned an invalid posts page.');
  }
  const record = value as { items?: unknown; nextPageToken?: unknown };
  if (record.items !== undefined && !Array.isArray(record.items)) {
    throw new Error('Blogger API posts page has invalid items.');
  }
  const items = (record.items ?? []).map((item, index): DiscoveredPost => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Blogger API post ${index} is invalid.`);
    }
    const post = item as Record<string, unknown>;
    const labels = post.labels === undefined ? [] : post.labels;
    if (!Array.isArray(labels) || !labels.every((label) => typeof label === 'string')) {
      throw new Error(`Blogger API post ${index} has invalid labels.`);
    }
    return {
      id: requiredString(post.id, `items[${index}].id`),
      url: requiredString(post.url, `items[${index}].url`),
      title: requiredString(post.title, `items[${index}].title`),
      content: requiredString(post.content, `items[${index}].content`),
      labels,
      published: requiredString(post.published, `items[${index}].published`),
      updated: requiredString(post.updated, `items[${index}].updated`)
    };
  });
  if (record.nextPageToken !== undefined && typeof record.nextPageToken !== 'string') {
    throw new Error('Blogger API posts page has an invalid nextPageToken.');
  }
  return {
    items,
    ...(typeof record.nextPageToken === 'string' && record.nextPageToken.length > 0
      ? { nextPageToken: record.nextPageToken }
      : {})
  };
}

export class BloggerDiscoveryClient {
  readonly #http: HarnessHttpClient;
  readonly #credentials: BloggerApiCredentials;

  constructor(http: HarnessHttpClient, credentials: BloggerApiCredentials) {
    if (!credentials.apiKey?.trim() && !credentials.accessToken?.trim()) {
      throw new Error('Blogger discovery requires an API key or OAuth access token.');
    }
    this.#http = http;
    this.#credentials = credentials;
  }

  async listAllPosts(blogId: string): Promise<readonly DiscoveredPost[]> {
    if (!blogId.trim()) {
      throw new Error('A Blogger blog ID is required for discovery.');
    }
    const posts: DiscoveredPost[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(`${BLOGGER_API_BASE}/blogs/${encodeURIComponent(blogId)}/posts`);
      url.searchParams.set('fetchBodies', 'true');
      url.searchParams.set('maxResults', '500');
      url.searchParams.set('fields', POST_FIELDS);
      if (this.#credentials.apiKey) {
        url.searchParams.set('key', this.#credentials.apiKey);
      }
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }
      const headers = this.#credentials.accessToken
        ? { authorization: `Bearer ${this.#credentials.accessToken}` }
        : undefined;
      const response = await this.#http.get(url, { headers });
      if (response.blocked) {
        throw new Error(response.blockedReason ?? 'Blogger API discovery was blocked.');
      }
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Blogger API posts.list returned HTTP ${response.status}.`);
      }
      const page = parsePostsPage(response.body);
      posts.push(...page.items);
      pageToken = page.nextPageToken;
    } while (pageToken);
    return posts;
  }
}
