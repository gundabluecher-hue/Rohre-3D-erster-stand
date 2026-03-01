# Feature: Modulare Architektur fuer Performance und KI-Erweiterbarkeit

## Ziel

Das Spiel soll schrittweise modularisiert werden, ohne Gameplay-Regressionen. Die Hotpaths sollen alloc-arm bleiben, und die Bot-KI soll ueber stabile Schnittstellen austauschbar werden.

## Leitregeln fuer jede Phase (KI-freundlich)

1. Pro Phase nur ein klarer Schwerpunkt.
2. Maximal 2-5 produktive Dateien anfassen.
3. Verhalten in der Phase nicht aendern, ausser explizit im Phasenziel genannt.
4. Nach jeder Phase Planstatus aktualisieren (dieses Dokument + `docs/Umsetzungsplan.md`).
5. Abschluss je Phase nur mit Verifikation und Doku-Gates.

## Fortschrittsboard (nach jeder Phase aktualisieren)

- [x] Phase 1 - Playing-State aus `main.js` extrahieren
- [x] Phase 2 - Entity-Update-Pipeline in Subsysteme schneiden
- [x] Phase 3 - Bot-Policy-Schnittstelle einfuehren
- [x] Phase 4 - Bot-Logik in Sensing/Decision/Action Module splitten
- [x] Phase 5 - Hotpath-Allocations und Kollisionspfad optimieren
- [x] Phase 6 - Messung/Baseline fuer Performance und KI-Stabilitaet
- [x] Phase 7 - Abschluss, Cleanup, Architektur-Doku finalisieren

## Phase 1 - Playing-State aus `main.js` extrahieren

Erledigt: 2026-03-01

Ziel:
- Die Logik von `_updatePlayingState(dt)` aus `src/core/main.js` in ein eigenes System auslagern.

Scope:
- `src/core/main.js`
- `src/core/PlayingStateSystem.js` (neu)

Arbeitsschritte:
1. Neues Modul `PlayingStateSystem` anlegen.
2. Bisherige Reihenfolge der Calls unveraendert uebernehmen:
   - `_updatePlanarAimAssist`
   - `entityManager.update`
   - `powerupManager.update`
   - `particles.update`
   - `arena.update`
   - `entityManager.updateCameras`
   - `_updateCrosshairs`
   - `_updatePlayingHudTick`
   - `_applyPlayingTimeScaleFromEffects`
3. In `main.js` nur orchestrieren (delegieren), keine neue Spielmechanik.

Definition of Done:
- `_updatePlayingState` ist aus `main.js` entfernt oder auf schlanke Delegation reduziert.
- Neues Modul kapselt die Playing-State-Abfolge.
- Kein sichtbarer Gameplay-Unterschied.

Verifikation:
- `npm run test:core`
- `npm run docs:sync`
- `npm run docs:check`

Kurznotiz (2026-03-01):
- Geaendert: Playing-State-Abfolge in `src/core/PlayingStateSystem.js` extrahiert, `main.js` delegiert nur noch.
- Verifikation: `npm run test:core`, `npm run docs:sync`, `npm run docs:check`.
- Restrisiko: niedrig (reiner Struktur-Refactor ohne neue Spielmechanik).

## Phase 2 - Entity-Update-Pipeline in Subsysteme schneiden

Erledigt: 2026-03-01

Ziel:
- `EntityManager.update()` in kleinere, testbare Subsystem-Schritte zerlegen.

Scope:
- `src/entities/EntityManager.js`
- `src/entities/systems/PlayerInputSystem.js` (neu)
- `src/entities/systems/PlayerLifecycleSystem.js` (neu)

Arbeitsschritte:
1. Input-Aufloesung (Human/Bot) in `PlayerInputSystem`.
2. Spieler-Tick + Arena/Trail/Portal/Powerup-Lifecycle in `PlayerLifecycleSystem`.
3. `EntityManager.update()` reduziert auf Pipeline-Orchestrierung.

Definition of Done:
- `update()` ist deutlich kuerzer und ruft Subsysteme auf.
- Keine doppelte Verantwortung im `EntityManager`.

Verifikation:
- `npm run test:core`
- `npm run test:physics`
- `npm run docs:sync`
- `npm run docs:check`

