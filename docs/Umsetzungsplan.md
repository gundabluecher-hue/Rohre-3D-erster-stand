# Umsetzungsplan (Master)

Dies ist der konsolidierte Plan fuer anstehende und laufende Implementierungen.
Neue Findings aus dem Analysebericht fliessen hier ein.

> Abgeschlossene Phasen 1-10 siehe [Archiv](archive/Umsetzungsplan_Archiv_Phase1-10.md).
> Abgeschlossene Phasen 11-15 siehe [Archiv](archive/Umsetzungsplan_Archiv_Phase11-15.md).
> Abgeschlossene Phase 17 siehe [Archiv](archive/Umsetzungsplan_Archiv_Phase17.md).
> Abgeschlossene Referenzplaene siehe `docs/archive/`.

## Status-Uebersicht

- [ ] Offen
- [/] In Bearbeitung
- [x] Abgeschlossen

---

## Prioritaeten (Triage)

**Wichtig:**

- Keine offenen kritischen Punkte.

**Mittel:**

- Weitere Dummy-Tests schrittweise durch echte Integritaetstests ersetzen.

**Unwichtig/Backlog:**

- Bundle-Groesse weiter optimieren (Code-Splitting), auch wenn aktuelles Warnlimit keine Build-Warnung mehr erzeugt.

---

## Produkt- und Gameplay-Verbesserungen (Backlog, Stand: 2026-03-03)

- Entscheidung: Aus der Vorschlagsliste vom 2026-03-03 sind Punkte `4`, `5`, `6`, `7`, `8`, `9`, `11`, `13`, `15`, `16` fuer den Umsetzungsplan freigegeben.
- Punkt `10` (Challenge-/Achievement-Idee) wurde auf Wunsch archiviert: `docs/archive/Idee_10_Achievements_Challenges.md`.
- [ ] V4 Treffer-/Schadensfeedback verbessern
  - Klarere Audio-/VFX-Signale bei MG-, Raketen- und Trail-Treffern sowie bei Schildabsorption.
  - Zielpfade: `src/hunt/HuntHUD.js`, `src/core/Audio.js`, `src/entities/systems/ProjectileSystem.js`.
- [ ] V5 Hunt-Mode Feintuning datenbasiert abschliessen
  - TTK, Overheat-Fenster, Respawn-Timer und Pickup-Spawns auf Telemetrie und Matchdaten abstimmen.
  - Zielpfade: `src/core/Config.js`, `src/hunt/HuntConfig.js`, `src/hunt/RespawnSystem.js`, `src/hunt/RocketPickupSystem.js`.
- [x] V6 Menue-Schnellpresets einfuehren (abgeschlossen 2026-03-06)
  - Presets wie `Arcade`, `Competitive`, `Chaos` mit sauberem Sync in Settings/UI.
  - Erweiterter Referenzplan (inkl. Menue-Umbau/Multiplayer-Stub/Developer-Modus): `docs/Feature_Menu_Umbau_V26_3.md`.
  - Zielpfade: `src/ui/MenuController.js`, `src/ui/UIManager.js`, `src/core/SettingsManager.js`.
- [ ] V7 Profile-UX ausbauen
  - Profil duplizieren, Import/Export und Standardprofil-Markierung ergaenzen.
  - Zielpfade: `src/ui/SettingsStore.js`, `src/ui/Profile*Ops.js`, `src/ui/MenuController.js`.
- [ ] V8 Post-Match-Statistiken erweitern
  - Kill/Death, Trefferquote, Ueberlebenszeit und Todesursachen pro Runde/Match sichtbar machen.
  - Zielpfade: `src/ui/HUD.js`, `src/ui/MatchFlowUiController.js`, `src/state/RoundRecorder.js`.
- [ ] V9 Replay/Ghost fuer letzte Runde
  - Leichten Replay-/Ghost-Pfad fuer Lern- und Highlight-Momente aufbauen.
  - Zielpfade: `src/state/RoundRecorder.js`, `src/core/main.js`, `src/ui/MatchFlowUiController.js`.
- [ ] V11 Mehr Map-Varianz ueber GLB/GLTF-Maps
  - Map-Pool um externe GLB-Umgebungen erweitern, inklusive Collider/Fallback-Pfad.
  - Referenz: `docs/Feature_GLB_Map_Loader.md`.
