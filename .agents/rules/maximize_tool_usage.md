---
trigger: shell_or_repetitive_tasks
description: Rule to maximize use of tools and CLI commands to save context tokens
---

- Prefer running lightweight terminal commands or predefined workflows for repetitive tasks (e.g., mass renaming, finding files) instead of requesting instructions via chat.
- Don't ask the user for permission to execute safe commands (like `grep`, `dir`, finding a file) - just do it implicitly.
- For documentation drift tasks, prefer `npm run docs:sync` and `npm run docs:check` over repetitive manual edits.
- If you build a complex logic that could be a standalone script (e.g., Python or Node script for converting formats), write the script to the file system instead of keeping all the logic in the chat context.
- Avoid reading large data objects (like long arrays or JSON configs) into the chat. Filter or query them directly in the terminal where possible.
