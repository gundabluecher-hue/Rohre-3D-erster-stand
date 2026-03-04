# Feature: V19 Restentkopplung der Runtime-Orchestrierung

Stand: 2026-03-04

## Ziel

Die verbleibenden Kopplungspunkte nach V18 werden ohne Verhaltensaenderung weiter modularisiert, damit:

1. `EntityManager` als stabile Runtime-Fassade statt als Sammelklasse arbeitet.
2. `PlayerLifecycleSystem` klar in Sub-Pipelines getrennt wird.
3. private Feldkopplungen (`entityManager._...`) auf definierte Runtime-Contracts reduziert werden.
4. der naechste Ausbauschritt (Balancing/Telemetry/Features) auf stabilen Modulen aufsetzt.

## Warum jetzt

- V18 hat bereits grosse Splits geliefert (`ProjectileSystem`, `OverheatGunSystem`, `main.js`, `Bot`, `MenuController`).
- Es bleiben vor allem Orchestrierungs- und Contract-Schulden in Runtime-Hotpaths.
- Diese Schulden erschweren Tests, Reuse und sichere Feature-Erweiterungen in V4/V5/V8/V15.

## Betroffene Dateien

Bestehend (primaer):

- `src/entities/EntityManager.js`
- `src/entities/systems/PlayerLifecycleSystem.js`
- `src/entities/systems/PlayerInputSystem.js`
- `src/entities/systems/HuntCombatSystem.js`
- `src/entities/systems/CollisionResponseSystem.js`
- `src/entities/systems/SpawnPlacementSystem.js`
- `src/hunt/RespawnSystem.js`
- `src/hunt/mg/MGHitResolver.js`
- `src/core/main.js`
- `docs/Refactoring_Plan_God_Classes.md`
- `docs/Umsetzungsplan.md`

Neu (Zielbild, erwartete Splits):

- `src/entities/runtime/EntityRuntimeContext.js`
- `src/entities/runtime/EntityEventBus.js`
- `src/entities/systems/lifecycle/PlayerActionPhase.js`
- `src/entities/systems/lifecycle/PlayerCollisionPhase.js`
- `src/entities/systems/lifecycle/PlayerInteractionPhase.js`
- `src/entities/systems/RoundOutcomeSystem.js`

Hinweis: Dateinamen koennen waehrend 22.0 finalisiert werden, wenn bestehende Muster (`*System.js`, `*Ops.js`) im Detail geprueft sind.

## Architektur-Check

Bestehende Wiederverwendung:

- Hotpath-Systems sind bereits vorhanden (`ProjectileSystem`, `OverheatGunSystem`, `TrailSpatialIndex`, `PlayerInputSystem`).
- `main.js` nutzt bereits Fassade/Controller-Splits (`GameRuntimeFacade`, `MatchFlowUiController`, `GameDebugApi`).

Noch offene Architekturprobleme:

- `EntityManager` bietet viele private Delegations-Entry-Points fuer andere Systeme.
- `PlayerLifecycleSystem.updatePlayer()` vermischt Input-Aktionen, Kollision, Schaden, Portal und Pickup.
- Compatibility-Aliase in `EntityManager` und `Bot` halten Legacy-Zugriffe offen.

Entscheidung Reuse vs. Neuanlage:

- Reuse: vorhandene Systeme und Ops-Funktionen bleiben die technische Basis.
- Neu: kleine Runtime-Contract- und Phasenmodule, damit Abhaengigkeiten explizit werden.
- Kein Big-Bang: alte Fassade bleibt bis 22.5 kompatibel.

Risiko-Rating:

- Gesamt: **medium**
- Hoechstes Risiko: Verhaltensdrift in Kollision/Schaden/Respawn-Hotpaths.
- Gegenmassnahmen: phasenweise Splits, zielgerichtete Tests, kein gleichzeitiger API-Bruch.

## Dokumentationsauswirkungen (nach Umsetzung)

- `docs/ai_architecture_context.md` (Module + Runtime-Contracts)
- `docs/Refactoring_Plan_God_Classes.md` (aktiver Planstand)
- `docs/Umsetzungsplan.md` (Phase-Tracking)
- `docs/Testergebnisse_YYYY-MM-DD.md` (Verifikationsdelta)

## Phase 22.0 - Baseline und Contract-Freeze

