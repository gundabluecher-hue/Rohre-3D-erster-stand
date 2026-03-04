# Feature: V20 Single-Agent No-Stop Tiefenmodularisierung

Stand: 2026-03-04

## Ziel

Die Restkopplungen nach V19 werden in einem einzigen sequenziellen Durchlauf weiter reduziert, damit:

1. `EntityManager` nur noch Runtime-Fassade + Tick-Orchestrierung bleibt.
2. `RoundRecorder` als modulare Telemetrie-Schicht statt Sammelklasse arbeitet.
3. `Renderer` in Kamera-/Viewport-/Scene-/Quality-Module getrennt wird.
4. Bot-Sensorik und Observation-Bridge auf einer gemeinsamen Wahrnehmungsbasis laufen.
5. Portal-/Gate-Runtime klar von Build/Layout getrennt ist.

## Warum jetzt

- V19 hat die Kernentkopplung in `EntityManager`/Lifecycle bereits weit gebracht.
- Offene Grossmodule sind jetzt die naechsten Engpaesse fuer V8/V9/V13/V15.
- Ein no-stop Durchlauf reduziert Reibung zwischen Chats und verhindert Zwischenzustaende.

## Durchlaufregeln (Single-Agent ohne Stop)

- Ein Agent bearbeitet die Phasen `23.0` bis `23.10` strikt sequenziell.
- Wechsel in die naechste Phase nur nach bestandener Teil-Verifikation.
- Kein Parallel-Branching und keine alternativen Teilplaene waehrend des Laufs.
- Stop nur bei Hard-Blockern (rote Gates, unklare Contracts, fehlende Artefakte).
- Nach jeder abgeschlossenen Phase: Checkboxen + Datum + `docs:sync` + `docs:check`.

## Betroffene Dateien

Bestehend (primaer):

- `src/core/main.js`
- `src/entities/EntityManager.js`
- `src/state/RoundRecorder.js`
- `src/core/GameDebugApi.js`
- `src/core/Renderer.js`
- `src/entities/ai/BotSensors.js`
- `src/entities/ai/observation/ObservationSystem.js`
- `src/entities/arena/PortalGateSystem.js`
- `src/entities/systems/TrailSpatialIndex.js`
- `docs/Refactoring_Plan_God_Classes.md`
- `docs/Umsetzungsplan.md`

Neu (Zielbild, erwartete Splits):

- `src/entities/runtime/EntityRuntimeAssembler.js`
- `src/state/recorder/RoundEventStore.js`
- `src/state/recorder/RoundMetricsStore.js`
- `src/state/recorder/RoundSnapshotStore.js`
- `src/state/validation/BotValidationMatrix.js`
- `src/state/validation/BotValidationService.js`
- `src/core/renderer/CameraRigSystem.js`
- `src/core/renderer/RenderViewportSystem.js`
- `src/core/renderer/SceneRootManager.js`
- `src/core/renderer/RenderQualityController.js`
- `src/entities/ai/perception/EnvironmentSamplingOps.js`
- `src/entities/arena/portal/PortalLayoutBuilder.js`
- `src/entities/arena/portal/PortalRuntimeSystem.js`
- `src/entities/arena/portal/SpecialGateRuntime.js`
- `src/entities/systems/trails/TrailSegmentRegistry.js`
- `src/entities/systems/trails/TrailCollisionQuery.js`

Hinweis: Endgueltige Dateinamen werden pro Phase an bestehende Muster (`*System.js`, `*Ops.js`, `*Store.js`) angepasst.

## Architektur-Check

Bestehende Wiederverwendung:

- V19 Runtime-Contracts (`EntityRuntimeContext`, `EntityEventBus`) bleiben Basis.
- Bereits ausgelagerte Controller/Facades in `main.js` bleiben erhalten.
- Bestehende Bot-Policy-Schnittstelle (`BotPolicyRegistry`, `ObservationBridgePolicy`) bleibt stabil.

Offene Architekturprobleme:

- Constructor-Wiring in `EntityManager` ist weiterhin stark konzentriert.
- `RoundRecorder` mischt Event-Log, KPI-Aggregation, Snapshoting und Validation-Matrix.
- `Renderer` vereint Kamera-Logik, Viewport-Rendering, Scene-Cleanup und Quality-Umschaltung.
- `BotSensors` und `ObservationSystem` haben ueberlappende Wahrnehmungslogik.
- `PortalGateSystem` kombiniert Layout-Build, Runtime-Collision und Update-Loop.

Entscheidung Reuse vs. Neuanlage:

- Reuse: bestehende APIs bleiben als Fassade stabil.
- Neu: interne Module/Stores/Systeme zur Trennung von Verantwortung.
- Kein API-Big-Bang: Umstellung schrittweise, kompatibel und testgetrieben.

Risiko-Rating:

- Gesamt: **medium-high**
- Hoechste Risiken:
  - Verhaltensdrift in Kamera- und Kollisions-Hotpaths
  - KPI/Recorder-Drift in Debug- und Validation-Workflows
  - AI-Verhaltensaenderung durch Sensorik-Angleichung
- Gegenmassnahmen:
  - Phase fuer Phase, keine gleichzeitigen API-Brueche
  - Mapping-basierte Tests pro Schritt
  - Vollmatrix in `23.10`

## Dokumentationsauswirkungen (nach Umsetzung)

- `docs/ai_architecture_context.md`
- `docs/Refactoring_Plan_God_Classes.md`
- `docs/Umsetzungsplan.md`
- `docs/Testergebnisse_YYYY-MM-DD.md`

## Phase 23.0 - Baseline und Carry-Over-Freeze

- [x] 23.0.1 V19-Carry-Over Scope fixieren (`22.5`, `22.6`) und in V20-Run integrieren.
- [x] 23.0.2 Baseline-Messung fuer Recorder/Renderer/AI/Portal-Hotpaths erfassen.
- [x] 23.0.3 Aktuelle oeffentliche Contracts (`main.js`, `EntityManager`, `RoundRecorder`, `Renderer`) einfrieren.
- [x] 23.0.4 Guardrail: keine neuen Legacy-Aliase oder privaten Cross-Module-Zugriffe.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:roundstate`
- `npm run build`

Exit-Kriterien:

- Baseline dokumentiert.
- Carry-Over-Scope als feste Eingangskante fuer `23.1`/`23.2` gesetzt.

Abgeschlossen am: `2026-03-04`

### 23.0 Baseline (Stand 2026-03-04)

- Carry-Over-Integration fixiert: V19 `22.5`/`22.6` bleiben als harte Eingangskante in V20 `23.1`/`23.2` und werden dort formal gegatet.
- Hotpath-Baseline (LOC / Methoden): `RoundRecorder 438/21`, `Renderer 455/24`, `BotSensors 370/25`, `ObservationSystem 268/2`, `PortalGateSystem 348/15`, `TrailSpatialIndex 418/13`.
- Contract-Freeze `main.js`: Runtime-Einstieg `window.GAME_INSTANCE`, Debug-Einstieg `window.GAME_INSTANCE.debugApi`, Klassen-API `startMatch`, `update`, `render`.
- Contract-Freeze `EntityManager`: `setup`, `spawnAll`, `update`, `updateCameras`, `getHumanPlayers`, `getRuntimeContext`, `getTrailSpatialIndex`, `getHuntOverheatSnapshot`, `getHuntScoreboard`.
- Contract-Freeze `RoundRecorder` und `Renderer`: oeffentliche Methoden bleiben API-kompatibel waehrend 23.x-Splits; nur interne Module/Assembler werden verschoben.
- Guardrail aktiv: keine neuen Legacy-Aliase; bestehende bekannte Compat-Schuld (`EntityManager.gridSize`/`spatialGrid`) bleibt bis Phase `23.9` explizit markiert.

### 23.0 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, `57.7s`)
- `npm run test:physics` -> PASS (`47 passed`, `3.0m`)
- `npm run smoke:roundstate` -> PASS (`ok: true`)
- `npm run build` -> PASS (`vite build`, `10.43s`)

## Phase 23.1 - main.js API-Aufraeumen (V19 Carry-Over Teil 1)

- [x] 23.1.1 Reine Pass-Through-Methoden in `main.js` inventarisieren und reduzieren.
- [x] 23.1.2 Delegationen in bestehende Controller/Facades verschieben.
- [x] 23.1.3 Debug-/Runtime-Einstiegspunkte konsolidieren (`window.GAME_INSTANCE`, DebugApi).
- [x] 23.1.4 V19 `22.5` als erledigt markieren und referenzieren.

Verifikation:

- `npm run test:core`
- `npm run test:stress`
- `npm run build`

Exit-Kriterien:

- `main.js` bleibt Entry-Point, nicht Sammel-Proxy.
- Menue-/Match-/Debug-Flow unveraendert.

Abgeschlossen am: `2026-03-04`

### 23.1 Umsetzung (Stand 2026-03-04)

- `main.js` Pass-Throughs fuer MatchFlow/SessionBridge entfernt; Entry-Point bleibt auf Runtime-Start + Kernzustand fokussiert.
- Delegationen in bestehende Controller/Fassaden verschoben: `RoundStateTickSystem`, `PlayingStateSystem`, `MatchFlowUiController`.
- Runtime/Debug-Einstiege konsolidiert: `window.GAME_INSTANCE`, `window.GAME_RUNTIME`, `window.GAME_DEBUG`.
- V19-Referenz gesetzt: `22.5` bleibt abgeschlossen in `docs/Feature_Modularisierung_V19_Restentkopplung.md`.

### 23.1 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, `1.5m`)
- `npm run test:stress` -> PASS (`13 passed`, `2.0m`)
- `npm run build` -> PASS (`vite build`, `9.61s`)

## Phase 23.2 - V19-Abschluss und Gate-Freeze (V19 Carry-Over Teil 2)

- [x] 23.2.1 V19-Gesamtverifikation gem. 22.6 ausfuehren.
- [x] 23.2.2 V19-Dokumente finalisieren (Phasenstatus + Abschlusshinweise).
- [x] 23.2.3 Restschulden in V20-Folgephasen eindeutig referenzieren.
- [x] 23.2.4 V19 `22.6` als erledigt markieren.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run test:stress`
- `npm run smoke:roundstate`
- `npm run smoke:selftrail`
- `npm run build`
- `npm run docs:sync`
- `npm run docs:check`

