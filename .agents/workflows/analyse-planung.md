---
description: Run full test analysis, persist results, and update prioritized action plan.
---

## 0. Context

- Read `docs/Umsetzungsplan.md`.
- Read latest `docs/Analysebericht.md` if present.

## 1. Test mapping (source of truth)

- `T1-T20`: `npm run test:core` -> `tests/core.spec.js`
- `T21-T40`: `npm run test:gpu` -> `tests/gpu.spec.js`
- `T41-T60`: `npm run test:physics` -> `tests/physics.spec.js`
- `T61-T125`: `npm run test:stress` -> `tests/stress.spec.js`
- Extra smoke:
  - `npm run smoke:roundstate`
  - `npm run smoke:selftrail`

## 2. Execute and persist

- Run all mapped commands.
- Save raw outcome to `docs/Testergebnisse_YYYY-MM-DD.md`.
- Use per-test status: `PASS` / `FAIL` / `WARN`.

## 3. Analyze deltas only

- Compare against previous `docs/Analysebericht.md`.
- Document only: new issues, regressions, resolved items.

## 4. Update master plan

- Sync findings into `docs/Umsetzungsplan.md`.
- Keep completed items for history.
- Ensure phase headers use checkbox format: `## Phase X: [ ] Title`.

## 5. Documentation freshness check

- Run `npm run docs:sync`.
- Resolve stale path/state/date references from `docs/Dokumentationsstatus.md`.
- Run `npm run docs:check` (must pass).

## 6. Final consistency check

- No uncovered findings between test report, analysis, and plan.
- Keep `/fix-planung` compatibility.

## Report

Use standard output format from `.agents/rules/reporting_format.md`.