- [x] 22.0.1 Baseline fuer Runtime-Hotpaths dokumentieren (`core`, `physics`, `roundstate`).
- [x] 22.0.2 Alle aktuellen `entityManager._...`-Nutzungen per `rg` inventarisieren.
- [x] 22.0.3 Ziel-Contractliste definieren: welche Zugriffe bleiben, welche werden ersetzt.
- [x] 22.0.4 Namens- und Verzeichniskonvention fuer neue Runtime-/Lifecycle-Module festlegen.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:roundstate`

Exit-Kriterien:

- Baseline dokumentiert.
- Kopplungsinventar liegt als Checkliste fuer 22.1-22.5 vor.

Abgeschlossen am: `2026-03-04`

### 22.0 Baseline (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, ca. `1.1m`)
- `npm run test:physics` -> PASS (`47 passed`, ca. `2.1m`, isolierter Lauf)
- `npm run smoke:roundstate` -> PASS (`ok: true`)

### 22.0.2 Inventar `entityManager._...` (Command-Freeze)

Command:

- `rg -n --no-heading "entityManager\\._[A-Za-z0-9_]+" src`

Trefferbild (gesamt: `39`):

- `src/entities/systems/PlayerLifecycleSystem.js`: `34`
- `src/hunt/RespawnSystem.js`: `3`
- `src/hunt/mg/MGHitResolver.js`: `2`

Member-Gruppen:

- Runtime-Temp/Fallback: `_tmpVec` (`5`), `_tmpVec2` (`5`), `_tmpDir` (`8`), `_tmpPrevPlayerPosition` (`1`), `_fallbackArenaCollision` (`1`)
- Actions/Feedback: `_useInventoryItem` (`1`), `_shootItemProjectile` (`2`), `_shootHuntGun` (`1`), `_notifyPlayerFeedback` (`3`)
- Damage/Lifecycle: `_emitHuntDamageEvent` (`3`), `_killPlayer` (`5`), `_bouncePlayerOnFoam` (`1`)
- Spawn: `_getPlanarSpawnLevel` (`1`), `_findSpawnPosition` (`1`), `_findSafeSpawnDirection` (`1`)

Guardrail ab 22.1:

- Keine neuen `entityManager._...`-Callsites ausserhalb dieses Inventars.
- Abbau erfolgt ausschliesslich ueber 22.1 bis 22.5.

### 22.0.3 Ziel-Contractliste (fuer 22.1-22.5)

| Aktueller Zugriff | Ziel-Contract ab 22.1 | Migrationsphase |
|---|---|---|
| `_tmpVec`, `_tmpVec2`, `_tmpDir`, `_tmpPrevPlayerPosition` | `EntityRuntimeContext.tempVectors.*` | 22.1/22.2 |
| `_fallbackArenaCollision` | `EntityRuntimeContext.constants.fallbackArenaCollision` | 22.2 |
| `_useInventoryItem`, `_shootItemProjectile`, `_shootHuntGun` | `EntityRuntimeContext.combat.*` | 22.1/22.2 |
| `_notifyPlayerFeedback` | `EntityEventBus.emitPlayerFeedback(...)` | 22.1 |
| `_emitHuntDamageEvent` | `EntityEventBus.emitHuntDamageEvent(...)` | 22.1 |
| `_killPlayer` | `EntityRuntimeContext.lifecycle.killPlayer(...)` | 22.1/22.2 |
| `_bouncePlayerOnFoam` | `EntityRuntimeContext.collision.bouncePlayerOnFoam(...)` | 22.2 |
| `_getPlanarSpawnLevel`, `_findSpawnPosition`, `_findSafeSpawnDirection` | `EntityRuntimeContext.spawn.*` | 22.1 |

Contract-Freeze:

- Bis inklusive 22.5 bleiben diese Legacy-Entry-Points in `EntityManager` kompatibel.
- Neue und migrierte Systeme konsumieren nur die neuen Runtime-Contracts.

### 22.0.4 Namens- und Verzeichniskonvention (fixiert)

- Runtime-Contracts liegen unter `src/entities/runtime/`.
- Lifecycle-Phasen liegen unter `src/entities/systems/lifecycle/`.
- Dateinamen:
  - Runtime: `EntityRuntimeContext.js`, `EntityEventBus.js`
  - Lifecycle: `PlayerActionPhase.js`, `PlayerCollisionPhase.js`, `PlayerInteractionPhase.js`
  - Outcome-Orchestrierung: `RoundOutcomeSystem.js`
- Suffix-Regeln:
  - `*System.js` fuer stateful Orchestrierung.
  - `*Phase.js` fuer teilbare Lifecycle-Pipelines.
  - `*Ops.js` nur fuer zustandsarme Helfer.
- Contract-APIs werden ohne fuehrenden `_` benannt; `_` bleibt auf private `EntityManager`-Compat intern begrenzt.

## Phase 22.1 - Entity Runtime Contract einziehen

- [x] 22.1.1 `EntityRuntimeContext` einziehen (temp vectors, players, arena access, callbacks).
- [x] 22.1.2 `HuntCombatSystem`, `RespawnSystem`, `MGHitResolver` auf Context statt private EntityManager-Felder umstellen.
- [x] 22.1.3 Event-Ausgaenge (`onPlayerDied`, `onHuntDamageEvent`, Feed) ueber `EntityEventBus` kapseln.
- [x] 22.1.4 `EntityManager` als Fassade behalten, aber direkte `_...`-Zugriffe reduzieren.

Verifikation:

- `npm run test:core`
- `npm run test:physics`

Exit-Kriterien:

- Keine neuen direkten Systemzugriffe auf `entityManager._...` in geaenderten Dateien.
- Verhalten von Kills/Feed/Damage unveraendert.

Abgeschlossen am: `2026-03-04`

### 22.1 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, ca. `55s`)
- `npm run test:physics` -> PASS (`47 passed`, ca. `2.0m`)
- `npm run docs:sync` -> PASS (`updated=0`, `missing=0`, `legacy=0`, `mojibake=0`)
- `npm run docs:check` -> PASS (`updated=0`, `missing=0`, `legacy=0`, `mojibake=0`)

## Phase 22.2 - PlayerLifecycle in Phasen trennen

- [x] 22.2.1 `PlayerActionPhase` extrahieren (Inventory, Item-Shoot, MG-Shoot, Recorder-Events).
- [x] 22.2.2 `PlayerCollisionPhase` extrahieren (Arena/Trail, Schaden, Foambounce, Kill-Entscheidungen).
- [x] 22.2.3 `PlayerInteractionPhase` extrahieren (Special Gates, Portale, Pickups).
- [x] 22.2.4 `PlayerLifecycleSystem` auf orchestrierende Reihenfolge reduzieren.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:selftrail`

