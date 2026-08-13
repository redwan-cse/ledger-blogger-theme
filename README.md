# Ledger

A Blogger **Layouts V3** theme for [blogs.redwan.work](https://blogs.redwan.work), built from source and continuously verified against real Blogger-rendered HTML.

> **Status: M2 completion candidate, staging verification pending.** Header and Blog render paths delegate top-level dispatch to Blogger's native `super.main` (see `docs/DECISION-M2-NATIVE-DISPATCH.md`); a hand-rolled dispatcher was reintroduced and reverted twice after it rendered a blank production page, most recently 2026-08-12. Complete includable inventory, pagination, loud empty/error states, and server-side threaded comments are implemented. A homepage lead/row split is not implemented — the native includable contract has no per-item position hook, and adding one requires either a verified `post`-level heuristic or a separate widget; see the decision log before attempting it. M2 is not complete until the exact stamped artifact passes all ten staging views, including Layout mode.

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
- `src/styles/`: SCSS compiled into the single `b:skin` CDATA block.
- `src/scripts/`: TypeScript bundled into one inline IIFE.
- `tools/generate.ts`: deterministic compiler and size gate.
- `tools/contract-check.ts`: namespace-aware V3 contract validator.
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
