---
trigger: file_access_*
description: Rule for efficient file access and context management
---

- Use `rg` / `rg --files` first to locate files and code regions quickly.
- Read only targeted sections with line-limited `Get-Content` whenever possible.
- Avoid loading whole files unless structure/context requires it.
- Prefer focused path queries over broad recursive listings.
