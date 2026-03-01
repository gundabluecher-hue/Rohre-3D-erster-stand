---
description: Create a compact implementation plan for a new feature or extension.
---

## 0. Context

- Read `docs/Umsetzungsplan.md`.
- Read `git log -n 5 --oneline`.
- Scan impacted modules in `src/`, `tests/`, `editor/js/`.

## 1. Clarify (only if critical)

- What should be built?
- Why does it matter?
- Which area/module is affected?

## 2. Architecture check

- Existing modules/interfaces/events
- Reuse vs new file decision
- Risk rating (low/medium/high)
- Documentation impact list (which docs need update after implementation)

## 3. Write plan

Create `docs/Feature_[Name].md` with:

- Goal
- Affected files
- Split into as many granular sub-phases as needed (e.g. 1.1, 1.2, 1.3) so the AI never gets confused by too many changes at once.
- Checkboxes `[ ]` for each phase to track completion.
- Verification steps for each phase.

## 4. Update master plan

- Add the new Phase as a focused block in `docs/Umsetzungsplan.md`.
- Include the sub-phases with checkboxes `[ ]` to mark which phase is done.
- Keep phases small and single-purpose.

## 5. Freshness hook

- Add a verification note to run `npm run docs:sync` and `npm run docs:check` during implementation closure.

## Report

Use standard output format from `.agents/rules/reporting_format.md`.

**CRITICAL ADDITION FOR THE REPORT:**
At the end of your report, you MUST provide:

1. A copy-paste prompt for the user to start the FIRST sub-phase in the next chat (e.g., "Mache weiter mit Phase X.1 aus dem Dokument Y").
2. A generic copy-paste prompt for the user to use AFTER a phase is done to start the NEXT phase in the following chat (e.g., "Markiere Phase X.1 als erledigt und starte Phase X.2 aus dem Dokument").
