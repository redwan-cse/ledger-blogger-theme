# M0 stamped empty-theme RED evidence

- Workflow commit: `3f179b85c1231140e26944ab631f5628eadd8154`
- Deployed build expected and verified by harness: `0.0.0+96c0ce5b442f7ad2612b3f27aae5441f17166482`
- OAuth refresh step: `success`
- Harness step: `success`
- Harness exit: `1`

```text

> ledger-blogger-theme@0.0.0 harness
> tsx tools/render-harness.ts

[FAIL] R-RENDER-1 AC1 home-p1: HTTP 200, main visible text 0 chars. Evidence: https://blogs.redwan.work/
[SKIP] R-RENDER-3 AC2 home-p2 was not measured. Evidence: No older-page URL was discovered.
[FAIL] R-RENDER-1 AC3 label: HTTP 200, main visible text 0 chars. Evidence: https://blogs.redwan.work/search/label/Penetration%20Testing
[FAIL] R-RENDER-1 AC3 search: HTTP 200, main visible text 0 chars. Evidence: https://blogs.redwan.work/search?q=%5BLedger
[FAIL] R-RENDER-1 AC3 archive: HTTP 200, main visible text 0 chars. Evidence: https://blogs.redwan.work/2026/08/
[FAIL] R-RENDER-2 AC1 post: HTTP 200, main visible text 0 chars. Evidence: https://blogs.redwan.work/2026/08/ledger-m0-fixture-pagination-post-25.html
[FAIL] R-RENDER-4 AC1 static-page: HTTP 200, main visible text 0 chars. Evidence: https://blogs.redwan.work/p/ledger-m0-fixture-long-static-page.html
[FAIL] R-EMPTY-1 AC3 empty-result: HTTP 200, main visible text 0 chars, empty-state missing. Evidence: https://blogs.redwan.work/search?q=ledger-m0-guaranteed-empty-7f4c91
[FAIL] R-EMPTY-1 AC4 error: HTTP 404, main visible text 0 chars, empty-state missing. Evidence: https://blogs.redwan.work/__ledger-m0-missing-page__
[SKIP] R-V3-1 AC10 layout-mode was not measured. Evidence: LAYOUT_MODE_URL is not configured.
{
  "outcome": "FAIL",
  "counts": {
    "PASS": 0,
    "FAIL": 8,
    "BLOCKED": 0,
    "SKIP": 2
  }
}
```
