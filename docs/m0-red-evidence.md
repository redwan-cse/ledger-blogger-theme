# M0 stamped empty-theme RED evidence

- Workflow commit: `b5343b6ca78495ca3f058f8d2ed5401ecabf8f10`
- Deployed build expected and verified by harness: `0.0.0+96c0ce5b442f7ad2612b3f27aae5441f17166482`
- OAuth refresh step: `success`
- Harness step: `success`
- Harness exit: `2`

```text

> ledger-blogger-theme@0.0.0 harness
> tsx tools/render-harness.ts

[FAIL] R-RENDER-1 AC1 home-p1: HTTP 200, main visible text 0 chars. Evidence: https://blogs.redwan.work/
[SKIP] R-RENDER-3 AC2 home-p2 was not measured. Evidence: No older-page URL was discovered.
[FAIL] R-RENDER-1 AC3 label: HTTP 200, main visible text 0 chars. Evidence: https://blogs.redwan.work/search/label/Penetration%20Testing
[BLOCKED] R-RENDER-1 AC3 search could not be measured. Evidence: Blogger returned HTTP 429 (rate limited).
[BLOCKED] R-RENDER-1 AC3 archive could not be measured. Evidence: Blogger returned HTTP 429 (rate limited).
[BLOCKED] R-RENDER-2 AC1 post could not be measured. Evidence: Blogger returned HTTP 429 (rate limited).
[BLOCKED] R-RENDER-4 AC1 static-page could not be measured. Evidence: Blogger returned HTTP 429 (rate limited).
[FAIL] R-EMPTY-1 AC3 empty-result: HTTP 200, main visible text 0 chars, empty-state missing. Evidence: https://blogs.redwan.work/search?q=ledger-m0-guaranteed-empty-7f4c91
[FAIL] R-EMPTY-1 AC4 error: HTTP 404, main visible text 0 chars, empty-state missing. Evidence: https://blogs.redwan.work/__ledger-m0-missing-page__
[SKIP] R-V3-1 AC10 layout-mode was not measured. Evidence: LAYOUT_MODE_URL is not configured.
{
  "outcome": "BLOCKED",
  "counts": {
    "PASS": 0,
    "FAIL": 4,
    "BLOCKED": 4,
    "SKIP": 2
  }
}
```
