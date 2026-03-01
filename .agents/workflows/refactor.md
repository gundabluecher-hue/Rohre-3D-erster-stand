---
description: Restructure code without changing behavior.
---

## 0. Scope

- Identify module and refactor objective.
- Confirm no behavior change target.

## 1. Baseline

- Run baseline tests and store result.

## 2. Refactor

- Reduce duplication and long functions.
- Clarify module boundaries and naming.

## 3. Verify

- Re-run baseline tests.
- Compare with baseline; investigate regressions immediately.

## 4. Documentation freshness

- Run `npm run docs:sync`.
- Update docs when module structure/naming changed.
- Run `npm run docs:check` (must pass).

## 5. Commit

```bash
git add [scoped-files]
git commit -m "refactor: [scope] - [reason]"
```

- Verify scope first: `git diff --name-only`.
- Push only after confirming no unrelated files are included.

## Report

Use standard output format from `.agents/rules/reporting_format.md`.




