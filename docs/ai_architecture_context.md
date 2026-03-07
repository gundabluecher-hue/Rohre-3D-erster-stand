# AI Architecture Context (Aktiv)

Stand: 2026-03-07

## 1. Architekturparadigma

- Engine: Three.js + Vanilla JavaScript (ES Modules)
- Struktur: Functional Core (`*Ops.js`) + Imperative Shell (Controller/Manager)
- Hauptverzeichnisse: `src/core`, `src/state`, `src/entities`, `src/ui`

## 2. Modul-Uebersicht

### 2.1 Core (`src/core`)

- `main.js`: App-Orchestrierung, Match-Lifecycle, Runtime-State-Anwendung
- `PlayingStateSystem.js`: kapselt den PLAYING-Updateablauf als eigenes System
- `RuntimeDiagnosticsSystem.js`: Runtime-Monitoring/FPS/Quality-Delegation aus `main.js`
- `Config.js`: zentrale Spielkonfiguration
- `GameLoop.js`: Update-/Render-Takt
- `Renderer.js`: Render-Fassade mit Subsystemen (`renderer/CameraRigSystem.js`, `RenderViewportSystem.js`, `SceneRootManager.js`, `RenderQualityController.js`)
- `InputManager.js`, `Audio.js`, `three-disposal.js`

### 2.2 State (`src/state`)

- `MatchSessionFactory.js`: Match-Initialisierung und Session-Assembly
- `RoundStateController.js` + `RoundStateControllerOps.js`: Tick-/Transition-Entscheidungen
- `RoundStateOps.js`: Pure Round/Match-End-Ableitung
- `RoundEndCoordinator.js`, `RoundRecorder.js` (Store-Fassade auf `recorder/RoundEventStore.js`, `RoundMetricsStore.js`, `RoundSnapshotStore.js`)
- `validation/BotValidationService.js`, `validation/BotValidationMatrix.js`: entkoppelte Baseline-/Validation-Pfade fuer Debug-Workflows

### 2.3 Entities (`src/entities`)

- `Arena.js`: Bounds/Kollisionen, Fast-Collision-Pfade
- `EntityManager.js`: Runtime-Orchestrierung auf Basis von `runtime/EntityRuntimeAssembler.js`
- `systems/ProjectileSystem.js`, `systems/TrailSpatialIndex.js`: modulare Projectile-/Trail-Hotpaths
- `systems/trails/TrailSegmentRegistry.js`, `TrailCollisionQuery.js`, `TrailCollisionDebugTelemetry.js`: Trail-Registry/Query/Debug intern getrennt
- `systems/PlayerInputSystem.js`: Human/Bot-Input-Aufloesung
- `systems/PlayerLifecycleSystem.js`: Spieler-Tick, Arena-/Trail-/Portal-/Powerup-Lifecycle
- `arena/PortalGateSystem.js`: Orchestrator-Fassade auf `arena/portal/PortalLayoutBuilder.js`, `PortalRuntimeSystem.js`, `SpecialGateRuntime.js`
- `ai/BotPolicyTypes.js`, `ai/BotPolicyRegistry.js`: Policy-Vertrag und Registry-Fabrik
- `ai/RuleBasedBotPolicy.js`: Default-Policy-Adapter auf `Bot.js`
- `hunt/HuntBotPolicy.js`: Hunt-spezifische Bot-Policy (MG/Rocket/HP-Verhalten)
- `ai/BotSensingOps.js`, `ai/BotDecisionOps.js`, `ai/BotActionOps.js`: modulare KI-Ops
- `Player.js`, `Bot.js`, `Trail.js`, `Powerup.js`, `Particles.js`
- `vehicle-registry.js` + Fahrzeug-Mesh-Module
- `MapSchema.js`, `CustomMapLoader.js`, `GeneratedLocalMaps.js`

### 2.4 UI (`src/ui`)

