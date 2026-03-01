# AI Architecture Context (Aktiv)

Stand: 2026-03-01

## 1. Architekturparadigma

- Engine: Three.js + Vanilla JavaScript (ES Modules)
- Struktur: Functional Core (`*Ops.js`) + Imperative Shell (Controller/Manager)
- Hauptverzeichnisse: `src/core`, `src/state`, `src/entities`, `src/ui`

## 2. Modul-Uebersicht

### 2.1 Core (`src/core`)

- `main.js`: App-Orchestrierung, Match-Lifecycle, Runtime-State-Anwendung
- `PlayingStateSystem.js`: kapselt den PLAYING-Updateablauf als eigenes System
- `Config.js`: zentrale Spielkonfiguration
- `GameLoop.js`: Update-/Render-Takt
- `Renderer.js`: Scene/Kamera/Render-Layer
- `InputManager.js`, `Audio.js`, `three-disposal.js`

### 2.2 State (`src/state`)

- `MatchSessionFactory.js`: Match-Initialisierung und Session-Assembly
- `RoundStateController.js` + `RoundStateControllerOps.js`: Tick-/Transition-Entscheidungen
- `RoundStateOps.js`: Pure Round/Match-End-Ableitung
- `RoundEndCoordinator.js`, `RoundRecorder.js`

### 2.3 Entities (`src/entities`)

- `Arena.js`: Bounds/Kollisionen, Fast-Collision-Pfade
- `EntityManager.js`: Pipeline-Orchestrierung fuer Input, Lifecycle, Projectile/Trail-Kollisionen
- `systems/PlayerInputSystem.js`: Human/Bot-Input-Aufloesung
- `systems/PlayerLifecycleSystem.js`: Spieler-Tick, Arena-/Trail-/Portal-/Powerup-Lifecycle
- `ai/BotPolicyTypes.js`, `ai/BotPolicyRegistry.js`: Policy-Vertrag und Registry-Fabrik
- `ai/RuleBasedBotPolicy.js`: Default-Policy-Adapter auf `Bot.js`
- `ai/BotSensingOps.js`, `ai/BotDecisionOps.js`, `ai/BotActionOps.js`: modulare KI-Ops
- `Player.js`, `Bot.js`, `Trail.js`, `Powerup.js`, `Particles.js`
- `vehicle-registry.js` + Fahrzeug-Mesh-Module
- `MapSchema.js`, `CustomMapLoader.js`, `GeneratedLocalMaps.js`

### 2.4 UI (`src/ui`)

- `UIManager.js`: Menues und Bedienfluss
- `HUD.js`: Ingame-Overlay
- `SettingsStore.js`, `Profile*Ops.js`, `MatchUiStateOps.js`

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
