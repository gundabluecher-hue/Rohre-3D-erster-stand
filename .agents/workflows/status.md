---
description: Quick project status snapshot.
---

## 1. Plan status

- Read `docs/Umsetzungsplan.md`.
- Identify next open phase.

## 2. Git state

- `git log -n 5 --oneline --decorate`
- `git status --short`
- `git branch -a`

## 3. Output

- Next phase
- Uncommitted changes
- Active branches
- If documentation drift is suspected, run `npm run docs:sync` and then `npm run docs:check`.

## Report

Use standard output format from `.agents/rules/reporting_format.md`.




