interface ArticlePayload {
  title: string;
  labels: string[];
  snippet: string;
  contentHtml: string;
}

const BLOG_ID = process.env.BLOGGER_BLOG_ID?.trim() || '5972841034338492159';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const CLIENT_ID = process.env.BLOGGER_CLIENT_ID?.trim() || process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.BLOGGER_CLIENT_SECRET?.trim() || process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
const REFRESH_TOKEN = process.env.BLOGGER_REFRESH_TOKEN?.trim();

const VALID_LABELS = [
  'AI Security',
  'Cloud Security',
  'DevOps',
  'Digital Forensics',
  'Linux Hardening',
  'OSINT',
  'Penetration Testing',
  'Red Teaming'
];

async function getBloggerAccessToken(): Promise<string> {
  if (process.env.BLOGGER_ACCESS_TOKEN?.trim()) {
    return process.env.BLOGGER_ACCESS_TOKEN.trim();
  }

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error('Missing Blogger OAuth credentials: BLOGGER_CLIENT_ID, BLOGGER_CLIENT_SECRET, and BLOGGER_REFRESH_TOKEN are required.');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string };
  if (!tokenData.access_token) {
    throw new Error(`Failed to refresh Blogger access token: ${tokenData.error} - ${tokenData.error_description}`);
  }

  return tokenData.access_token;
}

async function fetchTrendingSources(): Promise<string[]> {
  const sources: string[] = [];
  const feeds = [
    { url: 'https://feeds.feedburner.com/TheHackersNews', name: 'The Hacker News' },
    { url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', name: 'CISA Advisories' },
    { url: 'https://export.arxiv.org/rss/cs.CR', name: 'ArXiv Cryptography & Security' }
  ];

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      if (res.ok) {
        const text = await res.text();
        const titles = text.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi) || [];
        const cleaned = titles.slice(1, 4).map((t) => {
          let clean = t;
          let prev: string;
          do {
            prev = clean;
            clean = clean.replace(/<[^>]+>|<!\[CDATA\[|\]\]>/g, '');
          } while (clean !== prev);
          return clean.trim();
        });
        sources.push(`[${feed.name}] ${cleaned.join(' | ')}`);
      }
    } catch {
      // Graceful fallback if feed is unreachable
    }
  }

  return sources;
}

async function generateArticleWithGemini(trendingContext: string[]): Promise<ArticlePayload> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required.');
  }

  const prompt = `
You are the principal security researcher writing for "Md Redwan Ahmed's Cybersecurity Research & Notes" (blogs.redwan.work).
Author: Md Redwan Ahmed — Founder & CEO of Fast Cyber Defense, Cybersecurity Professional, ORCID: 0009-0001-9419-4760.

TRENDING CONTEXT & SIGNALS:
${trendingContext.join('\n')}

TASK:
Write a deep, authoritative, technically rigorous, and engaging cybersecurity research article on a critical modern security topic inspired by the trending signals or cutting-edge threats (e.g., Cloud IAM / AWS / GCP Privilege Escalation, LLM Prompt Injection & Agentic AI Exploitation, Linux eBPF / Kernel Rootkits, Red Team Active Directory Attack Paths, OSINT Investigation Methodologies, or Zero-Day Vulnerability Analysis).

REQUIREMENTS:
1. Tone: Authoritative, magnetic, analytical, and highly actionable for security engineers, penetration testers, and defense architects.
2. Structure (in semantic HTML):
   - Hook / Threat Overview: Why this matters right now.
   - Attack Anatomy & Technical Breakdown: Detailed walkthrough with realistic syntax-highlighted code or terminal commands in <pre><code>...</code></pre>.
   - Practical Hardening & Defense Tactics: Specific configurations, detection queries (Sigma / YARA / bash / python / yaml), and mitigation strategies.
   - Fast Cyber Defense Key Takeaways: Strategic conclusions.
3. Strict Output Format: JSON ONLY (no markdown fences) with this exact schema:
{
  "title": "Clear, compelling, non-clickbait technical title",
  "labels": ["Choose 1 to 3 valid labels from: ${VALID_LABELS.join(', ')}"],
  "snippet": "1-2 sentence high-impact summary under 160 characters",
  "contentHtml": "<p>Full HTML formatted article...</p>"
}
`;

  // Use Gemini 1.5 Pro / 2.5 Flash API via REST
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText}`);
  }

  const data = await response.json() as any;
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini API returned an empty response.');
  }

  const article = JSON.parse(rawText) as ArticlePayload;
  article.labels = article.labels.filter((l) => VALID_LABELS.includes(l));
  if (article.labels.length === 0) {
    article.labels = ['Cloud Security'];
  }

  return article;
}

async function publishToBlogger(article: ArticlePayload): Promise<void> {
  const token = await getBloggerAccessToken();

  console.log(`Publishing article to Blogger blog ID: ${BLOG_ID}`);
  console.log(`Title: ${article.title}`);
  console.log(`Labels: ${article.labels.join(', ')}`);

  const response = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      kind: 'blogger#post',
      title: article.title,
      content: article.contentHtml,
      labels: article.labels
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Blogger API publish failed (${response.status}): ${errText}`);
  }

  const published = await response.json() as { id: string; url: string; title: string };
  console.log(`\n🎉 SUCCESS! Published Post: "${published.title}"`);
  console.log(`🔗 Live URL: ${published.url}\n`);
}

async function main() {
  console.log('=== Daily Cybersecurity Auto-Publisher ===');
  console.log('1. Fetching trending security research signals...');
  const trending = await fetchTrendingSources();
  console.log(`Collected ${trending.length} trending sources.`);

  console.log('2. Generating technical research article with Google Gemini...');
  const article = await generateArticleWithGemini(trending);
  console.log(`Article generated: "${article.title}" (${article.contentHtml.length} characters)`);

  console.log('3. Publishing to https://blogs.redwan.work/...');
  await publishToBlogger(article);
  console.log('=== Auto-Publisher Finished Cleanly ===');
}

main().catch((err) => {
  console.error('Fatal Auto-Publisher Error:', err);
  process.exit(1);
});
