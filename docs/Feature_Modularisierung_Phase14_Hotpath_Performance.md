# Feature: Phase 14 - Hotpath-Performance und modulare Laufzeit-Optimierung (2-Agenten-Plan)

Stand: 2026-03-02

## Ziel

Diese Phase optimiert CPU-, DOM- und GC-Hotpaths in kleinen, rueckrollbaren Schritten, ohne Gameplay-Regeln zu aendern.

1. Frametimes stabilisieren (weniger Spikes durch DOM-Neuaufbau und per-frame Allokationen).
2. Hotpath-Module klar trennen (UI-Hotpath vs Core/AI-Hotpath).
3. Aenderungen mit festen Testintervallen und Benchmark-Gates absichern.

## Nicht-Ziele

1. Kein neues Feature-Design im Menue/HUD.
2. Kein Rework der Render-Engine oder Physik-Architektur als Big-Bang.
3. Keine Balance-Aenderungen fuer Waffen/Bots.

## Agenten-Setup (parallel + sequenziell)

Rollen:

- Agent A (UI-Hotpath): `src/hunt/HuntHUD.js`, `src/ui/HudRuntimeSystem.js`, `src/ui/CrosshairSystem.js`
- Agent B (Core/AI-Hotpath): `src/core/RuntimeDiagnosticsSystem.js`, `src/hunt/OverheatGunSystem.js`, `src/entities/Bot.js`, `src/state/RoundRecorder.js`
- Integrations-Agent: `src/core/PlayingStateSystem.js`, `src/core/main.js`, finale Benchmark-/Doku-Synchronisierung

Datei-Ownership:

1. Agent A bearbeitet keine Agent-B-Dateien.
2. Agent B bearbeitet keine Agent-A-Dateien.
3. Integrationsdateien werden erst in Integrationsphasen bearbeitet.

No-Stop-Ablaufregel:

1. Beide Agenten starten gleichzeitig mit ihren jeweiligen Phase-X.A/X.B-Tasks.
2. Nach jeder Teilphase: Verifikation + Commit, dann direkt naechste Lane-Phase starten.
3. Nur bei roten Gates oder Merge-Konflikten stoppen.

## Testintervalle (verpflichtend)

Intervall S (nach jeder Mikro-Phase):

- Agent A (`src/ui/**` / `src/hunt/**`): `npm run test:core` und `npm run test:stress`
- Agent B (`src/core/**`, `src/entities/**`, `src/hunt/**`, `src/state/**`): `npm run test:core` und `npm run test:physics`

Intervall M (nach jeder Wave A+B):

- `npm run smoke:roundstate`
- `npm run smoke:selftrail`

Intervall L (vor Abschluss von 14.8):

- `npm run benchmark:baseline`
- `npm run docs:sync`
- `npm run docs:check`

## Git-Intervall

1. Genau ein atomarer Commit pro Teilphase (`14.XA` oder `14.XB`).
2. Nach jeder Wave ein Integrations-Commit (falls Zusammenfuehrung noetig).
3. Commit-Schema:
   - `perf(phase14.XA): <kurze-beschreibung>`
   - `perf(phase14.XB): <kurze-beschreibung>`
   - `chore(phase14.X): integrate wave X`

## Fortschrittsboard

- [x] 14.0 Baseline, Metrik-Gates und Ownership finalisieren
- [x] 14.1A HuntHUD Kill-Feed inkrementell statt Full-Rebuild
- [x] 14.1B RuntimeDiagnostics FPS-Ringbuffer ohne per-frame reduce/shift
- [ ] 14.2A HUD/Crosshair nur bei Aenderung in DOM schreiben
- [ ] 14.2B Bot-Portal-Intent ohne Loop-Allokationen
- [ ] 14.3A HUD-Tick-Entzerrung (getrennte Frequenzen Score/Feed/Indikator)
- [ ] 14.3B Overheat-Snapshot als mutable Ref + dirty-Flag
- [ ] 14.4 Integration I: PlayingState nur dirty Overheat in `huntState` spiegeln
- [ ] 14.5 Integration II: Recorder im Runtime-Pfad sauber toggelbar machen
- [ ] 14.6 Wave-Regression (S+M) und Merge-Hygiene
- [ ] 14.7 Abschluss-Benchmark und KPI-Vergleich gegen Baseline
- [ ] 14.8 Doku-Abschluss, Restrisiken, Masterplan-Status auf abgeschlossen

