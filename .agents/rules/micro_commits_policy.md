---
trigger: *_git_commit_or_version_control
description: Rule for meaningful micro-commits without cluttering the history
---

- Scope commits logically: A commit should represent an isolated, functional change (e.g., "Fix trail hitbox calculation" or "Add object pooling for bullets").
- Do NOT create a commit for every single typo out of context or single variables changed in isolation without a functional reason.
- Avoid monolithic commits mixing unrelated changes (e.g., combining UI fixes with physics adjustments).
- Provide concise, clear commit messages that explain the *why*, not just the *what*.
- Squash minor, transitional "wipe-in-progress" commits before finalizing a feature branch or larger change to keep the main history clean.
- Never use destructive git history changes as a default workflow step. Use `revert`/scoped restore first; request explicit confirmation before any forceful rewrite.
