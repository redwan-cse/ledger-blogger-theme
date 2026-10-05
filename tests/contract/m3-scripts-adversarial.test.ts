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

      // Module 1b: Floating Action Button (Back to Top)
      expect(scriptSource).toContain('initBackToTop');
      expect(scriptSource).toContain('back-to-top');
      expect(scriptSource).toContain('is-visible');

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

      // Back to top floating action button hooks
      expect(themePug).toContain('#back-to-top');
      expect(themePug).toContain('.back-to-top');
      expect(themePug).toContain('.back-to-top-icon');
      expect(scriptSource).toContain('back-to-top');

      // Share button & toast container hooks
      expect(postPug).toContain('data-action=\'copy-link\'');
      expect(themePug).toContain('#toast-container');

      // Blogger Follow hooks
      expect(themePug).toContain('followers/follow');
      expect(postPug).toContain('followers/follow');
      expect(scriptSource).toContain('followers/follow');
    });

    it('verifies back-to-top floating action button contract in generated theme', async () => {
      const themeXml = await readFile(path.join(ROOT, 'dist/theme.xml'), 'utf8');

      // Button markup with accessible label and inline SVG
      expect(themeXml).toContain('id="back-to-top"');
      expect(themeXml).toContain('class="back-to-top"');
      expect(themeXml).toContain('aria-label="Back to top"');
      expect(themeXml).toContain('title="Back to top"');
      expect(themeXml).toContain('back-to-top-icon');

      // Layout suppression in Blogger GUI
      expect(themeXml).toContain('body#layout .back-to-top');

      // Preserves existing footer text link for full fallback redundancy
      expect(themeXml).toContain('footer-back-to-top');
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

    it('heals non-standard parenthesized arrow labels and subsequent bare bracket nodes in flowcharts', () => {
      const input = `graph TD
[Coerced DC01$]  ---(SMB NTLM Auth)--->  [Attacker Relay]  ---(HTTP NTLM Auth)--->  [AD CS Web Enrollment]`;

      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned).toContain('node_1["Coerced DC01$"]');
      expect(cleaned).toContain('-->|"SMB NTLM Auth"|');
      expect(cleaned).toContain('node_2["Attacker Relay"]');
      expect(cleaned).toContain('-->|"HTTP NTLM Auth"|');
      expect(cleaned).toContain('node_3["AD CS Web Enrollment"]');
    });

    it('collapses multiline double-quoted strings across newlines in sequence diagrams', () => {
      const input = `sequenceDiagram
    autonumber
    Attacker->>Pipe: write("root::0:0:root:/root:/bin/sh
")
    Pipe->>PageCache: memcpy(buf->page + 1, payload)`;

      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned).toContain('Attacker->>Pipe: write("root::0:0:root:/root:/bin/sh\\n")');
      expect(cleaned).not.toMatch(/write\("root[^\n\r]*\r?\n"\)/);
    });

    it('heals ASCII box comparison diagrams into valid Mermaid flowcharts', () => {
      const input = `+-------------------------------------------------------------------------+
       |                  THE CRYPTOGRAPHIC TRUST INVERSION                      |
       +-------------------------------------------------------------------------+
       |  Legitimate SAML:   Identity Validation  --->  Cryptographic Signing    |
       |  Golden SAML:       Stolen Private Key   --->  Identity Fabrication    |
       +-------------------------------------------------------------------------+`;

      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned).toContain('graph TD');
      expect(cleaned).toContain('subgraph "THE CRYPTOGRAPHIC TRUST INVERSION"');
      expect(cleaned).toContain('c_1_a["Legitimate SAML:   Identity Validation"] --> c_1_b["Cryptographic Signing"]');
      expect(cleaned).toContain('c_2_a["Golden SAML:       Stolen Private Key"] --> c_2_b["Identity Fabrication"]');
    });

    it('heals ASCII box lifecycle stage diagrams into valid Mermaid flowcharts', () => {
      const input = `+-------------------------------------------------------------------------+
       |                     GOLDEN SAML 5-STAGE LIFECYCLE                       |
       +-------------------------------------------------------------------------+
       |  [1. Discovery]   --> Enumerate Federation Settings & Token-Signing Cert|
       |  [2. Extraction]  --> Harvest DKM Symmetric Key & Decrypt EncryptedPfx  |
       |  [3. Claim Craft] --> Forge NameID (ImmutableID), Roles & MFA Claims    |
       |  [4. XMLDSIG]     --> Canonicalize XML & Sign Assertion with Private Key|
       |  [5. Ingestion]   --> HTTP POST to Cloud ACS & Harvest Cloud Session    |
       +-------------------------------------------------------------------------+`;

      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned).toContain('graph TD');
      expect(cleaned).toContain('subgraph "GOLDEN SAML 5-STAGE LIFECYCLE"');
      expect(cleaned).toContain('node_1["<b>1. Discovery</b><br/>Enumerate Federation Settings & Token-Signing Cert"]');
      expect(cleaned).toContain('node_1 --> node_2');
      expect(cleaned).toContain('node_4 --> node_5');
    });

    it('heals ASCII box vertical numbered pipeline diagrams into valid Mermaid flowcharts', () => {
      const input = `+-------------------------------------------------------------------------+
       |                     XMLDSIG COMPUTATION PIPELINE                        |
       +-------------------------------------------------------------------------+
       |  1. Raw Assertion XML (without Signature block)                        |
       |                            |                                            |
       |                            v                                            |
       |  2. Apply Exclusive XML Canonicalization (C14N: whitespace/namespaces)  |
       |                            |                                            |
       |                            v                                            |
       |  3. Compute SHA-256 Digest of Canonicalized XML ---> DigestValue       |
       +-------------------------------------------------------------------------+`;

      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned).toContain('graph TD');
      expect(cleaned).toContain('subgraph "XMLDSIG COMPUTATION PIPELINE"');
      expect(cleaned).toContain('step_1["1. Raw Assertion XML (without Signature block)"]');
      expect(cleaned).toContain('step_1 --> step_2');
      expect(cleaned).toContain('step_2 --> step_3');
    });

    it('heals ASCII box horizontal multi-column pipeline diagrams into valid Mermaid flowcharts', () => {
      const input = `+-------------------------------------------------------------------------+
|               THE ENTERPRISE AI GATEWAY CONTROL PLANE                   |
+-------------------------------------------------------------------------+
|  Internal Apps / Agents  --->  LiteLLM AI Gateway  --->  Upstream LLMs  |
|  (Employees, Chatbots)         * Master API Keys         (OpenAI, Bedrock|
|                                * System Prompts & RAG     Anthropic, etc)|
|                                * MCP Tool Endpoints                     |
+-------------------------------------------------------------------------+`;

      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned).toContain('graph LR');
      expect(cleaned).toContain('subgraph "THE ENTERPRISE AI GATEWAY CONTROL PLANE"');
      expect(cleaned).toContain('node_1["<b>Internal Apps / Agents</b><br/>(Employees, Chatbots)"]');
      expect(cleaned).toContain('node_1 --> node_2');
      expect(cleaned).toContain('node_2 --> node_3');
    });

    it('heals ASCII box unnumbered vertical execution chain diagrams into valid Mermaid flowcharts', () => {
      const input = `+-------------------------------------------------------------------------+
|              STARLETTE "BADHOST" MIDDLEWARE BYPASS CHAIN                |
+-------------------------------------------------------------------------+
|  Attacker HTTP Request                                                  |
|  Host: badhost:8000, X-Forwarded-Host: evil.internal                    |
|                            |                                            |
|                            v                                            |
|  Starlette ASGI Engine                                                  |
|  Evaluates: request.headers.get("host") == "badhost:8000"               |
|                            |                                            |
|                            v                                            |
|  FastAPI Engine (LiteLLM Gateway Core)                                  |
|  Evaluates: request.url.hostname == "evil.internal"                     |
+-------------------------------------------------------------------------+`;

      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned).toContain('graph TD');
      expect(cleaned).toContain('subgraph "STARLETTE \'BADHOST\' MIDDLEWARE BYPASS CHAIN"');
      expect(cleaned).toContain('stage_1["<b>Attacker HTTP Request</b><br/>Host: badhost:8000, X-Forwarded-Host: evil.internal"]');
      expect(cleaned).toContain('stage_1 --> stage_2');
      expect(cleaned).toContain('stage_2 --> stage_3');
    });

    it('heals ASCII box process execution tree diagrams into valid Mermaid flowcharts', () => {
      const input = `+-------------------------------------------------------------------------+
|                     GATEWAY PROCESS EXECUTION TRACE                     |
+-------------------------------------------------------------------------+
|  PID 1240: python3 -m litellm --config /etc/litellm/config.yaml         |
|    |                                                                    |
|    +---> PID 1582: python3 -c "import socket,subprocess,os;..."         |
+-------------------------------------------------------------------------+`;

      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned).toContain('graph TD');
      expect(cleaned).toContain('subgraph "GATEWAY PROCESS EXECUTION TRACE"');
      expect(cleaned).toContain('proc_parent["PID 1240: python3 -m litellm --config /etc/litellm/config.yaml"]');
      expect(cleaned).toContain('proc_child["PID 1582: python3 -c \'import socket,subprocess,os;...\'"]');
      expect(cleaned).toContain('proc_parent -->|"Fork &amp; Execute Subprocess"| proc_child');
    });

    it('heals ASCII box nested sub-boxes with transition connectors into valid Mermaid flowcharts', () => {
      const input = `+-------------------------------------------------------------------------+
|             AD FS DISTRIBUTED KEY MANAGEMENT (DKM) CHAIN                |
+-------------------------------------------------------------------------+
|                                                                         |
|   +-----------------------------------------------------------------+   |
|   | Active Directory DIT (Domain Controllers)                       |   |
|   | Container: CN=ADFS,CN=Microsoft,CN=Program Data,DC=domain,DC=... |   |
|   | Attribute: thumbnailPhoto (Stores DKM Master Symmetric Key)     |   |
|   +---------------------------------+-------------------------------+   |
|                                     |                                   |
|                      Protected by Domain DPAPI                          |
|                                     |                                   |
|                                     v                                   |
|   +-----------------------------------------------------------------+   |
|   | AD FS Database (WID / SQL Server)                               |   |
|   | Table: IdentityServerPolicy.ServiceSettings                     |   |
|   | XML Column: SecurityTokenService -> <EncryptedPfx>              |   |
|   +---------------------------------+-------------------------------+   |
|                                     |                                   |
|                      Decrypted via DkmHelper.Unprotect()                |
|                                     |                                   |
|                                     v                                   |
|   +-----------------------------------------------------------------+   |
|   | In-Memory Private Key (RSA 2048-bit Private Signing Key)       |   |
|   | Used by Microsoft.IdentityServer.Service to mint SAML tokens    |   |
|   +-----------------------------------------------------------------+   |
+-------------------------------------------------------------------------+`;

      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned).toContain('graph TD');
      expect(cleaned).toContain('subgraph "AD FS DISTRIBUTED KEY MANAGEMENT (DKM) CHAIN"');
      expect(cleaned).toContain('stage_1["<b>Active Directory DIT (Domain Controllers)</b><br/>Container: CN=ADFS,CN=Microsoft,CN=Program Data,DC=domain,DC=...<br/>Attribute: thumbnailPhoto (Stores DKM Master Symmetric Key)"]');
      expect(cleaned).toContain('stage_1 -->|"Protected by Domain DPAPI"| stage_2');
      expect(cleaned).toContain('stage_2 -->|"Decrypted via DkmHelper.Unprotect()"| stage_3');
    });

    it('heals ASCII box key-value architectural overview cards into valid Mermaid flowcharts', () => {
      const input = `+-------------------------------------------------------------------------+
|                  THE GOLDEN SAML DEFENSIVE DILEMMA                      |
+-------------------------------------------------------------------------+
|  Attack Vector:       Offline Cryptographic SAML Token Forgery          |
|  On-Premise Visibility: ZERO (No DC Kerberos traffic, No AD FS logs)    |
|  Cloud Visibility:    VALID Sign-In (Signature matches trusted cert)   |
|  Defensive Trap:      Standard password resets DO NOT stop the attack   |
+-------------------------------------------------------------------------+`;

      const cleaned = cleanMermaidSyntax(input);
      expect(cleaned).toContain('graph TD');
      expect(cleaned).toContain('subgraph "THE GOLDEN SAML DEFENSIVE DILEMMA"');
      expect(cleaned).toContain('item_1["<b>Attack Vector</b><br/>Offline Cryptographic SAML Token Forgery"]');
      expect(cleaned).toContain('item_1 --> item_2');
      expect(cleaned).toContain('item_2 --> item_3');
      expect(cleaned).toContain('item_3 --> item_4');
    });

    it('discriminates XML code blocks with HTML comments and brackets from Mermaid diagrams', () => {
      const xmlMarkdown = `\`\`\`
<saml2:Assertion xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" ID="_123">
  <!-- Enveloped XML Digital Signature -->
  <ds:SignatureValue>A7f9...[RSA-SHA256 Encrypted Hash]...==</ds:SignatureValue>
</saml2:Assertion>
\`\`\``;

      const compiled = compileMarkdownToHtml(xmlMarkdown);
      expect(compiled).not.toContain('class="mermaid-diagram-wrap"');
      expect(compiled).toContain('class="code-block-wrap"');
      expect(compiled).toContain('<span class="code-block-lang">XML</span>');
      expect(compiled).toContain('&lt;saml2:Assertion');
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



