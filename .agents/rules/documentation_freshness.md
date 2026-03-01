---
trigger: always_on
description: Rule for keeping docs/workflows/rules aligned with current code and test reality
---

- Before finishing any task, run a documentation freshness check if behavior, architecture, tests, scripts, workflows, or rules changed.
- Run `npm run docs:sync` after relevant changes to auto-update dated documentation fields and `docs/Dokumentationsstatus.md`.
- Run `npm run docs:check` as gate before closing the task.
- Treat changes in `src/**`, `tests/**`, `scripts/**`, `editor/**`, `index.html`, `style.css`, `package.json`, and `.agents/**` as potentially documentation-relevant.
- Update affected docs in the same task when claims changed (paths, module names, state names, commands, test outcomes, dates).
- Prefer active runtime paths (`src/...`) and avoid reintroducing legacy paths (`js/main.js`, `js/modules/...`) unless explicitly marked as historical/archive context.
- Use explicit dates (`YYYY-MM-DD`) for status claims instead of vague relative wording.
- If no doc update is required, state `Dokumentation aktuell (geprueft am YYYY-MM-DD)` in the final report.
- If stale content is found but intentionally deferred, document the risk and add a concrete follow-up in `docs/Umsetzungsplan.md`.
