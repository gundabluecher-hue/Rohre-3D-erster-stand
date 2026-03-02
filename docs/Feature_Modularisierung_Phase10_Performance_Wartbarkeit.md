# Feature: Phase 10 - Vertiefte Modularisierung fuer Performance und Wartbarkeit

Stand: 2026-03-02

## Ziel

Das Spiel wird in kleinen, sicheren Schritten weiter modularisiert, damit:

1. Hotpaths klar getrennt und messbar optimierbar sind.
2. `main.js`, `EntityManager.js`, `Arena.js` und `Bot.js` deutlich wartbarer werden.
3. die KI bei Folge-Tasks pro Phase nur wenige, klar abgegrenzte Dateien anfassen muss.

## Leitregeln pro Phase

1. Pro Phase nur ein Schwerpunkt, keine Mischaufgaben.
2. Maximal 2-5 produktive Dateien anfassen.
3. Verhalten nicht aendern, wenn im Phasenziel nicht explizit erlaubt.
4. Am Phasenende immer:
   - Tests gemaess `.agents/test_mapping.md`
   - `npm run docs:sync`
   - `npm run docs:check`
5. Am Phasenende den angegebenen "Naechster-Chat-Prompt" verwenden.

## Fortschrittsboard

- [x] 10.1 Core Runtime Loop final entkoppeln (Erledigt: 2026-03-01)
- [x] 10.2 UI-Verantwortung konsolidieren (UIManager vs MenuController) (Erledigt: 2026-03-01)
- [x] 10.3 HUD- und Crosshair-Logik als eigene Systeme (Erledigt: 2026-03-01)
- [x] 10.4 EntityManager Split I - ProjectileSystem (Erledigt: 2026-03-01)
- [x] 10.5 EntityManager Split II - TrailSpatialIndex (Erledigt: 2026-03-02)
- [x] 10.6 Arena Split - Builder / Collision / PortalGate (Erledigt: 2026-03-02)
- [x] 10.7 Bot Split II - Recovery/Targeting/Scoring Ops (Erledigt: 2026-03-02)
- [x] 10.8 RuntimeConfig Snapshot statt globaler Streuung (Erledigt: 2026-03-02)
- [/] 10.9 Abschluss, Baseline-Vergleich, Cleanup (In Bearbeitung: 2026-03-02)

---

## Phase 10.1 - Core Runtime Loop final entkoppeln

Erledigt: 2026-03-01

Ziel:

1. `PlayingStateSystem` aktiv in den Laufzeitpfad integrieren (statt ungenutztes Modul).
2. Round-End/Match-End Tick-Handling aus `main.js` in ein dediziertes Tick-System auslagern.

Dateien (2-5):

- `src/core/main.js`
- `src/core/PlayingStateSystem.js`
- `src/state/RoundStateTickSystem.js` (neu)

Arbeitsschritte:

1. `main.js` erzeugt und nutzt `PlayingStateSystem` fuer `PLAYING`.
2. Neues `RoundStateTickSystem` kapselt Round-End/Match-End Tick-Descriptor-Logik.
3. `main.js` bleibt nur Orchestrator und Lifecycle-Kleber.

Definition of Done:

- `_updatePlayingState` in `main.js` ist auf Delegation reduziert oder entfernt.
- Round-End/Match-End Ticks liegen in einem separaten Modul.
- Kein Gameplay-Unterschied.

Verifikation:

- `npm run test:core`
- `npm run smoke:roundstate`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 10.1 als erledigt und starte Phase 10.2 aus docs/Feature_Modularisierung_Phase10_Performance_Wartbarkeit.md.`

---

## Phase 10.2 - UI-Verantwortung konsolidieren (UIManager vs MenuController)

Erledigt: 2026-03-01

Ziel:

1. Doppelverantwortung bei Settings-Events entfernen.
2. Eindeutige Trennung:
   - `MenuController`: Input/Event-Binding
   - `UIManager`: Rendering/Sync/View-State

Dateien (2-5):

- `src/ui/UIManager.js`
- `src/ui/MenuController.js`
- `src/core/main.js`

Arbeitsschritte:

1. Ungenutzte oder doppelte Listener-Pfade entfernen.
2. Klare Schnittstelle definieren, welche Events `MenuController` emittiert.
3. `UIManager` auf reine Sync-/Render-Aufgaben beschraenken.

Definition of Done:

- Kein doppeltes Event-Binding mehr.
- `UIManager.bindSettingsControls()` ist entfernt oder eindeutig begruendet.
- UI-Verhalten bleibt unveraendert.

Verifikation:

- `npm run test:core`
- `npm run test:stress`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 10.2 als erledigt und starte Phase 10.3 aus docs/Feature_Modularisierung_Phase10_Performance_Wartbarkeit.md.`

