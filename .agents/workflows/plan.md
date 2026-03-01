---
description: Create a compact implementation plan for a new feature or extension.
---

## 0. Context

- Read `docs/Umsetzungsplan.md`.
- Read `git log -n 5 --oneline`.
- Scan impacted modules in `src/`, `tests/`, `editor/js/`.

## 1. Clarify (only if critical)

- What should be built?
- Why does it matter?
- Which area/module is affected?

## 2. Architecture check

- Existing modules/interfaces/events
- Reuse vs new file decision
- Risk rating (low/medium/high)
- Documentation impact list (which docs need update after implementation)

## 3. Write plan

Create `docs/Feature_[Name].md` with:

- Goal
- Affected files
- Steps
- Verification

## 4. Update master plan

- Add focused phase(s) in `docs/Umsetzungsplan.md` only if needed.
- Keep phases small and single-purpose.

## 5. Freshness hook

- Add a verification note to run `.agents/workflows/aktualitaet-check.md` during implementation closure.

## Report

Use standard output format from `.agents/rules/reporting_format.md`.



