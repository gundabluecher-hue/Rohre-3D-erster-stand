# Feature: Phase 12 - KI-freundliche Modularisierung (kleine, sichere Splits)

Stand: 2026-03-02

## Ziel

Die naechste Modularisierungsrunde wird so geschnitten, dass ein KI-Agent pro Task nur wenige, klar abgegrenzte Aenderungen machen muss:

1. Weniger "God Files" (`main.js`, `Config.js`, `Player.js`, `PortalGateSystem.js`, `EditorMapManager.js`).
2. Maximal 2-5 produktive Dateien pro Teilphase.
3. Pro Teilphase ein eindeutiger Schwerpunkt ohne Mischaufgaben.

## Voraussetzungen

1. Start erst nach Abschluss von Phase 10.9 (`docs/Feature_Modularisierung_Phase10_Performance_Wartbarkeit.md`).
2. Architekturregeln aus `docs/ai_architecture_context.md` bleiben unveraendert gueltig.

## Leitregeln pro Teilphase

1. Pro Teilphase nur ein Modul-Cluster bearbeiten.
2. Keine Verhaltensaenderung, wenn nicht explizit als Ziel genannt.
3. Bei jeder Teilphase:
   - Tests gemaess `.agents/test_mapping.md`
   - `npm run docs:sync`
   - `npm run docs:check`
4. Nach erfolgreicher Verifikation jeder Teilphase genau einen Git-Checkpoint-Commit erstellen.
5. Am Ende jeder Teilphase den angegebenen "Naechster-Chat-Prompt" verwenden.

## Git-Checkpoint pro Teilphase

1. Commit erfolgt erst nach gruenen Verifikationsschritten der Teilphase.
2. Commit-Format:
   - `git add <scoped-files>`
   - `git commit -m "refactor(phase12.X): <kurze-beschreibung>"`
3. Pro Teilphase ein atomarer Commit (Rollback-freundlich).

## Fortschrittsboard

- [ ] 12.1 `main.js` Split A - Runtime Diagnostics entkoppeln
- [ ] 12.2 `main.js` Split B - Keybind-Editor Controller entkoppeln
- [ ] 12.3 `main.js` Split C - Match/UI-Flow Controller entkoppeln
- [ ] 12.4 `Config.js` Split A - Map-Presets auslagern
- [ ] 12.5 `Config.js` Split B - Config-Sections komponieren
- [ ] 12.6 `PortalGateSystem` Split A - Mesh-Fabrik auslagern
- [ ] 12.7 `PortalGateSystem` Split B - Placement/Resolver auslagern
- [ ] 12.8 `Player.js` Split A - Effects/Inventory Ops auslagern
- [ ] 12.9 `Player.js` Split B - Motion/Update Ops auslagern
- [ ] 12.10 `EditorMapManager` Split A - Import/Export Serializer auslagern
- [ ] 12.11 `EditorMapManager` Split B - Mesh/Registry Ops auslagern
- [ ] 12.12 Abschluss, Verifikation, Cleanup

---

## Phase 12.1 - `main.js` Split A: Runtime Diagnostics entkoppeln

Ziel:

1. Debug-Overlay, FPS-Tracking und adaptive Qualitaetslogik aus `main.js` isolieren.
2. `main.js` bleibt Orchestrator ohne Monitoring-Detailcode.

Dateien (2-5):

- `src/core/main.js`
- `src/core/RuntimeDiagnosticsSystem.js` (neu)

Arbeitsschritte:

1. `F`-Overlay Toggle + Sampling in `RuntimeDiagnosticsSystem` verschieben.
2. Auto-Quality-Switch (`LOW` bei niedriger FPS) in neues System verschieben.
3. `main.js` ruft nur noch `diagnostics.update(dt)` auf.

Definition of Done:

- `main.js` hat keinen direkten DOM-Overlay-Rendercode fuer Runtime-Diagnostics mehr.
- Verhalten von `F`-Overlay und `P`-Quality-Toggle bleibt gleich.

Verifikation:

