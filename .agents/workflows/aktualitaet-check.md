---
description: Verify that docs, workflows, and rules are current with code and verification state.
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

## 2. Staleness scan

- Check for legacy-path leaks in active docs/process files:
  - `rg -n "js/main\\.js|js/modules/" docs .agents AGENTS.md -S -g "!docs/archive/**"`
- Check for references to missing core docs:
  - `rg -n "docs/ai_architecture_context\\.md|docs/architektur_ausfuehrlich\\.md" docs .agents AGENTS.md -S -g "!docs/archive/**"`
- Validate that each changed status statement has an explicit date (`YYYY-MM-DD`).

## 3. Reality check

- Select verification via `.agents/test_mapping.md` from changed paths.
- If no mapping matches, run `npm run test:core`.
- If docs claim smoke stability, run corresponding smoke command(s):
  - `npm run smoke:roundstate`
  - `npm run smoke:selftrail`

## 4. Sync updates

- Update stale paths, commands, states, and dates in docs/workflows/rules.
- Sync `docs/Umsetzungsplan.md` and `docs/Analysebericht.md` if outcomes changed.
- Keep archive material explicitly marked as archive/historical when not updated.

## 5. Gate

- No unresolved stale references in active docs/workflows/rules.
- Verification commands and documented outcomes are consistent.
- Record result as:
  - `Dokumentation aktuell (geprueft am YYYY-MM-DD)` or
  - concrete list of updated files and residual risks.

## Report

Use standard output format from `.agents/rules/reporting_format.md`.