---

## Phase 10.3 - HUD- und Crosshair-Logik als eigene Systeme

Erledigt: 2026-03-01

Ziel:

1. HUD-Update, Item-Bar und Crosshair-Handling aus `main.js` auslagern.
2. UI-Hotpath einfacher testbar und gezielt optimierbar machen.

Dateien (2-5):

- `src/core/main.js`
- `src/ui/HUD.js`
- `src/ui/HudRuntimeSystem.js` (neu)
- `src/ui/CrosshairSystem.js` (neu)

Arbeitsschritte:

1. `_updateHUD`, `_updateItemBar`, `_ensureItemSlots` in `HudRuntimeSystem` verschieben.
2. `_updateCrosshairPosition` und `_updateCrosshairs` in `CrosshairSystem` verschieben.
3. `main.js` ruft nur noch Systeme auf.

Definition of Done:

- HUD/Crosshair-Code ist aus `main.js` deutlich reduziert.
- Keine sichtbare UI-Regression in 1P/2P.

Verifikation:

- `npm run test:core`
- `npm run test:stress`
- `npm run smoke:selftrail`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 10.3 als erledigt und starte Phase 10.4 aus docs/Feature_Modularisierung_Phase10_Performance_Wartbarkeit.md.`

---

## Phase 10.4 - EntityManager Split I - ProjectileSystem

Erledigt: 2026-03-01

Ziel:

1. Projektil-Lifecycle (Pool, Update, Treffer) aus `EntityManager` extrahieren.
2. Kollisionen und Effekte im Projektilpfad isoliert optimierbar machen.

Dateien (2-5):

- `src/entities/EntityManager.js`
- `src/entities/systems/ProjectileSystem.js` (neu)
- optional: `tests/core.spec.js` (nur bei Bedarf)

Arbeitsschritte:

1. `_shootItemProjectile`, `_updateProjectiles`, Pool-Methoden in `ProjectileSystem`.
2. `EntityManager.update()` delegiert an `ProjectileSystem`.
3. Callbacks fuer Audio/Particles/Feedback injizieren statt direkter harter Kopplung.

Definition of Done:

- Projektilpfad lebt in eigenem System.
- `EntityManager` ist kuerzer und orchestriert nur.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:selftrail`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 10.4 als erledigt und starte Phase 10.5 aus docs/Feature_Modularisierung_Phase10_Performance_Wartbarkeit.md.`

---

## Phase 10.5 - EntityManager Split II - TrailSpatialIndex

Erledigt: 2026-03-02

Ziel:

1. Spatial-Grid- und Trail-Kollisionslogik aus `EntityManager` auslagern.
2. Trail-Kollision separat testbar und fuer Hotpath-Optimierung vorbereitet machen.

Dateien (2-5):

- `src/entities/EntityManager.js`
- `src/entities/systems/TrailSpatialIndex.js` (neu)
- `src/entities/Trail.js`

Arbeitsschritte:

1. `registerTrailSegment`, `unregisterTrailSegment`, `checkGlobalCollision` nach `TrailSpatialIndex`.
2. `Trail.js` greift ueber klare API auf den Index zu.
3. Debug-Hooks (traildebug) im neuen Modul kapseln.

Definition of Done:

- Trail-Grid-Code ist aus `EntityManager` entfernt.
- Keine Regression bei Self-Trail-/Enemy-Trail-Kollisionen.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:selftrail`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 10.5 als erledigt und starte Phase 10.6 aus docs/Feature_Modularisierung_Phase10_Performance_Wartbarkeit.md.`

---

## Phase 10.6 - Arena Split - Builder / Collision / PortalGate

Erledigt: 2026-03-02

Ziel:

1. `Arena.js` in drei klare Submodule teilen:
   - Build/Geometry
   - Collision
   - Portal/Gate Runtime
2. Arena-Hotpaths (Collision, Cooldown-Update) klar isolieren.

Dateien (2-5):

- `src/entities/Arena.js`
- `src/entities/arena/ArenaBuilder.js` (neu)
- `src/entities/arena/ArenaCollision.js` (neu)
- `src/entities/arena/PortalGateSystem.js` (neu)

Arbeitsschritte:

1. Build-/Mesh-Erzeugung in `ArenaBuilder`.
2. `checkCollisionFast`, `getCollisionInfo`, Normalberechnung in `ArenaCollision`.
3. Portal/Gate-Cooldowns und Animationen in `PortalGateSystem`.

Definition of Done:

- `Arena.js` ist orchestrierender Facade.
- Kollisions- und Portalpfad sind getrennt.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:selftrail`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 10.6 als erledigt und starte Phase 10.7 aus docs/Feature_Modularisierung_Phase10_Performance_Wartbarkeit.md.`

---

## Phase 10.7 - Bot Split II - Recovery/Targeting/Scoring Ops

Erledigt: 2026-03-02

Ziel:

1. Verbleibende dicke Bot-Methoden aus `Bot.js` in fokussierte Ops verschieben.
2. `Bot.js` als kompakter Orchestrator stabilisieren.

Dateien (2-5):

- `src/entities/Bot.js`
- `src/entities/ai/BotSensingOps.js`
- `src/entities/ai/BotDecisionOps.js`
- `src/entities/ai/BotRecoveryOps.js` (neu)
- `src/entities/ai/BotTargetingOps.js` (neu)

Arbeitsschritte:

1. Recovery (`_updateStuckState`, `_enterRecovery`, `_updateRecovery`) nach `BotRecoveryOps`.
2. Targeting/Pressure/Point-Risk nach `BotTargetingOps`.
3. `Bot.js` behaelt State, Temp-Vektoren und Orchestrierung.

Definition of Done:

- `Bot.js` signifikant kleiner.
- KI-Verhalten bleibt gleich (abgesehen von minimalem Messrauschen).

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run bot:validate`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 10.7 als erledigt und starte Phase 10.8 aus docs/Feature_Modularisierung_Phase10_Performance_Wartbarkeit.md.`

---

## Phase 10.8 - RuntimeConfig Snapshot statt globaler Streuung

Erledigt: 2026-03-02

Ziel:

1. Laufzeitkonfiguration pro Match kapseln statt breite direkte `CONFIG`-Mutationen.
2. Reproduzierbarkeit fuer Tests und Performance-Messungen verbessern.

Dateien (2-5):

- `src/core/main.js`
- `src/state/MatchSessionFactory.js`
- `src/core/SettingsManager.js`
- `src/core/RuntimeConfig.js` (neu)

Arbeitsschritte:

1. `RuntimeConfig` aus Settings ableiten (Snapshot je Match).
2. Systeme konsumieren Snapshot schrittweise statt globalem Zustand.
3. Kompatibilitaetspfad lassen, bis alle Zugriffe migriert sind.

Definition of Done:

- Match-Session kann mit stabiler Config instanziert werden.
- Weniger direkte globale Seiteneffekte auf `CONFIG`.

Verifikation:

- `npm run test:core`
- `npm run smoke:roundstate`
- `npm run build`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 10.8 als erledigt und starte Phase 10.9 aus docs/Feature_Modularisierung_Phase10_Performance_Wartbarkeit.md.`

