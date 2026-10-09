import { describe, it, expect } from 'vitest';
import { resolveCompanionLinks, findMatchingCatalogPost } from '../../scripts/lib/companion-link-resolver.js';

describe('companion-link-resolver', () => {
  const sampleCatalog = [
    {
      title: 'AWS EKS Pod Identity: Deconstructing Workload Token Interception',
      url: 'https://blogs.redwan.work/2026/10/aws-eks-pod-identity-deconstructing.html'
    },
    {
      title: 'LiteLLM: Deconstructing AI Gateway MCP RCE Chain',
      url: 'https://blogs.redwan.work/2026/10/litellm-deconstructing-ai-gateway-mcp.html'
    },
    {
      title: 'Golden SAML: Deconstructing ADFS Token Forgery Architecture',
      url: 'https://blogs.redwan.work/2026/10/golden-saml-deconstructing-adfs-token.html'
    },
    {
      title: 'Active Directory Certificate Services: ESC8 ADCS Relay Defense',
      url: 'https://blogs.redwan.work/2026/09/active-directory-certificate-services-esc8.html'
    }
  ];

  it('matches exact article titles', () => {
    const match = findMatchingCatalogPost(
      'AWS EKS Pod Identity: Deconstructing Workload Token Interception',
      sampleCatalog
    );
    expect(match).not.toBeNull();
    expect(match?.url).toBe('https://blogs.redwan.work/2026/10/aws-eks-pod-identity-deconstructing.html');
  });

  it('matches articles with CVE variations in anchor text', () => {
    const match = findMatchingCatalogPost(
      'LiteLLM CVE-2026-42271: Deconstructing AI Gateway MCP RCE Chain',
      sampleCatalog
    );
    expect(match).not.toBeNull();
    expect(match?.url).toBe('https://blogs.redwan.work/2026/10/litellm-deconstructing-ai-gateway-mcp.html');
  });

  it('resolves markdown placeholder links pointing to root homepage', () => {
    const markdown = 'In our morning threat analysis ([AWS EKS Pod Identity: Deconstructing Workload Token Interception](https://blogs.redwan.work/)), we dissected the broker.';
    const { resolvedContent, replacementsCount } = resolveCompanionLinks(
      markdown,
      sampleCatalog,
      'Hardening AWS EKS Pod Identity: Blue Team Defense Guide'
    );

    expect(replacementsCount).toBe(1);
    expect(resolvedContent).toContain('https://blogs.redwan.work/2026/10/aws-eks-pod-identity-deconstructing.html');
    expect(resolvedContent).not.toContain('(https://blogs.redwan.work/)');
  });

  it('resolves HTML anchor tags pointing to root homepage', () => {
    const html = '<p>See <a href="https://blogs.redwan.work/">Golden SAML: Deconstructing ADFS Token Forgery Architecture</a> for token attack mechanics.</p>';
    const { resolvedContent, replacementsCount } = resolveCompanionLinks(
      html,
      sampleCatalog,
      'Hardening AD FS: Blue Team Golden SAML Defense Guide'
    );

    expect(replacementsCount).toBe(1);
    expect(resolvedContent).toContain('href="https://blogs.redwan.work/2026/10/golden-saml-deconstructing-adfs-token.html"');
  });

  it('resolves generic companion anchor text using topic from currentPostTitle', () => {
    const markdown = 'For attack mechanics, check our companion guide: [Deconstructing Breakdown](/search?q=Deconstructing).';
    const { resolvedContent, replacementsCount } = resolveCompanionLinks(
      markdown,
      sampleCatalog,
      'Hardening AWS EKS Pod Identity: Blue Team Defense Guide'
    );

    expect(replacementsCount).toBe(1);
    expect(resolvedContent).toContain('https://blogs.redwan.work/2026/10/aws-eks-pod-identity-deconstructing.html');
  });

  it('preserves legitimate intentional links to Home', () => {
    const markdown = 'Return to [Home](https://blogs.redwan.work/) or [Blog](https://blogs.redwan.work).';
    const { resolvedContent, replacementsCount } = resolveCompanionLinks(
      markdown,
      sampleCatalog
    );

    expect(replacementsCount).toBe(0);
    expect(resolvedContent).toBe(markdown);
  });

  it('heals mismatched links in companion callout blocks', () => {
    const catalog = [
      {
        title: 'Kerberos Diamond Ticket: Deconstructing TGT Forgery Architecture',
        url: 'https://blogs.redwan.work/2026/10/kerberos-diamond-ticket-deconstructing.html'
      },
      {
        title: 'Hardening Active Directory Kerberos: PAC Validation & Diamond Ticket Defense',
        url: 'https://blogs.redwan.work/2026/10/hardening-active-directory-kerberos-pac.html'
      },
      {
        title: 'Golden SAML: Deconstructing ADFS Token Forgery Architecture',
        url: 'https://blogs.redwan.work/2026/10/golden-saml-deconstructing-adfs-token.html'
      }
    ];

    // Post 1 with an outdated link pointing to Golden SAML instead of Hardening AD Kerberos PAC
    const post1Html = '<blockquote><p>🛡️ <strong>Blue Team Defense</strong>: For detection rules, Sysmon event IDs, and hardening configurations, see our companion guide: <a href="https://blogs.redwan.work/2026/10/golden-saml-deconstructing-adfs-token.html">Hardening Guide</a>.</p></blockquote>';
    const res1 = resolveCompanionLinks(post1Html, catalog, 'Kerberos Diamond Ticket: Deconstructing TGT Forgery Architecture');
    expect(res1.replacementsCount).toBe(1);
    expect(res1.resolvedContent).toContain('href="https://blogs.redwan.work/2026/10/hardening-active-directory-kerberos-pac.html"');

    // Post 2 with an outdated link pointing to Golden SAML instead of Diamond Ticket
    const post2Html = '<blockquote><p>⚔️ <strong>Exploitation Mechanics</strong>: For root-cause attack flow, see our deep-dive: <a href="https://blogs.redwan.work/2026/10/golden-saml-deconstructing-adfs-token.html">Deconstructing Breakdown</a>.</p></blockquote>';
    const res2 = resolveCompanionLinks(post2Html, catalog, 'Hardening Active Directory Kerberos: PAC Validation & Diamond Ticket Defense');
    expect(res2.replacementsCount).toBe(1);
    expect(res2.resolvedContent).toContain('href="https://blogs.redwan.work/2026/10/kerberos-diamond-ticket-deconstructing.html"');
  });
});

