---
description: Detect and remove dead code/files with safe dry-run first.
---

## 0. Detect

- Unused exports:
  - if `tsconfig.json` exists: `npx -y ts-unused-exports tsconfig.json`
  - else: manual `rg` checks
- Gather TODO/FIXME/HACK markers and large commented blocks.

## 1. Inventory

- Candidate file set:
  - `git ls-files "src/**/*.js" "editor/js/**/*.js" "tests/**/*.js"`
- Cross-check with actual imports/references.

## 2. Security and deps

- `npm outdated`
- `npm audit`
- Apply fixes selectively after impact check.

## 3. Dry-run report (mandatory)

- List candidate deletions/archives.
- Add per-item risk rating.
- No file deletion in dry-run.

## 4. Execute after confirmation

- Remove/archive approved items only.
- Re-run relevant tests.

## 5. Documentation freshness

- Run `npm run docs:sync`.
- Update docs referencing removed/moved files.
- Run `npm run docs:check` (must pass).

## 6. Commit

```bash
git add [approved-files]
git commit -m "chore: cleanup - remove dead code/files"
```

- Verify scope first: `git diff --name-only`.
- Push only after confirming no unrelated files are included.

## Report

Use standard output format from `.agents/rules/reporting_format.md`.