---

## Phase 14.0 - Baseline und Gate-Setup

Ziel:

1. Einheitliche Ausgangslage fuer beide Agenten.
2. Klare KPI-Grenzen fuer Abnahme.

Dateien (2-5):

- `docs/Feature_Modularisierung_Phase14_Hotpath_Performance.md`
- `docs/Testergebnisse_2026-03-02.md` (oder neues Tagesdokument)

Arbeitsschritte:

1. Baseline-Referenz aus `npm run benchmark:baseline` dokumentieren.
2. Abnahmekriterien festlegen (z. B. keine Regression bei FPS-Mittel/Draw Calls, keine neuen Testfehler).
3. Startfreigabe fuer Wave 1 erteilen.

Definition of Done:

- KPI-Gates dokumentiert.
- Beide Agenten-Lanes freigegeben.

Verifikation:

- `npm run test:core`
- `npm run benchmark:baseline`

14.0 Ergebnis (2026-03-02):

- Baseline aus `npm run benchmark:baseline` dokumentiert.
- Ownership bestaetigt: Agent A (`src/hunt/HuntHUD.js`, `src/ui/HudRuntimeSystem.js`, `src/ui/CrosshairSystem.js`), Agent B (`src/core/RuntimeDiagnosticsSystem.js`, `src/hunt/OverheatGunSystem.js`, `src/entities/Bot.js`, `src/state/RoundRecorder.js`).
- Baseline-KPIs (Overall):
  - FPS-Mittel: `59.54`
  - Draw Calls (Mittel): `28.49`
  - Stuck-Events: `0`
  - Runden: `16`, Performance-Samples: `43`
- KPI-Gates fuer 14.7-Abnahme:
  - `test:core`, lane-spezifische Intervall-S/M-Gates muessen durchgehend gruen bleiben.
  - FPS-Mittel Overall darf max. `5%` fallen (`>= 56.56`).
  - Draw Calls Overall duerfen max. `10%` steigen (`<= 31.34`).
  - Stuck-Events duerfen nicht steigen (`<= 0`).
- Wave-1-Startfreigabe erteilt.

---

## Phase 14.1A - Agent A

Titel: HuntHUD Kill-Feed inkrementell statt Full-Rebuild

Dateien (2-5):

- `src/hunt/HuntHUD.js`
- optional: `style.css`

Arbeitsschritte:

1. Rebuild-Pfad `innerHTML=''` entfernen.
2. Stabile Slot-Liste (max. 5) einmal erzeugen und nur Text/Visibility patchen.
3. Unveraenderte Eintraege nicht neu schreiben.

Definition of Done:

- Kein per-frame kompletter Kill-Feed-DOM-Neuaufbau mehr.
- Sichtbares Verhalten bleibt gleich.

Verifikation (Intervall S):

- `npm run test:core`
- `npm run test:stress`

Commit:

- `perf(phase14.1A): make hunt kill-feed rendering incremental`

---

## Phase 14.1B - Agent B

Titel: RuntimeDiagnostics FPS-Ringbuffer ohne per-frame reduce/shift

Dateien (2-5):

- `src/core/RuntimeDiagnosticsSystem.js`

Arbeitsschritte:

1. `samples.push/shift/reduce` durch Ringbuffer + laufende Summe ersetzen.
2. O(1)-Update pro Tick sicherstellen.
3. UI-Output (`FPS`, Overlay-Toggle) unveraendert lassen.

Definition of Done:

- Keine lineare Aggregation mehr pro Frame.
- Overlay-Funktionalitaet unveraendert.

