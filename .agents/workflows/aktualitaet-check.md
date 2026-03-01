---
description: Verify docs/workflows/rules are current with an automated gate.
---

## 0. Context

- Read `docs/Umsetzungsplan.md`.
- Read `docs/Analysebericht.md` if present.
- Read latest `docs/Testergebnisse_*.md`.
- Read `git log -n 5 --oneline`.

## 1. Inventory

- `git status --short`
- `rg --files docs .agents`
- Identify changed runtime areas (`src/`, `tests/`, `scripts/`, `editor/`).

## 2. Automated check (mandatory)

- Run `npm run docs:check`.
- Read `docs/Dokumentationsstatus.md`.

## 3. If check fails

- Run workflow `.agents/workflows/aktualitaet-sync.md`.
- Re-run `npm run docs:check` until PASS.

## 4. Gate

- `npm run docs:check` PASS.
- `docs/Dokumentationsstatus.md` has current date and no blocking issues.
- Verification commands and documented outcomes are consistent.

## Report

Use standard output format from `.agents/rules/reporting_format.md`.