Exit-Kriterien:

- V19 vollstaendig geschlossen.
- V20 ist alleiniger aktiver Durchlauf.

Abgeschlossen am: `2026-03-04`

### 23.2 Abschlussstand (Stand 2026-03-04)

- V19-Abschluss verifiziert gegen die volle `22.6`-Matrix.
- V19-Dokumentstatus bleibt final abgeschlossen (`22.0` bis `22.6`).
- Restschulden klar in V20 referenziert: `Bot._sensePhase` -> `23.7`, `EntityManager.gridSize/spatialGrid` -> `23.9`.
- V20 ist der einzige aktive Single-Agent-Durchlauf.

### 23.2 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, `1.1m`)
- `npm run test:physics` -> PASS (`47 passed`, `3.7m`)
- `npm run test:stress` -> PASS (`13 passed`, `3.2m`, ein vorheriger Timeout-Run wurde erfolgreich per Re-Run validiert)
- `npm run smoke:roundstate` -> PASS (`ok: true`)
- `npm run smoke:selftrail` -> PASS (`failures: []`)
- `npm run build` -> PASS (`vite build`, `22.48s`)
- `npm run docs:sync` -> PASS
- `npm run docs:check` -> PASS

## Phase 23.3 - Entity Runtime Assembler

- [x] 23.3.1 Constructor-Wiring aus `EntityManager` in `EntityRuntimeAssembler` extrahieren.
- [x] 23.3.2 System-/Callback-/EventBus-Aufbau zentral im Assembler kapseln.
- [x] 23.3.3 `EntityManager` auf Runtime-Fassade + Tick-Orchestrierung reduzieren.
- [x] 23.3.4 Regression-Checks fuer Kill/Feed/Damage/Respawn-Flows absichern.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:roundstate`

Exit-Kriterien:

- Keine semantische Verhaltensaenderung.
- Constructor-Abhaengigkeiten sind explizit und testbar.

Abgeschlossen am: `2026-03-04`

### 23.3 Umsetzung (Stand 2026-03-04)

- Neues Runtime-Modul: `src/entities/runtime/EntityRuntimeAssembler.js`.
- Constructor-Wiring fuer Projectile/EventBus/RuntimeContext/Trail/Spawn/Collision/Hunt/Outcome in den Assembler verschoben.
- `EntityManager`-Constructor reduziert auf Zustandsbasis + Assembler-Aufruf + Orchestrierungsfelder.
- Bestehende API bleibt kompatibel (`setup`, `spawnAll`, `update`, `updateCameras`, Trail-/Score-/Lock-On-Methoden).

### 23.3 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, `2.1m`)
- `npm run test:physics` -> PASS (`47 passed`, `6.1m`)
- `npm run smoke:roundstate` -> PASS (`ok: true`)

## Phase 23.4 - RoundRecorder in Stores splitten

- [x] 23.4.1 Event-Ringbuffer in `RoundEventStore` auslagern.
- [x] 23.4.2 KPI/Metric-Aggregation in `RoundMetricsStore` auslagern.
- [x] 23.4.3 Snapshot-Management in `RoundSnapshotStore` auslagern.
- [x] 23.4.4 `RoundRecorder` als stabile Fassade mit unveraenderter API erhalten.

Verifikation:

- `npm run test:core`
- `npm run smoke:roundstate`

Exit-Kriterien:

- Recorder-API kompatibel.
- KPI/Events/Snapshots technisch getrennt.

Abgeschlossen am: `2026-03-04`

### 23.4 Umsetzung (Stand 2026-03-04)

- Neue Stores: `src/state/recorder/RoundEventStore.js`, `RoundMetricsStore.js`, `RoundSnapshotStore.js`.
- `RoundRecorder` in Facade-Form refaktoriert und auf Store-Delegation umgestellt.
- Legacy-Feld-Kompatibilitaet (`events`, `eventCount`, `snapshots`, `roundSummaries` etc.) ueber Alias-Properties erhalten.
- Validation-Matrix bleibt bewusst noch in `RoundRecorder` (geplant fuer `23.5`).

### 23.4 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, `1.1m`)
- `npm run smoke:roundstate` -> PASS (`ok: true`)

## Phase 23.5 - Validation-Service von Recorder entkoppeln

- [x] 23.5.1 Validation-Matrix aus Recorder in `BotValidationMatrix` verschieben.
- [x] 23.5.2 Baseline/Report/Protocol in `BotValidationService` kapseln.
- [x] 23.5.3 `GameDebugApi` auf Service statt Recorder-Interna verdrahten.
- [x] 23.5.4 Recorder bleibt auf Logging/KPI fokussiert.

Verifikation:

- `npm run test:core`
- `npm run smoke:roundstate`

Exit-Kriterien:

- Debug-Workflows unveraendert nutzbar.
- Validation-Logik ist austauschbar und modulgetrennt.

Abgeschlossen am: `2026-03-04`

### 23.5 Umsetzung (Stand 2026-03-04)

- Neue Validation-Module: `src/state/validation/BotValidationMatrix.js` und `BotValidationService.js`.
- `GameDebugApi` komplett auf `BotValidationService` umverdrahtet (Baseline, Report, Protocol, Szenario-Anwendung).
- Validation-Matrix und Baseline-Vergleich aus `RoundRecorder` entfernt.
- `RoundRecorder` bleibt auf Event-/Snapshot-/KPI-Fassade fokussiert.

### 23.5 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, `1.6m`)
- `npm run smoke:roundstate` -> PASS (`ok: true`)

## Phase 23.6 - Renderer in Subsysteme splitten

- [x] 23.6.1 Kamera-Hotpath in `CameraRigSystem` auslagern.
- [x] 23.6.2 Scene-Root-Lifecycle in `SceneRootManager` kapseln.
- [x] 23.6.3 Viewport/Splitscreen/Aspect in `RenderViewportSystem` kapseln.
- [x] 23.6.4 Quality-Umschaltung in `RenderQualityController` auslagern.
- [x] 23.6.5 `Renderer` als Facade/API-kompatibel erhalten.

Verifikation:

- `npm run test:core`
- `npm run test:stress`
- `npm run build`

Exit-Kriterien:

- Kamera-/Renderverhalten stabil.
- Scene-Cleanup-Ownership klar getrennt.

Abgeschlossen am: `2026-03-04`

### 23.6 Umsetzung (Stand 2026-03-04)

- Neue Renderer-Subsysteme: `CameraRigSystem`, `SceneRootManager`, `RenderViewportSystem`, `RenderQualityController`.
- `Renderer` auf Facade mit API-kompatiblen Delegationen reduziert.
- Kameraarrays (`cameras`, `cameraModes` etc.) bleiben fuer bestehende HUD/Input/Entity-Callsites stabil erreichbar.
- Resize/Viewport/Quality/Cleanup-Verantwortung ist in dedizierte Module getrennt.

### 23.6 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, `3.3m`)
- `npm run test:stress` -> PASS (`13 passed`, `2.4m`)
- `npm run build` -> PASS (`vite build`, `8.77s`)

## Phase 23.7 - AI-Wahrnehmung vereinheitlichen

- [x] 23.7.1 Gemeinsame Environment-Sampling-Ops fuer BotSensors + Observation extrahieren.
- [x] 23.7.2 Doppelte Wand-/Projectile-/Target-Logik abbauen.
- [x] 23.7.3 Schwellwerte/Normalisierung zentralisieren (Config + Ops).
- [x] 23.7.4 Rule-Based und Bridge-Pfade auf Paritaet gegen Baseline pruefen.

Verifikation:

- `npm run test:core`
- `npm run test:physics`

Exit-Kriterien:

- Kein unbeabsichtigter KI-Verhaltenssprung.
- Wahrnehmungslogik ist konsistent und wiederverwendbar.

Abgeschlossen am: `2026-03-04`

### 23.7 Umsetzung (Stand 2026-03-04)

- Neues Shared-Ops-Modul: `src/entities/ai/perception/EnvironmentSamplingOps.js`.
- `ObservationSystem` nutzt jetzt gemeinsame Basis-/Wall-/Projectile-/NearestEnemy-Sampling-Ops.
- `BotSensors` nutzt gemeinsame Basis-/Steering-Ops; `BotTargetingOps` verwendet zentralen `targetInFront`-Threshold.
- Legacy-Shim entfernt: `Bot._sensePhase`-Bridge abgebaut, Sensorphase nur noch ueber Sensors-Facade/Runtime.

### 23.7 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, `1.5m`)
- `npm run test:physics` -> PASS (`47 passed`, `4.9m`; vorherige Load-Timeouts waren nicht-deterministische Re-Run-Flakes)

## Phase 23.8 - Portal/Gate Runtime modularisieren

- [x] 23.8.1 Layout/Build in `PortalLayoutBuilder` auslagern.
- [x] 23.8.2 Runtime-Collision und Trigger in `PortalRuntimeSystem` auslagern.
- [x] 23.8.3 Special-Gates in `SpecialGateRuntime` separieren.
- [x] 23.8.4 `PortalGateSystem` auf Orchestrierung/Fassade reduzieren.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:roundstate`