- `npm run test:core`
- `npm run smoke:selftrail`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 12.1 als erledigt und starte Phase 12.2 aus docs/Feature_Modularisierung_Phase12_KI_Freundliche_Splits.md.`

---

## Phase 12.2 - `main.js` Split B: Keybind-Editor Controller entkoppeln

Ziel:

1. Keybind-Render und Key-Capture-Flow aus `main.js` extrahieren.
2. Klare Trennung zwischen App-State (`Game`) und Keybind-UI-Handling.

Dateien (2-5):

- `src/core/main.js`
- `src/ui/KeybindEditorController.js` (neu)
- optional: `src/ui/UIManager.js`

Arbeitsschritte:

1. Methoden `_renderKeybindEditor`, `_renderKeybindRows`, `_collectKeyConflicts`, `_updateKeyConflictWarning`, `_handleKeyCapture` in neuen Controller verschieben.
2. Controller bekommt nur benoetigte Abhaengigkeiten injiziert (`ui`, `settings`, `showToast` Callback).
3. `main.js` delegiert Keybind-Aufgaben komplett.

Definition of Done:

- Keybind-Rendering lebt in eigenem Modul.
- `main.js` enthaelt nur Delegation + Lifecycle-Wiring.

Verifikation:

- `npm run test:core`
- `npm run test:stress`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 12.2 als erledigt und starte Phase 12.3 aus docs/Feature_Modularisierung_Phase12_KI_Freundliche_Splits.md.`

---

## Phase 12.3 - `main.js` Split C: Match/UI-Flow Controller entkoppeln

Ziel:

1. Match-UI-Anwendung (`_applyMatchUiState`, Round-End-UI, Toast-Flow) kapseln.
2. `main.js` weiter auf Session-Orchestrierung reduzieren.

Dateien (2-5):

- `src/core/main.js`
- `src/ui/MatchFlowUiController.js` (neu)
- optional: `src/ui/MatchUiStateOps.js`

Arbeitsschritte:

1. UI-Methoden fuer Match-Lifecycle in `MatchFlowUiController` auslagern.
2. Status-Toast-Flow zentral ueber den neuen Controller laufen lassen.
3. `startMatch`, `_onRoundEnd`, `_returnToMenu` nutzen nur noch Controller-API.

Definition of Done:

- UI-Transitions fuer `MENU/PLAYING/ROUND_END/MATCH_END` sind kapsuliert.
- Keine sichtbare UI-Regression.

Verifikation:

- `npm run test:core`
- `npm run test:stress`
- `npm run smoke:roundstate`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 12.3 als erledigt und starte Phase 12.4 aus docs/Feature_Modularisierung_Phase12_KI_Freundliche_Splits.md.`

---

## Phase 12.4 - `Config.js` Split A: Map-Presets auslagern

Ziel:

1. Sehr grosse Map-Preset-Bloecke aus `Config.js` auslagern.
2. `Config.js` wird wieder lesbar fuer Runtime-Parameter.

Dateien (2-5):

- `src/core/Config.js`
- `src/core/config/MapPresets.js` (neu)

Arbeitsschritte:

1. `CONFIG.MAPS` in `MapPresets.js` extrahieren.
2. In `Config.js` nur Import und Zusammensetzung lassen.
3. Bestehende Schluessel/Map-Namen 1:1 beibehalten.

Definition of Done:

- `Config.js` enthaelt keine langen map-spezifischen Datenblcke mehr.
- Alle Maps (inkl. `GENERATED_LOCAL_MAPS`) bleiben funktionsgleich.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run build`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 12.4 als erledigt und starte Phase 12.5 aus docs/Feature_Modularisierung_Phase12_KI_Freundliche_Splits.md.`

---

## Phase 12.5 - `Config.js` Split B: Config-Sections komponieren

Ziel:

1. Runtime-Parameter in klar getrennte Config-Section-Module aufteilen.
2. Kompatibilitaet ueber unveraenderten `CONFIG`-Export sichern.

Dateien (2-5):

- `src/core/Config.js`
- `src/core/config/ConfigSections.js` (neu)
- optional: `src/core/RuntimeConfig.js`

Arbeitsschritte:

1. Nicht-Map-Sections in `ConfigSections.js` kapseln (z. B. `PLAYER`, `BOT`, `CAMERA`, `POWERUP`).
2. `Config.js` baut `CONFIG` aus `MapPresets` + `ConfigSections` zusammen.
3. Kein Breaking Change fuer Imports.

Definition of Done:

- `CONFIG` bleibt API-kompatibel.
- Section-Struktur ist logisch getrennt und testbar.

Verifikation:

- `npm run test:core`
- `npm run build`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 12.5 als erledigt und starte Phase 12.6 aus docs/Feature_Modularisierung_Phase12_KI_Freundliche_Splits.md.`

