# Ledger

A Blogger **Layouts V3** theme for [blogs.redwan.work](https://blogs.redwan.work), built from source and continuously verified against real Blogger-rendered HTML.

> **Status: M2 render path merged unverified; production still blank; M3a design system implemented and offline-green.** The root cause of the blank render is still open and tracked in [`docs/M2-DEBT.md`](docs/M2-DEBT.md) and [`docs/decisions/0001-blogger-owns-widget-bindings.md`](docs/decisions/0001-blogger-owns-widget-bindings.md) (the widget-binding hypothesis was tested live and falsified; the next diagnostic is a round-trip export diff against what Blogger actually stored). M3a splits `src/styles/main.scss` into the seven files [`PROJECT-PLAN.md` §3.3](docs/PROJECT-PLAN.md) specifies, adds computed WCAG contrast verification against the real token values, and adds three compiled-CSS contract rules (no focus suppression, no hidden post content outside hover/focus/hidden, no scroll-triggered reveal). All of it is offline-verified only. **M3b — visual baselines, the ten-view state matrix, responsive confirmation — is blocked on the render path and has not started.** Per this repo's own rules, no milestone is complete until a stamp-gated staging run passes; that has never yet happened for this theme.

## Rules

1. Rendered Blogger HTML is the evidence. XML shape alone never proves rendering.
2. No view may produce a blank content area.
3. The output budget is 200 KB. Line count is irrelevant.

## Start here

Read in this order: [`AGENTS.md`](AGENTS.md), [`docs/POSTMORTEM.md`](docs/POSTMORTEM.md), [`docs/V3-REFERENCE.md`](docs/V3-REFERENCE.md), [`docs/PROJECT-PLAN.md`](docs/PROJECT-PLAN.md). Harness operation lives in [`docs/HARNESS.md`](docs/HARNESS.md). Current blocker and milestone status lives in [`docs/M2-DEBT.md`](docs/M2-DEBT.md).

## Setup and core checks

```sh
nvm use
npm ci
npm run typecheck
npm test
npm run test:contract
```

## Generation commands

```sh
npm run generate
npm run watch
npm run contract:check
npm run test:golden
```

Generation must finish in under 10 seconds, the fetch-denied contract suite in under 5 seconds, and `dist/theme.xml` must remain at or below 200 KB. CI runs on GitHub-hosted Linux runners and uploads the verified XML artifact.

### Deliberately updating the golden snapshot

1. Run `npm run generate` and `npm run contract:check`.
2. Replace only the full SHA in `dist/theme.xml` with `GOLDEN_SHA_40_CHARS________________`.
3. Review the complete XML diff, then update `tests/golden/theme.xml`.
4. Run `npm run test:golden` and `npm run test:contract`.

Never update the golden file merely to make CI green.

## Repository source layout

- `src/theme.pug`: generated XML shell.
- `src/widgets/header.pug`: locked Header widget and homepage heading switch.
- `src/widgets/blog.pug`: M2 Blog render path, states, pager, comments, and recovery lists.
- `src/styles/`: SCSS compiled into the single `b:skin` CDATA block. Split per M3 into `tokens.scss`, `base.scss`, `layout.scss`, `index.scss`, `article.scss`, `states.scss`, with `main.scss` as the `@use` entry point.
- `src/scripts/`: TypeScript bundled into one inline IIFE.
- `tools/generate.ts`: deterministic compiler and size gate.
- `tools/contract-check.ts`: namespace-aware V3 contract validator, plus compiled-CSS rules from `tools/style-contract.ts`.
- `tools/color-contrast.ts`: OKLCH → linear sRGB → WCAG contrast ratio, used to verify R-A11Y-1 AC3 against the actual token values.
- `tools/watch.ts`: serialized, coalescing source watcher.
- `tests/contract/`: isolated mutation and render-contract suite.
- `tests/golden/theme.xml`: canonical generated output snapshot.
- `tests/render/`: real Blogger Playwright checks, never hand-written DOM fixtures.

## Live Blogger commands

```sh
npm run seed:staging
npm run deploy:check
npm run harness
npm run harness:browser
```

All Blogger/API configuration uses environment variables documented in `.env.example`. Upload the exact green artifact before staging validation. A mismatched stamp is STALE, throttling/challenge is BLOCKED, and neither is a pass.

## Layout zones

| Zone | `id` | Widget | Max | Purpose |
|---|---|---|---|---|
| Masthead | `header` | `Header` | 1 | Site title and tagline. Locked. Bound id, see ADR 0001. |
| Nav | `navlinks` | `LinkList` | 1 | Menu items |
| Intro | `intro` | `HTML` | 1 | Editorial standfirst |
| Topics | `topics` | `Label` | 1 | Topic pills from real labels |
| Posts | `page_body` | `Blog` | 1 | The render path. Locked. Bound id, see ADR 0001. |
| CTA | `cta` | `HTML` | 1 | Closing call to action |
| Footer | `footer` | `HTML` | 3 | Attribution and social links |

Only Masthead and Posts are implemented. Remaining editable zones belong to M4.

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE): personal and other noncommercial use, modification, and contribution are allowed; commercial use is not. This is **not an OSI-approved open-source license**.

Identity-specific material belonging to Md Redwan Ahmed and Fast Cyber Defense is not licensed for reuse and must be replaced before public deployment or redistribution.
