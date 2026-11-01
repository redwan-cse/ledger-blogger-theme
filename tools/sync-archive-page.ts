import { syncArchivePage } from '../scripts/lib/archive-page-syncer.js';

const BLOG_ID = process.env.BLOGGER_BLOG_ID?.trim() || '5972841034338492159';
const CLIENT_ID = process.env.BLOGGER_CLIENT_ID?.trim() || process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.BLOGGER_CLIENT_SECRET?.trim() || process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
const REFRESH_TOKEN = process.env.BLOGGER_REFRESH_TOKEN?.trim();
const ARCHIVE_PAGE_ID = '1598577468722262893';

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      refresh_token: REFRESH_TOKEN!,
      grant_type: 'refresh_token'
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

async function main() {
  console.log('Fetching OAuth token...');
  const token = await getAccessToken();

  const res = await syncArchivePage({
    token,
    blogId: BLOG_ID,
    pageId: ARCHIVE_PAGE_ID,
    log: console.log
  });

  console.log('Done! Result:', res);
}

main().catch((err) => {
  console.error('Archive sync failed:', err);
  process.exit(1);
});
