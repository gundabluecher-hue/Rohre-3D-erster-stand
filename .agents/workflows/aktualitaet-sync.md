---
description: Check and auto-update docs/workflows/rules to current repository reality.
---

## 0. Context

- Read `docs/Umsetzungsplan.md`.
- Read `docs/Analysebericht.md` if present.
- Read latest `docs/Testergebnisse_*.md`.
- Read `git log -n 5 --oneline`.

## 1. Auto-sync (mandatory)

- Run `npm run docs:sync`.
- Open `docs/Dokumentationsstatus.md` and review findings.

## 2. Resolve remaining drift

- If `docs:sync` reports legacy-path findings, update affected active files.
- If required files are missing, restore/create them.
- Re-run `npm run docs:sync` after each fix.

## 3. Validate

- Run `npm run docs:check`.
- Ensure the command exits PASS and no blocking issues remain.

## 4. Optional reality checks

- If docs claim smoke stability, run:
  - `npm run smoke:roundstate`
  - `npm run smoke:selftrail`

## Gate

- `npm run docs:check` PASS.
- `docs/Dokumentationsstatus.md` reflects the current date and status.

## Report

Use standard output format from `.agents/rules/reporting_format.md`.

