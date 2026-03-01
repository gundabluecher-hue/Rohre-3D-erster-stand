---
description: Implement a planned change from coding to verification and commit.
---

## 0. Context

- Read `docs/Umsetzungsplan.md`.
- Read latest context: `git log -n 3 --oneline`.
- If available, use `docs/Feature_*.md` for scope.

## 1. Scope

- Define target files and expected behavior.
- If scope is clear, proceed directly.
- Ask only for critical missing constraints.

## 2. Implement

- Follow existing project patterns.
- Avoid hardcoded config values.
- Include cleanup/dispose for new runtime objects.

## 3. Self-check

- `rg -n "console\\.log" src tests`
- No open TODOs in changed code.
- Select tests via `.agents/test_mapping.md` based on changed paths.
- If no mapping matches, run `npm run test:core` as default safety check.

## 4. Documentation freshness (mandatory)

- Run `.agents/workflows/aktualitaet-check.md`.
- Sync affected docs if claims changed (`docs/Umsetzungsplan.md`, `docs/Analysebericht.md`, `docs/Feature_*.md`).
- If no updates are needed, record: `Dokumentation aktuell (geprueft am YYYY-MM-DD)`.

## 5. Definition of Done

- `npm run build` succeeds.
- Mapped tests (from `.agents/test_mapping.md`) pass.
- `git diff --name-only` matches planned scope.
- Documentation freshness check completed.
- Add one-line risk rating: low/medium/high.

## 6. Commit

```bash
git add [scoped-files]
git commit -m "[type]: [name] - [short reason]"
```

- `type` must match workflow intent (`feat`, `fix`, `refactor`, `perf`, `chore`, `release`).
- Before push, show impacted files (`git diff --name-only`) and confirm scope if unrelated changes exist.
- Push only after scope confirmation.

## Report

Use standard output format from `.agents/rules/reporting_format.md`.