- [ ] V13 Performance-Hotspot `maze` gezielt optimieren
  - Draw-Calls per Batching/Instancing/LOD reduzieren, ohne Gameplay-Regression.
  - Zielpfade: `src/entities/Arena.js`, `src/core/Renderer.js`, `src/core/Config.js`.
- [ ] V15 Telemetrie-Dashboard fuer Balancing
  - Winrate-, Survival-, Stuck- und Schadensmetriken pro Mode/Map/Bot-Level auswertbar machen.
  - Zielpfade: `scripts/`, `data/`, `docs/archive/tests/Testergebnisse_*.md`.
- [ ] V16 Event-Playlist/Fun-Modes
  - Rotierende Spezialregeln als zeitlich limitierte Modi fuer Abwechslung und Retention.
  - Zielpfade: `src/core/Config.js`, `src/core/main.js`, `src/ui/MenuController.js`.
- [ ] V24 Performance-Flaschenhaelse systematisch abbauen
  - Fokus: CPU/GPU/GC-Hotspots in Bot-Sensing, Trail-Kollision, MG-Tracer, Portal-Rendering und HUD-DOM.
  - Referenzplan: `docs/Feature_Performance_Flaschenhaelse_Abarbeitung.md`.
- [x] V25 Weitere Modularisierung ausserhalb Phase 24 (abgeschlossen 2026-03-05)
  - Fokus: Match-/Entity-Orchestrierung, Arena-Build-Pipeline, Map-Datenpfad, Kamera-Rig, Settings-Contracts, Test-Suite-Split.
  - Referenzplan: `docs/Feature_Modularisierung_V25_Ausserhalb_Phase24.md`.
- [x] V18 Single-Agent-Durchlauf fuer weitere Modularisierung (ohne Stop)
  - Fokus: `OverheatGunSystem`, `ProjectileSystem`, `main.js`, `Bot.js`, `MenuController` in sequenziellen Phasen fuer einen Agenten.
  - Referenzplan: `docs/archive/Feature_Modularisierung_SingleAgent_Durchlauf.md`.
- [x] V19 Restentkopplung Runtime-Orchestrierung (EntityManager/Lifecycle)
  - Fokus: Runtime-Contracts, Lifecycle-Phasen, Round-Outcome-Split und Abbau verbleibender Compat-Shims.
  - Referenzplan: `docs/archive/Feature_Modularisierung_V19_Restentkopplung.md`.
- [x] V20 Single-Agent No-Stop Tiefenmodularisierung (Assembler/Recorder/Renderer/AI/Portal/Trail) (abgeschlossen 2026-03-04)
  - Fokus: no-stop Durchlauf fuer nachgelagerte Tiefenentkopplung.
  - Referenzplan: `docs/archive/Feature_Modularisierung_V20_SingleAgent_NoStop.md`.

---

## Single-Agent Block V18 (Stand: 2026-03-04)

- Rollenmodell:
  - Ein Agent setzt alle Phasen `21.x` strikt sequenziell um.
  - Keine Zwischenfreigaben durch zweite Instanz; Phase wechselt nur bei erfuellten Exit-Kriterien.

- [x] 21.0 Baseline, Scope und Guardrails
- [x] 21.1 OverheatGunSystem Split (State, HitResolver, TracerFx)
- [x] 21.2 ProjectileSystem Split (StatePool, SimulationOps, HitResolver)
- [x] 21.3 main.js Split (Bootstrap, RuntimeFacade, DebugApi)
- [x] 21.4 Bot-Fassade vereinfachen (Proxy-Abbau + SensorsFacade)
- [x] 21.5 MenuController Listener-Split (Gameplay/Profile/Controls)
- [x] 21.6 Abschluss, Stabilisierung, Doku-Freeze (`docs:sync`, `docs:check`)

---

## Single-Agent Block V19 (Stand: 2026-03-04)

- Rollenmodell:
  - Ein Agent setzt die Phasen `22.x` sequenziell um.
  - Wechsel zur naechsten Phase nur nach bestandener Teil-Verifikation.

- [x] 22.0 Baseline und Contract-Freeze
- [x] 22.1 Entity Runtime Contract einziehen
- [x] 22.2 PlayerLifecycle in Phasen trennen
- [x] 22.3 Round/Setup Orchestrierung modularisieren
- [x] 22.4 Compatibility-Shims abbauen
- [x] 22.5 main.js API-Flaeche aufraeumen
- [x] 22.6 Abschluss, Handover und Doku-Freeze (`docs:sync`, `docs:check`)

