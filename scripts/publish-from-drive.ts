import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { marked } from 'marked';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
}

const BLOG_ID = process.env.BLOGGER_BLOG_ID?.trim() || '5972841034338492159';
const CLIENT_ID = process.env.BLOGGER_CLIENT_ID?.trim() || process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.BLOGGER_CLIENT_SECRET?.trim() || process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
const REFRESH_TOKEN = process.env.BLOGGER_REFRESH_TOKEN?.trim();
const SERVICE_ACCOUNT_JSON = process.env.DRIVE_SERVICE_ACCOUNT_KEY?.trim();

const ROOT_FOLDER_ID = '1bJGScEpKr2iuP6nynxAW_lNScI_8I0jq';
const QUEUE_FOLDER_ID = '17Il9OEUn3OluptlReqefnrn2DlfMmdbl';
const PUBLISHED_FOLDER_NAME = 'Blog_Published';

// 1. Authenticate with Google Drive via Service Account JWT
async function getDriveAccessToken(sa: any): Promise<string> {
  const privateKeyRaw = sa.private_key || sa.privateKey;
  if (!privateKeyRaw) {
    throw new Error(`Service account private_key not found. Available JSON keys: ${Object.keys(sa).join(', ')}`);
  }

  const clientEmail = sa.client_email || sa.clientEmail;
  if (!clientEmail) {
    throw new Error(`Service account client_email not found. Available JSON keys: ${Object.keys(sa).join(', ')}`);
  }

  const normalizedKey = privateKeyRaw.includes('\\n') ? privateKeyRaw.replace(/\\n/g, '\n') : privateKeyRaw;

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const base64Url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const encodedHeader = base64Url(header);
  const encodedClaim = base64Url(claim);
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(normalizedKey, 'base64url');
  const jwt = `${signatureInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await res.json() as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`Failed to get Google Drive access token: ${data.error} - ${data.error_description}`);
  }

  return data.access_token;
}

// 2. Authenticate with Blogger as Md Redwan Ahmed via User Refresh Token
async function getBloggerAccessToken(): Promise<string> {
  if (process.env.BLOGGER_ACCESS_TOKEN?.trim()) {
    return process.env.BLOGGER_ACCESS_TOKEN.trim();
  }

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error('Missing Blogger OAuth credentials: CLIENT_ID, CLIENT_SECRET, and REFRESH_TOKEN are required.');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });

  const data = await res.json() as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`Failed to refresh Blogger access token: ${data.error} - ${data.error_description}`);
  }

  return data.access_token;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\[.*?\]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

// 3. Configure Marked Markdown Compiler with Code Window & Mermaid Support
function compileMarkdownToHtml(markdown: string, heroImageUrl?: string): string {
  const renderer = new marked.Renderer();

  renderer.code = function({ text, lang }: { text: string; lang?: string }) {
    const rawLang = (lang || '').trim().toLowerCase();

    // Auto-detect Mermaid sequence diagrams and flowcharts
    const isMermaid = rawLang === 'mermaid' ||
      text.includes('sequenceDiagram') ||
      text.includes('autonumber') ||
      text.includes('participant ') ||
      text.includes('actor ') ||
      (text.includes('-->') && text.includes('[') && text.includes(']'));

    if (isMermaid) {
      let mermaidCode = text.trim();
      if (mermaidCode.includes('participant') || mermaidCode.includes('actor') || mermaidCode.includes('autonumber')) {
        if (!mermaidCode.startsWith('sequenceDiagram')) {
          mermaidCode = 'sequenceDiagram\n' + mermaidCode;
        }
      } else if (mermaidCode.includes('-->')) {
        if (!mermaidCode.startsWith('graph') && !mermaidCode.startsWith('flowchart')) {
          mermaidCode = 'graph TD\n' + mermaidCode;
        }
      }
      return `\n<div class="mermaid-diagram-wrap" style="overflow-x:auto;background:var(--card-bg, #161b22);padding:1.5rem;border-radius:8px;margin:2rem 0;border:1px solid var(--border-subtle, #30363d);text-align:center;"><pre class="mermaid" style="background:transparent;border:none;margin:0;">${mermaidCode}</pre></div>\n`;
    }

    // Auto-detect programming language if missing
    let displayLang = rawLang;
    if (!displayLang || displayLang === 'code' || displayLang === 'text') {
      if (text.includes('$') || text.includes('Get-AD') || text.includes('param (') || text.includes('Write-Host')) {
        displayLang = 'powershell';
      } else if (text.includes('def ') || text.includes('import ') || text.includes('from collections')) {
        displayLang = 'python';
      } else if (text.includes('title:') || text.includes('logsource:') || text.includes('detection:')) {
        displayLang = 'yaml';
      } else if (text.includes('curl ') || text.includes('chmod ') || text.includes('sudo ') || text.includes('#!/bin')) {
        displayLang = 'bash';
      } else {
        displayLang = 'code';
      }
    }

    return `\n<div class="code-window" style="margin:1.8rem 0;border-radius:8px;overflow:hidden;border:1px solid var(--border-subtle, #30363d);box-shadow:0 4px 12px rgba(0,0,0,0.15);">
  <div class="code-window-header" style="background:var(--code-header-bg, #21262d);padding:0.45rem 1rem;font-size:0.75rem;font-weight:600;color:var(--text-muted, #8b949e);text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid var(--border-subtle, #30363d);display:flex;justify-content:space-between;align-items:center;">
    <span>${displayLang}</span>
  </div>
  <pre style="margin:0;padding:1.1rem;background:var(--code-bg, #0d1117);overflow-x:auto;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:0.875rem;line-height:1.65;"><code class="language-${displayLang}">${escapeHtml(text)}</code></pre>
</div>\n`;
  };

  renderer.table = function({ header, rows }: { header: string; rows: string }) {
    return `\n<div class="table-container" style="overflow-x:auto;margin:2rem 0;border-radius:8px;border:1px solid var(--border-subtle, #30363d);">
  <table style="width:100%;border-collapse:collapse;font-size:0.92rem;line-height:1.6;text-align:left;">
    <thead style="background:var(--card-bg, #161b22);border-bottom:2px solid var(--border-subtle, #30363d);">${header}</thead>
    <tbody>${rows}</tbody>
  </table>
</div>\n`;
  };

  renderer.tablecell = function({ text, header }: { text: string; header: boolean }) {
    const tag = header ? 'th' : 'td';
    const style = header
      ? 'padding:0.85rem 1.2rem;font-weight:700;color:var(--text, #f0f6fc);border-bottom:2px solid var(--border-subtle, #30363d);'
      : 'padding:0.85rem 1.2rem;border-bottom:1px solid var(--border-subtle, #30363d);color:var(--text-muted, #c9d1d9);';
    return `<${tag} style="${style}">${text}</${tag}>`;
  };

  // Strip manual bylines if present in markdown
  let cleanedMarkdown = markdown
    .replace(/^Author:.*$/gim, '')
    .replace(/^Publication:.*$/gim, '')
    .replace(/^Date:.*$/gim, '')
    .replace(/^ORCID:.*$/gim, '')
    .replace(/\\([*_`~[\]()#+\-.!])/g, '$1') // Unescape markdown backslashes
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Merge fragmented adjacent code blocks
  for (let i = 0; i < 5; i++) {
    const before = cleanedMarkdown;
    cleanedMarkdown = cleanedMarkdown.replace(/```([a-z0-9_-]*)\n([\s\S]*?)\n```\s*\n+```\1?\n/gi, (match, lang, code) => {
      return '```' + (lang || '') + '\n' + code + '\n';
    });
    if (before === cleanedMarkdown) break;
  }

  let htmlBody = marked.parse(cleanedMarkdown, { renderer, gfm: true }) as string;

  // Compact excessive whitespace inside <pre><code> blocks
  htmlBody = htmlBody.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match) => {
    return match.replace(/\n\s*\n\s*\n/g, '\n\n').replace(/\n{2,}/g, '\n');
  });

  // Inject Mermaid ESM script if post contains Mermaid diagrams
  if (htmlBody.includes('class="mermaid"')) {
    const mermaidScript = `\n<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  mermaid.initialize({ startOnLoad: true, theme: isDark ? 'dark' : 'neutral', securityLevel: 'loose' });
</script>\n`;
    htmlBody += mermaidScript;
  }

  // Prepend Hero Image if available
  if (heroImageUrl) {
    const heroBlock = `<div class="post-hero-wrap" style="margin-bottom:2.2rem;border-radius:10px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.25);">
  <img src="${heroImageUrl}" alt="Article Hero" class="post-hero-image" style="width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;display:block;" loading="eager" fetchpriority="high" width="1200" height="675"/>
</div>\n`;
    htmlBody = heroBlock + htmlBody;
  }

  return htmlBody;
}

