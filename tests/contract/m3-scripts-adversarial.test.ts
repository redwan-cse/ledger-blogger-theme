import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTheme } from '../../tools/generate.js';
import { checkThemeContract } from '../../tools/contract-check.js';

import { cleanMermaidSyntax } from '../../src/scripts/main.js';
import { compileMarkdownToHtml, extractSearchDescription } from '../../scripts/publish-from-drive.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHA = '0123456789abcdef0123456789abcdef01234567';

describe('Milestone 3: Interactive Client Scripts (src/scripts/main.ts)', () => {
  describe('Source Code & Contract Alignment', () => {
    it('declares all 4 required M3 interactive modules in main.ts', async () => {
      const scriptSource = await readFile(path.join(ROOT, 'src/scripts/main.ts'), 'utf8');

      // Module 1: Reading Progress
      expect(scriptSource).toContain('initReadingProgress');
      expect(scriptSource).toContain('reading-progress');
      expect(scriptSource).toContain('reading-progress-bar');
      expect(scriptSource).toContain('requestAnimationFrame');
      expect(scriptSource).toMatch(/addEventListener\(\s*['"]scroll['"],\s*\w+,\s*\{\s*passive:\s*true\s*\}\s*\)/);
      expect(scriptSource).toMatch(/addEventListener\(\s*['"]resize['"],\s*\w+,\s*\{\s*passive:\s*true\s*\}\s*\)/);

      // Module 2: Mobile Navigation Drawer
      expect(scriptSource).toContain('initMobileDrawer');
      expect(scriptSource).toContain('#mobile-drawer');
      expect(scriptSource).toContain('.drawer-backdrop');
      expect(scriptSource).toContain('.drawer-toggle');
      expect(scriptSource).toContain('.drawer-close');
      expect(scriptSource).toContain('drawer-open');
      expect(scriptSource).toContain('aria-expanded');
      expect(scriptSource).toContain('aria-hidden');

      // Module 3: Live Search & Dropdown
      expect(scriptSource).toContain('initLiveSearch');
      expect(scriptSource).toContain('.sidebar-search-card');
      expect(scriptSource).toContain('.drawer-search-wrap');
      expect(scriptSource).toContain('.search-results-dropdown');
      expect(scriptSource).toContain('feeds/posts/summary');

      // Module 4: Share Copy & Toast
      expect(scriptSource).toContain('showToast');
      expect(scriptSource).toContain('initShareCopy');
      expect(scriptSource).toContain('copyToClipboard');
      expect(scriptSource).toContain('toast-container');
      expect(scriptSource).toContain('copy-link');
      expect(scriptSource).toContain('Link copied to clipboard!');

      // Module 13: Blogger Follow Centered Popup
      expect(scriptSource).toContain('initBloggerFollowPopup');
      expect(scriptSource).toContain('BloggerFollowPrompt');
      expect(scriptSource).toContain('followers/follow');

      // Progressive Enhancement
      expect(scriptSource).toContain('classList.add(\'js\')');
    });

    it('synchronizes DOM hooks between Pug templates and main.ts', async () => {
      const [themePug, headerPug, postPug, scriptSource] = await Promise.all([
        readFile(path.join(ROOT, 'src/theme.pug'), 'utf8'),
        readFile(path.join(ROOT, 'src/widgets/header.pug'), 'utf8'),
        readFile(path.join(ROOT, 'src/widgets/blog-post.pug'), 'utf8'),
        readFile(path.join(ROOT, 'src/scripts/main.ts'), 'utf8')
      ]);

      // Reading progress hooks
      expect(themePug).toContain('#reading-progress');
      expect(themePug).toContain('.reading-progress-bar');
      expect(scriptSource).toContain('reading-progress');

      // Drawer hooks
      expect(themePug).toContain('#mobile-drawer');
      expect(themePug).toContain('.drawer-backdrop');
      expect(themePug).toContain('.drawer-close');
      expect(headerPug).toContain('.drawer-toggle');

      // Search hooks
      expect(themePug).toContain('.sidebar-search-card');
      expect(themePug).toContain('.drawer-search-wrap');
      expect(themePug).toContain('.search-results-dropdown');

      // Share button & toast container hooks
      expect(postPug).toContain('data-action=\'copy-link\'');
      expect(themePug).toContain('#toast-container');

      // Blogger Follow hooks
      expect(themePug).toContain('followers/follow');
      expect(postPug).toContain('followers/follow');
      expect(scriptSource).toContain('followers/follow');
    });
  });

  describe('Theme Compilation & Inlined Client Script', () => {
    it('compiles theme XML with valid inlined script within CDATA', async () => {
      const { xml, bytes } = await generateTheme({ sha: SHA, write: false });
      expect(bytes).toBeLessThanOrEqual(500_000);
      expect(bytes).toBeGreaterThan(50_000);

      // Verify CDATA wrapping
      expect(xml).toContain('//<![CDATA[');
      expect(xml).toContain('//]]>');

      // Verify minified client script is present in compiled output
      expect(xml).toContain('document.documentElement.classList.add("js")');
      expect(xml).toContain('reading-progress');
      expect(xml).toContain('mobile-drawer');
      expect(xml).toContain('sidebar-search');
      expect(xml).toContain('toast-container');
      expect(xml).toContain('BloggerFollowPrompt');
    });

    it('passes all 37 contract checks with zero findings', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const findings = checkThemeContract(xml);
      expect(findings).toEqual([]);
    });

    it('ensures no external script dependencies are introduced', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      // Theme should not declare hardcoded external script dependencies (CDN, external frameworks)
      const externalScripts = xml.match(/<script\b[^>]*\bsrc=['"]https?:\/\/[^'"]+['"]/gi) ?? [];
      expect(externalScripts).toEqual([]);
    });
  });

  describe('Mermaid Syntax Sanitization & Client-Side Healing', () => {
    it('heals duplicate diagram headers (e.g. sequenceDiagram prepended to flowchart)', () => {
      const input = `sequenceDiagram\nflowchart TD\n    DevUser["Compromised CI/CD Runner / Contractor"] --> LocalPolicy`;
      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned.startsWith('flowchart TD')).toBe(true);
      expect(cleaned).not.toContain('sequenceDiagram');
    });

    it('normalizes entity-escaped arrow variants without corrupting labels', () => {
      const input = `STSEngine &lt;--&gt;|Verify Trust Policy| TargetIAMRole\nNodeA &lt;--> NodeB\nNodeC --&gt;&gt; NodeD\nNodeE &lt;-- NodeF\nNodeG["Label with &lt;tag&gt; inside"]`;
      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned).toContain('STSEngine <-->|Verify Trust Policy| TargetIAMRole');
      expect(cleaned).toContain('NodeA <--> NodeB');
      expect(cleaned).toContain('NodeC -->> NodeD');
      expect(cleaned).toContain('NodeE <-- NodeF');
      expect(cleaned).toContain('NodeG["Label with <tag> inside"]');
    });

    it('prevents substring keyword collision in markdown compiler (e.g. Contractor not matching actor)', () => {
      const markdown = '```mermaid\nflowchart TD\n    DevUser["Compromised CI/CD Runner / Contractor"] --> LocalPolicy\n```';
      const compiled = compileMarkdownToHtml(markdown);
      expect(compiled).toContain('data-mermaid-code=');
      expect(compiled).not.toContain('sequenceDiagram');
      expect(compiled).toContain('flowchart TD');
    });

    it('heals unquoted subgraph titles and node labels containing parentheses/special characters', () => {
      const input = `flowchart TD
    subgraph IngressPerimeter [External Untrusted Boundary]
        WANClient[Remote Client (Port 443 / WAN)]
        EdgeWAF{Edge WAF (Cloudflare Gate)}
        DropBadCookie["Deny: Path Traversal / Shell Metacharacters Detected"]
    end

    subgraph TelemetrySubsystem [Appliance Operating System (Root)]
        TelemetryWorker["Telemetry Daemon: Disabled via Policy"]
    end

    subgraph Appliance Operating System (Root)
        A --> B
    end

    WANClient --> EdgeWAF`;

      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned).toContain('subgraph IngressPerimeter ["External Untrusted Boundary"]');
      expect(cleaned).toContain('subgraph TelemetrySubsystem ["Appliance Operating System (Root)"]');
      expect(cleaned).toContain('subgraph "Appliance Operating System (Root)"');
      expect(cleaned).toContain('WANClient["Remote Client (Port 443 / WAN)"]');
      expect(cleaned).toContain('EdgeWAF{"Edge WAF (Cloudflare Gate)"}');
      // Pre-quoted labels should remain single-quoted
      expect(cleaned).toContain('DropBadCookie["Deny: Path Traversal / Shell Metacharacters Detected"]');
      expect(cleaned).not.toContain('DropBadCookie[""');
    });

    it('heals ASCII protocol handshake ladder diagrams into valid sequenceDiagram', () => {
      const input = `graph TD
[Attacker Client with Extracted Factory Cert] 
       |
       |---> TCP SYN to Port 541 (FGFM)
       |<--- TCP SYN/ACK
       |---> TLS ClientHello
       |<--- TLS ServerHello + CertificateRequest
       |---> TLS Certificate (Extracted Fortinet Factory Cert) + ClientKeyExchange
       |<--- TLS Finished
       |
[mTLS Handshake Accepted: Trust Established Without Identity Verification]`;

      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned).toContain('sequenceDiagram');
      expect(cleaned).toContain('autonumber');
      expect(cleaned).toContain('actor Client as Attacker Client with Extracted Factory Cert');
      expect(cleaned).toContain('participant Server as Port 541 (FGFM)');
      expect(cleaned).toContain('Client->>Server: TCP SYN to Port 541 (FGFM)');
      expect(cleaned).toContain('Server-->>Client: TCP SYN/ACK');
      expect(cleaned).toContain('Client->>Server: TLS ClientHello');
      expect(cleaned).toContain('Server-->>Client: TLS ServerHello + CertificateRequest');
      expect(cleaned).toContain('Client->>Server: TLS Certificate (Extracted Fortinet Factory Cert) + ClientKeyExchange');
      expect(cleaned).toContain('Server-->>Client: TLS Finished');
      expect(cleaned).toContain('Note over Client,Server: mTLS Handshake Accepted: Trust Established Without Identity Verification');
      expect(cleaned).not.toContain('graph TD');
      expect(cleaned).not.toContain('|--->');
    });

    it('heals bare bracket flowchart nodes without IDs and strips lone pipe lines', () => {
      const input = `flowchart TD
    [Start Request] --> [Validate Auth]
    |
    [Validate Auth] --> [Commit DB]`;

      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned).toContain('node_1["Start Request"] --> node_2["Validate Auth"]');
      expect(cleaned).toContain('node_2["Validate Auth"] --> node_3["Commit DB"]');
      expect(cleaned).not.toMatch(/^\s*\|\s*$/m);
    });

    it('compiles ASCII handshake ladder in markdown directly to sequenceDiagram', () => {
      const markdown = `\`\`\`mermaid
[Attacker Client]
|---> Handshake SYN to Port 541
|<--- Handshake ACK
[Handshake Complete]
\`\`\``;
      const compiled = compileMarkdownToHtml(markdown);
      expect(compiled).toContain('sequenceDiagram');
      expect(compiled).toContain('actor Client as Attacker Client');
      expect(compiled).toContain('participant Server as Port 541');
      expect(compiled).toContain('Client->>Server: Handshake SYN to Port 541');
      expect(compiled).toContain('Server-->>Client: Handshake ACK');
      expect(compiled).not.toContain('graph TD');
    });

    it('extracts clean 155-char search description stripping markdown artifacts', () => {
      const markdown = `---
title: Test Article
date: 2026-09-13
---

# Main Heading

![Diagram](https://example.com/diag.png)

This is the **primary** introduction paragraph explaining a critical vulnerability in PAN-OS GlobalProtect that allows remote unauthenticated attackers to execute commands via buffer overflow.

\`\`\`bash
curl -X POST https://target/api
\`\`\`

Secondary conclusion paragraph.`;

      const desc = extractSearchDescription(markdown);
      expect(desc.length).toBeLessThanOrEqual(158);
      expect(desc).toContain('This is the primary introduction paragraph');
      expect(desc).not.toContain('#');
      expect(desc).not.toContain('curl');
      expect(desc).not.toContain('title:');
    });

    it('defensively strips nested, malformed HTML tags and residual brackets from search descriptions', () => {
      const maliciousMarkdown = 'Summary: <img src=x onerror="hack">This is <b>safe</b> content <div class="box">with nested <span data-info="tag">tags</span></div> and residual <unclosed brackets.';
      const desc = extractSearchDescription(maliciousMarkdown);
      expect(desc).not.toContain('<');
      expect(desc).not.toContain('>');
      expect(desc).not.toContain('img');
      expect(desc).not.toContain('onerror');
      expect(desc).toContain('Summary: This is safe content with nested tags and residual unclosed brackets.');
    });

    it('sets article title as hero image alt attribute when provided', () => {
      const markdown = '# Sample Article\n\nContent here.';
      const compiled = compileMarkdownToHtml(markdown, 'https://example.com/hero.png', 'Hardening PAN-OS GlobalProtect');
      expect(compiled).toContain('alt="Hardening PAN-OS GlobalProtect"');
      expect(compiled).not.toContain('alt="Article Hero"');
    });

    it('defensively strips stray markdown fences and deduplicates sequenceDiagram in cleanMermaidSyntax', () => {
      const corrupted = `sequenceDiagram
\`\`\`mermaid
sequenceDiagram
    autonumber
    actor Attacker as Threat Actor
    participant SSHD as OpenSSH Daemon (sshd)
    SSHD->>Attacker: Handshake
\`\`\``;

      const cleaned = cleanMermaidSyntax(corrupted);
      expect(cleaned).not.toContain('```');
      expect(cleaned.match(/sequenceDiagram/g)?.length).toBe(1);
      expect(cleaned).toContain('actor Attacker as Threat Actor');
      expect(cleaned).toContain('SSHD->>Attacker: Handshake');
    });

    it('truncates unclosed diagram swallow of markdown prose in cleanMermaidSyntax', () => {
      const corrupted = `sequenceDiagram
    autonumber
    A->>B: Ping
    B-->>A: Pong

## Attack Path Step-by-Step

This is markdown prose that should not crash the diagram parser.`;

      const cleaned = cleanMermaidSyntax(corrupted);
      expect(cleaned).toContain('A->>B: Ping');
      expect(cleaned).not.toContain('## Attack Path');
      expect(cleaned).not.toContain('markdown prose');
    });

    it('compiles code blocks stripping nested fences and escapes C/C++ header includes in compileMarkdownToHtml', () => {
      const markdown = `\`\`\`\`c
// Header comment
\`\`\`c
#include <vmlinux.h>
#include <bpf/bpf_helpers.h>

struct event_t { int id; };
\`\`\`
\`\`\`\``;

      const compiled = compileMarkdownToHtml(markdown);
      expect(compiled).not.toContain('```');
      expect(compiled).toContain('&lt;vmlinux.h&gt;');
      expect(compiled).toContain('&lt;bpf/bpf_helpers.h&gt;');
      expect(compiled).toContain('struct event_t');
      expect(compiled).toContain('class="code-block-wrap"');
    });

    it('never produces nested double-frame code-block-wrap containers', () => {
      const markdown = `
### Step 1
<pre><code class="language-c">
int test_func(void) { return 0; }
</code></pre>

\`\`\`bash
echo "hello world"
\`\`\`
`;

      const compiled = compileMarkdownToHtml(markdown);
      expect(compiled).not.toMatch(/<div class="code-block-header">(?:(?!<\/div>)[\s\S])*<\/div>\s*<div class="code-block-wrap">/i);
      const wraps = compiled.match(/<div class="code-block-wrap">/g) || [];
      expect(wraps.length).toBe(2);
      expect(compiled).toContain('int test_func');
      expect(compiled).toContain('echo &quot;hello world&quot;');
    });

    it('strips task-list checkboxes so list items never render double bullet points', () => {
      const markdown = `## Verification Checklist

- [ ] **Verify sysctl lockdown**: Ensure \`kernel.unprivileged_bpf_disabled = 2\`.
- [x] **Confirm auditd rules**: Ensure BPF syscall monitoring is active.`;

      const compiled = compileMarkdownToHtml(markdown);
      expect(compiled).not.toContain('<input');
      expect(compiled).not.toContain('type="checkbox"');
      expect(compiled).toContain('<li><strong>Verify sysctl lockdown</strong>');
    });

    it('preserves single-# comments inside fenced code blocks and never swallows article sections after Mermaid', () => {
      const markdown = `## Exploit Architecture

\`\`\`mermaid
sequenceDiagram
    autonumber
    actor Attacker as Threat Actor
    participant Verifier as eBPF Verifier
    Note over Verifier: Tracks register bounds<br>(smin/smax)
    Attacker->>Verifier: Submit bytecode
\`\`\`

---

## Attack Path Step-by-Step

<pre><code class="language-bash"># Monitor 64-bit bpf syscall invocations
-a always,exit -F arch=b64 -S bpf
</code></pre>

<pre><code class="language-c">struct task_struct {
    const struct cred *cred;
};
</code></pre>

Final conclusion paragraph.`;

      const compiled = compileMarkdownToHtml(markdown);
      expect(compiled).toContain('<h2 id="attack-path-step-by-step">Attack Path Step-by-Step');
      expect(compiled).toContain('# Monitor 64-bit bpf syscall invocations');
      expect(compiled).not.toContain('## Monitor 64-bit bpf syscall invocations');
      expect(compiled).toContain('<p>Final conclusion paragraph.</p>');
      // Ensure .post-body .code-block-wrap pre comes after .post-body pre in scopedStyles
      const postBodyPreIdx = compiled.indexOf('.post-body pre {');
      const codeWrapPreIdx = compiled.indexOf('.post-body .code-block-wrap pre,');
      expect(postBodyPreIdx).toBeGreaterThan(-1);
      expect(codeWrapPreIdx).toBeGreaterThan(postBodyPreIdx);
    });

    it('converts raw <pre class="mermaid"> without swallowing subsequent sections and preserves spaces between inline code spans', () => {
      const markdown = `### The Flaw in \`downloadBlob\`

In Go, \`filepath.Join\` calls \`filepath.Clean\` on the path.

<pre class="mermaid">
sequenceDiagram
    autonumber
    actor Attacker as Threat Actor
    participant Victim as Ollama Server
    Attacker->>Victim: POST /api/pull
</pre>

---

## Attack Path Step-by-Step

Step 1 prose after mermaid diagram.`;

      const compiled = compileMarkdownToHtml(markdown);
      expect(compiled).toContain('<h3 id="the-flaw-in-downloadblob">The Flaw in <code>downloadBlob</code>');
      expect(compiled).toContain('<code>filepath.Join</code> calls <code>filepath.Clean</code>');
      expect(compiled).toContain('<h2 id="attack-path-step-by-step">Attack Path Step-by-Step');
      expect(compiled).toContain('<p>Step 1 prose after mermaid diagram.</p>');
      expect(compiled).not.toContain('```mermaid');
    });
  });
});



