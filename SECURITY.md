# Security Policy

## Supported Versions

We release patches and security fixes for the current release version of the Ledger Blogger theme.

| Version | Supported |
|---|---|
| `main` branch / `0.0.0` | :white_check_mark: |
| Legacy V1 / V2 prototypes | :x: |

---

## Security Architecture & Threat Model

The Ledger theme operates within Google Blogger's server-side Layouts V3 XML rendering pipeline and client-side web browser runtime. Security controls enforced in this repository include:

1. **XSS & Injection Defense**:
   - Strictly requires `.jsonEscaped` on all server-side interpolated JSON-LD structured data expressions (`tools/contract-check.ts` rule `json-escaped`).
   - Prevents unsafe string concatenation in URL attributes by requiring native `path` operators (`tools/contract-check.ts` rule `url-path-operator`).
   - Ensures all user-controllable post and comment content is sanitized through Blogger's native parser before rendering.

2. **Supply Chain Security**:
   - Zero external runtime script or stylesheet dependencies (`CDN`-free).
   - Automated CodeQL static analysis scanning on every push and pull request.
   - Dependabot vulnerability monitoring with automated dependency remediation.
   - Secret scanning and push protection enabled for credentials and API keys.

---

## Reporting a Vulnerability

If you discover a security vulnerability in the Ledger theme or its build toolchain, please follow responsible disclosure guidelines. **Do not create public GitHub issues for security vulnerabilities.**

### Preferred Method: GitHub Private Vulnerability Reporting
You can report security vulnerabilities privately via GitHub:
1. Navigate to the repository's **Security** tab.
2. Click **Advisories** → **Report a vulnerability**.
3. Provide a detailed description, proof-of-concept (PoC), and potential impact.

### Alternative Method: Direct Security Contact
If you cannot use GitHub Advisories, email:
- **Security Contact**: `security@fastcyberdefense.com` (or `redwan@fastcyberdefense.com`)
- **Subject**: `[SECURITY VULNERABILITY] Ledger Blogger Theme - <Short Description>`

Please include:
- A description of the vulnerability and attack scenario.
- Steps to reproduce or a minimal proof-of-concept.
- Affected files, template includables, or scripts.
- Any suggested remediation or patch.

---

## Response Process & SLAs

- **Initial Response**: Within **24 hours** to acknowledge receipt of the report.
- **Triage & Assessment**: Within **72 hours** with an initial severity rating and reproduction status.
- **Fix & Disclosure**: We will collaborate with you to develop and verify a fix before coordinating public release and advisory disclosure.

---

## Safe Harbor

Any activities conducted in a manner consistent with this policy will be considered authorized conduct, and we will not initiate legal action against you for security research conducted in good faith.
