# Render harness

M0 verifies Blogger-rendered HTML, never a hand-written DOM fixture. Node 24.18.1 is required.

## Approved target and seed

The owner approved blog ID `5972841034338492159`, `redwancse.blogspot.com`, and `blogs.redwan.work` as the M0 target after confirming backups and accepting downtime plus fixtures. The protected seed workflow refreshes OAuth, paces API calls, skips existing fixture titles, and reconciles 25 posts plus 3 pages.

## Native reference

Google Contempo/Indie `1.3.3` was applied and exported. The full export is committed as `docs/contempo-1.3.3.xml`.

## RED artifact

Run **Build M0 empty theme** on `chore/m0-scaffold` and download the new artifact. Do not reuse an older artifact: the first generator used self-closing widgets and a nonstandard full build string in `b:templateVersion`, which Blogger rejected. The corrected artifact uses a numeric template version, explicit Header/Blog widget bodies with V2 `main` includables, a full build stamp only in `<meta name='theme-build'>`, and an intentionally empty Blog render path.

Upload `empty-theme.xml` through Blogger Theme → More → Restore. Keep `build.txt`; its exact value is `EXPECTED_THEME_BUILD` for the harness. STALE runs zero assertions, BLOCKED means throttling/challenge, and M0 exits only when measured render assertions fail for missing visible content.
