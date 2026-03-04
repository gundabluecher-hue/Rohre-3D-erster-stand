---
description: Execute the next open phase from master plan with tight scope control (supports single-agent no-stop blocks).
---

## 0. Read status

- Read `docs/Umsetzungsplan.md`.
- Identify first phase marked `[ ]`.
- Detect whether the phase belongs to a `Single-Agent Block` that is intended for no-stop execution.
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
- If no-stop block: include ordered list of all remaining phases in that block and continue criteria.

## 3. Execute

- Run `/code` workflow with `fix:` commit prefix.
- Keep this workflow focused on phase management only.
- Use `/code` as the single source of truth for implementation DoD and verification checks.
- If no-stop block is active: continue directly to the next open phase in the same block after each successful phase close.
- Stop only on hard blockers (failing gates, unclear contract conflicts, missing assets, or explicit user stop).

## 4. Close phase

- Mark phase/task checkboxes done.
- Add completion date.
- Run `npm run docs:sync` and `npm run docs:check` before marking phase complete.
- Remove `implementation_plan.md`.
- If no-stop block: repeat Step 1-4 until the block has no `[ ]` phases left.

## Report

Use standard output format from `.agents/rules/reporting_format.md`.
Set `Next Step` to `/fix-planung`.