---

## V19 Follow-up Schulden (Stand: 2026-03-04)

- [x] Entferne verbleibende `EntityManager`-Legacy-Aliase `gridSize`/`spatialGrid` in V20 `23.9` (abgeschlossen 2026-03-04).
- [x] Entferne verbleibenden `Bot`-Legacy-Shim `_sensePhase` in V20 `23.7` (abgeschlossen 2026-03-04).

## V20 Follow-up Schulden (Stand: 2026-03-04)

- Keine neuen offenen Restschulden aus dem no-stop Durchlauf `23.0` bis `23.10` identifiziert.

---

## Single-Agent Block V20 (Stand: 2026-03-04)

- Rollenmodell:
  - Ein Agent setzt die Phasen `23.x` strikt sequenziell ohne Stop um.
  - Wechsel zur naechsten Phase nur nach bestandener Teil-Verifikation.

- [x] 23.0 Baseline und Carry-Over-Freeze (abgeschlossen 2026-03-04)
- [x] 23.1 main.js API-Aufraeumen (V19 Carry-Over Teil 1) (abgeschlossen 2026-03-04)
- [x] 23.2 V19-Abschluss und Gate-Freeze (V19 Carry-Over Teil 2) (abgeschlossen 2026-03-04)
- [x] 23.3 Entity Runtime Assembler (abgeschlossen 2026-03-04)
- [x] 23.4 RoundRecorder in Stores splitten (abgeschlossen 2026-03-04)
- [x] 23.5 Validation-Service von Recorder entkoppeln (abgeschlossen 2026-03-04)
- [x] 23.6 Renderer in Subsysteme splitten (abgeschlossen 2026-03-04)
- [x] 23.7 AI-Wahrnehmung vereinheitlichen (abgeschlossen 2026-03-04)
- [x] 23.8 Portal/Gate Runtime modularisieren (abgeschlossen 2026-03-04)
- [x] 23.9 TrailSpatialIndex intern splitten (abgeschlossen 2026-03-04)
- [x] 23.10 Abschluss, Handover und Doku-Freeze (`docs:sync`, `docs:check`) (abgeschlossen 2026-03-04)

---

## Single-Agent Block V24 (Stand: 2026-03-05)

- Rollenmodell:
  - Ein Agent setzt die Phasen `24.x` strikt sequenziell um.
  - Wechsel zur naechsten Phase nur nach bestandenem Phasen-Gate.

- [x] 24.0 Baseline-Freeze und Messprotokoll (abgeschlossen 2026-03-05)
- [x] 24.1 Quick Win: Observation-Build nur bei Bedarf (abgeschlossen 2026-03-05)
- [x] 24.2 Observation-Wall-Probing budgetieren (abgeschlossen 2026-03-05)
- [x] 24.3 Trail-Kollision deduplizieren und Sweep-Kosten senken (abgeschlossen 2026-03-05)
- [x] 24.4 MG-Tracer pooling und Hit-Sampling straffen (abgeschlossen 2026-03-05)
- [x] 24.5 Portal/Gate Renderkosten reduzieren (abgeschlossen 2026-03-05)
- [x] 24.6 HUD/DOM Runtime-Updates weiter entkoppeln (abgeschlossen 2026-03-05)
- [x] 24.7 Abschluss-Gate, Regression und Doku-Freeze (`docs:sync`, `docs:check`) (abgeschlossen 2026-03-05)

---

## Single-Agent Block V25 (abgeschlossen, Stand: 2026-03-05)

- Rollenmodell:
  - Ein Agent setzt die Phasen `25.x` strikt sequenziell um.
  - Phase `25.x` darf nur Module enthalten, die nicht in `24.1` bis `24.6` liegen.
  - Wechsel zur naechsten Phase nur nach bestandenem Teil-Gate.