Kurznotiz (2026-03-01):
- Geaendert: Input-Aufloesung nach `src/entities/systems/PlayerInputSystem.js` und Spieler-Lifecycle nach `src/entities/systems/PlayerLifecycleSystem.js` extrahiert; `EntityManager.update()` orchestriert nur noch die Pipeline.
- Verifikation: `npm run test:core`, `npm run test:physics`, `npm run docs:sync`, `npm run docs:check`.
- Restrisiko: niedrig (strukturierter Refactor ohne beabsichtigte Gameplay-Aenderung).

## Phase 3 - Bot-Policy-Schnittstelle einfuehren

Erledigt: 2026-03-01

Ziel:
- KI austauschbar machen (Rule-based heute, weitere Policies spaeter).

Scope:
- `src/entities/EntityManager.js`
- `src/entities/ai/BotPolicyTypes.js` (neu)
- `src/entities/ai/RuleBasedBotPolicy.js` (neu)
- `src/entities/ai/BotPolicyRegistry.js` (neu)

Arbeitsschritte:
1. `BotPolicy`-Vertrag definieren (`update(...) -> input`).
2. Bestehende `BotAI` als `RuleBasedBotPolicy` adaptieren.
3. `EntityManager` erzeugt Bots ueber Registry statt harter `new BotAI(...)` Kopplung.

Definition of Done:
- KI-Instanziierung laeuft ueber Registry.
- Default-Policy bleibt identisch zum bisherigen Verhalten.

Verifikation:
- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:roundstate`
- `npm run docs:sync`
- `npm run docs:check`

Kurznotiz (2026-03-01):
- Geaendert: Neue Policy-Schicht mit `BotPolicyTypes`, `RuleBasedBotPolicy` und `BotPolicyRegistry`; `EntityManager` instanziiert Bot-KI jetzt ueber Registry statt direkter `BotAI`-Kopplung.
- Verifikation: `npm run test:core`, `npm run test:physics`, `npm run smoke:roundstate`, `npm run docs:sync`, `npm run docs:check`.
- Restrisiko: niedrig (strukturelle Entkopplung ohne beabsichtigte Gameplay-Aenderung).

## Phase 4 - Bot-Logik in Sensing/Decision/Action Module splitten

Erledigt: 2026-03-01

Ziel:
- `Bot.js` intern zerlegen, um Features/Modelle spaeter gezielt austauschen zu koennen.

Scope:
- `src/entities/Bot.js`
- `src/entities/ai/BotSensingOps.js` (neu)
- `src/entities/ai/BotDecisionOps.js` (neu)
- `src/entities/ai/BotActionOps.js` (neu)

Arbeitsschritte:
1. Perception-Logik nach `BotSensingOps`.
2. Decision-Logik nach `BotDecisionOps`.
3. Input-Mapping nach `BotActionOps`.

Definition of Done:
- `Bot.js` ist orchestrierend, Ops sind pure/nahezu pure.
- Schwierigkeit/Verhalten bleibt unveraendert.

Verifikation:
- `npm run test:core`
- `npm run test:physics`
- `npm run bot:validate`
- `npm run docs:sync`
- `npm run docs:check`

Kurznotiz (2026-03-01):
- Geaendert: Sensing-, Decision- und Action-Logik nach `src/entities/ai/BotSensingOps.js`, `src/entities/ai/BotDecisionOps.js` und `src/entities/ai/BotActionOps.js` extrahiert; `src/entities/Bot.js` delegiert auf diese Ops.
- Verifikation: `npm run test:core`, `npm run test:physics`, `npm run bot:validate`, `npm run docs:sync`, `npm run docs:check`.
- Restrisiko: niedrig (struktureller Refactor mit unveraenderter Policy-Schnittstelle).

## Phase 5 - Hotpath-Allocations und Kollisionspfad optimieren

Erledigt: 2026-03-01

Ziel:
- Laufzeitallokationen in Hotpaths reduzieren und Kollisionspfad stabilisieren.

Scope:
- `src/entities/EntityManager.js`
- `src/core/main.js`
- optional `src/entities/Trail.js` (nur falls fuer no-allocation noetig)

Arbeitsschritte:
1. `player.position.clone()` im Update-Hotpath durch wiederverwendbare Temp-Vektoren ersetzen.
2. Weitere temporale Objektallokationen im Frame-Pfad minimieren.
3. Doppelte `clear()`-Definition in `EntityManager` bereinigen.

Definition of Done:
- Weniger per-frame Allocation-Stellen im Hotpath.
- Kein funktionaler Regressionseffekt.

Verifikation:
- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:selftrail`
- `npm run build`
- `npm run docs:sync`
- `npm run docs:check`