Verifikation (Intervall S):

- `npm run test:core`
- `npm run test:physics`

Commit:

- `perf(phase14.1B): replace fps tracker with o1 ring buffer`

---

## Wave-1 Gate (A+B)

Verifikation (Intervall M):

- `npm run smoke:roundstate`
- `npm run smoke:selftrail`

Integrations-Commit (falls noetig):

- `chore(phase14.1): integrate wave 1 hotpath changes`

---

## Phase 14.2A - Agent A

Titel: HUD/Crosshair schreibt DOM nur bei Aenderung

Dateien (2-5):

- `src/ui/HudRuntimeSystem.js`
- `src/ui/CrosshairSystem.js`

Arbeitsschritte:

1. Last-value-Caches fuer Text/Style-Werte einfuehren.
2. `style.left/top/transform` nur schreiben, wenn Wert geaendert.
3. Kein Functional Drift bei Splitscreen/FPS-HUD.

Definition of Done:

- Reduzierte DOM-Schreiblast in jedem Tick.
- Crosshair- und HUD-Verhalten bleibt identisch.

Verifikation (Intervall S):

- `npm run test:core`
- `npm run test:stress`

Commit:

- `perf(phase14.2A): avoid redundant hud and crosshair dom writes`

---

## Phase 14.2B - Agent B

Titel: Bot-Portal-Intent ohne Loop-Allokationen

Dateien (2-5):

- `src/entities/Bot.js`

Arbeitsschritte:

1. `sides`-Array/Objekt-Allokation im Portal-Loop entfernen.
2. Beide Richtungen per direkter Branch-Logik pruefen.
3. Identische Entscheidungslogik beibehalten.

Definition of Done:

- Keine neuen Arrays/Objekte im betreffenden Portal-Hotpath.
- Bot-Verhalten funktional gleich.

Verifikation (Intervall S):

- `npm run test:core`
- `npm run test:physics`

Commit:

- `perf(phase14.2B): remove portal loop allocations in bot intent`

---

## Wave-2 Gate (A+B)

Verifikation (Intervall M):

- `npm run smoke:roundstate`
- `npm run smoke:selftrail`

Integrations-Commit (falls noetig):

- `chore(phase14.2): integrate wave 2 hotpath changes`

---

## Phase 14.3A - Agent A

Titel: HUD-Tick entkoppeln (Score/Feed/Indicator getrennte Frequenz)

Dateien (2-5):

- `src/ui/HudRuntimeSystem.js`
- `src/hunt/HuntHUD.js`

Arbeitsschritte:

1. Score-/Inventory-Tick getrennt von Hunt-Feed/Indicator-Tick fuehren.
2. Update-Frequenzen konfigurierbar und konservativ waehlen.
3. Bei Menu-/Nicht-Hunt-Status fruehzeitig aussteigen.

Definition of Done:

- Weniger unnötige UI-Arbeit pro Frame.
- Keine visuelle Stotter-Regressions.

Verifikation (Intervall S):

- `npm run test:core`
- `npm run test:stress`

Commit:

- `perf(phase14.3A): decouple hud tick frequencies`

---

## Phase 14.3B - Agent B

Titel: Overheat-Snapshot mutable + dirty-Flag

Dateien (2-5):

- `src/hunt/OverheatGunSystem.js`

Arbeitsschritte:

1. Snapshot-Objekt persistent halten statt pro Aufruf neu zu allokieren.
2. Dirty-Flag/Version-Counter bei echten Aenderungen pflegen.
3. API rueckwaertskompatibel halten (read-only use).

Definition of Done:

- Keine full-copy des Overheat-Snapshots pro Tick.
- API fuer Integration vorbereitet.

Verifikation (Intervall S):

- `npm run test:core`
- `npm run test:physics`

Commit:

- `perf(phase14.3B): provide mutable overheat snapshot with dirty flag`

---

## Wave-3 Gate (A+B)

Verifikation (Intervall M):