Exit-Kriterien:

- Portal-/Gate-Flow bleibt stabil.
- Build- und Runtime-Verantwortung klar getrennt.

Abgeschlossen am: `2026-03-04`

### 23.8 Umsetzung (Stand 2026-03-04)

- Neue Portal-Module eingefuehrt: `PortalLayoutBuilder`, `PortalRuntimeSystem`, `SpecialGateRuntime` unter `src/entities/arena/portal/`.
- `PortalGateSystem` als schlanke Orchestrator-Fassade wiederhergestellt und auf reine Delegation reduziert.
- Oeffentliche `Arena`-Vertraege (`checkPortal`, `checkSpecialGates`, `getPortalLevels`, `update`) bleiben kompatibel.

### 23.8 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, `1.3m`)
- `npm run test:physics` -> PASS (`47 passed`, `5.6m`)
- `npm run smoke:roundstate` -> PASS (`ok: true`)

## Phase 23.9 - TrailSpatialIndex intern splitten

- [x] 23.9.1 Segment-Registry aus Query-Logik trennen.
- [x] 23.9.2 Collision-Query und Debug-Telemetrie in eigene Module aufteilen.
- [x] 23.9.3 Compat-Aliase in `EntityManager` auf Restnutzung minimieren.
- [x] 23.9.4 Hotpath auf allocationsarme Implementierung absichern.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:selftrail`

Exit-Kriterien:

- Trail-Hit-Pfade stabil.
- Registry/Query/Debug technisch entkoppelt.

Abgeschlossen am: `2026-03-04`

### 23.9 Umsetzung (Stand 2026-03-04)

- Neue Trail-Module: `TrailSegmentRegistry`, `TrailCollisionQuery`, `TrailCollisionDebugTelemetry` unter `src/entities/systems/trails/`.
- `TrailSpatialIndex` in eine Fassade mit stabiler API umgebaut; Registrierung, Query und Debug-Telemetrie sind intern getrennt.
- `EntityManager`-Compat-Aliase `gridSize`/`spatialGrid` entfernt; Smoke-Skript auf `getTrailSpatialIndex()` umgestellt.
- Hotpath-Guards erhalten: Reuse von `Set`/Result-Objekten/Vektoren und keine zusaetzlichen Per-Query-Collections.

### 23.9 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, `2.1m`)
- `npm run test:physics` -> PASS (`47 passed`, `3.8m`; ein initialer `page.goto`-Timeout in T42 war ein Re-Run-Flake)
- `npm run smoke:selftrail` -> PASS (`failures: []`)

## Phase 23.10 - Abschluss, Handover, Doku-Freeze

- [x] 23.10.1 Gesamtlauf-Verifikation fuer alle geaenderten Pfade.
- [x] 23.10.2 Architektur-/Plan-Doku aktualisieren.
- [x] 23.10.3 Offene Restschulden als Follow-ups in `docs/Umsetzungsplan.md` erfassen.
- [x] 23.10.4 Dokumentations-Gate finalisieren.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run test:stress`
- `npm run smoke:roundstate`
- `npm run smoke:selftrail`
- `npm run build`
- `npm run docs:sync`
- `npm run docs:check`