Exit-Kriterien:

- `updatePlayer()` bleibt als Reihenfolge-Fassade erhalten, nicht als Monolith.
- Keine Regression in Trail-/Wall-/Portal-Kollisionen.

Abgeschlossen am: `2026-03-04`

### 22.2 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, ca. `55s`)
- `npm run test:physics` -> PASS (`47 passed`, ca. `3.0m`)
- `npm run smoke:selftrail` -> PASS (`failures: []`)
- `npm run docs:sync` -> PASS (`updated=0`, `missing=0`, `legacy=0`, `mojibake=0`)
- `npm run docs:check` -> PASS (`updated=0`, `missing=0`, `legacy=0`, `mojibake=0`)

## Phase 22.3 - Round/Setup Orchestrierung modularisieren

- [x] 22.3.1 Round-End-Ermittlung aus `EntityManager.update()` in `RoundOutcomeSystem` verschieben.
- [x] 22.3.2 Setup-/Spawn-Initialisierung an klaren Boundaries kapseln (Humans/Bots/Policy-Aufloesung).
- [x] 22.3.3 `clear()/dispose()`-Pfad auf konsistente Ownership pruefen und vereinheitlichen.

Verifikation:

- `npm run test:core`
- `npm run smoke:roundstate`

Exit-Kriterien:

- `EntityManager.update()` enthaelt nur Tick-Orchestrierung + delegierte Outcome-Entscheidung.
- Round-End-Flow und Respawn-Regeln bleiben stabil.

Abgeschlossen am: `2026-03-04`

### 22.3 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, ca. `53s`)
- `npm run smoke:roundstate` -> PASS (`ok: true`)
- `npm run docs:sync` -> PASS (`updated=0`, `missing=0`, `legacy=0`, `mojibake=0`)
- `npm run docs:check` -> PASS (`updated=0`, `missing=0`, `legacy=0`, `mojibake=0`)

## Phase 22.4 - Compatibility-Shims abbauen

- [x] 22.4.1 TrailSpatialIndex-Compat-Aliase in `EntityManager` auf aktive Nutzung pruefen.
- [x] 22.4.2 Nicht mehr benoetigte Aliase entfernen, verbleibende als explizite Schulden markieren.
- [x] 22.4.3 Bot-Legacy-Proxies (`_sensePhase*`-Bridge) auf minimale API reduzieren.

Verifikation:

- `npm run test:core`
- `npm run test:physics`

Exit-Kriterien:

- Verbleibende Compat-Shims sind bewusst und dokumentiert.
- Keine impliziten Legacy-Seitenpfade mehr in neuen Modulen.

Abgeschlossen am: `2026-03-04`

### 22.4 Verifikation (Stand 2026-03-04)