---

## Phase 10.9 - Abschluss, Baseline-Vergleich, Cleanup

Ziel:

1. Vorher/Nachher-Benchmark und KI-Stabilitaet final vergleichen.
2. Architektur- und Plan-Dokumente auf finalen Stand bringen.

Dateien (2-5):

- `scripts/bot-benchmark-baseline.mjs` (nur falls noetig)
- `data/performance_ki_baseline_report.json`
- `docs/Testergebnisse_2026-03-01.md` (oder neues Tagesdokument)
- `docs/ai_architecture_context.md`
- `docs/Umsetzungsplan.md`

Arbeitsschritte:

1. Baseline-Command(s) laufen lassen und Delta dokumentieren.
2. Restrisiken/Offene Punkte klar notieren.
3. Phase 10 im Masterplan auf abgeschlossen setzen.

Definition of Done:

- Messdaten und Architektur-Doku sind konsistent.
- Keine offenen "In Bearbeitung"-Eintraege ohne Folgeaktion.

Verifikation:

- `npm run benchmark:baseline`
- `npm run bot:validate`
- `npm run test:core`
- `npm run test:physics`
- `npm run docs:sync`
- `npm run docs:check`

Naechster-Chat-Prompt:

`Markiere Phase 10.9 als erledigt, aktualisiere docs/Umsetzungsplan.md auf abgeschlossen und erstelle einen kompakten Abschlussbericht mit Risiken und naechsten Optionen.`

---

## Prompt-Vorlage fuer jede abgeschlossene Phase

Wenn eine Phase beendet ist, immer diesen Stil nutzen:

`Markiere Phase 10.X als erledigt und starte Phase 10.Y aus docs/Feature_Modularisierung_Phase10_Performance_Wartbarkeit.md. Fuehre danach die Verifikation gemaess Phase 10.Y aus und gib den naechsten Prompt aus.`