- [x] 25.0 Baseline + Non-Overlap-Freeze (abgeschlossen 2026-03-05)
- [x] 25.1 Match-Lifecycle-Orchestrierung entkoppeln (abgeschlossen 2026-03-05)
- [x] 25.2 EntityManager in Setup/Spawn/Tick-Pipelines schneiden (abgeschlossen 2026-03-05)
- [x] 25.3 Arena-Build-Pipeline modularisieren (Cache + Compile-Stufen) (abgeschlossen 2026-03-05)
- [x] 25.4 Map-Datenpfad modularisieren (Presets + Schema + Loader) (abgeschlossen 2026-03-05)
- [x] 25.5 CameraRigSystem in Strategien zerlegen (Mode/Collision/Shake) (abgeschlossen 2026-03-05)
- [x] 25.6 Settings-/RuntimeConfig-Contracts vereinheitlichen (abgeschlossen 2026-03-05)
- [x] 25.7 Test-Suite modularisieren (Physics/AI/Hunt getrennt) (abgeschlossen 2026-03-05)
- [x] 25.8 Abschluss-Gate, Regression und Doku-Freeze (`docs:sync`, `docs:check`) (abgeschlossen 2026-03-05)

- Kurznotiz 2026-03-05 (25.0):
  - Scope-Freeze aktiv: keine Bearbeitung der 24.1-24.6 Module (`PlayerInputSystem`, Observation-/Trail-/MG-/Portal-/HUD-Hotpaths).
  - Lifecycle-Baseline in `tmp/perf_phase25_0_lifecycle_baseline.json`: `domToGameInstanceMs=320`, `startMatchLatencyMs=5179.20`, `returnToMenuLatencyMs=18.20`.
- Kurznotiz 2026-03-05 (25.1):
  - Match-Lifecycle entkoppelt in Session-Orchestrator + Transition-Ops + Feedback-Adapter; `MatchFlowUiController` schlanker.
  - Phasen-Gates bestanden: `test:core`, `smoke:roundstate`, `test:stress`.
- Kurznotiz 2026-03-05 (25.2):
  - `EntityManager` Setup-/Spawn-/Tick-Pfade in `EntitySetupOps`, `EntitySpawnOps`, `EntityTickPipeline` ausgelagert; Verdrahtung ueber `EntityRuntimeAssembler`.
  - Phasen-Gates bestanden: `test:core`, `test:physics`.
- Kurznotiz 2026-03-05 (25.3):
  - Arena-Build in Cache (`ArenaBuildResourceCache`) + Compile-Stages (`ArenaGeometryCompilePipeline`) gesplittet, inkl. Rebuild-Signatur-Policy.
  - Phasen-Gates bestanden: `test:core`, `test:physics`, `test:gpu`.
- Kurznotiz 2026-03-05 (25.4):
  - Map-Datenpfad getrennt in Preset-Themenmodule + MapSchema-Ops (`Migration/Sanitize/Runtime`) + Loader-Resolver fuer Fallback/Warnungen.
  - Phasen-Gates bestanden: `test:core`, `test:physics`.
- Kurznotiz 2026-03-05 (25.5):
  - Camera-Rig gesplittet in Mode-/Collision-/Shake-Strategien; Collision-Pruefung mit bewegungs- und modebasiertem Recheck-Cache.
  - Phasen-Gates bestanden: `test:core`, `test:physics`, `test:gpu`.
- Kurznotiz 2026-03-05 (25.6):
  - Shared Contract fuer Settings/RuntimeConfig (`SettingsRuntimeContract`) zentralisiert Limits, Clamping und Controls-Normalisierung.
  - Phasen-Gates bestanden: `test:core`, `test:stress`.
- Kurznotiz 2026-03-05 (25.7):
  - Physics-Suite aufgeteilt in `physics-core`, `physics-hunt`, `physics-policy` plus neue Teil-Skripte fuer gezielte Regressionen.
  - Phasen-Gates bestanden: `test:physics:core`, `test:physics:hunt`, `test:physics:policy`, `test:core`, `test:physics`.
- Kurznotiz 2026-03-05 (25.8):
  - Abschluss-Gates bestanden: `test:core`, `test:physics`, `test:gpu`, `test:stress`, `docs:sync`, `docs:check`.
  - Lifecycle-Deltas ggü. 25.0-Baseline: `domToGameInstance 320.00 -> 70.30ms`, `startMatch 5179.20 -> 1810.00ms`, `returnToMenu 18.20 -> 31.10ms`.
  - Kamera-Pfad-Probe (inferenzbasiert): `resolveCalls=240`, `collisionChecks=1`, geschaetzte vermiedene Checks `239 (~99.58%)`.

