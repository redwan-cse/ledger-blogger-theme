# Render harness

M0 verifies Blogger-rendered HTML, never a hand-written DOM fixture. Node 24.18.1 is required.

## Environment

`STAGING_URL`, `EXPECTED_THEME_BUILD`, `BLOGGER_BLOG_ID`, and either `BLOGGER_API_KEY` or `BLOGGER_ACCESS_TOKEN` are required for discovery. `LAYOUT_MODE_URL` is optional; without an authenticated Blogger Layout URL that view reports SKIP, never PASS. `HARNESS_PACE_MS` defaults to 4000 and cannot be lower; `HARNESS_TIMEOUT_MS` defaults to 30000.

## Staging seed

Run `npm run seed:staging` with `BLOGGER_BLOG_ID` and `BLOGGER_ACCESS_TOKEN`. The script idempotently creates or updates 25 posts and 3 pages using official Blogger API v3 post/page CRUD.

Blogger API v3 has no comment-insert method and a label exists only through posts, so finish these dashboard fixtures manually after seeding: disable comments on the named fixture post; add 12 threaded comments and delete one; preserve `Empty Fixture Label` as a documented SKIP until Blogger provides a real zero-post label route. Never fake these in HTML.

## M0 RED run

Upload a minimal staging theme whose build stamp exactly matches `EXPECTED_THEME_BUILD` but whose `<main>` intentionally contains no rendered post content. Run `npm run harness`. STALE means the wrong build was uploaded and runs zero assertions. BLOCKED means Blogger throttled or challenged the run. Only measured missing-render assertions count as the required RED evidence.
