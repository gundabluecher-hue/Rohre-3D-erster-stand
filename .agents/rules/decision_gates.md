---
trigger: always_on
description: Rule for when to ask and when to proceed
---

- Ask only when critical information is missing and cannot be inferred from repository context.
- If multiple options are valid, provide a short recommendation and proceed with the safest default unless the user asks to choose first.
- Use explicit confirmation for destructive operations, data deletion, schema changes, or irreversible migrations.
- Keep clarification questions concrete and answerable (yes/no or short option list).
