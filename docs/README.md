# Ledger Documentation Index

This directory contains technical specifications, architectural decision records (ADRs), postmortems, platform references, and runbooks for the Ledger Blogger theme.

---

## 📑 Core Architecture & Specifications

| Document | Description |
|---|---|
| [`PROJECT-PLAN.md`](PROJECT-PLAN.md) | Comprehensive project requirements, milestone definitions (M0–M6), acceptance criteria, and state matrices. |
| [`V3-REFERENCE.md`](V3-REFERENCE.md) | Blogger Layouts V3 & Widget Version 2 platform reference, syntax rules, includables, data tags, and engine behavior. |
| [`BLOG_DESIGN_SYSTEM.md`](BLOG_DESIGN_SYSTEM.md) | Design system specifications, typography scales, OKLCH color ramps, spacing tokens, and dark mode conventions. |
| [`MASTER-PLAN-v2.md`](MASTER-PLAN-v2.md) | Master plan for the 2-column desktop grid, sticky glassmorphic sidebar, and interactive components. |
| [`THEME_LAYOUT_COMPARISON.md`](THEME_LAYOUT_COMPARISON.md) | Structural comparison between Ledger V3 architecture and Google's native Contempo theme XML. |

---

## 🏛️ Architectural Decisions & Postmortems

| Document | Description |
|---|---|
| [`POSTMORTEM.md`](POSTMORTEM.md) | Root cause analysis of the predecessor theme failure (why XML validity alone is insufficient). |
| [`BLANK_PAGE_FIX_POSTMORTEM.md`](BLANK_PAGE_FIX_POSTMORTEM.md) | Investigation and resolution of Blogger EL Java runtime dispatch issues and `.empty` accessor hazards. |
| [`DECISION-M2-NATIVE-DISPATCH.md`](DECISION-M2-NATIVE-DISPATCH.md) | Architectural decision record for adopting native `super.main` delegation and defaultmarkups. |
| [`decisions/0001-blogger-owns-widget-bindings.md`](decisions/0001-blogger-owns-widget-bindings.md) | ADR establishing that Blogger's internal layout database binds widget IDs. |

---

## 🛠️ Tooling & Testing Runbooks

| Document | Description |
|---|---|
| [`HARNESS.md`](HARNESS.md) | HTTP and Playwright test harness operation, rate limiting, and 10-view render verification. |
| [`BRAND-PALETTE-2026-08-19.md`](BRAND-PALETTE-2026-08-19.md) | OKLCH color token reference and brand palette definitions. |
| [`reference/`](reference/) | Reference materials and exported native V3 themes for comparison. |