- `UIManager.js`: Menues, selektive Settings-Sync (`syncByChangeKeys`), Menu-Context und Status-Toast
- `HUD.js`: Ingame-Overlay
- `MatchFlowUiController.js`, `KeybindEditorController.js`: UI-Flow/Settings-Controller-Splits aus `main.js`
- `UISettingsSyncMap.js`: Zuordnung `changedKey -> UI-Sync-Teilfunktion`
- `SettingsChangeKeys.js`, `SettingsChangeSetOps.js`: stabiler Key-Vertrag und Set-Operationen fuer Event-Coalescing
- `MenuController.js`: emittiert typisierte `SETTINGS_CHANGED`-Payloads und coalesct `input`-Storms pro Frame
- `SettingsStore.js`, `Profile*Ops.js`, `MatchUiStateOps.js`

### 2.5 Hunt (`src/hunt`)

- `HuntMode.js`, `HuntConfig.js`, `HealthSystem.js`: Game-Mode + HP/Shield-Logik
- `OverheatGunSystem.js`, `RocketPickupSystem.js`, `DestructibleTrail.js`: Hunt-Kampfpfade
- `HuntHUD.js`, `ScreenShake.js`: Hunt-UI/Feedback
- `RespawnSystem.js`, `HuntScoring.js`: Respawn + erweitertes Hunt-Scoring

## 3. State-Namen (aktuell)

- Laufender Spielzustand: `PLAYING`
- Rundenende: `ROUND_END`
- Matchende: `MATCH_END`

## 4. Entwicklungsregeln

1. `*Ops.js` als pure Logik behandeln (keine versteckten Side Effects).
2. Keine Magic Numbers statt `Config`.
3. Lifecycle-Disposal immer vollstaendig ausfuehren.
4. Kollision/Trail/Bot-Hotpaths auf Performance und geringe Allocation optimieren.
5. Bot-KI nur ueber Policy-Schnittstelle anbinden; keine direkte Runtime-Kopplung von `EntityManager` auf konkrete KI-Klassen.

## 5. Verifikation

- Testauswahl ueber `.agents/test_mapping.md`
- Danach immer Doku-/Prozess-Check ueber `npm run docs:sync` und `npm run docs:check`

## 6. Bot-Bridge Vertrag V1 (eingefroren am 2026-03-03)

- Observation:
  - `schemaVersion`: `v1`
  - `length`: `40`
  - `0..19`: Core-Features (u. a. `WALL_DISTANCE_FRONT=3`, `MODE_ID=18`)
  - `20..39`: feste Item-Slots (`ITEM_SLOT_00..ITEM_SLOT_19`)
- Wertebereiche:
  - Ratio: `0..1`
  - Signed: `-1..1`
  - Bool: `0|1`
  - `MODE_ID`: `0=classic`, `1=hunt`
- Action-Contract V1:
  - Bool-Flags: `pitchUp`, `pitchDown`, `yawLeft`, `yawRight`, `boost`, `shootItem`, `shootMG`
  - Index-Felder: `useItem`, `shootItemIndex` im Bereich `-1..19`
- Sicherheitsregel:
  - Bei Observation-/Action-Contract-Verletzung wird die Ausgabe neutralisiert und auf `rule-based` zurueckgefallen.
- V1 Nicht-Ziele:
  - keine History-Frames, keine Reward-/Telemetriefelder im Runtime-Vektor, keine verpflichtende Netzwerk-Bridge.

## 7. Runtime-Policy-Auswahl (Stand 2026-03-03)

- `SettingsManager` fuehrt `botPolicyStrategy` mit Default `auto`.
- `RuntimeConfig` normalisiert Strategie (`rule-based|bridge|auto`) und loest deterministisch `bot.policyType` nach aktivem Modus auf.
- `MatchSessionFactory` gibt `runtimeConfig` plus aufgeloesten `botPolicyType` an `EntityManager.setup(...)` weiter.
- `EntityManager` nutzt einen klaren Resolver (`requested > runtime > mode-fallback`) statt Hunt-Health-Hack.
