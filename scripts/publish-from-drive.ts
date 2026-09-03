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
const SPREADSHEET_ID = '1Pox6crGHIr0t8fR5iTR5CM-0e_OjAaOQ7VoKde9baro';

// 1. Authenticate with Google Drive & Sheets via Service Account JWT
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
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
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
  if (!res.ok || !data.access_token) {
    throw new Error(`Google Service Account Token Error: ${data.error || res.statusText} - ${data.error_description || ''}`);
  }

  return data.access_token;
}

async function logToGoogleSheet(token: string, row: (string | number)[]): Promise<void> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [row] })
    });
    if (res.ok) {
      console.log(`[✓] Successfully logged entry to Content_Planner_and_History Google Sheet.`);
    } else {
      const err = await res.text();
      console.warn(`[!] Warning: Failed to log to Google Sheet: ${err}`);
    }
  } catch (e: any) {
    console.warn(`[!] Exception logging to Google Sheet: ${e.message}`);
  }
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
    if (!text || !text.trim() || text.trim() === '[ ]' || text.trim() === '[]') {
      return ''; // NEVER EMIT EMPTY CODE BLOCKS
    }

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
      return `\n<div class="mermaid-diagram-wrap"><pre class="mermaid">${mermaidCode}</pre></div>\n`;
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
        displayLang = 'plaintext';
      }
    }

    // Authentic GitHub / Medium Markdown code block (clean, no bulky headers)
    return `\n<pre><code class="language-${displayLang}">${escapeHtml(text.trim())}</code></pre>\n`;
  };

  renderer.table = function({ header, rows }: { header: string; rows: string }) {
    return `\n<div class="table-container">
  <table>
    <thead>${header}</thead>
    <tbody>${rows}</tbody>
  </table>
</div>\n`;
  };

  renderer.tablecell = function({ text, header }: { text: string; header: boolean }) {
    const tag = header ? 'th' : 'td';
    return `<${tag}>${text}</${tag}>`;
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

  // 1. Purge completely empty code blocks (e.g. ```\n``` or ```powershell\n```)
  cleanedMarkdown = cleanedMarkdown.replace(/```[a-z0-9_-]*\s*```/gi, '');

  // 2. Intelligent Auto-Fencer for Google Docs plain-text exports (where Spark forgot fences)
  // A. Mermaid sequence diagrams & flowcharts
  if (!cleanedMarkdown.includes('```mermaid')) {
    cleanedMarkdown = cleanedMarkdown.replace(/(?:^|\n)(sequenceDiagram[\s\S]*?)(?=\n\n(?:[A-Z0-9#]|\d+\.|\##)|$)/g, '\n\n```mermaid\n$1\n```\n\n');
    cleanedMarkdown = cleanedMarkdown.replace(/(?:^|\n)((?:flowchart|graph)\s+(?:TD|LR|BT|RL)[\s\S]*?)(?=\n\n(?:[A-Z0-9#]|\d+\.|\##)|$)/g, '\n\n```mermaid\n$1\n```\n\n');
  }

  // B. C Structures (struct cred, etc.)
  if (!cleanedMarkdown.includes('```c')) {
    cleanedMarkdown = cleanedMarkdown.replace(/(?:^|\n)(struct\s+\w+\s*\{[\s\S]*?\};)/g, '\n\n```c\n$1\n```\n\n');
  }

  // C. Bash runbooks and scripts (with shebang or shell comments)
  if (!cleanedMarkdown.includes('```bash')) {
    cleanedMarkdown = cleanedMarkdown.replace(/(?:^|\n)((?:#!.*bash|# Fast Cyber.*|set -euo pipefail)[\s\S]*?)(?=\n\n(?:\d+\.|\##|[A-Z][a-z]+:)|$)/g, '\n\n```bash\n$1\n```\n\n');
  }

  // D. Sigma Detection Rules (YAML)
  if (!cleanedMarkdown.includes('```yaml')) {
    cleanedMarkdown = cleanedMarkdown.replace(/(?:^|\n)(title:\s*[\s\S]*?tags:[\s\S]*?)(?=\n\n(?:\d+\.|\##|[A-Z][a-z]+)|$)/g, '\n\n```yaml\n$1\n```\n\n');
  }

  // E. Python Monitoring Scripts
  if (!cleanedMarkdown.includes('```python')) {
    cleanedMarkdown = cleanedMarkdown.replace(/(?:^|\n)((?:#!.*python3?|import sys|import subprocess|import json|from typing import|class \w+Auditor)[\s\S]*?)(?=\n\n(?:\d+\.|\##|Fast Cyber Defense)|$)/g, '\n\n```python\n$1\n```\n\n');
  }

  // F. PowerShell Audit Modules
  if (!cleanedMarkdown.includes('```powershell')) {
    cleanedMarkdown = cleanedMarkdown.replace(/(?:^|\n)(\[CmdletBinding\(\)\][\s\S]*?)(?=\n\n(?:\d+\.|\##|[A-Z][a-z]+:)|$)/g, '\n\n```powershell\n$1\n```\n\n');
  }

  // 3. Demote any accidental '# ' headings in body to '## ' (prevents shell comments from becoming H1)
  cleanedMarkdown = cleanedMarkdown.replace(/^# (?!#)/gm, '## ');

  // 4. Aggressively merge consecutive code blocks separated by whitespace or empty lines
  for (let i = 0; i < 10; i++) {
    const before = cleanedMarkdown;
    cleanedMarkdown = cleanedMarkdown.replace(/```([a-z0-9_-]*)\n([\s\S]*?)\n```[\s\r\n]+```\1?\n/gi, (match, lang, code) => {
      return '```' + (lang || '') + '\n' + code + '\n';
    });
    if (before === cleanedMarkdown) break;
  }

  // Disable 4-space indented code blocks in marked to prevent random code fragmentation
  marked.use({
    tokenizer: {
      code(src: string) {
        return undefined as any;
      }
    }
  });

  let htmlBody = marked.parse(cleanedMarkdown, { renderer, gfm: true }) as string;

  // Compact excessive whitespace inside <pre><code> blocks
  htmlBody = htmlBody.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match) => {
    return match.replace(/\n\s*\n\s*\n/g, '\n\n').replace(/\n{2,}/g, '\n');
  });

  // Inject Mermaid ESM script with dynamic light/dark theme support
  if (htmlBody.includes('class="mermaid"')) {
    const mermaidScript = `\n<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  mermaid.initialize({
    startOnLoad: true,
    theme: isDark ? 'dark' : 'default',
    themeVariables: isDark ? {
      darkMode: true,
      background: '#161B22',
      primaryColor: '#2563EB',
      primaryTextColor: '#F8FAFC',
      lineColor: '#58A6FF'
    } : {
      darkMode: false,
      background: '#FFFFFF',
      primaryColor: '#F6F8FA',
      primaryTextColor: '#1F2328',
      primaryBorderColor: '#D0D7DE',
      lineColor: '#57606A'
    },
    securityLevel: 'loose'
  });
</script>\n`;
    htmlBody += mermaidScript;
  }

  // Prepend scoped style block for authentic GitHub/Medium Markdown code blocks and diagrams
  const scopedStyles = `<style>
  /* GitHub / Medium Markdown Clean Code Styles */
  .post-body pre {
    background-color: #f6f8fa !important;
    border: 1px solid #d0d7de !important;
    padding: 16px !important;
    border-radius: 6px !important;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important;
    font-size: 0.85rem !important;
    line-height: 1.5 !important;
    color: #1f2328 !important;
    margin: 16px 0 !important;
    overflow-x: auto !important;
    position: relative !important;
  }
  .post-body pre code {
    background: transparent !important;
    color: inherit !important;
    padding: 0 !important;
    font-size: inherit !important;
    border: none !important;
  }
  .post-body code {
    background-color: rgba(175, 184, 193, 0.2) !important;
    padding: 0.2em 0.4em !important;
    border-radius: 6px !important;
    font-size: 0.85em !important;
    color: #1f2328 !important;
  }
  .mermaid-diagram-wrap {
    background: #ffffff !important;
    border: 1px solid #d0d7de !important;
    padding: 24px !important;
    border-radius: 6px !important;
    margin: 24px 0 !important;
    text-align: center !important;
    overflow-x: auto !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
  }
  .mermaid-diagram-wrap pre.mermaid {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
    color: #1f2328 !important;
    overflow: visible !important;
  }
  .table-container {
    overflow-x: auto;
    margin: 20px 0;
    border: 1px solid #d0d7de;
    border-radius: 6px;
  }
  .table-container table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
  .table-container thead { background: #f6f8fa; border-bottom: 2px solid #d0d7de; }
  .table-container th { padding: 8px 14px; font-weight: 600; color: #1f2328; border-bottom: 2px solid #d0d7de; }
  .table-container td { padding: 8px 14px; border-bottom: 1px solid #d0d7de; color: #1f2328; }
  .table-container tr:nth-child(even) td { background: #fbfcfd; }

  /* Dark mode overrides (attribute or OS) */
  [data-theme='dark'] .post-body pre, html[data-theme='dark'] .post-body pre {
    background-color: #161b22 !important;
    border-color: #30363d !important;
    color: #e6edf3 !important;
  }
  [data-theme='dark'] .post-body code, html[data-theme='dark'] .post-body code {
    background-color: rgba(110, 118, 129, 0.4) !important;
    color: #e6edf3 !important;
  }
  [data-theme='dark'] .mermaid-diagram-wrap, html[data-theme='dark'] .mermaid-diagram-wrap {
    background: #161b22 !important;
    border-color: #30363d !important;
  }
  [data-theme='dark'] .mermaid-diagram-wrap pre.mermaid, html[data-theme='dark'] .mermaid-diagram-wrap pre.mermaid {
    color: #e6edf3 !important;
  }
  [data-theme='dark'] .table-container, html[data-theme='dark'] .table-container { border-color: #30363d; }
  [data-theme='dark'] .table-container thead, html[data-theme='dark'] .table-container thead { background: #161b22; border-bottom-color: #30363d; }
  [data-theme='dark'] .table-container th, html[data-theme='dark'] .table-container th { color: #e6edf3; border-bottom-color: #30363d; }
  [data-theme='dark'] .table-container td, html[data-theme='dark'] .table-container td { border-bottom-color: #30363d; color: #c9d1d9; }
  [data-theme='dark'] .table-container tr:nth-child(even) td { background: #0d1117; }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) .post-body pre {
      background-color: #161b22 !important;
      border-color: #30363d !important;
      color: #e6edf3 !important;
    }
    :root:not([data-theme='light']) .post-body code {
      background-color: rgba(110, 118, 129, 0.4) !important;
      color: #e6edf3 !important;
    }
    :root:not([data-theme='light']) .mermaid-diagram-wrap {
      background: #161b22 !important;
      border-color: #30363d !important;
    }
    :root:not([data-theme='light']) .mermaid-diagram-wrap pre.mermaid {
      color: #e6edf3 !important;
    }
  }
</style>\n`;

  // Prepend Hero Image if available
  if (heroImageUrl) {
    const heroBlock = `<div class="post-hero-wrap" style="margin-bottom:2.2rem;border-radius:10px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.25);">
  <img src="${heroImageUrl}" alt="Article Hero" class="post-hero-image" style="width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;display:block;" loading="eager" fetchpriority="high" width="1200" height="675"/>
</div>\n`;
    htmlBody = heroBlock + htmlBody;
  }

  return scopedStyles + htmlBody;
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

  // 1. Check for 'Intake' drop folder inside Blog_Queue
  try {
    const intakeQuery = `'${QUEUE_FOLDER_ID}' in parents and name='Intake' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const intakeRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(intakeQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${driveToken}` }
    });
    const intakeData = await intakeRes.json() as { files?: DriveItem[] };
    const intakeFolder = intakeData.files?.[0];

    if (intakeFolder) {
      console.log(`Checking Intake folder (ID: ${intakeFolder.id}) for newly dropped files...`);
      const intakeFilesRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${intakeFolder.id}'+in+parents+and+trashed=false&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType)`, {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      const intakeFilesData = await intakeFilesRes.json() as { files?: DriveItem[] };
      const intakeFiles = intakeFilesData.files || [];

      const articleItem = intakeFiles.find(f => f.name.toLowerCase().includes('article') || f.mimeType === 'application/vnd.google-apps.document');
      const thumbnailItem = intakeFiles.find(f => f.name.toLowerCase().includes('thumb') || f.mimeType.startsWith('image/'));

      if (articleItem) {
        console.log(`Found newly dropped post in Intake: "${articleItem.name}". Auto-organizing into dedicated subfolder...`);
        let rawContent = '';
        if (articleItem.mimeType === 'application/vnd.google-apps.document') {
          const expRes = await fetch(`https://www.googleapis.com/drive/v3/files/${articleItem.id}/export?mimeType=text/plain`, {
            headers: { Authorization: `Bearer ${driveToken}` }
          });
          rawContent = await expRes.text();
        } else {
          const downRes = await fetch(`https://www.googleapis.com/drive/v3/files/${articleItem.id}?alt=media`, {
            headers: { Authorization: `Bearer ${driveToken}` }
          });
          rawContent = await downRes.text();
        }

        // Detect title & category
        const titleMatch = rawContent.match(/^#\s+(.+)$/m) || rawContent.match(/^##\s+(.+)$/m);
        let detectedTitle = titleMatch ? titleMatch[1].replace(/[#*`_]/g, '').trim() : articleItem.name.replace(/\.[^/.]+$/, '');
        const catMatch = rawContent.match(/\[(AI Security|Cloud Security|DevSecOps|Penetration Testing|Linux Hardening|OSINT & Threat Intel|Digital Forensics)\]/i) || detectedTitle.match(/\[(.*?)\]/);
        const detectedCat = catMatch ? `[${catMatch[1]}]` : '[Cybersecurity]';

        if (!detectedTitle.includes('[')) {
          detectedTitle = `${detectedCat} ${detectedTitle}`;
        }

        // Create dedicated subfolder in Blog_Queue
        const folderCreateRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${driveToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: detectedTitle,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [QUEUE_FOLDER_ID]
          })
        });
        const newSubfolder = await folderCreateRes.json() as { id: string; name: string };
        console.log(`[✓] Created dedicated package folder in Blog_Queue: "${detectedTitle}" (ID: ${newSubfolder.id})`);

        // Move article & thumbnail from Intake into newSubfolder
        await fetch(`https://www.googleapis.com/drive/v3/files/${articleItem.id}?addParents=${newSubfolder.id}&removeParents=${intakeFolder.id}&enforceSingleParent=true&supportsAllDrives=true`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${driveToken}` }
        });
        if (thumbnailItem) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${thumbnailItem.id}?addParents=${newSubfolder.id}&removeParents=${intakeFolder.id}&enforceSingleParent=true&supportsAllDrives=true`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${driveToken}` }
          });
        }
        console.log(`[✓] Moved article and thumbnail into "${detectedTitle}".`);
      }
    }
  } catch (e: any) {
    console.warn(`[!] Note checking Intake folder: ${e.message}`);
  }

  // List all items inside Blog_Queue
  console.log(`Checking items in Blog_Queue (ID: ${QUEUE_FOLDER_ID})...`);
  const queueQuery = `'${QUEUE_FOLDER_ID}' in parents and trashed=false`;
  const queueRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queueQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType)`, {
    headers: { Authorization: `Bearer ${driveToken}` }
  });
  const queueData = await queueRes.json() as { files?: DriveItem[] };
  let items = (queueData.files || []).filter(f => f.name !== 'Intake');

  // Also check if any package folder was created directly in root blogs.redwan.work
  try {
    const rootQuery = `'${ROOT_FOLDER_ID}' in parents and trashed=false`;
    const rootRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(rootQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType)`, {
      headers: { Authorization: `Bearer ${driveToken}` }
    });
    const rootData = await rootRes.json() as { files?: DriveItem[] };
    const rootPackages = (rootData.files || []).filter(f => 
      f.name.startsWith('[') && 
      f.id !== QUEUE_FOLDER_ID && 
      f.id !== publishedFolderId &&
      !f.name.includes('Content_Planner')
    );
    if (rootPackages.length > 0) {
      console.log(`Found ${rootPackages.length} package(s) directly in root folder:`, rootPackages.map(p => p.name));
      items = [...items, ...rootPackages];
    }
  } catch (e: any) {
    console.warn(`Could not check root folder: ${e.message}`);
  }

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

    // 1. Log to Content_Planner_and_History Google Sheet
    const todayStr = new Date().toISOString().slice(0, 10);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayStr = days[new Date().getUTCDay()];
    const cveMatch = markdownContent.match(/\b(CVE-\d{4}-\d+|RFC\s*\d+|AD\s*CS\s*ESC\d+|NIST\s*[\w\.\-]+)\b/i);
    const focusCve = cveMatch ? cveMatch[0] : label;

    await logToGoogleSheet(driveToken, [
      todayStr,
      weekdayStr,
      label,
      cleanTitle,
      focusCve,
      'PowerShell, Python, Bash, Sigma, Mermaid',
      'Published',
      post.url
    ]);

    // 2. Move folder/file to Blog_Published
    if (publishedFolderId) {
      try {
        const detailRes = await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}?fields=parents&supportsAllDrives=true`, {
          headers: { Authorization: `Bearer ${driveToken}` }
        });
        const detail = await detailRes.json() as { parents?: string[] };
        const currentParent = detail.parents?.[0] || QUEUE_FOLDER_ID;

        await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}?addParents=${publishedFolderId}&removeParents=${currentParent}&enforceSingleParent=true&supportsAllDrives=true`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${driveToken}` }
        });
        console.log(`Moved "${item.name}" to "${PUBLISHED_FOLDER_NAME}".`);
      } catch (e: any) {
        console.warn(`Could not move folder to Blog_Published: ${e.message}`);
      }
    }
  }

  console.log('\n=== All Documents Processed Successfully ===');
}

main().catch((err) => {
  console.error('Fatal Auto-Publisher Error:', err);
  process.exit(1);
});
