---
description: Diagnose a reported issue and apply a targeted fix.
---

## 0. Capture issue

- Get exact symptom, timing, reproducibility, and error text.
- Ask follow-up only if missing data blocks diagnosis.

## 1. Analyze evidence

- Check latest logs and error traces.
- Correlate timestamps with user scenario.
- Extract likely failure path.

## 2. Find root cause

- Locate error pattern in code (`rg`).
- Validate cause with minimal reproduction.
- Note impacted files and side effects.

## 3. Fix

- Apply smallest safe change for root cause.
- Keep scope limited to affected files.
- Re-run relevant checks (`build` + focused tests).

## 4. Documentation sync

- Run `npm run docs:sync`.
- Update issue status in `docs/Analysebericht.md` and `docs/Umsetzungsplan.md` when bug state changed.
- Run `npm run docs:check` (must pass).

## Report

Use standard output format from `.agents/rules/reporting_format.md`.




