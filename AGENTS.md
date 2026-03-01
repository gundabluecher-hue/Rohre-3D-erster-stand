# AGENTS.md

This file defines repository-specific operating rules for Codex.

## Scope

- Applies to the full repository.
- If this file conflicts with higher-priority system/developer instructions, higher-priority instructions win.

## Rule Sources

- Global rules folder: `.agents/rules/`
- Workflow folder: `.agents/workflows/`
- Test mapping: `.agents/test_mapping.md`

## Default Behavior

- Always apply rules from `.agents/rules/` first.
- Use concise, token-efficient output by default.
- Ask questions only when critical information is missing.
- For non-destructive design decisions, proceed proactively with a short rationale.
- Keep docs/workflows/rules in sync with code and test reality after each change.

## Workflow Selection

- Feature planning: use `.agents/workflows/plan.md`
- Feature implementation: use `.agents/workflows/code.md`
- Bug fixing: use `.agents/workflows/bugfix.md`
- Phase execution from master plan: use `.agents/workflows/fix-planung.md`
- Documentation/process freshness check: use `.agents/workflows/aktualitaet-check.md`
- Documentation/process freshness sync: use `.agents/workflows/aktualitaet-sync.md`
- Cleanup/refactor/release/status/rollback: use matching workflow in `.agents/workflows/`

## Verification Policy

- Select tests using `.agents/test_mapping.md`.
- If no mapping matches, run `npm run test:core` as fallback.
- For phase execution via `/fix-planung`, `/code` is the single source of truth for DoD and verification checks.
- For any code/process update, run `npm run docs:sync` and `npm run docs:check` before closing the task.

## Git Safety

- Never use destructive git operations without explicit user approval.
- Use scoped staging (`git add [scoped-files]`) and verify scope via `git diff --name-only` before push.
- Keep commits atomic and use `git commit --amend` for immediate small corrections in the same task.

## UI Changes

- Do not generate full walkthrough artifacts unless requested.
- For UI changes, provide lightweight visual verification evidence when available.
