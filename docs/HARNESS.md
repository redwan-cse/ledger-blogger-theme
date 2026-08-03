# Render harness

M0 verifies Blogger-rendered HTML, never a hand-written DOM fixture. Node 24.18.1 is required.

## Approved test target

The owner approved blog ID `5972841034338492159`, `redwancse.blogspot.com`, and `blogs.redwan.work` as the M0 target after confirming backups and accepting downtime plus fixtures.

## Seed

The protected manual workflow refreshes OAuth, serializes API calls, skips existing fixture titles, and reconciles exactly 25 fixture posts and 3 pages. Dashboard-only comment fixtures remain manual.

## Native reference

Google Contempo/Indie `1.3.3` was applied and exported. Commit the supplied file byte-for-byte as `docs/reference/contempo-1.3.3.xml`; never use a truncated chat preview.

## RED artifact

Run the **Build M0 empty theme** workflow on `chore/m0-scaffold`. Download its artifact and note `build.txt`. Upload `empty-theme.xml` through Blogger Theme → More → Restore. Set `EXPECTED_THEME_BUILD` to the exact `build.txt` value, then run the harness. This file is a deliberately empty test artifact under `dist/m0`, not theme source under `src/`.

STALE means the upload does not match and runs zero assertions. BLOCKED means Blogger throttled/challenged the run. M0 exits only when measured render assertions fail for missing visible content, proving RED for the right reason.
