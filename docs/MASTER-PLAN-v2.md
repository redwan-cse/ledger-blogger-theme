# Ledger — master plan, revision 4

**Status as of 2026-08-18.** This revision replaces revision 3's claim that one harness run was the only remaining blocker. Real Blogger screenshots of uploaded builds now prove that the render path works, but M3b remains incomplete because the live UI still has structural wrapper and visual-quality defects. `docs/PROJECT-PLAN.md` §1–§9 still define the product requirements and verification standard; this document supersedes its milestone table in §10.

---

## 1. Current evidence

### 1.1 What is confirmed

- Blogger renders the Header, Blog posts, pagination, article body, comments, CTA, footer, labels, and sidebar from the uploaded generated theme.
- The two historical blank-render causes remain fixed and contract-enforced: no `maxwidgets` on sections and a load-bearing `<b:defaultmarkups>` block with `Common` coverage.
- Offline gates are green on the latest wrapper repair: generation, golden snapshot, unit tests, contract suite, contract check, and typecheck.
- Pagination/share encoding defects seen in earlier screenshots no longer reproduce in the latest screenshots.
- Commit `10f7504` flattened the first known Header wrapper chain, but live screenshots prove that the single-row masthead outcome is not yet achieved.

### 1.2 What is not verified

- No exact-SHA stamp-gated ten-view harness pass exists. The 2026-08-18 diagnostic failed while refreshing the Blogger OAuth token, before deploy or render assertions. Tracked in [#17](https://github.com/redwan-cse/ledger-blogger-theme/issues/17).
- M3b visual baselines are incomplete. Current screenshots expose unresolved desktop shell, masthead, article rhythm, comments, and dark-mode hierarchy defects.
- Layout mode, JS-disabled, reduced-motion, and all ten view types are not accepted until the harness produces conclusive evidence.
- M4 gadget readiness is still unverified against a real dashboard-added gadget.

### 1.3 Governing rule

Offline-green proves the artifact contract, not Blogger rendering. Owner screenshots are valid defect evidence, but completion still requires exact-SHA rendered evidence. BLOCKED or STALE is never a pass.

---

## 2. Active issue map

| Issue | Workstream | Priority | Dependency |
|---|---|---:|---|
| [#17](https://github.com/redwan-cse/ledger-blogger-theme/issues/17) | Restore Blogger OAuth/live harness and complete ten-view verification | P0 | Owner may need to reauthorize the refresh token |
| [#18](https://github.com/redwan-cse/ledger-blogger-theme/issues/18) | Complete the Blogger Header/LinkList wrapper chain and single-row masthead | P0 | Requires real rendered-DOM evidence |
| [#15](https://github.com/redwan-cse/ledger-blogger-theme/issues/15) | Rebalance desktop canvas width, scale, grid, and editorial density | P1 | After #18 |
| [#16](https://github.com/redwan-cse/ledger-blogger-theme/issues/16) | Polish article/comments spacing and dark-mode hierarchy | P1 | After #18 and coordinated with #15 |
| [#14](https://github.com/redwan-cse/ledger-blogger-theme/issues/14) | Parent record for screenshot-discovered UI defects | P1 | Closes only after #15, #16, #18 and live evidence |
| [#7](https://github.com/redwan-cse/ledger-blogger-theme/issues/7) | M2 render-path acceptance | P0 | Blocked by #17 |
| [#11](https://github.com/redwan-cse/ledger-blogger-theme/issues/11) | M3 design system and live visual acceptance | P1 | Blocked by #15, #16, #17, #18 |
| [#13](https://github.com/redwan-cse/ledger-blogger-theme/issues/13) | M4 real gadget/defaultmarkup validation | P2 | After #7 and M3b stabilization |

The OD-5 taxonomy decision remains closed, but applying the eight labels to live posts is still a manual Blogger-dashboard task.

---

## 3. Milestone table, revision 4

| M | Name | Status | Exit criteria |
|---|---|---|---|
| M0 | Repo, staging, harness | Infrastructure exists; credential health regressed | Restore the live credential path under #17 |
| M1 | Generation pipeline | Done | Deterministic generation, contract, golden, size, and CI gates remain green |
| M2 | Render path | **Rendering confirmed, formal acceptance blocked** | #17 restores exact-SHA deploy check; HTTP and browser harnesses pass all ten views, JS/no-JS/reduced-motion, and Layout mode where configured; then close #7 |
| M3a | Design system, offline | Done | Tokens, SCSS architecture, contrast, and contract rules remain green |
| M3b | Design system, live | **In progress with confirmed defects** | #18 header wrappers, #15 desktop canvas, and #16 article/comments polish pass real 375/768/1440 screenshots in both modes; full state matrix verified |
| M3c | Design direction | Decided | Keep the approved lead/elevated-card editorial direction; do not re-litigate it while fixing scale and wrappers |
| M4 | Config zones and gadget readiness | Blocked | All seven zones editable; one real dashboard gadget renders through defaultmarkup; CLS measured; empty zone removal verified; #13 closed |
| M5 | SEO and accessibility | Not started | Original PROJECT-PLAN criteria plus live heading, landmark, focus, comments, and contrast checks |
| M6 | Performance | Not started | Lighthouse and runtime budget against the live exact-SHA build, including current JS features |
| M7 | Cutover | Not started | M2–M6 accepted with rollback evidence |
| M8/M9 | Reading experience and monetisation | Deferred | Begin only after M7 |

---

## 4. Dependency-ordered execution plan

1. **Restore verification (#17).** Repair or reauthorize the Blogger OAuth refresh token and confirm the `blogger-live` environment without exposing secrets.
2. **Finish the masthead (#18).** Inspect Blogger-rendered DOM, identify every platform wrapper, and flatten/span only the load-bearing Header and LinkList chain. Preserve distinct Layout sections and responsive drawer behavior.
3. **Fix desktop composition (#15).** Rebalance container width, grid allocation, gutters, card/sidebar proportions, typography scale, CTA, and footer at 1440/1024/768/375 while preserving the article's roughly 66ch measure.
4. **Polish article and comments (#16).** Correct vertical rhythm, dark-mode contrast, share/author/post-navigation layout, comment shell, CTA transition, and mobile wrapping without depending on JavaScript for visibility.
5. **Run M2/M3b acceptance.** Upload the generated artifact, gate on its exact full-SHA stamp, run all ten views plus JS/no-JS/reduced-motion/Layout mode, and capture light/dark baselines at 375/768/1440.
6. **Close parent debt.** Update and close #7, #11, and #14 only when their rendered acceptance criteria are satisfied.
7. **Resume M4 (#13).** Add a real dashboard gadget, verify defaultmarkup styling and CLS, then remove it and verify the zone collapses cleanly.

---

## 5. Acceptance rules for every UI slice

- Name the issue and requirement IDs in the change description.
- Generate successfully and remain within the 500 KB hard budget.
- Contract check, contract suite, unit tests, typecheck, and golden snapshot pass.
- Review the golden diff deliberately; never update it only to silence CI.
- Any change touching the document shell, Blog/Header widgets, defaultmarkups, or wrapper layout requires exact-SHA live verification.
- Capture real Blogger HTML/screenshots, never a hand-written fixture.
- Test light and dark modes at 375, 768, and 1440 where the change is visual.
- Keep content visible without JavaScript and respect reduced motion.
- Do not globally flatten `.section`/`.widget` or globally force anchors into flex layout.
- Do not close an issue on owner screenshots alone when its acceptance criteria require the harness.

---

## 6. Manual owner actions

Only two current steps require dashboard access:

1. If #17 confirms an invalid/expired refresh token, reauthorize Blogger OAuth and replace `BLOGGER_REFRESH_TOKEN` in the GitHub `blogger-live` environment. Never paste it into chat, issues, or logs.
2. After each verified generated UI candidate, upload that exact `dist/theme.xml` to Blogger and report the full SHA embedded in its `theme-build` meta tag.

Applying the eight OD-5 labels to the live posts remains a separate manual content task.

---

## 7. Status

The project is **offline-green and live-rendering, but not production-ready or M3b-complete**. The critical path is #17 → #18 → #15/#16 → exact-SHA M2/M3b acceptance → #13. Any document claiming “Production-Ready and Verified” before those gates pass is stale and must not be used as release evidence.
