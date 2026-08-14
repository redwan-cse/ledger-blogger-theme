# Ledger

A Blogger **Layouts V3** theme for [blogs.redwan.work](https://blogs.redwan.work), built from source and continuously verified against real Blogger-rendered HTML.

> **Status: M2 render path reverted to native dispatch; production confirmed still blank; M3a design system split and offline-verified.** `Header` and `Blog` render paths delegate top-level dispatch to Blogger's native `super.main` (see `docs/DECISION-M2-NATIVE-DISPATCH.md`). Live evidence as of the `cc6bee8` build: this confirmed-deployed, native-dispatch build still renders `no-items` empty shells for both `Header` and `Blog` on `blogs.redwan.work`, which rules out the dispatch pattern as sole cause — root cause is still open, see `docs/M2-BLANK-RENDER-INVESTIGATION.md` and `docs/decisions/0001-blogger-owns-widget-bindings.md` (falsified). Complete includable inventory (including `postBodySnippet`), pagination, loud empty/error states, and server-side threaded comments are implemented. The M3 design system (tokens, type scale, grid, states, responsive, a11y) is split into seven files per `docs/PROJECT-PLAN.md` §3.3, with computed WCAG contrast checks and three new compiled-CSS contract rules, all offline-verified (M3a, see #12). **Visual baselines are not captured** (M3b) because the site does not yet render on production. M2 and M3a are both offline-green only; neither is complete until a real Blogger render confirms it, per this repo's own rules. See `docs/M2-DEBT.md`.

## Rules

1. Rendered Blogger HTML is the evidence. XML shape alone never proves rendering.
2. No view may produce a blank content area.
3. The output budget is 200 KB. Line count is irrelevant.

## Start here

Read in this order: [`AGENTS.md`](AGENTS.md), [`docs/POSTMORTEM.md`](docs/POSTMORTEM.md), [`docs/V3-REFERENCE.md`](docs/V3-REFERENCE.md), [`docs/PROJECT-PLAN.md`](docs/PROJECT-PLAN.md). Harness operation lives in [`docs/HARNESS.md`](docs/HARNESS.md).

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
- `src/styles/`: SCSS compiled into the single `b:skin` CDATA block. Split per `docs/PROJECT-PLAN.md` §3.3: `tokens.scss`, `base.scss`, `layout.scss`, `index.scss`, `article.scss`, `states.scss`, `main.scss` (entry).
- `src/scripts/`: TypeScript bundled into one inline IIFE.
- `tools/generate.ts`: deterministic compiler and size gate.
- `tools/contract-check.ts`: namespace-aware V3 contract validator, including compiled-CSS style-contract rules.
- `tools/style-contract.ts`: regex-based rules over the compiled CSS inside `<b:skin>` (focus suppression, hidden post/article content, scroll-triggered motion).
- `tools/color-contrast.ts`: OKLCH → linear sRGB → WCAG contrast ratio, used to assert R-A11Y-1 AC3 by computation.
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
| Masthead | `masthead` | `Header` | 1 | Site title and tagline. Locked. |
| Nav | `navlinks` | `LinkList` | 1 | Menu items |
| Intro | `intro` | `HTML` | 1 | Editorial standfirst |
| Topics | `topics` | `Label` | 1 | Topic pills from real labels |
| Posts | `main` | `Blog` | 1 | The render path. Locked. |
| CTA | `cta` | `HTML` | 1 | Closing call to action |
| Footer | `footer` | `HTML` | 3 | Attribution and social links |

Only Masthead and Posts are implemented in M2. Remaining editable zones belong to M4.

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE): personal and other noncommercial use, modification, and contribution are allowed; commercial use is not. This is **not an OSI-approved open-source license**.

Identity-specific material belonging to Md Redwan Ahmed and Fast Cyber Defense is not licensed for reuse and must be replaced before public deployment or redistribution.
