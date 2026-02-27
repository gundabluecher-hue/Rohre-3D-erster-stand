---
trigger: always_on
description: Rule for stable text encoding and readable artifacts
---

- Keep rule/workflow/docs files in UTF-8.
- Avoid mixed encodings and mojibake artifacts in generated text.
- If an existing file contains broken characters, normalize touched lines while editing.
- Prefer plain ASCII for commands and code snippets unless Unicode is required.