---

## Single-Agent Block V26: Gameplay & Features (geplant, Stand: 2026-03-05)

- Rollenmodell:
  - Umsetzung der aus dem Backlog freigegebenen Gameplay-Punkte.
  - Iterativer Durchlauf mit Fokus auf Spielgefuehl und Polish.

- [ ] 26.0 Baseline-Freeze und Gameplay-Metriken erfassen
- [ ] 26.1 V4 Treffer-/Schadensfeedback (Audio & VFX)
  - [ ] 26.1.1 Audio-Signale fuer MG, Raketen und Schild implementieren
  - [ ] 26.1.2 VFX-Signale (Partikel/Flashes) bei Treffern ausbauen
- [ ] 26.2 V5 Hunt-Mode Feintuning
  - [ ] 26.2.1 TTK und Overheat-Werte basierend auf Testdaten anpassen
  - [ ] 26.2.2 Respawn- und Pickup-Logik verfeinern
- [x] 26.3 V6 Menue-Umbau (modular, Multiplayer-ready, Developer-Modus) (abgeschlossen 2026-03-06)
  - Referenzplan: `docs/Feature_Menu_Umbau_V26_3.md`.
  - Produktentscheidungen fixiert (2026-03-05): Multiplayer als Hauptpunkt, Developer-Modus owner-only mit spaeterer Sperroption, Presets getrennt in `fixed` (owner) und `open` (spielerbasiert).
  - [x] 26.3.0 Baseline, UX-Freeze und Migrationsleitplanken (abgeschlossen 2026-03-05)
  - [x] 26.3.1 Menue-Schema und Panel-Registry einfuehren (abgeschlossen 2026-03-05)
  - [x] 26.3.2 Navigation aus UIManager entkoppeln (abgeschlossen 2026-03-05)
  - [x] 26.3.3 Schnellpreset-System produktiv aufbauen (`Arcade`, `Competitive`, `Chaos`) (abgeschlossen 2026-03-05)
  - [x] 26.3.4 Multiplayer-Menuepfad als anbindbare Bridge vorbereiten (abgeschlossen 2026-03-05)
  - [x] 26.3.5 Developer-Modus (Schrift/Themes, Fixed-Preset, Dev-Hinweise) (abgeschlossen 2026-03-05)
  - [x] 26.3.6 MenuController-Events in Feature-Bindings weiter aufteilen (abgeschlossen 2026-03-05)
  - [x] 26.3.7 HTML/CSS-Komposition modernisieren (anpassbar, kompatibel) (abgeschlossen 2026-03-05)
  - [x] 26.3.8 Testausbau fuer neue Menuepfade (abgeschlossen 2026-03-06)
  - [x] 26.3.9 Abschluss-Gate, Doku-Freeze und Restrisiken (abgeschlossen 2026-03-06)
  - Kurznotiz 2026-03-06: Menu-Contracts (`menu-state.v1`, `menu-controller.v1`, `lifecycle.v1`, `menu-compatibility.v1`) aktiv; Access-Guards und Preset-Typtrennung (`fixed/open`) in Core+Stress abgesichert.
- [ ] 26.4 V9 Replay/Ghost-System fuer die letzte Runde aufbauen
- [ ] 26.5 V11 GLB-Map Loader Integration (Erweiterte Map-Varianz)
- [ ] 26.6 V16 Event-Playlist / Fun-Modes Mechanik testen
- [x] 26.7 Cinematic Kamera & Auto-Recording Pipeline vorbereiten (Teil von V29) (abgeschlossen 2026-03-05)
  - Referenzplan: `docs/Feature_Cinematic_Camera_V29.md`.
  - Kann parallel oder im Nachgang zu 26.3 eingefuegt werden.
  - Non-Overlap: V29 besitzt Kamera/Recording-Module; V26.3 besitzt Menue-/DOM-Module. Shared nur ueber Lifecycle-Events in `main.js`.
  - Zielpfade: `src/core/MediaRecorderSystem.js`, `src/entities/systems/CinematicCameraSystem.js`.
- [ ] 26.8 Abschluss-Gate, Playtest und Doku-Freeze (`docs:sync`, `docs:check`)

---