// 4. Main Processing Engine
async function main() {
  console.log('=== Google Drive (Folders & Markdown) to Blogger Auto-Publisher ===');

  if (!SERVICE_ACCOUNT_JSON) {
    throw new Error('DRIVE_SERVICE_ACCOUNT_KEY secret is required (paste the full JSON of your service account key).');
  }

  let rawJson = SERVICE_ACCOUNT_JSON.trim();
  if (!rawJson.startsWith('{')) {
    try {
      const decoded = Buffer.from(rawJson, 'base64').toString('utf8');
      if (decoded.startsWith('{')) rawJson = decoded;
    } catch {}
  }

  const sa = JSON.parse(rawJson);
  console.log(`Authenticated Service Account: ${sa.client_email || sa.clientEmail}`);

  const driveToken = await getDriveAccessToken(sa);
  const bloggerToken = await getBloggerAccessToken();

  // Find Blog_Published folder ID inside root
  const pubQuery = `'${ROOT_FOLDER_ID}' in parents and name='${PUBLISHED_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const pubRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(pubQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${driveToken}` }
  });
  const pubData = await pubRes.json() as { files?: DriveItem[] };
  const publishedFolderId = pubData.files?.[0]?.id || null;

  // List all items inside Blog_Queue
  console.log(`Checking items in Blog_Queue (ID: ${QUEUE_FOLDER_ID})...`);
  const queueQuery = `'${QUEUE_FOLDER_ID}' in parents and trashed=false`;
  const queueRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queueQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType)`, {
    headers: { Authorization: `Bearer ${driveToken}` }
  });
  const queueData = await queueRes.json() as { files?: DriveItem[] };
  let items = queueData.files || [];

  if (items.length === 0) {
    if (process.env.REPUBLISH_LATEST === 'true' && publishedFolderId) {
      console.log('Blog_Queue is empty. REPUBLISH_LATEST is true. Checking Blog_Published for latest package...');
      const pubCheckQuery = `'${publishedFolderId}' in parents and trashed=false`;
      const pubCheckRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(pubCheckQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType)&orderBy=modifiedTime desc`, {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      const pubCheckData = await pubCheckRes.json() as { files?: DriveItem[] };
      const latestFolder = pubCheckData.files?.find(f => f.mimeType === 'application/vnd.google-apps.folder');
      if (latestFolder) {
        console.log(`Found published package to re-verify: "${latestFolder.name}"`);
        items = [latestFolder];
      }
    }

    if (items.length === 0) {
      console.log('No pending items found in Blog_Queue. Everything is up to date!');
      return;
    }
  }

  console.log(`Found ${items.length} item(s) in Blog_Queue.`);

  for (const item of items) {
    const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
    console.log(`\nProcessing ${isFolder ? 'Folder' : 'File'}: "${item.name}" (ID: ${item.id})...`);

    // Parse category and clean title
    let label = 'Cybersecurity';
    let cleanTitle = item.name;
    const match = item.name.match(/^\[(.*?)\]\s*(.*)$/);
    if (match) {
      label = match[1].trim();
      cleanTitle = match[2].trim();
    }

    const postSlug = slugify(cleanTitle);
    let markdownContent = '';
    let heroImageUrl: string | undefined = undefined;

    if (isFolder) {
      // List files inside the subfolder
      const childQuery = `'${item.id}' in parents and trashed=false`;
      const childRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(childQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType)`, {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      const childData = await childRes.json() as { files?: DriveItem[] };
      const childFiles = childData.files || [];

      // Find article file (.md or Google Doc)
      const articleFile = childFiles.find((f) => f.name.toLowerCase().endsWith('.md') || f.mimeType === 'application/vnd.google-apps.document');
      const thumbnailFile = childFiles.find((f) => f.name.toLowerCase().includes('thumbnail') || f.mimeType.startsWith('image/'));

      if (!articleFile) {
        console.warn(`No article.md or Google Doc found inside folder "${item.name}". Skipping.`);
        continue;
      }

      // Download / Export article content
      if (articleFile.mimeType === 'application/vnd.google-apps.document') {
        const expRes = await fetch(`https://www.googleapis.com/drive/v3/files/${articleFile.id}/export?mimeType=text/plain`, {
          headers: { Authorization: `Bearer ${driveToken}` }
        });
        markdownContent = await expRes.text();
      } else {
        const downRes = await fetch(`https://www.googleapis.com/drive/v3/files/${articleFile.id}?alt=media`, {
          headers: { Authorization: `Bearer ${driveToken}` }
        });
        markdownContent = await downRes.text();
      }

      // Process thumbnail if present
      if (thumbnailFile) {
        console.log(`Downloading thumbnail image: "${thumbnailFile.name}"...`);
        const imgRes = await fetch(`https://www.googleapis.com/drive/v3/files/${thumbnailFile.id}?alt=media`, {
          headers: { Authorization: `Bearer ${driveToken}` }
        });
        if (imgRes.ok) {
          const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
          const assetDir = path.join(process.cwd(), 'assets', 'posts', postSlug);
          fs.mkdirSync(assetDir, { recursive: true });
          const assetPath = path.join(assetDir, 'thumbnail.png');
          fs.writeFileSync(assetPath, imgBuffer);
          console.log(`Saved thumbnail to: ${assetPath}`);

          let pushSucceeded = false;
          try {
            execSync(`git config user.name "github-actions[bot]" && git config user.email "github-actions[bot]@users.noreply.github.com"`, { stdio: 'ignore' });
            execSync(`git add assets/posts/${postSlug}/thumbnail.png`, { stdio: 'ignore' });
            execSync(`git commit -m "chore(assets): add thumbnail for ${postSlug}"`, { stdio: 'ignore' });
            const ghToken = process.env.GITHUB_TOKEN?.trim();
            if (ghToken) {
              execSync(`git push https://x-access-token:${ghToken}@github.com/redwan-cse/ledger-blogger-theme.git HEAD:main`, { stdio: 'ignore' });
            } else {
              execSync(`git push origin main`, { stdio: 'ignore' });
            }
            console.log(`Committed & pushed thumbnail to repository.`);
            pushSucceeded = true;
          } catch (e: any) {
            console.log(`Note: Local git commit/push skipped (${e.message}). Using base64 inline image.`);
          }

          if (pushSucceeded) {
            heroImageUrl = `https://raw.githubusercontent.com/redwan-cse/ledger-blogger-theme/main/assets/posts/${postSlug}/thumbnail.png`;
          } else {
            const mime = thumbnailFile.mimeType || 'image/png';
            heroImageUrl = `data:${mime};base64,${imgBuffer.toString('base64')}`;
          }
        }
      }
    } else {
      // Standalone Google Doc
      const expRes = await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}/export?mimeType=text/plain`, {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      markdownContent = await expRes.text();
    }

    if (!markdownContent.trim()) {
      console.warn(`Article content is empty for "${item.name}". Skipping.`);
      continue;
    }

    // Compile Markdown to Semantic HTML
    console.log(`Compiling GFM markdown (with Mermaid diagrams and unified code windows)...`);
    const compiledHtml = compileMarkdownToHtml(markdownContent, heroImageUrl);

    // Publish to Blogger as Md Redwan Ahmed
    console.log(`Publishing to https://blogs.redwan.work/ as Md Redwan Ahmed...`);
    const pubRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bloggerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        kind: 'blogger#post',
        title: cleanTitle,
        content: compiledHtml,
        labels: [label]
      })
    });

    if (!pubRes.ok) {
      const err = await pubRes.text();
      console.error(`Blogger API publish failed for "${cleanTitle}": ${err}`);
      continue;
    }

    const post = await pubRes.json() as { title: string; url: string };
    console.log(`🎉 PUBLISHED LIVE: "${post.title}"`);
    console.log(`🔗 URL: ${post.url}`);

    // Move folder/file to Blog_Published
    if (publishedFolderId) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}?addParents=${publishedFolderId}&removeParents=${QUEUE_FOLDER_ID}&enforceSingleParent=true`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      console.log(`Moved "${item.name}" to "${PUBLISHED_FOLDER_NAME}".`);
    }
  }

  console.log('\n=== All Documents Processed Successfully ===');
}

main().catch((err) => {
  console.error('Fatal Auto-Publisher Error:', err);
  process.exit(1);
});
