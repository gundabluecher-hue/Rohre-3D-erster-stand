---
description: Execute the next open phase from master plan with tight scope control.
---

## 0. Read status

- Read `docs/Umsetzungsplan.md`.
- Identify first phase marked `[ ]`.
- Read `git log -n 5 --oneline`.

## 1. Scope next phase

- List open tasks in that phase.
- List affected files.
- Split phase if it touches unrelated systems.

## 2. Create execution plan

Create `implementation_plan.md`:

- 2-3 goals max
- file-level changes
- risk rating
- verification commands

## 3. Execute

- Run `/code` workflow with `fix:` commit prefix.
- Keep this workflow focused on phase management only.
- Use `/code` as the single source of truth for implementation DoD and verification checks.

## 4. Close phase

- Mark phase/task checkboxes done.
- Add completion date.
- Run `.agents/workflows/aktualitaet-check.md` before marking phase complete.
- Remove `implementation_plan.md`.

## Report

Use standard output format from `.agents/rules/reporting_format.md`.
Set `Next Step` to `/fix-planung`.



