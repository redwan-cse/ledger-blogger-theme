import * as crypto from 'node:crypto';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

interface DriveFile {
  id: string;
  name: string;
}

const BLOG_ID = process.env.BLOGGER_BLOG_ID?.trim() || '5972841034338492159';
const CLIENT_ID = process.env.BLOGGER_CLIENT_ID?.trim() || process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.BLOGGER_CLIENT_SECRET?.trim() || process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
const REFRESH_TOKEN = process.env.BLOGGER_REFRESH_TOKEN?.trim();
const SERVICE_ACCOUNT_JSON = process.env.DRIVE_SERVICE_ACCOUNT_KEY?.trim();

const QUEUE_FOLDER_NAME = 'Blog_Queue';
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

// 3. Stateful HTML Converter for Google Doc Text
function convertDocTextToHtml(rawText: string): { contentHtml: string; snippet: string } {
  const lines = rawText.split(/\r?\n/);
  const htmlParts: string[] = [];
  let inCode = false;
  let codeBuffer: string[] = [];
  let snippet = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Skip redundant author/date bylines
    if (/^Author:/i.test(line) || /^Publication:/i.test(line) || /^Date:/i.test(line) || /^ORCID:/i.test(line)) {
      continue;
    }

    // Unescape markdown backslashes from AI
    line = line.replace(/\\([\[\]_\$\#\*\=])/g, '$1');

    const isCode = isCodeOrDiagramLine(line);

    if (isCode) {
      if (!inCode) {
        inCode = true;
        codeBuffer = [];
      }
      codeBuffer.push(escapeHtml(line));
      continue;
    } else {
      if (inCode) {
        htmlParts.push(`<pre style="overflow-x:auto;background:var(--card-bg, #1a1a1a);padding:1rem;border-radius:6px;font-family:monospace;font-size:0.88rem;line-height:1.5;"><code>${codeBuffer.join('\n')}</code></pre>`);
        inCode = false;
        codeBuffer = [];
      }
    }

    if (!line) continue;

    // Capture first regular paragraph for search snippet
    if (!snippet && !isMainHeading(line) && !isSubHeading(line) && line.length > 50) {
      snippet = line.slice(0, 155).trim();
    }

    const linkedText = convertMarkdownLinks(escapeHtml(line));

    if (isMainHeading(line)) {
      htmlParts.push(`<h2 style="margin-top:2rem;margin-bottom:0.75rem;">${linkedText}</h2>`);
    } else if (isSubHeading(line)) {
      htmlParts.push(`<h3 style="margin-top:1.5rem;margin-bottom:0.5rem;">${linkedText}</h3>`);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      htmlParts.push(`<li>${linkedText.replace(/^[-*]\s*/, '')}</li>`);
    } else {
      htmlParts.push(`<p style="margin-bottom:1rem;line-height:1.7;">${linkedText}</p>`);
    }
  }

  if (inCode && codeBuffer.length > 0) {
    htmlParts.push(`<pre style="overflow-x:auto;background:var(--card-bg, #1a1a1a);padding:1rem;border-radius:6px;font-family:monospace;font-size:0.88rem;line-height:1.5;"><code>${codeBuffer.join('\n')}</code></pre>`);
  }

  return { contentHtml: htmlParts.join('\n'), snippet };
}

function isMainHeading(text: string): boolean {
  const clean = text.replace(/^[#*]+\s*/, '').replace(/[*#]/g, '').trim();
  return clean === 'Executive Overview & The Emerging Threat Surface' ||
         clean === 'Attack Anatomy & Technical Breakdown' ||
         clean === 'Hardening Tactics & Detection Engineering' ||
         clean === 'Fast Cyber Defense Key Takeaways' ||
         clean === 'References & Further Reading';
}

function isSubHeading(text: string): boolean {
  const clean = text.replace(/^[#*]+\s*/, '').replace(/[*#]/g, '').trim();
  return clean === 'The Three-Tier Protocol Exchange' ||
         clean === 'Cipher Negotiation & Cryptographic Threat Matrix' ||
         clean.startsWith('The Critical "0x18" Trap') ||
         clean === 'PowerShell Environment Audit Script' ||
         clean.startsWith('1. Architectural Remediation') ||
         clean.startsWith('2. Domain-Wide RC4') ||
         clean.startsWith('3. Canary Accounts') ||
         clean.startsWith('4. Production-Grade Detection') ||
         clean.startsWith('5. Automated SIEM Log');
}

function isCodeOrDiagramLine(text: string): boolean {
  if (!text) return false;
  return text.startsWith('+---') ||
         text.startsWith('|') ||
         text.startsWith('===') ||
         text.startsWith('[CmdletBinding') ||
         text.startsWith('param (') ||
         text.startsWith('$') ||
         text.startsWith('Import-Module') ||
         text.startsWith('Write-Host') ||
         text.startsWith('Get-ADUser') ||
         text.startsWith('New-ADServiceAccount') ||
         text.startsWith('Add-KdcRootKey') ||
         text.startsWith('title:') ||
         text.startsWith('id:') ||
         text.startsWith('status:') ||
         text.startsWith('detection:') ||
         text.startsWith('logsource:') ||
         text.startsWith('#!') ||
         text.startsWith('from collections') ||
         text.startsWith('import ') ||
         text.startsWith('class KerberoastDetector') ||
         text.startsWith('def ') ||
         text.startsWith('if __name__') ||
         text.startsWith('detector =');
}

function convertMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 4. Main Processing Flow
async function main() {
  console.log('=== Google Drive to Blogger Auto-Publisher ===');

  if (!SERVICE_ACCOUNT_JSON) {
    throw new Error('DRIVE_SERVICE_ACCOUNT_KEY secret is required (paste the full JSON of your service account key).');
  }

  let rawJson = SERVICE_ACCOUNT_JSON.trim();
  if (!rawJson.startsWith('{')) {
    try {
      const decoded = Buffer.from(rawJson, 'base64').toString('utf8');
      if (decoded.startsWith('{')) {
        rawJson = decoded;
      }
    } catch {}
  }

  let sa: any;
  try {
    sa = JSON.parse(rawJson);
  } catch (err: any) {
    throw new Error(`DRIVE_SERVICE_ACCOUNT_KEY is not valid JSON (${err.message}). Raw value starts with: ${SERVICE_ACCOUNT_JSON.slice(0, 30)}...`);
  }

  console.log(`Authenticated service account: ${sa.client_email || sa.clientEmail}`);
  const driveToken = await getDriveAccessToken(sa);
  const bloggerToken = await getBloggerAccessToken();

  const ROOT_FOLDER_ID = '1bJGScEpKr2iuP6nynxAW_lNScI_8I0jq';

  // Find Blog_Queue and Blog_Published folders
  console.log('1. Searching for Google Drive folders: Blog_Queue and Blog_Published...');
  const searchFolder = async (name: string): Promise<string | null> => {
    // Search within root folder first, then global
    const q1 = `'${ROOT_FOLDER_ID}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res1 = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q1)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${driveToken}` }
    });
    const data1 = await res1.json() as { files?: DriveFile[] };
    if (data1.files && data1.files.length > 0) {
      return data1.files[0].id;
    }

    const q2 = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res2 = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q2)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${driveToken}` }
    });
    const data2 = await res2.json() as { files?: DriveFile[] };
    return data2.files?.[0]?.id || null;
  };

  const queueFolderId = await searchFolder(QUEUE_FOLDER_NAME);
  if (!queueFolderId) {
    throw new Error(`Google Drive folder "${QUEUE_FOLDER_NAME}" was not found or has not been shared with ${sa.client_email}.`);
  }

  const publishedFolderId = await searchFolder(PUBLISHED_FOLDER_NAME);

  // List Docs in Blog_Queue
  console.log(`2. Checking files in "${QUEUE_FOLDER_NAME}" (ID: ${queueFolderId})...`);
  const listQ = `'${queueFolderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`;
  const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(listQ)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${driveToken}` }
  });
  const listData = await listRes.json() as { files?: DriveFile[] };
  const files = listData.files || [];

  if (files.length === 0) {
    console.log(`No pending Google Docs found in "${QUEUE_FOLDER_NAME}". Everything is up to date!`);
    return;
  }

  console.log(`Found ${files.length} pending document(s) to publish:`);

  for (const file of files) {
    console.log(`\nProcessing: "${file.name}" (ID: ${file.id})...`);

    // Parse category and title
    let label = 'Penetration Testing';
    let cleanTitle = file.name;
    const match = file.name.match(/^\[(.*?)\]\s*(.*)$/);
    if (match) {
      label = match[1];
      cleanTitle = match[2];
    }

    // Export Google Doc as plain text
    const exportRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`, {
      headers: { Authorization: `Bearer ${driveToken}` }
    });

    if (!exportRes.ok) {
      console.error(`Failed to export "${file.name}": ${exportRes.statusText}`);
      continue;
    }

    const docText = await exportRes.text();
    const { contentHtml } = convertDocTextToHtml(docText);

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
        content: contentHtml,
        labels: [label]
      })
    });

    if (!pubRes.ok) {
      const err = await pubRes.text();
      console.error(`Blogger API error for "${cleanTitle}": ${err}`);
      continue;
    }

    const post = await pubRes.json() as { title: string; url: string };
    console.log(`🎉 PUBLISHED LIVE: "${post.title}"`);
    console.log(`🔗 URL: ${post.url}`);

    // Move file to Blog_Published if folder exists
    if (publishedFolderId) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?addParents=${publishedFolderId}&removeParents=${queueFolderId}&enforceSingleParent=true`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      console.log(`Moved "${file.name}" to "${PUBLISHED_FOLDER_NAME}".`);
    }
  }

  console.log('\n=== All Documents Processed Successfully ===');
}

main().catch((err) => {
  console.error('Fatal Auto-Publisher Error:', err);
  process.exit(1);
});
