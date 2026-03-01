---
trigger: *_code_change_or_creation
description: Rule for prioritizing code quality and architectural rules
---

- Always prioritize clean, maintainable, and self-documenting code.
- Strongly adhere to established architectural patterns (source of truth: `docs/ai_architecture_context.md`).
- Before modifying complex functions, consider if a refactoring (e.g., splitting into smaller, testable units) is more appropriate than just adding more logic to an existing monolith.
- Always validate edge cases and potential null values proactively when writing new logic.
- Prefer explicit naming over comments. Avoid writing comments that just describe *what* the code does; write comments that explain *why* something is done, if non-obvious.
