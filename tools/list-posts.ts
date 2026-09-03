interface BloggerPostItem {
  id: string;
  title: string;
  url: string;
  published: string;
}

const BLOG_ID = process.env.BLOGGER_BLOG_ID?.trim() || '5972841034338492159';
const CLIENT_ID = process.env.BLOGGER_CLIENT_ID?.trim() || process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.BLOGGER_CLIENT_SECRET?.trim() || process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
const REFRESH_TOKEN = process.env.BLOGGER_REFRESH_TOKEN?.trim();

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
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

async function main() {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json() as { items?: BloggerPostItem[] };
  console.log('Posts on blog:');
  for (const post of data.items || []) {
    console.log(`ID: ${post.id} | Title: ${post.title} | URL: ${post.url}`);
  }
}

main().catch(console.error);
