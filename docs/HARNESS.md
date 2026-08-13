# Render harness

Rendered Blogger HTML is authoritative. Node 24.18.1 is required; hand-written DOM fixtures are forbidden.

## Approved staging target and seed

The owner approved blog ID `5972841034338492159`, `redwancse.blogspot.com`, and `blogs.redwan.work` as the backed-up development target after accepting downtime plus fixtures. The protected seed workflow refreshes OAuth, serializes and paces API calls, skips existing fixture titles, and reconciles 25 posts plus 3 pages.

## Native reference

Google Contempo/Indie `1.3.3` was applied and exported. The full export is committed as `docs/contempo-1.3.3.xml`.

## M2 validation

1. Download `theme.xml` from the `generate` job for the exact PR head SHA.
2. Upload it manually through Blogger Theme → More → Restore.
3. Confirm the staging environment has `STAGING_URL`, `BLOGGER_BLOG_ID`, `BLOGGER_API_KEY` or `BLOGGER_ACCESS_TOKEN`, and the private `LAYOUT_MODE_URL`.
4. Dispatch **M2 staging validation** on that exact branch commit.

The workflow derives `EXPECTED_THEME_BUILD` from the checked-out full SHA, runs the stamp gate before assertions, then measures all ten views through the HTTP harness and Playwright in JavaScript, no-JavaScript, and reduced-motion contexts. Requests are serialized, paced at least four seconds, and never retried.

A stamp mismatch is **STALE** and runs zero render assertions. Throttling or a bot challenge is **BLOCKED**, never PASS or FAIL. Missing labels, pages, pagination, or Layout-mode access makes M2 inconclusive; the seeded target is expected to provide every precondition.

## Historical M0 RED control

The M0 empty-theme artifact intentionally produced missing-render failures after its build stamp matched. Do not reuse it for M2; every validation must use the artifact generated from the current PR head.