---

## Phase 12.6 - `PortalGateSystem` Split A: Mesh-Fabrik auslagern

Ziel:

1. Mesh-Erzeugung von Portal/Gates separieren.
2. `PortalGateSystem` fokussiert auf Runtime und Logik.

Dateien (2-5):

- `src/entities/arena/PortalGateSystem.js`
- `src/entities/arena/PortalGateMeshFactory.js` (neu)

Arbeitsschritte:

1. `_createBoostPortalMesh`, `_createSlingshotGateMesh`, `_createPortalMesh` in Factory verschieben.
2. `PortalGateSystem` ruft Factory-Methoden auf.
3. Material-/Geometrie-Parameter unveraendert lassen.

Definition of Done:

- Mesh-Bau liegt ausschliesslich in `PortalGateMeshFactory`.
- Laufzeitverhalten der Gates/Portale bleibt gleich.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:selftrail`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 12.6 als erledigt und starte Phase 12.7 aus docs/Feature_Modularisierung_Phase12_KI_Freundliche_Splits.md.`

---

## Phase 12.7 - `PortalGateSystem` Split B: Placement/Resolver auslagern

Ziel:

1. Slot-Layouts, Position-Resolver und Pair-Building in pure Ops verschieben.
2. Runtime-Update und Cooldowns bleiben im System.

Dateien (2-5):

- `src/entities/arena/PortalGateSystem.js`
- `src/entities/arena/PortalPlacementOps.js` (neu)

Arbeitsschritte:

1. `_getMapPortalSlots3D`, `_getMapPlanarAnchors`, `_resolvePortalPosition`, `_resolvePlanarElevatorPair` auslagern.
2. `PortalGateSystem` nutzt klar definierte Ops-Funktionen.
3. Testbarkeit fuer Placement ohne Mesh-Kontext verbessern.

Definition of Done:

- Placement/Resolver-Code lebt in eigenem Ops-Modul.
- Keine Aenderung der Portal-Verteilung bei gleichen Seeds.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:selftrail`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 12.7 als erledigt und starte Phase 12.8 aus docs/Feature_Modularisierung_Phase12_KI_Freundliche_Splits.md.`

---

## Phase 12.8 - `Player.js` Split A: Effects/Inventory Ops auslagern

Ziel:

1. Effekt- und Inventarlogik aus `Player.js` entkoppeln.
2. `Player` bleibt State-Owner + Orchestrator.

Dateien (2-5):

- `src/entities/Player.js`
- `src/entities/player/PlayerEffectOps.js` (neu)
- `src/entities/player/PlayerInventoryOps.js` (neu)

Arbeitsschritte:

1. `applyPowerup`, `_removeEffect`, `_updateEffects` in `PlayerEffectOps` verschieben.
2. `addToInventory`, `cycleItem`, `useItem`, `dropItem` in `PlayerInventoryOps` verschieben.
3. `Player` ruft nur noch Ops-Funktionen mit `this`-Kontextdaten auf.

Definition of Done:

- Effects/Inventory leben in getrennten Modulen.
- Ingame-Effekte und Item-Flow bleiben identisch.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:selftrail`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 12.8 als erledigt und starte Phase 12.9 aus docs/Feature_Modularisierung_Phase12_KI_Freundliche_Splits.md.`

---

## Phase 12.9 - `Player.js` Split B: Motion/Update Ops auslagern

Ziel:

1. Die grosse `update(dt, input)`-Methode modularisieren.
2. Hotpath bleibt allocation-arm und unveraendert performant.

Dateien (2-5):

- `src/entities/Player.js`
- `src/entities/player/PlayerMotionOps.js` (neu)

Arbeitsschritte:

1. Steuerung/Rotation/Boost/Velocity in `PlayerMotionOps` auslagern.
2. Planar-/Gate-spezifische Bewegungspfade dort kapseln.
3. `Player.update` bleibt kurze Pipeline mit klaren Schritten.

Definition of Done:

- `Player.update` ist deutlich kuerzer.
- Kein Unterschied bei Bewegung, Boost und Planar-Lock.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:selftrail`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 12.9 als erledigt und starte Phase 12.10 aus docs/Feature_Modularisierung_Phase12_KI_Freundliche_Splits.md.`

---

## Phase 12.10 - `EditorMapManager` Split A: Import/Export Serializer auslagern

Ziel:

1. JSON-Import/Export aus `EditorMapManager` auslagern.
2. Editor-Manager fokussiert auf Scene/Object-Lifecycle.

Dateien (2-5):

- `editor/js/EditorMapManager.js`
- `editor/js/EditorMapSerializer.js` (neu)

Arbeitsschritte:

1. `generateJSONExport` und `importFromJSON` in `EditorMapSerializer` verschieben.
2. `EditorMapManager` konsumiert Serializer ueber klare API.
3. Schema- und Migrationspfad bleibt unveraendert (`MapSchema`).

Definition of Done:

- Import/Export-Code ist nicht mehr in `EditorMapManager`.
- Editor-Import/Export funktioniert wie vorher.

Verifikation:

- `npm run test:core`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 12.10 als erledigt und starte Phase 12.11 aus docs/Feature_Modularisierung_Phase12_KI_Freundliche_Splits.md.`

---

## Phase 12.11 - `EditorMapManager` Split B: Mesh/Registry Ops auslagern

Ziel:

1. Mesh-Erzeugung und Objekt-Registry separat kapseln.
2. `EditorMapManager` wird Orchestrator statt Implementierungs-Sammelstelle.

Dateien (2-5):

- `editor/js/EditorMapManager.js`
- `editor/js/EditorMeshFactory.js` (neu)
- `editor/js/EditorObjectRegistry.js` (neu)

Arbeitsschritte:

1. `createMesh` und Tunnel-Align-Helfer in `EditorMeshFactory` verschieben.
2. ID-Management + Registry (`objectsById`, register/remove/clear) in `EditorObjectRegistry`.
3. `EditorMapManager` verdrahtet nur noch Factory + Registry + UI-Refresh.

Definition of Done:

- Mesh/Registry-Logik liegt in eigenen Modulen.
- Editor-Funktionen (add/remove/import/export/select) bleiben stabil.

Verifikation:

- `npm run test:core`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 12.11 als erledigt und starte Phase 12.12 aus docs/Feature_Modularisierung_Phase12_KI_Freundliche_Splits.md.`

---

## Phase 12.12 - Abschluss, Verifikation, Cleanup

Ziel:

1. Gesamt-Delta (Wartbarkeit, Dateigroessen, Risiken) dokumentieren.
2. Masterplan und Architekturdoku auf finalen Stand setzen.

Dateien (2-5):

- `docs/Umsetzungsplan.md`
- `docs/ai_architecture_context.md`
- `docs/Testergebnisse_2026-03-02.md` (oder neues Tagesdokument)

Arbeitsschritte:

1. Rest-Risiken + offene Nacharbeiten dokumentieren.
2. Phase 12 im Masterplan auf abgeschlossen setzen.
3. Abschlussbericht inkl. Next-Options erstellen.

Definition of Done:

- Doku, Plan und Teststatus sind konsistent.
- Keine offenen "In Bearbeitung"-Eintraege ohne Folgeaktion.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:selftrail`
- `npm run smoke:roundstate`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 12.12 als erledigt, aktualisiere docs/Umsetzungsplan.md und erstelle einen kompakten Abschlussbericht mit Restrisiken und naechsten Optionen.`