- `rg -n "entityManager\\.gridSize|entityManager\\.spatialGrid|_trailCollisionResult|_trailCollisionDebug"` -> keine aktiven Callsites ausser Definition.
- `rg -n "_sensePhase|_sensePhaseCounter" src tests` -> `_sensePhaseCounter` nur noch in `BotSensors*`; `Bot`-Bridge reduziert.
- `npm run test:core` -> PASS (`20 passed`, ca. `1.2m`)
- `npm run test:physics` -> PASS (`47 passed`, ca. `2.8m`)
- `npm run docs:sync` -> PASS (`updated=0`, `missing=0`, `legacy=0`, `mojibake=0`)
- `npm run docs:check` -> PASS (`updated=0`, `missing=0`, `legacy=0`, `mojibake=0`)

## Phase 22.5 - main.js API-Flaeche aufraeumen

- [x] 22.5.1 Reine Pass-Through-Methoden in `main.js` auf tatsaechlich benoetigte API reduzieren.
- [x] 22.5.2 Profil-/UI-Helfer weiter in vorhandene Controller/Facades verlagern.
- [x] 22.5.3 Debug- und Runtime-Einstiegspunkte dokumentieren (`window.GAME_INSTANCE`, DebugApi).

Verifikation:

- `npm run test:core`
- `npm run test:stress`
- `npm run build`

Exit-Kriterien:

- `main.js` bleibt Entry-Point, nicht Sammel-Proxy.
- Menue-/Match-/Debug-Flow unveraendert.

Abgeschlossen am: `2026-03-04`

### 22.5 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, ca. `1.0m`)
- `npm run test:stress` -> PASS (`13 passed`, ca. `1.6m`)
- `npm run build` -> PASS
- `npm run docs:sync` -> PASS (`updated=0`, `missing=0`, `legacy=0`, `mojibake=0`)
- `npm run docs:check` -> PASS (`updated=0`, `missing=0`, `legacy=0`, `mojibake=0`)

Runtime-/Debug-Einstiegspunkte (stabil dokumentiert):

- `window.GAME_INSTANCE` (Runtime-Instanz)
- `window.GAME_INSTANCE.debugApi` (`setRecorderFrameCaptureEnabled`, `captureBotBaseline`, `printBotValidationReport`, `getBotValidationMatrix`, `printBotTestProtocol`, `applyBotValidationScenario`)

## Phase 22.6 - Abschluss, Handover und Doku-Freeze

- [x] 22.6.1 Gesamtlauf-Verifikation fuer alle geaenderten Pfade durchfuehren.
- [x] 22.6.2 Architektur-/Plan-Doku aktualisieren.
- [x] 22.6.3 Offene Restschulden mit klaren Follow-ups im Masterplan erfassen.
- [x] 22.6.4 Dokumentations-Gate finalisieren.

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

- Phasen 22.0-22.6 vollstaendig abgehakt.
- Doku- und Teststatus konsistent.

Abgeschlossen am: `2026-03-04`

### 22.6 Verifikation (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`, ca. `55s`)
- `npm run test:physics` -> PASS (`47 passed`, ca. `2.5m`)
- `npm run test:stress` -> PASS (`13 passed`, ca. `1.5m`)
- `npm run smoke:roundstate` -> PASS (`ok: true`)
- `npm run smoke:selftrail` -> PASS (`failures: []`)
- `npm run build` -> PASS
- `npm run docs:sync` -> PASS (`updated=0`, `missing=0`, `legacy=0`, `mojibake=0`)
- `npm run docs:check` -> PASS (`updated=0`, `missing=0`, `legacy=0`, `mojibake=0`)

### 22.6 Re-Validation im V20 Carry-Over (Stand 2026-03-04)

- `npm run test:core` -> PASS (`20 passed`)
- `npm run test:physics` -> PASS (`47 passed`)
- `npm run test:stress` -> PASS (`13 passed`; einmaliger Timeout wurde per Re-Run stabil bestaetigt)
- `npm run smoke:roundstate` -> PASS (`ok: true`)
- `npm run smoke:selftrail` -> PASS (`failures: []`)
- `npm run build` -> PASS
- `npm run docs:sync` -> PASS
- `npm run docs:check` -> PASS

### V19 Restschulden (Follow-up erfasst)

- Legacy-Compat in `EntityManager`: Alias `gridSize`/`spatialGrid` bleibt als explizite Schuld markiert; Follow-up im Masterplan unter V20.
- Legacy-Compat in `Bot`: `_sensePhase`-Shim bleibt als explizite Schuld markiert; Follow-up im Masterplan unter V20.

## DoD fuer V19

- `EntityManager` und `PlayerLifecycleSystem` haben klar getrennte Verantwortungen.
- Runtime-Contracts sind explizit, statt private Feldkopplung.
- Hotpaths bleiben allocationsarm.
- Dokumentation und Tests sind gruen.
