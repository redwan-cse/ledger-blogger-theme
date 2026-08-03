# Ledger

A Blogger **Layouts V3** theme for [blogs.redwan.work](https://blogs.redwan.work), built from source and continuously verified against real Blogger-rendered HTML.

> **Status: M1 generation pipeline ready for final review.** Pug, SCSS, and TypeScript compile deterministically into a stamped V3 XML artifact. The hardened contract suite, canonical golden snapshot, size budget, and timing gates are green. The current generated theme is only the M1 scaffold; M2 owns the real Blog render path.

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

## M1 generation commands

```sh
npm run generate         # Pug + SCSS + TypeScript -> dist/theme.xml
npm run watch            # regenerate after .pug, .scss, or .ts source changes
npm run contract:check   # validate generated XML against the V3 contract
npm run test:golden      # byte-diff generated XML after build-SHA normalization
```

Generation must finish in under 10 seconds, the fetch-denied contract suite in under 5 seconds, and `dist/theme.xml` must remain at or below 200 KB. CI publishes both timings and uploads the verified XML artifact.

### Deliberately updating the golden snapshot

1. Run `npm run generate` and `npm run contract:check`.
2. Replace only the full SHA in `dist/theme.xml` with `GOLDEN_SHA_40_CHARS________________`.
3. Review the complete XML diff, then update `tests/golden/theme.xml`.
4. Run `npm run test:golden` and `npm run test:contract`.

Never update the golden file merely to make CI green.

## Repository source layout

- `src/theme.pug`: generated XML shell and M1 scaffold.
- `src/styles/`: SCSS compiled into the single `b:skin` CDATA block.
- `src/scripts/`: TypeScript bundled into one inline IIFE.
- `tools/generate.ts`: deterministic compiler and size gate.
- `tools/contract-check.ts`: namespace-aware V3 contract validator.
- `tests/contract/`: isolated mutation and blind-spot regression suite.
- `tests/golden/theme.xml`: canonical generated output snapshot.

## Live Blogger commands

```sh
npm run seed:staging
npm run deploy:check
npm run harness
npm run harness:browser
```

All Blogger/API configuration uses environment variables documented in `.env.example`. Never commit credentials. Live Layout-mode rendering and the complete Blog-widget includable contract remain M2 gates; M1 does not claim them.

## Self-hosted runner safety

CI currently uses repository-scoped persistent Linux runners while this repository is private. Jobs reject fork pull requests before reaching those runners. Before making the repository public, add a dedicated runner label, restrict runner access to trusted branches/environments, and keep untrusted fork code on ephemeral GitHub-hosted runners.

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

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE): personal and other noncommercial use, modification, and contribution are allowed; commercial use is not. This is **not an OSI-approved open-source license**.

Identity-specific material belonging to Md Redwan Ahmed and Fast Cyber Defense is not licensed for reuse and must be replaced before public deployment or redistribution.
