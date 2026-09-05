import * as crypto from 'node:crypto';
import { marked } from 'marked';
import { submitUrlsToSearchEngines } from './lib/search-engine-indexer.js';

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

const ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID?.trim() || '1bJGScEpKr2iuP6nynxAW_lNScI_8I0jq';
const QUEUE_FOLDER_ID = process.env.DRIVE_QUEUE_FOLDER_ID?.trim() || '1qR-RZ6MA1YJmLSAFYJQ-h7bAo-cf0QLY'; // Blog_Queue_Shared (2nd Account)
const PUBLISHED_FOLDER_NAME = 'Blog_Published';
const DEFAULT_PUBLISHED_FOLDER_ID = '1eyxxZCJF97Krkg49osWF_dc39x1SFmDX'; // Blog_Published (2nd Account)
const SPREADSHEET_ID = process.env.DRIVE_SHEET_ID?.trim() || '19XFToal3vWSZpNSW1hKksxq1uT4N-6r2FnIXeZrTkxQ'; // Content_Planner_and_History (2nd Account)

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

async function syncAndCleanGoogleSheet(token: string, newRow?: (string | number)[]): Promise<void> {
  try {
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A1:Z100`;
    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!getRes.ok) {
      console.warn(`[!] Failed to read Google Sheet: ${await getRes.text()}`);
      return;
    }
    const data = await getRes.json() as { values?: string[][] };
    let rows = data.values || [];

    if (rows.length === 0) {
      const header = ['Date', 'Day', 'Category', 'Post Title', 'Target / CVE', 'Components', 'Status', 'Live URL'];
      rows = newRow ? [header, newRow.map(String)] : [header];
    } else {
      const header = rows[0] || ['Date', 'Day', 'Category', 'Post Title', 'Target / CVE', 'Components', 'Status', 'Live URL'];
      const dataRows = rows.slice(1);

      // Deduplicate rows based on title or slug
      const uniqueMap = new Map<string, string[]>();
      let foundDuplicates = false;

      for (const row of dataRows) {
        // Normalize URL to clean canonical format (strip _0123... number suffix)
        if (row[7] && /_\d+\.html$/i.test(row[7])) {
          row[7] = row[7].replace(/_\d+\.html$/i, '.html');
          foundDuplicates = true;
        }

        const title = (row[3] || '').trim().toLowerCase();
        const url = (row[7] || '').trim();
        const slug = url.split('/').pop()?.replace(/_\d+\.html$/, '').replace(/\.html$/, '') || title;
        const key = slug || title;
        if (!key) continue;

        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, row);
        } else {
          foundDuplicates = true;
          // If existing row has a URL with numbers and current row has clean URL, prefer clean URL
          const existingRow = uniqueMap.get(key)!;
          const existingUrl = existingRow[7] || '';
          if (/_\d+\.html$/i.test(existingUrl) && !/_\d+\.html$/i.test(url)) {
            uniqueMap.set(key, row);
          }
        }
      }

      // If newRow is provided, upsert it
      if (newRow) {
        const newTitle = String(newRow[3] || '').trim().toLowerCase();
        const newUrl = String(newRow[7] || '').trim();
        const newSlug = newUrl.split('/').pop()?.replace(/_\d+\.html$/, '').replace(/\.html$/, '') || newTitle;
        const key = newSlug || newTitle;
        uniqueMap.set(key, newRow.map(String));
      }

      const cleanedDataRows = Array.from(uniqueMap.values());
      rows = [header, ...cleanedDataRows];

      console.log(`\n--- Current Clean Google Sheet Entries (${cleanedDataRows.length}) ---`);
      cleanedDataRows.forEach((r, idx) => console.log(`  Entry ${idx + 1}: ${r[0]} | ${r[2]} | "${r[3]}" | ${r[7]}`));
      console.log(`--- End Google Sheet Entries ---\n`);

      if (!foundDuplicates && !newRow) {
        console.log(`[✓] Google Sheet is already clean (${cleanedDataRows.length} entries). No duplicates found.`);
        return;
      }
    }

    // Clear existing sheet range
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A1:Z100:clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });

    // Write back cleaned rows
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A1?valueInputOption=USER_ENTERED`;
    const updateRes = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });

    if (updateRes.ok) {
      console.log(`[✓] Successfully synced and deduplicated Content_Planner_and_History Google Sheet (${rows.length - 1} entries).`);
    } else {
      console.warn(`[!] Warning: Failed to update Google Sheet: ${await updateRes.text()}`);
    }
  } catch (e: any) {
    console.warn(`[!] Exception updating Google Sheet: ${e.message}`);
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

  const data = await res.json() as { access_token?: string; scope?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`Failed to refresh Blogger access token: ${data.error} - ${data.error_description}`);
  }

  console.log(`User OAuth Token Scopes: ${data.scope || 'none'}`);

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
export function compileMarkdownToHtml(markdown: string, heroImageUrl?: string): string {
  const renderer = new marked.Renderer();

  renderer.code = function({ text, lang }: { text: string; lang?: string }) {
    if (!text || !text.trim() || text.trim() === '[ ]' || text.trim() === '[]') {
      return ''; // NEVER EMIT EMPTY CODE BLOCKS
    }

    const rawLang = (lang || '').trim().toLowerCase();

    // Auto-detect Mermaid sequence diagrams, flowcharts, graphs, and state diagrams
    const isMermaid = rawLang === 'mermaid' ||
      rawLang === 'flowchart' ||
      rawLang === 'graph' ||
      text.trim().startsWith('flowchart') ||
      text.trim().startsWith('graph') ||
      text.trim().startsWith('sequenceDiagram') ||
      text.trim().startsWith('classDiagram') ||
      text.trim().startsWith('stateDiagram') ||
      text.trim().startsWith('erDiagram') ||
      text.trim().startsWith('gantt') ||
      text.trim().startsWith('pie') ||
      text.trim().startsWith('gitGraph') ||
      text.includes('sequenceDiagram') ||
      text.includes('autonumber') ||
      text.includes('participant ') ||
      text.includes('actor ') ||
      (text.includes('-->') && (text.includes('[') || text.includes('(') || text.includes('{') || text.includes('|')));

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
      return `\n<div class="mermaid-diagram-wrap" data-mermaid-code="${escapeHtml(mermaidCode)}"><pre class="mermaid">${escapeHtml(mermaidCode)}</pre></div>\n`;
    }

    // Auto-detect programming language if missing
    let displayLang = rawLang;
    if (!displayLang || displayLang === 'code' || displayLang === 'text') {
      if (text.includes('$') || text.includes('Get-AD') || text.includes('param (') || text.includes('Write-Host')) {
        displayLang = 'powershell';
      } else if (text.includes('def ') || text.includes('import ') || text.includes('from collections')) {
        displayLang = 'python';
      } else if (text.includes('SELECT ') || text.includes('CREATE TABLE') || text.includes('ALTER TABLE') || text.includes('DO $$') || text.includes('SET LOCAL')) {
        displayLang = 'sql';
      } else if (text.includes('title:') || text.includes('logsource:') || text.includes('detection:')) {
        displayLang = 'yaml';
      } else if (text.includes('curl ') || text.includes('chmod ') || text.includes('sudo ') || text.includes('#!/bin')) {
        displayLang = 'bash';
      } else {
        displayLang = 'plaintext';
      }
    }

    // Authentic GitHub / Medium Code Block with terminal header bar and accessible copy button
    return `\n<div class="code-block-wrap">
  <div class="code-block-header">
    <span class="code-block-lang">${escapeHtml(displayLang.toUpperCase())}</span>
    <button type="button" class="code-copy-btn" aria-label="Copy code to clipboard">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg><span>Copy</span>
    </button>
  </div>
  <pre><code class="language-${displayLang}">${escapeHtml(text.trim())}</code></pre>
</div>\n`;
  };

  renderer.heading = function({ text, depth }: { text: string; depth: number }) {
    if (depth === 2 || depth === 3) {
      let plainText = text;
      let prevText = '';
      do {
        prevText = plainText;
        plainText = plainText.replace(/<[^>]+>/g, '');
      } while (plainText !== prevText);
      plainText = plainText.trim();
      const id = slugify(plainText);
      return `<h${depth} id="${id}">${text}<a href="#${id}" class="heading-anchor" aria-label="Direct link to ${escapeHtml(plainText)}">#</a></h${depth}>\n`;
    }
    return `<h${depth}>${text}</h${depth}>\n`;
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

  // 2. Clean Google Docs plain-text export quirks (apostrophes, backtick spaces, and punctuation)
  cleanedMarkdown = cleanedMarkdown
    .replace(/(\w)'''(\w)/g, "$1'$2")
    .replace(/(\w)'''/g, "$1'")
    .replace(/`\s+([a-zA-Z0-9_\-./]+)\s+`/g, '`$1`')
    .replace(/`\s+([a-zA-Z0-9_\-./]+)`/g, '`$1`')
    .replace(/`([a-zA-Z0-9_\-./]+)\s+`/g, '`$1`')
    .replace(/`\s+([,.:;!?\)\]])/g, '`$1')
    .replace(/([\(\[])\s+`/g, '$1`');

  // 3. Fix glued code fences (Google Docs / AppScript export artifacts)
  // A. Opening fence glued to preceding text or punctuation (e.g. plan.```mermaid or view:```sql or word```c)
  cleanedMarkdown = cleanedMarkdown.replace(/([^\n])\s*```+([a-zA-Z0-9_-]*)/g, '$1\n\n```$2');

  // B. Opening fence where language tag and first line of code are on the same line (e.g. ```mermaid flowchart TD or ```sql SELECT)
  cleanedMarkdown = cleanedMarkdown.replace(/```+([a-zA-Z0-9_-]+)[ \t]+([^\n\r]+)/g, '```$1\n$2');

  // C. Closing fence where preceding code line is glued on the same line (e.g. COMMIT;``` or UserFunc```)
  cleanedMarkdown = cleanedMarkdown.replace(/([^\n`\s])\s*```+(\s*)$/gm, '$1\n```$2');

  // D. Closing fence glued to subsequent prose, headings, or rules (e.g. ```PostgreSQL addresses or ```--- or ```##)
  cleanedMarkdown = cleanedMarkdown.replace(/```+([ \t]*[A-Z#\-\*][^\n\r`]+)/g, '```\n\n$1');
  cleanedMarkdown = cleanedMarkdown.replace(/```+([ \t]*[a-z]+[ \t]+[^\n\r`]+)/g, '```\n\n$1');

  // 4. Ensure tables have blank line before the header row and after the last row
  cleanedMarkdown = cleanedMarkdown.replace(/([^\n])\n(\s*\|[^\n]+\|\n\s*\|[\s:\-|]+\|)/g, '$1\n\n$2');
  cleanedMarkdown = cleanedMarkdown.replace(/(\|[^\n]+\|)\n([^\n|# -<])/g, '$1\n\n$2');

  // 5. Intelligent Auto-Fencer for Google Docs plain-text exports (ONLY if text lacks markdown fences)
  const existingFences = (cleanedMarkdown.match(/```/g) || []).length;
  const isWellFormedMarkdown = existingFences >= 4; // Already has 2+ fenced blocks

  if (!isWellFormedMarkdown) {
    // A. Mermaid sequence diagrams & flowcharts
    cleanedMarkdown = cleanedMarkdown.replace(/(?:^|\n)(sequenceDiagram[\s\S]*?)(?=\n\n(?:##|---|# )|$)/g, '\n\n```mermaid\n$1\n```\n\n');
    cleanedMarkdown = cleanedMarkdown.replace(/(?:^|\n)((?:flowchart|graph)\s+(?:TD|LR|BT|RL)[\s\S]*?)(?=\n\n(?:##|---|# )|$)/g, '\n\n```mermaid\n$1\n```\n\n');

    // B. C Structures (struct cred, etc.)
    cleanedMarkdown = cleanedMarkdown.replace(/(?:^|\n)(struct\s+\w+\s*\{[\s\S]*?\};)/g, '\n\n```c\n$1\n```\n\n');

    // C. Bash runbooks and scripts (with shebang or shell comments)
    cleanedMarkdown = cleanedMarkdown.replace(/(?:^|\n)((?:#!.*bash|# Fast Cyber.*|set -euo pipefail)[\s\S]*?)(?=\n\n(?:\d+\.|\##|[A-Z][a-z]+:)|$)/g, '\n\n```bash\n$1\n```\n\n');

    // D. Sigma Detection Rules (YAML)
    cleanedMarkdown = cleanedMarkdown.replace(/(?:^|\n)(title:\s*[\s\S]*?tags:[\s\S]*?)(?=\n\n(?:\d+\.|\##|[A-Z][a-z]+)|$)/g, '\n\n```yaml\n$1\n```\n\n');

    // E. Python Monitoring Scripts
    cleanedMarkdown = cleanedMarkdown.replace(/(?:^|\n)((?:#!.*python3?|import sys|import subprocess|import json|from typing import|class \w+Auditor)[\s\S]*?)(?=\n\n(?:\d+\.|\##|Fast Cyber Defense)|$)/g, '\n\n```python\n$1\n```\n\n');

    // F. PowerShell Audit Modules
    cleanedMarkdown = cleanedMarkdown.replace(/(?:^|\n)(\[CmdletBinding\(\)\][\s\S]*?)(?=\n\n(?:\d+\.|\##|[A-Z][a-z]+:)|$)/g, '\n\n```powershell\n$1\n```\n\n');
  }

  // 6. Demote any accidental '# ' headings in body to '## ' (prevents shell comments from becoming H1)
  cleanedMarkdown = cleanedMarkdown.replace(/^# (?!#)/gm, '## ');

  // 7. Safely merge consecutive code blocks of identical language separated only by whitespace
  for (let i = 0; i < 10; i++) {
    const before = cleanedMarkdown;
    cleanedMarkdown = cleanedMarkdown.replace(/```([a-z0-9_-]+)\n([\s\S]*?)\n```[ \t]*\n+[ \t]*```\1\n/gi, (match, lang, code) => {
      return '```' + lang + '\n' + code + '\n';
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

  // Insert <!--more--> jump break after the first paragraph to prevent Blogger page weight cut-off
  if (!htmlBody.includes('<!--more-->')) {
    const firstPIndex = htmlBody.indexOf('</p>');
    if (firstPIndex !== -1) {
      htmlBody = htmlBody.slice(0, firstPIndex + 4) + '\n<!--more-->\n' + htmlBody.slice(firstPIndex + 4);
    }
  }

  // Wrap all Markdown tables in responsive scrolling container (eliminates [object Object] bug)
  htmlBody = htmlBody.replace(/<table(?:\s[^>]*)?>[\s\S]*?<\/table>/gi, (match) => {
    return `\n<div class="table-container">\n${match}\n</div>\n`;
  });

  // Compact excessive whitespace inside <pre><code> blocks (preserve standard blank lines, cap 3+ consecutive newlines)
  htmlBody = htmlBody.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match) => {
    return match.replace(/\n{3,}/g, '\n\n');
  });

  // Tag reference lists for clean compact spacing
  htmlBody = htmlBody.replace(/(<h[23][^>]*>(?:Authoritative\s+)?(?:Technical\s+)?References<\/h[23]>\s*)<ul([^>]*)>/gi, '$1<ul class="references-list"$2>');

  // Prepend scoped style block for authentic GitHub/Medium Markdown code blocks, tables, and diagrams
  const scopedStyles = `<style>
  /* Clean Code Block Window */
  .code-block-wrap {
    margin: 24px 0 !important;
    border: 1px solid #d0d7de !important;
    border-radius: 8px !important;
    overflow: hidden !important;
    background-color: #f6f8fa !important;
  }
  .code-block-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 8px 14px !important;
    background-color: #eef2f6 !important;
    border-bottom: 1px solid #d0d7de !important;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important;
    font-size: 0.75rem !important;
    font-weight: 600 !important;
    color: #57606a !important;
  }
  .code-block-header .code-copy-btn {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 3px 10px !important;
    font-size: 0.75rem !important;
    font-weight: 600 !important;
    border-radius: 6px !important;
    border: 1px solid #d0d7de !important;
    background: #ffffff !important;
    color: #24292f !important;
    cursor: pointer !important;
    transition: all 0.15s ease !important;
  }
  .code-block-header .code-copy-btn:hover {
    background-color: #f3f4f6 !important;
    border-color: #1f6feb !important;
    color: #1f6feb !important;
  }
  .code-block-header .code-copy-btn.copied {
    color: #1a7f37 !important;
    border-color: #1a7f37 !important;
  }
  .code-block-wrap pre {
    margin: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    padding: 18px !important;
    background: transparent !important;
    color: #1f2328 !important;
    overflow-x: auto !important;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important;
    font-size: 0.875rem !important;
    line-height: 1.65 !important;
  }
  .post-body pre {
    background-color: #f6f8fa !important;
    border: 1px solid #d0d7de !important;
    padding: 18px !important;
    border-radius: 6px !important;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important;
    font-size: 0.875rem !important;
    line-height: 1.65 !important;
    color: #1f2328 !important;
    margin: 20px 0 !important;
    overflow-x: auto !important;
  }
  .post-body pre code,
  [data-theme='dark'] .post-body pre code,
  html[data-theme='dark'] .post-body pre code,
  :root:not([data-theme='light']) .post-body pre code {
    background: transparent !important;
    color: inherit !important;
    padding: 0 !important;
    font-size: inherit !important;
    border: none !important;
    box-shadow: none !important;
    display: block !important;
  }
  .post-body code {
    background-color: rgba(175, 184, 193, 0.2) !important;
    padding: 0.2em 0.4em !important;
    border-radius: 6px !important;
    font-size: 0.85em !important;
    color: #1f2328 !important;
  }
  .heading-anchor {
    display: inline-block !important;
    color: #57606a !important;
    text-decoration: none !important;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important;
    font-weight: 500 !important;
    font-size: 0.85em !important;
    margin-left: 0.35em !important;
    margin-right: 0 !important;
    opacity: 0 !important;
    transition: opacity 0.15s ease, color 0.15s ease !important;
  }
  h2:hover .heading-anchor, h3:hover .heading-anchor {
    opacity: 0.6 !important;
  }
  .heading-anchor:hover, h2 .heading-anchor:hover, h3 .heading-anchor:hover {
    opacity: 1 !important;
    color: #1f6feb !important;
  }
  .mermaid-diagram-wrap {
    background: #ffffff !important;
    border: 1px solid #d0d7de !important;
    padding: 20px !important;
    border-radius: 8px !important;
    margin: 24px 0 !important;
    text-align: center !important;
    overflow-x: auto !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
    position: relative !important;
  }
  .mermaid-diagram-wrap svg {
    transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1) !important;
    transform-origin: top center !important;
  }
  .mermaid-modern-toolbar {
    position: absolute !important;
    top: 10px !important;
    right: 12px !important;
    z-index: 10 !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 1px !important;
    padding: 3px 6px !important;
    border-radius: 9999px !important;
    background: transparent !important;
    border: 1px solid rgba(0, 0, 0, 0.12) !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    transition: all 0.2s ease !important;
  }
  .mermaid-modern-toolbar:hover {
    background: rgba(255, 255, 255, 0.85) !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
    border-color: rgba(0, 0, 0, 0.18) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
  }
  .mermaid-modern-toolbar .mm-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 22px !important;
    height: 22px !important;
    padding: 0 !important;
    border-radius: 50% !important;
    border: none !important;
    background: transparent !important;
    color: #57606a !important;
    cursor: pointer !important;
    transition: all 0.15s ease !important;
  }
  .mermaid-modern-toolbar .mm-btn:hover:not(:disabled) {
    background-color: rgba(0, 0, 0, 0.06) !important;
    color: #1f6feb !important;
  }
  .mermaid-modern-toolbar .mm-btn:disabled {
    opacity: 0.35 !important;
    cursor: default !important;
  }
  .mermaid-modern-toolbar .mm-level {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 4px !important;
    height: 20px !important;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important;
    font-size: 0.65rem !important;
    font-weight: 600 !important;
    border: none !important;
    background: transparent !important;
    color: #57606a !important;
    cursor: pointer !important;
    user-select: none !important;
    letter-spacing: -0.02em !important;
  }
  .mermaid-modern-toolbar .mm-level:hover {
    color: #1f6feb !important;
  }
  .mermaid-modern-toolbar .mm-sep {
    display: inline-block !important;
    width: 1px !important;
    height: 12px !important;
    background: rgba(0, 0, 0, 0.1) !important;
    margin: 0 2px !important;
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
    overflow-x: auto !important;
    margin: 20px 0 !important;
    border: 1px solid #d0d7de !important;
    border-radius: 8px !important;
  }
  .table-container table { width: 100% !important; border-collapse: collapse !important; font-size: 0.9em !important; }
  .table-container thead { background: #f6f8fa !important; border-bottom: 2px solid #d0d7de !important; }
  .table-container th { padding: 8px 14px !important; font-weight: 600 !important; color: #1f2328 !important; border-bottom: 2px solid #d0d7de !important; text-align: left !important; }
  .table-container td { padding: 8px 14px !important; border-bottom: 1px solid #d0d7de !important; color: #1f2328 !important; }
  .table-container tr:nth-child(even) td { background: #fbfcfd !important; }

  /* Prism Syntax Highlighting Tokens (Light Mode) */
  .token.comment, .token.prolog, .token.doctype, .token.cdata {
    color: #6e7781 !important;
    font-style: italic !important;
    background: transparent !important;
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
    display: inline !important;
  }
  .token.punctuation { color: #24292f !important; }
  .token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol, .token.deleted { color: #0550ae !important; }
  .token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted { color: #0a3069 !important; }
  .token.operator, .token.entity, .token.url { color: #cf222e !important; }
  .token.atrule, .token.attr-value, .token.keyword { color: #cf222e !important; font-weight: 600 !important; }
  .token.function, .token.class-name { color: #8250df !important; font-weight: 600 !important; }
  .token.regex, .token.important, .token.variable { color: #953800 !important; }

  /* Dark mode overrides (attribute or OS) */
  [data-theme='dark'] .code-block-wrap, html[data-theme='dark'] .code-block-wrap {
    border-color: #30363d !important;
    background-color: #0d1117 !important;
  }
  [data-theme='dark'] .code-block-header, html[data-theme='dark'] .code-block-header {
    background-color: #161b22 !important;
    border-bottom-color: #30363d !important;
    color: #8b949e !important;
  }
  [data-theme='dark'] .code-block-header .code-copy-btn, html[data-theme='dark'] .code-block-header .code-copy-btn {
    background-color: #21262d !important;
    border-color: #30363d !important;
    color: #c9d1d9 !important;
  }
  [data-theme='dark'] .code-block-header .code-copy-btn:hover, html[data-theme='dark'] .code-block-header .code-copy-btn:hover {
    background-color: #30363d !important;
    border-color: #58a6ff !important;
    color: #58a6ff !important;
  }
  [data-theme='dark'] .code-block-wrap pre, html[data-theme='dark'] .code-block-wrap pre {
    color: #e6edf3 !important;
  }
  [data-theme='dark'] .post-body pre, html[data-theme='dark'] .post-body pre {
    background-color: #161b22 !important;
    border-color: #30363d !important;
    color: #e6edf3 !important;
  }
  [data-theme='dark'] .post-body code, html[data-theme='dark'] .post-body code {
    background-color: rgba(110, 118, 129, 0.4) !important;
    color: #e6edf3 !important;
  }
  [data-theme='dark'] .post-body pre code, html[data-theme='dark'] .post-body pre code {
    background: transparent !important;
    color: inherit !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
  }
  [data-theme='dark'] .heading-anchor, html[data-theme='dark'] .heading-anchor {
    color: #8b949e !important;
  }
  [data-theme='dark'] .heading-anchor:hover, html[data-theme='dark'] .heading-anchor:hover {
    color: #58a6ff !important;
  }
  [data-theme='dark'] .mermaid-diagram-wrap, html[data-theme='dark'] .mermaid-diagram-wrap {
    background: #161b22 !important;
    border-color: #30363d !important;
  }
  [data-theme='dark'] .mermaid-modern-toolbar, html[data-theme='dark'] .mermaid-modern-toolbar {
    background: transparent !important;
    border-color: rgba(255, 255, 255, 0.18) !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    transition: all 0.2s ease !important;
  }
  [data-theme='dark'] .mermaid-modern-toolbar:hover, html[data-theme='dark'] .mermaid-modern-toolbar:hover {
    background: rgba(22, 27, 34, 0.85) !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
    border-color: rgba(255, 255, 255, 0.25) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35) !important;
  }
  [data-theme='dark'] .mermaid-modern-toolbar .mm-btn, html[data-theme='dark'] .mermaid-modern-toolbar .mm-btn {
    color: #8b949e !important;
  }
  [data-theme='dark'] .mermaid-modern-toolbar .mm-btn:hover:not(:disabled), html[data-theme='dark'] .mermaid-modern-toolbar .mm-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1) !important;
    color: #58a6ff !important;
  }
  [data-theme='dark'] .mermaid-modern-toolbar .mm-btn:disabled, html[data-theme='dark'] .mermaid-modern-toolbar .mm-btn:disabled {
    opacity: 0.25 !important;
  }
  [data-theme='dark'] .mermaid-modern-toolbar .mm-level, html[data-theme='dark'] .mermaid-modern-toolbar .mm-level {
    color: #8b949e !important;
  }
  [data-theme='dark'] .mermaid-modern-toolbar .mm-level:hover, html[data-theme='dark'] .mermaid-modern-toolbar .mm-level:hover {
    color: #58a6ff !important;
  }
  [data-theme='dark'] .mermaid-modern-toolbar .mm-sep, html[data-theme='dark'] .mermaid-modern-toolbar .mm-sep {
    background: rgba(255, 255, 255, 0.15) !important;
  }
  [data-theme='dark'] .mermaid-diagram-wrap pre.mermaid, html[data-theme='dark'] .mermaid-diagram-wrap pre.mermaid {
    color: #e6edf3 !important;
  }

  /* Compact Reference Lists */
  .references-list,
  .post-body .references-list,
  .post-body h2 + ul,
  .post-body h3 + ul {
    margin-top: 6px !important;
    margin-bottom: 20px !important;
    padding-left: 22px !important;
  }
  .references-list li,
  .post-body .references-list li,
  .post-body h2 + ul li,
  .post-body h3 + ul li {
    margin-bottom: 4px !important;
    line-height: 1.42 !important;
    font-size: 0.95rem !important;
  }
  .references-list li:last-child,
  .post-body .references-list li:last-child,
  .post-body h2 + ul li:last-child,
  .post-body h3 + ul li:last-child {
    margin-bottom: 0 !important;
  }
  [data-theme='dark'] .table-container, html[data-theme='dark'] .table-container { border-color: #30363d !important; }
  [data-theme='dark'] .table-container thead, html[data-theme='dark'] .table-container thead { background: #161b22 !important; border-bottom-color: #30363d !important; }
  [data-theme='dark'] .table-container th, html[data-theme='dark'] .table-container th { background: #161b22 !important; color: #f0f6fc !important; border-bottom: 2px solid #30363d !important; }
  [data-theme='dark'] .table-container td, html[data-theme='dark'] .table-container td { border-bottom-color: #30363d !important; color: #c9d1d9 !important; }
  [data-theme='dark'] .table-container tr:nth-child(even) td { background: #0d1117 !important; }

  /* Prism Syntax Highlighting Tokens (Dark Mode) */
  [data-theme='dark'] .token.comment, html[data-theme='dark'] .token.comment {
    color: #8b949e !important;
    font-style: italic !important;
    background: transparent !important;
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
    display: inline !important;
  }
  [data-theme='dark'] .token.punctuation, html[data-theme='dark'] .token.punctuation { color: #c9d1d9 !important; }
  [data-theme='dark'] .token.property, [data-theme='dark'] .token.tag, [data-theme='dark'] .token.boolean, [data-theme='dark'] .token.number, [data-theme='dark'] .token.constant, [data-theme='dark'] .token.symbol, [data-theme='dark'] .token.deleted, html[data-theme='dark'] .token.number { color: #79c0ff !important; }
  [data-theme='dark'] .token.selector, [data-theme='dark'] .token.attr-name, [data-theme='dark'] .token.string, [data-theme='dark'] .token.char, [data-theme='dark'] .token.builtin, [data-theme='dark'] .token.inserted, html[data-theme='dark'] .token.string { color: #a5d6ff !important; }
  [data-theme='dark'] .token.operator, [data-theme='dark'] .token.entity, [data-theme='dark'] .token.url, html[data-theme='dark'] .token.operator { color: #d2a8ff !important; }
  [data-theme='dark'] .token.atrule, [data-theme='dark'] .token.attr-value, [data-theme='dark'] .token.keyword, html[data-theme='dark'] .token.keyword { color: #ff7b72 !important; font-weight: 600 !important; }
  [data-theme='dark'] .token.function, [data-theme='dark'] .token.class-name, html[data-theme='dark'] .token.function { color: #d2a8ff !important; font-weight: 600 !important; }
  [data-theme='dark'] .token.regex, [data-theme='dark'] .token.important, [data-theme='dark'] .token.variable, html[data-theme='dark'] .token.variable { color: #ffa657 !important; }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) .code-block-wrap {
      border-color: #30363d !important;
      background-color: #0d1117 !important;
    }
    :root:not([data-theme='light']) .code-block-header {
      background-color: #161b22 !important;
      border-bottom-color: #30363d !important;
      color: #8b949e !important;
    }
    :root:not([data-theme='light']) .code-block-header .code-copy-btn {
      background-color: #21262d !important;
      border-color: #30363d !important;
      color: #c9d1d9 !important;
    }
    :root:not([data-theme='light']) .code-block-wrap pre {
      color: #e6edf3 !important;
    }
    :root:not([data-theme='light']) .post-body pre {
      background-color: #161b22 !important;
      border-color: #30363d !important;
      color: #e6edf3 !important;
    }
    :root:not([data-theme='light']) .post-body code {
      background-color: rgba(110, 118, 129, 0.4) !important;
      color: #e6edf3 !important;
    }
    :root:not([data-theme='light']) .post-body pre code {
      background: transparent !important;
      color: inherit !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
    }
    :root:not([data-theme='light']) .mermaid-diagram-wrap {
      background: #161b22 !important;
      border-color: #30363d !important;
    }
    :root:not([data-theme='light']) .mermaid-diagram-wrap pre.mermaid {
      color: #e6edf3 !important;
    }
    :root:not([data-theme='light']) .table-container { border-color: #30363d !important; }
    :root:not([data-theme='light']) .table-container thead { background: #161b22 !important; border-bottom-color: #30363d !important; }
    :root:not([data-theme='light']) .table-container th { background: #161b22 !important; color: #f0f6fc !important; border-bottom: 2px solid #30363d !important; }
    :root:not([data-theme='light']) .table-container td { border-bottom-color: #30363d !important; color: #c9d1d9 !important; }
    :root:not([data-theme='light']) .table-container tr:nth-child(even) td { background: #0d1117 !important; }
    :root:not([data-theme='light']) .token.comment {
      background: transparent !important;
      border: none !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
      display: inline !important;
    }
  }
</style>\n`;

  // Prepend Hero Image if available
  if (heroImageUrl) {
    const heroBlock = `<div class="post-hero-wrap" style="margin-bottom:2.2rem;border-radius:10px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.25);">
  <img src="${heroImageUrl}" alt="Article Hero" class="post-hero-image" style="width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;display:block;" loading="eager" fetchpriority="high" width="1200" height="675" referrerpolicy="no-referrer"/>
</div>\n`;
    htmlBody = heroBlock + htmlBody;
  }

  const helperScript = `\n<script>
(function() {
  // Wire up code block copy buttons
  document.querySelectorAll('.code-block-header .code-copy-btn').forEach(function(btn) {
    if (btn.dataset.wired) return;
    btn.dataset.wired = 'true';
    btn.addEventListener('click', async function() {
      const wrap = btn.closest('.code-block-wrap');
      const code = wrap ? wrap.querySelector('code, pre') : null;
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code.textContent || '');
        const span = btn.querySelector('span');
        if (span) span.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function() {
          if (span) span.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      } catch (e) {
        console.error('Clipboard copy failed:', e);
      }
    });
  });

  // Ensure Prism syntax highlighting is active
  if (!window.Prism) {
    var s1 = document.createElement('script');
    s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js';
    s1.onload = function() {
      var s2 = document.createElement('script');
      s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js';
      s2.onload = function() {
        if (window.Prism) window.Prism.highlightAll();
      };
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
  } else {
    window.Prism.highlightAll();
  }
})();
</script>\n`;

  return scopedStyles + htmlBody + helperScript;
}

// 3b. Idempotent Schedule Guard: Prevent duplicate runs if previous cron in same slot succeeded
async function shouldSkipScheduledRun(): Promise<boolean> {
  if (process.env.GITHUB_EVENT_NAME !== 'schedule') {
    return false; // Always run for manual workflow_dispatch triggers
  }

  const ghToken = process.env.GITHUB_TOKEN?.trim();
  const repo = process.env.GITHUB_REPOSITORY || 'redwan-cse/ledger-blogger-theme';
  const currentRunId = process.env.GITHUB_RUN_ID;

  if (!ghToken) return false;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/publish-from-drive.yml/runs?status=completed&per_page=5`, {
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ledger-blogger-theme-publisher'
      }
    });
    if (!res.ok) return false;
    const data = await res.json() as { workflow_runs?: Array<{ id: number; conclusion: string; created_at: string }> };
    const runs = data.workflow_runs || [];

    const now = Date.now();
    const FORTY_FIVE_MIN_MS = 45 * 60 * 1000;

    const recentSuccess = runs.find(r => 
      String(r.id) !== String(currentRunId) &&
      r.conclusion === 'success' &&
      (now - new Date(r.created_at).getTime()) < FORTY_FIVE_MIN_MS
    );

    if (recentSuccess) {
      console.log(`[Schedule Guard] A previous run (ID: ${recentSuccess.id}) succeeded at ${recentSuccess.created_at} (within 45 minutes).`);
      console.log(`[Schedule Guard] Skipping this backup run because the previous scheduled run was already successful.`);
      return true;
    }
  } catch (e: any) {
    console.warn(`[Schedule Guard] Run check notice: ${e.message}. Proceeding safely.`);
  }

  return false;
}

// 4. Main Processing Engine
async function main() {
  console.log('=== Google Drive (Folders & Markdown) to Blogger Auto-Publisher ===');

  // Idempotent guard for scheduled crons
  if (await shouldSkipScheduledRun()) {
    return;
  }

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
  console.log('Authenticated Google Service Account credentials verified successfully.');

  const driveToken = await getDriveAccessToken(sa);
  const bloggerToken = await getBloggerAccessToken();

  // Deduplicate and sync Content_Planner_and_History Google Sheet on startup
  await syncAndCleanGoogleSheet(driveToken);

  // Find Blog_Published folder ID (either via env, default ID, inside root, or directly by name)
  let publishedFolderId = process.env.DRIVE_PUBLISHED_FOLDER_ID?.trim() || DEFAULT_PUBLISHED_FOLDER_ID;
  if (!publishedFolderId) {
    try {
      const pubQuery = `'${ROOT_FOLDER_ID}' in parents and name='${PUBLISHED_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const pubRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(pubQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`, {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      const pubData = await pubRes.json() as { files?: DriveItem[] };
      publishedFolderId = pubData.files?.[0]?.id || null;
    } catch {}
  }
  if (!publishedFolderId) {
    try {
      const pubQueryDirect = `name='${PUBLISHED_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const pubRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(pubQueryDirect)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`, {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      const pubData = await pubRes.json() as { files?: DriveItem[] };
      publishedFolderId = pubData.files?.[0]?.id || null;
    } catch {}
  }

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

      const mdItem = intakeFiles.find(f => f.name.toLowerCase().endsWith('.md'));
      const docItem = intakeFiles.find(f => f.mimeType === 'application/vnd.google-apps.document');
      const articleItem = mdItem || docItem || intakeFiles.find(f => f.name.toLowerCase().includes('article'));
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

  // Diagnostic search: List recent files and folders visible to the Service Account
  try {
    const sharedQuery = `sharedWithMe=true and trashed=false`;
    const sharedRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(sharedQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,parents,modifiedTime)&orderBy=modifiedTime desc&pageSize=30`, {
      headers: { Authorization: `Bearer ${driveToken}` }
    });
    if (sharedRes.ok) {
      const sharedData = await sharedRes.json() as { files?: Array<{ id: string; name: string; mimeType: string; parents?: string[]; modifiedTime?: string }> };
      console.log(`\n--- Diagnostic: Items explicitly 'Shared with me' ---`);
      for (const f of sharedData.files || []) {
        console.log(`[SharedWithMe] "${f.name}" | mime: ${f.mimeType} | ID: ${f.id} | parents: ${f.parents?.join(', ')} | modified: ${f.modifiedTime}`);
      }
      console.log(`--- End SharedWithMe Diagnostic ---\n`);
    }
  } catch (e: any) {
    console.warn(`[!] SharedWithMe diagnostic error: ${e.message}`);
  }

  try {
    const diagQuery = `trashed=false and (mimeType='application/vnd.google-apps.folder' or mimeType='application/vnd.google-apps.document' or name contains '.md')`;
    const diagRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(diagQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,parents,modifiedTime)&orderBy=modifiedTime desc&pageSize=30`, {
      headers: { Authorization: `Bearer ${driveToken}` }
    });
    if (diagRes.ok) {
      const diagData = await diagRes.json() as { files?: Array<{ id: string; name: string; mimeType: string; parents?: string[]; modifiedTime?: string }> };
      console.log(`\n--- Diagnostic: Recently modified items visible to Service Account ---`);
      for (const f of diagData.files || []) {
        console.log(`[Drive Item] "${f.name}" | mime: ${f.mimeType} | ID: ${f.id} | parents: ${f.parents?.join(', ')} | modified: ${f.modifiedTime}`);
      }
      console.log(`--- End Diagnostic ---\n`);

      // Inspect parent folder of the newest article.md (1tJ8dIIOrlBpqiAgib0c-tepQZt34YRBL)
      try {
        const mysteryRes = await fetch(`https://www.googleapis.com/drive/v3/files/1tJ8dIIOrlBpqiAgib0c-tepQZt34YRBL?supportsAllDrives=true&fields=id,name,mimeType,parents`, {
          headers: { Authorization: `Bearer ${driveToken}` }
        });
        if (mysteryRes.ok) {
          const mysteryData = await mysteryRes.json() as any;
          console.log(`[Mystery Folder 1tJ8dIIOrlBpqiAgib0c-tepQZt34YRBL] Name: "${mysteryData.name}" | parents: ${mysteryData.parents?.join(', ')}`);
        }
      } catch (e: any) {
        console.log(`Mystery folder check: ${e.message}`);
      }

      // Check alternate Blog_Queue_Shared (1JX_E9AAjtqZWbqG2N4KfBdYRMp748Rkv)
      try {
        const altQueueRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='1JX_E9AAjtqZWbqG2N4KfBdYRMp748Rkv'+in+parents+and+trashed=false&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType)`, {
          headers: { Authorization: `Bearer ${driveToken}` }
        });
        if (altQueueRes.ok) {
          const altQueueData = await altQueueRes.json() as { files?: DriveItem[] };
          console.log(`[Alt Queue 1JX_E9AAjtqZWbqG2N4KfBdYRMp748Rkv] contains ${altQueueData.files?.length} items:`, altQueueData.files?.map(f => f.name));
        }
      } catch (e: any) {
        console.log(`Alt queue check: ${e.message}`);
      }

      // Search for any folders containing '[' anywhere visible to service account
      try {
        const pkgRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name+contains+'['+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,parents,modifiedTime)&orderBy=modifiedTime desc`, {
          headers: { Authorization: `Bearer ${driveToken}` }
        });
        if (pkgRes.ok) {
          const pkgData = await pkgRes.json() as { files?: any[] };
          console.log(`\n--- All Package Folders Found Across Drive (${pkgData.files?.length}) ---`);
          for (const p of pkgData.files || []) {
            console.log(`[Package Folder] "${p.name}" | ID: ${p.id} | parents: ${p.parents?.join(', ')} | modified: ${p.modifiedTime}`);
          }
          console.log(`--- End Package Folders ---\n`);
        }
      } catch (e: any) {
        console.log(`Package search check: ${e.message}`);
      }
    }
  } catch (e: any) {
    console.warn(`[!] Diagnostic error: ${e.message}`);
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

  // Also check alternate Blog_Queue_Shared (ID: 1JX_E9AAjtqZWbqG2N4KfBdYRMp748Rkv)
  try {
    const altQueueRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='1JX_E9AAjtqZWbqG2N4KfBdYRMp748Rkv'+in+parents+and+trashed=false&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType)`, {
      headers: { Authorization: `Bearer ${driveToken}` }
    });
    if (altQueueRes.ok) {
      const altQueueData = await altQueueRes.json() as { files?: DriveItem[] };
      const altItems = (altQueueData.files || []).filter(f => f.name !== 'Intake');
      if (altItems.length > 0) {
        console.log(`Found ${altItems.length} item(s) in alternate Blog_Queue_Shared:`, altItems.map(i => i.name));
        items = [...items, ...altItems];
      }
    }
  } catch (e: any) {
    console.warn(`Could not check alternate queue: ${e.message}`);
  }

  // Also check if recent package folder 1tJ8dIIOrlBpqiAgib0c-tepQZt34YRBL is pending publication
  if (items.length === 0) {
    try {
      const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/1tJ8dIIOrlBpqiAgib0c-tepQZt34YRBL?supportsAllDrives=true&fields=id,name,mimeType,parents`, {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      if (checkRes.ok) {
        const folder = await checkRes.json() as DriveItem & { parents?: string[] };
        const isPublished = folder.parents?.some(p => p === publishedFolderId || p === '1eyxxZCJF97Krkg49osWF_dc39x1SFmDX' || p === '1Ht4jr07tIl4Wb8OI1PVAKL5y5Ayr_XCk');
        if (!isPublished) {
          console.log(`Auto-detected unpublished package folder: "${folder.name}" (ID: ${folder.id})`);
          items = [folder];
        }
      }
    } catch (e: any) {
      console.warn(`Package folder check: ${e.message}`);
    }
  }

  const targetTitle = process.env.TARGET_TITLE?.trim();
  if (targetTitle && publishedFolderId) {
    console.log(`TARGET_TITLE specified: "${targetTitle}". Searching Blog_Published...`);
    const pubCheckQuery = `'${publishedFolderId}' in parents and name contains '${targetTitle}' and trashed=false`;
    const pubCheckRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(pubCheckQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType)&orderBy=modifiedTime desc`, {
      headers: { Authorization: `Bearer ${driveToken}` }
    });
    const pubCheckData = await pubCheckRes.json() as { files?: DriveItem[] };
    const matchingFolder = pubCheckData.files?.find(f => f.mimeType === 'application/vnd.google-apps.folder');
    if (matchingFolder) {
      console.log(`Found matching published package: "${matchingFolder.name}" (ID: ${matchingFolder.id})`);
      items = [matchingFolder];
    } else {
      console.warn(`No package matching "${targetTitle}" found in Blog_Published.`);
    }
  } else if (items.length === 0) {
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

  // Limit to 1 post per scheduled execution (leaves subsequent queued posts for next scheduled window)
  const isScheduledRun = process.env.GITHUB_EVENT_NAME === 'schedule';
  const processLimit = isScheduledRun ? 1 : Number(process.env.MAX_POSTS_PER_RUN || 1);
  const itemsToProcess = items.slice(0, processLimit);

  if (items.length > itemsToProcess.length) {
    console.log(`Notice: Processing ${itemsToProcess.length} of ${items.length} queued item(s). Remaining ${items.length - itemsToProcess.length} item(s) will be published in the next scheduled slot.`);
  }

  for (const item of itemsToProcess) {
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

    const postSlug = slugify(cleanTitle).replace(/[^a-z0-9_-]/g, '').slice(0, 80);
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

      // Prioritize Markdown (.md) files over Google Docs exports
      const mdFile = childFiles.find((f) => f.name.toLowerCase().endsWith('.md'));
      const docFile = childFiles.find((f) => f.mimeType === 'application/vnd.google-apps.document');
      const articleFile = mdFile || docFile || childFiles.find((f) => f.name.toLowerCase().includes('article'));
      const thumbnailFile = childFiles.find((f) => f.name.toLowerCase().includes('thumbnail') || f.mimeType.startsWith('image/'));

      console.log(`Subfolder files in "${item.name}":`, childFiles.map(f => `${f.name} (${f.mimeType})`));

      if (!articleFile) {
        console.warn(`No article.md or Google Doc found inside folder "${item.name}". Skipping.`);
        continue;
      }
      console.log(`Using article file: "${articleFile.name}" (MIME: ${articleFile.mimeType}, ID: ${articleFile.id})`);

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
          const ghToken = process.env.GITHUB_TOKEN?.trim();
          if (ghToken) {
            try {
              const relPath = `posts/${postSlug}/thumbnail.png`;
              let existingSha: string | undefined = undefined;
              try {
                const getRes = await fetch(`https://api.github.com/repos/redwan-cse/blog-assets/contents/${relPath}?ref=main`, {
                  headers: {
                    Authorization: `Bearer ${ghToken}`,
                    Accept: 'application/vnd.github.v3+json',
                    'User-Agent': 'ledger-publisher'
                  }
                });
                if (getRes.ok) {
                  const getData = await getRes.json() as { sha?: string };
                  existingSha = getData.sha;
                }
              } catch {}

              const putRes = await fetch(`https://api.github.com/repos/redwan-cse/blog-assets/contents/${relPath}`, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${ghToken}`,
                  Accept: 'application/vnd.github.v3+json',
                  'User-Agent': 'ledger-publisher',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  message: `chore(assets): add thumbnail for ${postSlug}`,
                  content: imgBuffer.toString('base64'),
                  branch: 'main',
                  ...(existingSha ? { sha: existingSha } : {})
                })
              });
              if (putRes.ok) {
                console.log(`Uploaded thumbnail to 'blog-assets' repo via GitHub API.`);
              } else {
                console.warn(`GitHub API blog-assets upload notice: ${putRes.status}`);
              }
            } catch (apiErr: any) {
              console.warn(`API upload notice: ${apiErr.message}`);
            }
          }

          // Point to jsDelivr CDN from dedicated public blog-assets repository
          heroImageUrl = `https://cdn.jsdelivr.net/gh/redwan-cse/blog-assets@main/posts/${postSlug}/thumbnail.png`;
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

    // Check if post already exists on Blogger to update in-place (avoids duplicate URLs)
    console.log(`Checking if post "${cleanTitle}" already exists on Blogger...`);
    let existingPost: { id: string; url: string; title: string } | undefined = undefined;
    try {
      // 1. Check live recent posts first (100% reliable, zero search indexing lag)
      const listRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts?maxResults=50`, {
        headers: { Authorization: `Bearer ${bloggerToken}` }
      });
      if (listRes.ok) {
        const listData = await listRes.json() as { items?: Array<{ id: string; url: string; title: string }> };
        const matches = (listData.items || []).filter(p =>
          p.title.trim().toLowerCase() === cleanTitle.trim().toLowerCase() ||
          slugify(p.title) === postSlug ||
          (p.url && p.url.includes(postSlug))
        );
        if (matches.length > 0) {
          // Prefer canonical URL without number suffix
          existingPost = matches.find(p => !/_\d+\.html$/i.test(p.url)) || matches[0];
        }
      }

      // 2. Fallback to search query if not in the recent 50 posts
      if (!existingPost) {
        const searchRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/search?q=${encodeURIComponent(cleanTitle.slice(0, 30))}`, {
          headers: { Authorization: `Bearer ${bloggerToken}` }
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json() as { items?: Array<{ id: string; url: string; title: string }> };
          const matches = (searchData.items || []).filter(p => 
            p.title.trim().toLowerCase() === cleanTitle.trim().toLowerCase() ||
            slugify(p.title) === postSlug ||
            (p.url && p.url.includes(postSlug))
          );
          if (matches.length > 0) {
            existingPost = matches.find(p => !/_\d+\.html$/i.test(p.url)) || matches[0];
          }
        }
      }
    } catch (e: any) {
      console.log(`Search check notice: ${e.message}`);
    }

    let post: { title: string; url: string };
    if (existingPost) {
      console.log(`Found existing post (ID: ${existingPost.id}). Updating in-place...`);
      const updateRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/${existingPost.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${bloggerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          kind: 'blogger#post',
          id: existingPost.id,
          title: cleanTitle,
          content: compiledHtml,
          labels: [label]
        })
      });
      if (!updateRes.ok) {
        const err = await updateRes.text();
        console.error(`Blogger API update failed for "${cleanTitle}": ${err}`);
        continue;
      }
      post = await updateRes.json() as { title: string; url: string };
      console.log(`🎉 UPDATED LIVE POST: "${post.title}"`);
      console.log(`🔗 URL: ${post.url}`);
    } else {
      console.log(`Publishing new post to https://blogs.redwan.work/ as Md Redwan Ahmed...`);
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

      post = await pubRes.json() as { title: string; url: string };
      console.log(`🎉 PUBLISHED LIVE: "${post.title}"`);
      console.log(`🔗 URL: ${post.url}`);
    }

    // 1. Log to Content_Planner_and_History Google Sheet
    const todayStr = new Date().toISOString().slice(0, 10);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayStr = days[new Date().getUTCDay()];
    const cveMatch = markdownContent.match(/\b(CVE-\d{4}-\d+|RFC\s*\d+|AD\s*CS\s*ESC\d+|NIST\s*[\w\.\-]+)\b/i);
    const focusCve = cveMatch ? cveMatch[0] : label;

    await syncAndCleanGoogleSheet(driveToken, [
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

    // 3. Submit live post URL to Search Engines (Bing Webmaster API & IndexNow)
    if (post?.url) {
      try {
        await submitUrlsToSearchEngines({
          urls: [post.url],
          bingApiKey: process.env.BING_WEBMASTER_API_KEY?.trim(),
          indexNowKey: process.env.INDEXNOW_KEY?.trim(),
          indexNowKeyLocation: process.env.INDEXNOW_KEY_LOCATION?.trim()
        });
      } catch (e: any) {
        console.warn(`Search engine submission warning: ${e.message}`);
      }
    }
  }

  console.log('\n=== All Documents Processed Successfully ===');
}

main().catch((err) => {
  console.error('Fatal Auto-Publisher Error:', err);
  process.exit(1);
});
