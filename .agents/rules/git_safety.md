---
trigger: *_git_*
description: Rule for safe git operations
---

- Never run destructive git commands (`git reset --hard`, `git checkout --`, force-push) without explicit user approval in the same session.
- Prefer non-destructive alternatives first: `git restore --source`, `git revert`, new commit with fix.
- Before any rollback/push operation, show impacted commits/files and confirm scope.
- If unrelated uncommitted changes exist, avoid touching them and keep the operation scoped.
- In parallel worktree situations (second agent or user editing at the same time), leave foreign changes untouched unless the user explicitly asks to include them.
- After the user confirms scoped handling, stage and commit only the files changed for the current task; a dirty worktree alone is not a reason to widen scope.