- `npm run smoke:roundstate`
- `npm run smoke:selftrail`

Integrations-Commit (falls noetig):

- `chore(phase14.3): integrate wave 3 hotpath changes`

---

## Phase 14.4 - Integration I

Titel: PlayingState uebernimmt nur dirty Overheat-Updates

Dateien (2-5):

- `src/core/PlayingStateSystem.js`
- optional: `src/hunt/HuntHUD.js`

Arbeitsschritte:

1. Overheat-Transfer in `huntState` nur bei dirty/version-change aktualisieren.
2. Null-/Fallback-Pfade robust halten.
3. Keine Aenderung am sichtbaren HUD-Datenmodell.

Definition of Done:

- Keine redundanten per-tick Objektuebernahmen mehr.
- HUD zeigt korrekte Overheat-Werte.

Verifikation:

- `npm run test:core`
- `npm run test:stress`
- `npm run test:physics`

Commit:

- `perf(phase14.4): propagate overheat state only on dirty updates`

---

## Phase 14.5 - Integration II

Titel: Recorder im Runtime-Pfad sauber toggelbar

Dateien (2-5):

- `src/core/main.js`
- `src/state/RoundRecorder.js`

Arbeitsschritte:

1. Recorder standardmaessig klar steuerbar machen (Runtime-Flag).
2. `recordFrame` nur ausfuehren, wenn Recording explizit aktiv ist.
3. Debug-Workflows (`captureBaseline`, Reports) unveraendert erreichbar halten.

Definition of Done:

- Kein unnoetiger Recorder-Overhead im normalen Spielbetrieb.
- Debug- und QA-Pfade bleiben nutzbar.

Verifikation:

- `npm run test:core`
- `npm run smoke:roundstate`

Commit:

- `perf(phase14.5): gate recorder frame capture behind runtime toggle`

---

## Phase 14.6 - Wave-Regression und Merge-Hygiene

Ziel:

1. Alle Wave-Aenderungen konfliktfrei zusammenfuehren.
2. Technische Regressionen vor Benchmark ausschliessen.

Verifikation:

- `npm run test:core`
- `npm run test:stress`
- `npm run test:physics`
- `npm run smoke:roundstate`
- `npm run smoke:selftrail`

Commit:

- `chore(phase14.6): stabilize merged hotpath changes`

---

## Phase 14.7 - Abschluss-Benchmark

Ziel:

1. Vorher/Nachher gegen dokumentierte Baseline bewerten.
2. Delta fuer FPS/Draw Calls/Frametime nachvollziehbar dokumentieren.

Dateien (2-5):

- `data/performance_ki_baseline_report.json`
- `docs/Testergebnisse_2026-03-02.md` (oder neues Tagesdokument)

Verifikation (Intervall L):

- `npm run benchmark:baseline`

Commit:

- `perf(phase14.7): update benchmark report after hotpath optimization`

---

## Phase 14.8 - Doku-Abschluss

Ziel:

1. Planstatus, Restrisiken und Folgeoptionen finalisieren.
2. Masterplan auf abgeschlossen setzen.

Dateien (2-5):

- `docs/Umsetzungsplan.md`
- `docs/ai_architecture_context.md` (falls Zustaendigkeiten geaendert)
- `docs/Testergebnisse_2026-03-02.md` (oder neues Tagesdokument)

Verifikation:

- `npm run docs:sync`
- `npm run docs:check`

Commit:

- `chore(phase14.8): finalize docs and close phase 14`

---

## Prompt-Vorlage fuer den naechsten Chat

Start erster Schritt:

`Starte Phase 14.0 aus docs/Feature_Modularisierung_Phase14_Hotpath_Performance.md und fuehre danach direkt 14.1A und 14.1B parallel aus.`

Weiter nach jedem Schritt:

`Markiere Phase 14.X als erledigt und starte unmittelbar die naechste Phase aus docs/Feature_Modularisierung_Phase14_Hotpath_Performance.md inklusive der dort definierten Verifikation.`


