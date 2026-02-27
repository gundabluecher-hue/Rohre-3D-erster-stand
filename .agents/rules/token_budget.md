---
trigger: always_on
description: Rule for token-efficient execution and output quality
---

- Minimize context load: read only required files/sections before editing.
- Prefer fast CLI queries (`rg`, targeted `Get-Content`) over broad file dumps.
- Keep output budget small:
  - Status update: 1-2 sentences
  - Final summary: change list + verification + next step
- Avoid duplicate reporting sections across workflows; reuse one standard format.
- Do not include ASCII banners, emoji blocks, or long templates in routine responses.
