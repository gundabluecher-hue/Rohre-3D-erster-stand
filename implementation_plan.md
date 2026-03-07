Goals
- Compact the menu shell outside level 1 and turn level 2-4 into faster start-focused flows without breaking `#menu-nav`, `#submenu-custom`, `#submenu-game`, `#submenu-level4`, or `#btn-start`.
- Reuse the existing menu runtime for sticky start summary, structured previews, and sectioned level-4 navigation with local-state migration only where needed.
- Expand Playwright coverage for the new UX path, then close with build and documentation gates.

File-level changes
- `index.html`: reshape level 2/3/4 markup while preserving stable root selectors.
- `style.css`: compressed header shell, sticky start rail, preview cards, responsive level-4 sections.
- `src/ui/UIManager.js`, `src/ui/menu/MenuNavigationRuntime.js`, `src/ui/menu/MenuGameplayBindings.js`, `src/core/GameRuntimeFacade.js`, `src/core/GameBootstrap.js`, `src/ui/menu/MenuStateContracts.js`: menu state, navigation, section sync, validation focus, migration safety.
- `src/ui/menu/MenuPreviewCatalog.js`, `src/ui/menu/MenuTextCatalog.js`, `src/ui/menu/MenuTextRuntime.js`, `src/ui/menu/MenuSchema.js`: release-facing text and structured preview data.
- `tests/helpers.js`, `tests/core.spec.js`, `tests/stress.spec.js`: updated UX helpers and regression coverage.
- `docs/Feature_Menu_UX_Followup_V26_3c.md`: phase checkboxes and freeze notes only.

Risk rating
- Medium: shared UI shell, navigation focus flow, and Playwright selectors change together.

Verification commands
- Baseline / browser checks: local Playwright screenshot runs for desktop and mobile.
- Interim after 26.3c.2: `npm run test:core`
- Interim after 26.3c.5: `npm run test:core`
- Final: `npm run test:core`, `npm run test:stress`, `npm run build`, `npm run docs:sync`, `npm run docs:check`

No-stop block order
1. 26.3c.0 Baseline-Freeze und konfliktarme Vorbereitung
2. 26.3c.1 Kopfbereich komprimieren und Kontextleiste einfuehren
3. 26.3c.2 Ebene 2 als echte Startentscheidung schaerfen
4. 26.3c.3 Ebene 3 in eine sticky Startseite umbauen
5. 26.3c.4 Vorschauen, Favoriten und Zusammenfassung aufwerten
6. 26.3c.5 Ebene 4 in sektionierte Feineinstellungen umformen
7. 26.3c.6 Textkatalog fuer Release-Pfad bereinigen
8. 26.3c.7 Navigation, Fokus und State-Migration absichern
9. 26.3c.8 Tests und visuelle Verifikation ausbauen
10. 26.3c.9 Abschluss-Gate und Doku-Freeze

Continue criteria
- Continue directly after each phase when selectors/contracts remain stable and the current phase verification passes.
- Stop only on hard blockers, direct conflicts with unrelated in-flight edits, or failing mandatory gates that cannot be fixed inside scope.
