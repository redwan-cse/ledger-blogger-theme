import dns from 'node:dns';
import * as fs from 'node:fs';
dns.setDefaultResultOrder('ipv4first');

const BLOG_ID = process.env.BLOGGER_BLOG_ID?.trim() || '5972841034338492159';
const CLIENT_ID = process.env.BLOGGER_CLIENT_ID?.trim() || process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.BLOGGER_CLIENT_SECRET?.trim() || process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
const REFRESH_TOKEN = process.env.BLOGGER_REFRESH_TOKEN?.trim();

async function getBloggerAccessToken(): Promise<string> {
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
  const data = await res.json() as any;
  if (!data.access_token) {
    throw new Error(`Failed to refresh token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

function buildCodeBlock(lang: string, code: string): string {
  const cleanLang = (lang || 'plaintext').trim().toLowerCase();
  const displayLang = cleanLang.toUpperCase();
  return `<div class="code-block-wrap">
  <div class="code-block-header">
    <span class="code-block-lang">${displayLang}</span>
    <button type="button" class="code-copy-btn" aria-label="Copy code to clipboard">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg><span>Copy</span>
    </button>
  </div>
  <pre><code class="language-${cleanLang}">${code.trim()}</code></pre>
</div>`;
}

function buildTableHtml(headers: string[], rows: string[][]): string {
  let html = '<div class="table-container">\n<table>\n<thead>\n<tr>\n';
  headers.forEach(h => {
    html += `  <th>${h.trim()}</th>\n`;
  });
  html += '</tr>\n</thead>\n<tbody>\n';
  rows.forEach(r => {
    html += '<tr>\n';
    r.forEach(cell => {
      html += `  <td>${cell.trim()}</td>\n`;
    });
    html += '</tr>\n';
  });
  html += '</tbody>\n</table>\n</div>\n';
  return html;
}

export function healPostHtml(html: string, slug: string): string {
  let out = html;

  // 1. Repair stray code blocks that accidentally split tables across </p> ... <p>
  out = out.replace(
    /<\/p>\s*<div class="code-block-wrap">(?:(?!<div class="code-block-wrap">)[\s\S])*?<pre><code[^>]*>\s*Falco eBPF &amp; Auditd Telemetry\s*<\/code><\/pre>\s*<\/div>\s*<p>\s*/gi,
    '\n\tFalco eBPF &amp; Auditd Telemetry\n\t'
  );

  out = out.replace(
    /<\/p>\s*<div class="code-block-wrap">(?:(?!<div class="code-block-wrap">)[\s\S])*?<pre><code[^>]*>\s*Falco eBPF &amp; Sigma Telemetry\s*<\/code><\/pre>\s*<\/div>\s*<p>\s*/gi,
    '\n\tFalco eBPF &amp; Sigma Telemetry\n\t'
  );

  out = out.replace(
    /<\/p>\s*<div class="code-block-wrap">(?:(?!<div class="code-block-wrap">)[\s\S])*?<pre><code[^>]*>\s*Falco eBPF alert: vault opening files for write in plugins dir\s*<\/code><\/pre>\s*<\/div>\s*<p>\s*/gi,
    '\n\tFalco eBPF alert: vault opening files for write in plugins dir\n\t'
  );

  out = out.replace(
    /<\/p>\s*<div class="code-block-wrap">(?:(?!<div class="code-block-wrap">)[\s\S])*?<pre><code[^>]*>\s*Falco eBPF alert: vault opening files for write inside plugin_directory\s*<\/code><\/pre>\s*<\/div>\s*<p>\s*/gi,
    '\n\tFalco eBPF alert: vault opening files for write inside plugin_directory\n\t'
  );

  // Fallback standalone repairs
  out = out.replace(
    /<div class="code-block-wrap">(?:(?!<div class="code-block-wrap">)[\s\S])*?<pre><code[^>]*>\s*Falco eBPF &amp; Auditd Telemetry\s*<\/code><\/pre>\s*<\/div>/gi,
    '\tFalco eBPF &amp; Auditd Telemetry\t'
  );
  out = out.replace(
    /<div class="code-block-wrap">(?:(?!<div class="code-block-wrap">)[\s\S])*?<pre><code[^>]*>\s*Falco eBPF &amp; Sigma Telemetry\s*<\/code><\/pre>\s*<\/div>/gi,
    '\tFalco eBPF &amp; Sigma Telemetry\t'
  );
  out = out.replace(
    /<div class="code-block-wrap">(?:(?!<div class="code-block-wrap">)[\s\S])*?<pre><code[^>]*>\s*Falco eBPF alert: vault opening files for write in plugins dir\s*<\/code><\/pre>\s*<\/div>/gi,
    '\tFalco eBPF alert: vault opening files for write in plugins dir\t'
  );
  out = out.replace(
    /<div class="code-block-wrap">(?:(?!<div class="code-block-wrap">)[\s\S])*?<pre><code[^>]*>\s*Falco eBPF alert: vault opening files for write inside plugin_directory\s*<\/code><\/pre>\s*<\/div>/gi,
    '\tFalco eBPF alert: vault opening files for write inside plugin_directory\t'
  );

  // 2. Heal Unfenced Sigma Rules (precise bounded regex matching down to level: critical/high/medium/low)
  out = out.replace(
    /<p>\s*title:\s*[\s\S]*?<p>\s*level:\s*(?:critical|high|medium|low)\s*<\/p>/gi,
    (fullBlock) => {
      const cleanYaml = fullBlock
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p>/gi, '\n')
        .replace(/<li>\s*<p>\s*<a\s+href="([^"]+)">[^<]*<\/a>\s*<\/p>\s*<\/li>/gi, '    - $1')
        .replace(/<li>\s*<a\s+href="([^"]+)">[^<]*<\/a>\s*<\/li>/gi, '    - $1')
        .replace(/<li>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/gi, '    - $1')
        .replace(/<li>([\s\S]*?)<\/li>/gi, '    - $1')
        .replace(/<\/?(?:ul|ol)[^>]*>/gi, '')
        .replace(/<\/?[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      return buildCodeBlock('yaml', cleanYaml);
    }
  );

  // 3. Heal Unrendered Tab Tables in <p> tags
  // A. 6-column Mitigation Strategy tables
  out = out.replace(/<p>\s*Mitigation Strategy[\s\S]*?<\/p>/gi, (match) => {
    const clean = match
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[^>]+>/g, '')
      .trim();
    const cells = clean.split('\t').map(c => c.trim()).filter(Boolean);
    if (cells.length < 12) return match;

    const headers = [
      'Mitigation Strategy',
      'Implementation Layer',
      'Primary Weakness or Limitation',
      'Performance Overhead',
      'Bypass Resilience',
      'Implementation Velocity'
    ];

    let startIdx = 6;
    while (startIdx < cells.length && headers.includes(cells[startIdx])) {
      startIdx++;
    }

    const rows: string[][] = [];
    let trailing = '';
    for (let i = startIdx; i < cells.length; i += 6) {
      const chunk = cells.slice(i, i + 6);
      if (chunk.length === 6) {
        const last = chunk[5];
        const mTrail = last.match(/(Incident Response[\s\S]*|Step-by-Step Security[\s\S]*)$/i);
        if (mTrail) {
          chunk[5] = last.slice(0, mTrail.index).trim();
          trailing = mTrail[0].trim();
        }
        rows.push(chunk);
      } else {
        trailing += ' ' + chunk.join(' ');
      }
    }

    let res = buildTableHtml(headers, rows);
    if (trailing) {
      if (/^Incident Response/i.test(trailing)) {
        res += `\n<h2 id="incident-response-and-verification-runbook">Incident Response &amp; Verification Playbook</h2>\n<p>${trailing.replace(/^Incident Response[^\n]*\n?/i, '').trim()}</p>\n`;
      } else {
        res += `\n<p>${trailing}</p>\n`;
      }
    }
    return res;
  });

  // B. 4-column Security Dimension tables (Executive Takeaway Table)
  out = out.replace(/<p>\s*Security Dimension[\s\S]*?<\/p>/gi, (match) => {
    const clean = match
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[^>]+>/g, '')
      .trim();
    const cells = clean.split('\t').map(c => c.trim()).filter(Boolean);
    if (cells.length < 8) return match;

    const headers = [
      'Security Dimension',
      'Attack Vector &amp; Exposure',
      'Detection Signal',
      'Primary Mitigation'
    ];

    let startIdx = 4;
    while (startIdx < cells.length && headers.some(h => cells[startIdx].includes(h.replace(/&amp;/g, '&')))) {
      startIdx++;
    }

    const rows: string[][] = [];
    let trailing = '';
    for (let i = startIdx; i < cells.length; i += 4) {
      const chunk = cells.slice(i, i + 4);
      if (chunk.length === 4) {
        const last = chunk[3];
        const mTrail = last.match(/(References & Authoritative Sources[\s\S]*|Authoritative References[\s\S]*)$/i);
        if (mTrail) {
          chunk[3] = last.slice(0, mTrail.index).trim();
          trailing = mTrail[0].trim();
        }
        rows.push(chunk);
      } else {
        trailing += ' ' + chunk.join(' ');
      }
    }

    let res = buildTableHtml(headers, rows);
    if (trailing) {
      res += `\n<h2 id="authoritative-references">References &amp; Authoritative Sources</h2>\n`;
    }
    return res;
  });

  // C. 3-column Attack Vector & Technique tables (Exploit summary table)
  out = out.replace(/<p>\s*Attack Vector &amp; Technique[\s\S]*?<\/p>/gi, (match) => {
    const clean = match
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[^>]+>/g, '')
      .trim();
    const cells = clean.split('\t').map(c => c.trim()).filter(Boolean);
    if (cells.length < 6) return match;

    const headers = [
      'Attack Vector &amp; Technique',
      'Primary Detection Signal',
      'Key Mitigation &amp; Preventive Control'
    ];

    let startIdx = 3;
    while (startIdx < cells.length && headers.some(h => cells[startIdx].includes(h.replace(/&amp;/g, '&')))) {
      startIdx++;
    }

    const rows: string[][] = [];
    let trailing = '';
    for (let i = startIdx; i < cells.length; i += 3) {
      const chunk = cells.slice(i, i + 3);
      if (chunk.length === 3) {
        const last = chunk[2];
        const mTrail = last.match(/(References & Authoritative Sources[\s\S]*|Authoritative References[\s\S]*)$/i);
        if (mTrail) {
          chunk[2] = last.slice(0, mTrail.index).trim();
          trailing = mTrail[0].trim();
        }
        rows.push(chunk);
      } else {
        trailing += ' ' + chunk.join(' ');
      }
    }

    let res = buildTableHtml(headers, rows);
    if (trailing) {
      res += `\n<h2 id="authoritative-references">References &amp; Authoritative Sources</h2>\n`;
    }
    return res;
  });

  // 4. Demote Spurious <h3> Script Comments
  if (slug.includes('vault-cve-2025-6000-audit')) {
    out = out.replace(
      /<h3[^>]*id="authenticate-with-vault-operator-token"[^>]*>[\s\S]*?<\/h3>\s*<div class="code-block-wrap">\s*<div class="code-block-header">\s*<span class="code-block-lang">BASH<\/span>[\s\S]*?<pre><code class="language-bash">([\s\S]*?)<\/code><\/pre>\s*<\/div>/gi,
      (_m, code) => buildCodeBlock('bash', `# Authenticate with Vault operator token\n${code.trim()}`)
    );
    out = out.replace(
      /<h3[^>]*id="register-the-dropped-script-as-a-custom-secrets-pl"[^>]*>[\s\S]*?<\/h3>\s*<div class="code-block-wrap">\s*<div class="code-block-header">\s*<span class="code-block-lang">BASH<\/span>[\s\S]*?<pre><code class="language-bash">([\s\S]*?)<\/code><\/pre>\s*<\/div>/gi,
      (_m, code) => buildCodeBlock('bash', `# Register the dropped script as a custom secrets plugin\n${code.trim()}`)
    );
    out = out.replace(
      /<h3[^>]*id="mount-the-plugin-to-trigger-host-level-execution"[^>]*>[\s\S]*?<\/h3>\s*<div class="code-block-wrap">\s*<div class="code-block-header">\s*<span class="code-block-lang">BASH<\/span>[\s\S]*?<pre><code class="language-bash">([\s\S]*?)<\/code><\/pre>\s*<\/div>/gi,
      (_m, code) => buildCodeBlock('bash', `# Mount the plugin to trigger host-level execution\n${code.trim()}`)
    );
  }

  if (slug.includes('github-actions-cve-2025-30066-tag')) {
    out = out.replace(
      /<h3[^>]*id="scan-local-organization-repositories-for-mutable-t"[^>]*>[\s\S]*?<\/h3>\s*<div class="code-block-wrap">\s*<div class="code-block-header">\s*<span class="code-block-lang">BASH<\/span>[\s\S]*?<pre><code class="language-bash">([\s\S]*?)<\/code><\/pre>\s*<\/div>/gi,
      (_m, code) => buildCodeBlock('bash', `# Scan local organization repositories for mutable tj-actions references\n${code.trim()}`)
    );
    // Simulate double-base64 encoding
    out = out.replace(
      /<h3[^>]*id="simulate-double-base64-encoding-of-a-runner-secret"[^>]*>[\s\S]*?<\/h3>\s*<p>(SECRET_VAL=[\s\S]*?)<\/p>\s*<p>(DOUBLE_B64=[\s\S]*?)<\/p>\s*<p>(echo\s+&quot;Output:[\s\S]*?)<\/p>/gi,
      (_m, p1, p2, p3) => {
        const code = `# Simulate double-base64 encoding of a runner secret to evade GitHub '***' masking\n${p1}\n${p2}\n${p3}`
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        return buildCodeBlock('bash', code);
      }
    );
    // Decode suspected double-base64 blob
    out = out.replace(
      /<h3[^>]*id="decode-suspected-double-base64-blob-from-archived-"[^>]*>[\s\S]*?<\/h3>\s*<p>(echo\s+&quot;[A-Za-z0-9+/=]+&quot;\s*\|\s*base64\s+-d\s*\|\s*base64\s+-d)<\/p>/gi,
      (_m, cmd) => {
        const code = `# Decode suspected double-base64 blob from archived workflow logs\n${cmd.replace(/&quot;/g, '"')}`;
        return buildCodeBlock('bash', code);
      }
    );
  }

  // 5. Upgrade any remaining bare <pre><code class="..."> blocks into .code-block-wrap
  out = out.replace(
    /(?<!<div class="code-block-wrap">\s*<div class="code-block-header">[\s\S]*?)<pre><code(?:\s+class=["'](?:language-)?([a-zA-Z0-9_-]+)["'])?>([\s\S]*?)<\/code><\/pre>/gi,
    (_m, lang, code) => buildCodeBlock(lang || 'plaintext', code)
  );

  return out;
}

async function main() {
  const isApply = process.argv.includes('--apply');
  const token = await getBloggerAccessToken();
  console.log(`Blogger Auth Token OK. Mode: ${isApply ? 'APPLY LIVE PATCHES' : 'DRY RUN'}`);

  const targetPostIds = [
    { id: '3387868755279888612', slug: 'linux-nftables-defense-cve-2024-1086', title: 'Linux nf_tables Defense: CVE-2024-1086 Hardening' },
    { id: '2292604011644215206', slug: 'ldapnightmare-defense-cve-2024-49113', title: 'LDAPNightmare Defense: CVE-2024-49113 Hardening' },
    { id: '8742710283759814099', slug: 'hashicorp-vault-cve-2025-6000-audit', title: 'HashiCorp Vault CVE-2025-6000: Audit Plugin RCE' },
    { id: '7344743617602433330', slug: 'github-actions-defense-cve-2025-30066', title: 'GitHub Actions Defense: CVE-2025-30066 Hardening' },
    { id: '5837101852700249979', slug: 'github-actions-cve-2025-30066-tag', title: 'GitHub Actions CVE-2025-30066: Tag Hijack RCE' },
    { id: '7902871418433931399', slug: 'hashicorp-vault-defense-cve-2025-6000', title: 'HashiCorp Vault Defense: CVE-2025-6000 Hardening' }
  ];

  for (const postInfo of targetPostIds) {
    console.log(`\n================================================================`);
    console.log(`PROCESSING: ${postInfo.title} (${postInfo.id})`);
    console.log(`================================================================`);

    // Fetch live content
    const res = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/${postInfo.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      console.error(`Failed to fetch post ${postInfo.id}: ${res.status}`);
      continue;
    }
    const post = await res.json() as any;
    const rawContent = post.content || '';
    const healedContent = healPostHtml(rawContent, postInfo.slug);

    const tables = (healedContent.match(/<table\b/gi) || []).length;
    const preCount = (healedContent.match(/<pre\b/gi) || []).length;
    const wrapCount = (healedContent.match(/class=['"][^'"]*code-block-wrap[^'"]*['"]/gi) || []).length;
    const headings = [...healedContent.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => `${m[1].toUpperCase()}: ${m[2].replace(/<[^>]+>/g, '').trim()}`);

    console.log(`Healed Stats: Tables=${tables}, Pre=${preCount}, Wraps=${wrapCount}, Headings=${headings.length}`);
    headings.forEach(h => console.log('  ' + h));

    if (isApply) {
      const patchRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/${postInfo.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: healedContent
        })
      });

      if (!patchRes.ok) {
        console.error(`[ERROR] Failed to patch post ${postInfo.id}: ${patchRes.status} ${await patchRes.text()}`);
      } else {
        console.log(`[SUCCESS] Patched ${postInfo.title} (${postInfo.id}) on Blogger!`);
      }
    }
  }
}

main().catch(console.error);