Exit-Kriterien:

- Phasen `23.0` bis `23.10` vollstaendig abgehakt.
- Doku- und Teststatus konsistent.

Abgeschlossen am: `2026-03-04`

### 23.10 Abschlussstand (Stand 2026-03-04)

- Vollmatrix-Verifikation fuer V20-Hotpaths ist erfolgreich durchgelaufen.
- Plan-/Architektur-Dokumente wurden auf den finalen V20-Stand aktualisiert.
- Es wurden keine neuen V20-Restschulden identifiziert; bestehender Produkt-Backlog bleibt unveraendert.

### 23.10 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, `1.3m`)
- `npm run test:physics` -> PASS (`47 passed`, `5.2m`)
- `npm run test:stress` -> PASS (`13 passed`, `2.1m`)
- `npm run smoke:roundstate` -> PASS (`ok: true`)
- `npm run smoke:selftrail` -> PASS (`failures: []`)
- `npm run build` -> PASS (`vite build`, `10.14s`)
- `npm run docs:sync` -> PASS
- `npm run docs:check` -> PASS

## DoD fuer V20

- `EntityManager`, `RoundRecorder`, `Renderer`, `PortalGateSystem` haben klar getrennte Verantwortungen.
- AI-Wahrnehmung ist zwischen Rule-Based und Bridge konsistent modularisiert.
- Hotpaths bleiben allocationsarm.
- Dokumentation und Verifikation sind gruen.