Kurznotiz (2026-03-01):
- Geaendert: `player.position.clone()` im Player-Update-Hotpath durch wiederverwendbaren Temp-Vektor ersetzt; doppelte `clear()`-Definition in `src/entities/EntityManager.js` entfernt; zusaetzliche Runtime-Allokationen in Projektil-/Trail- und HUD-Statistikpfaden reduziert.
- Verifikation: `npm run test:core`, `npm run test:physics`, `npm run smoke:selftrail`, `npm run build`, `npm run docs:sync`, `npm run docs:check`.
- Restrisiko: niedrig (allocation-orientierter Refactor ohne beabsichtigte Gameplay-Aenderung).

## Phase 6 - Messung/Baseline fuer Performance und KI-Stabilitaet

Erledigt: 2026-03-01

Ziel:
- Vorher/Nachher messbar machen und als Referenz dokumentieren.

Scope:
- `scripts/` (neues leichtes Benchmark/Report-Skript)
- `data/` (Report-JSON)
- `docs/Testergebnisse_YYYY-MM-DD.md` (neu/erweitert)

Arbeitsschritte:
1. Reproduzierbare Baseline-Matrix definieren (Map, Bots, Runden).
2. Metriken erfassen: FPS-Mittel, Draw Calls, Bot-Winrate, Stuck-Events.
3. Ergebnisse als JSON + Kurzbericht dokumentieren.

Definition of Done:
- Vergleichbare Messdaten liegen versioniert vor.
- Report ist auf aktuellem Datum dokumentiert.

Verifikation:
- `npm run bot:validate`
- neues Benchmark-Kommando (in Phase implementiert)
- `npm run docs:sync`
- `npm run docs:check`

Kurznotiz (2026-03-01):
- Geaendert: `scripts/bot-benchmark-baseline.mjs` als reproduzierbares Benchmark-Command eingefuehrt, `package.json` um `benchmark:baseline` erweitert, Baseline-Report in `data/performance_ki_baseline_report.json` und Kurzbericht in `docs/Testergebnisse_2026-03-01.md` erzeugt.
- Verifikation: `npm run bot:validate`, `npm run benchmark:baseline`, `npm run test:core`, `npm run docs:sync`, `npm run docs:check`.
- Restrisiko: mittel (Performance-Messung ohne expliziten RNG-Seed-Hook; Reproduzierbarkeit erfolgt ueber feste Matrix und Runner-Parameter).

## Phase 7 - Abschluss, Cleanup, Architektur-Doku finalisieren

Erledigt: 2026-03-01

Ziel:
- Restarbeiten, Konsolidierung und finale Dokumentation.

Scope:
- Betroffene `src/**`, `docs/**`, ggf. `tests/**`

Arbeitsschritte:
1. Dead Code und uebrige Altpfade entfernen.
2. Architekturkontext aktualisieren (`docs/ai_architecture_context.md`).
3. Master-Plan final auf erledigt setzen.

Definition of Done:
- Alle Phasen im Fortschrittsboard als erledigt markiert.
- Doku und Tests sind konsistent.

Verifikation:
- `npm run build`
- gemappte Tests gemaess `.agents/test_mapping.md`
- `npm run docs:sync`
- `npm run docs:check`

Kurznotiz (2026-03-01):
- Geaendert: KI-Cleanup in `src/entities/Bot.js` (interne Wrapper-Altpfade entfernt, direkte Ops-Delegation), `src/entities/EntityManager.js` von privater `_sensePhase`-Fallback-Kopplung bereinigt und Architekturkontext in `docs/ai_architecture_context.md` finalisiert.
- Verifikation: `npm run build`, `npm run test:core`, `npm run test:physics`, `npm run docs:sync`, `npm run docs:check`.
- Restrisiko: niedrig (Cleanup/Architektur-Doku ohne neue Gameplay-Features).

## Regel fuer Status-Update nach jeder Phase

Nach Abschluss einer Phase immer:
1. In diesem Dokument das Fortschrittsboard aktualisieren.
2. In `docs/Umsetzungsplan.md` die zugehoerige Phase auf `[x]` setzen und Datum ergaenzen.
3. Kurz notieren: was geaendert wurde, welche Verifikation lief, welches Risiko verbleibt.