## Single-Agent Block V29 (abgeschlossen, Stand: 2026-03-05)

- Rollenmodell:
  - Ein Agent setzt die Phasen `29.x` strikt sequenziell ohne Stop um.
  - V26.3-Guardrails gelten: keine DOM-UI/MenuController/UIManager-Aenderungen.

- [x] 29.0 Baseline-Verifikation & Canvas-Probe (abgeschlossen 2026-03-05)
- [x] 29.1 Implementierung `MediaRecorderSystem` (abgeschlossen 2026-03-05)
- [x] 29.2 Implementierung `CinematicCameraSystem` (abgeschlossen 2026-03-05)
- [x] 29.3 Lifecycle-Anbindung (Auto-Start/Stop) (abgeschlossen 2026-03-05)
- [x] 29.4 Abschluss-Gate, Regression & Doku-Freeze (`docs:sync`, `docs:check`) (abgeschlossen 2026-03-05)

- Kurznotiz 2026-03-05 (29.0):
  - Runtime-Probe fuer `captureStream`/`MediaRecorder` als Support-State in `MediaRecorderSystem` verankert.
  - Lifecycle-Contract auf `lifecycle.v1` festgelegt (`match_started`, `match_ended`, `menu_opened`, optional `recording_requested`).
- Kurznotiz 2026-03-05 (29.1):
  - Neues `src/core/MediaRecorderSystem.js` kapselt Stream/Recorder-Lifecycle inkl. MIME-Fallback und Export-Metadaten.
- Kurznotiz 2026-03-05 (29.2):
  - Neues `src/entities/systems/CinematicCameraSystem.js` implementiert blendbaren Third-Person-Cinematic-Layer.
  - Integration isoliert in `src/core/renderer/CameraRigSystem.js`.
- Kurznotiz 2026-03-05 (29.3):
  - Auto-Recording an Match-Lifecycle in `src/state/MatchLifecycleSessionOrchestrator.js` gekoppelt.
  - Menu-/DOM-Pfade unveraendert; keine Aenderung an `src/ui/UIManager.js` oder `src/ui/MenuController.js`.
- Kurznotiz 2026-03-05 (29.4):
  - Gates bestanden: `test:core`, `test:physics`, `test:gpu`, `smoke:roundstate`, `build`, `docs:sync`, `docs:check`.

---

## Single-Agent Block V27: Profile, Statistiken & UI (geplant, Stand: 2026-03-05)

- Rollenmodell:
  - Umsetzung der erweiterten Profil-, UI- und Statistik-Features.

- [ ] 27.0 Baseline-Freeze und UI-Markup-Analyse
- [ ] 27.1 V7 Profile-UX Ausbau
  - [ ] 27.1.1 Duplizieren und Import/Export-Funktion
  - [ ] 27.1.2 Standardprofil-Markierung ergaenzen
- [ ] 27.2 V8 Post-Match-Statistiken
  - [ ] 27.2.1 Datenaggregator fuer Round/Match-Stats ausbauen
  - [ ] 27.2.2 UI-Overlay fuer vertiefte Statistiken am Rundenende
- [ ] 27.3 V15 Telemetrie-Dashboard fuer iteratives Balancing
- [ ] 27.4 Abschluss-Gate, UI-Verifikation und Doku-Freeze (`docs:sync`, `docs:check`)

---

## Single-Agent Block V28: Architektur & Performance (geplant, Stand: 2026-03-05)

- Rollenmodell:
  - Fokus auf Aufloesung von "God-Classes" und tiefen Core-Optimierungen.

- [ ] 28.0 Baseline-Freeze und Regression-Setup
- [ ] 28.1 Player "God Class" Refactoring
  - [ ] 28.1.1 Three.js Rendering in `PlayerView` auslagern
  - [ ] 28.1.2 Input-Handling in `PlayerController` isolieren
- [ ] 28.2 Bot "God Class" Refactoring
  - [ ] 28.2.1 Rendering in `BotView` kapseln
  - [ ] 28.2.2 Sensing/Probing-Logik fuer kuenftiges ML-Training abstrahieren
- [ ] 28.3 V13 Performance-Hotspot 'maze' (Draw-Calls / Batching optimieren)
- [ ] 28.4 Abschluss-Gate, Performance-Metrics pruefen und Doku-Freeze (`docs:sync`, `docs:check`)
