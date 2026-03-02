# Umsetzungsplan (Master)

Dies ist der konsolidierte Plan fuer anstehende und laufende Implementierungen.
Neue Findings aus dem Analysebericht fliessen hier ein.

> Abgeschlossene Phasen 1-10 siehe [Archiv](Umsetzungsplan_Archiv_Phase1-10.md).
> Abgeschlossene Referenzplaene aus Phase 11-13 siehe `docs/archive/`.

## Status-Uebersicht

- [ ] Offen
- [/] In Bearbeitung
- [x] Abgeschlossen

---

## Prioritaeten (Triage)

**Wichtig:**

- Keine offenen kritischen Findings (Stand: 2026-03-02, inkl. Hunt-Input-Hotfix validiert mit `test:core`, `test:physics`, `test:stress`).

**Mittel:**

- Weitere Dummy-Tests schrittweise durch echte Integritaetstests ersetzen.

**Unwichtig/Backlog:**

- Bundle-Groesse weiter optimieren (Code-Splitting), auch wenn aktuelles Warnlimit keine Build-Warnung mehr erzeugt.

---

## Parallelbetrieb Phase 11 + 12

> [!IMPORTANT]
> **Phase 11 und 12 werden parallel von zwei Agenten bearbeitet.**
> Jeder Agent MUSS vor Beginn seiner Teilphase diesen Plan lesen und den Status der Dependency-Gates pruefen.

**Koordinationsregeln:**

1. Vor jeder Teilphase: `docs/Umsetzungsplan.md` oeffnen und Checkbox-Status pruefen.
2. Wenn eine Teilphase ein **GATE** hat, darf sie erst starten wenn die Gate-Phase `[x]` ist.
3. Nach Abschluss einer Teilphase sofort Checkbox auf `[x]` setzen, damit der andere Agent weiterarbeiten kann.
4. Bei Merge-Konflikten: `git pull --rebase` vor Commit.

---

## Phase 11: [x] Jagd-Modus (neuer Spielmodus)

Geplant: 2026-03-02
**Parallelbetrieb:** Laeuft parallel zu Phase 12. Phase 12.9 und 12.10 warten auf Teilphasen aus Phase 11 (siehe Gates in Phase 12).

- Ziele:
  1. Neuer aktivierbarer Spielmodus "Jagd" mit HP, MG (Ueberhitzung), 3-Stufen-Raketen, zerstoerbarer Spur, Schild, Respawn, Kill-Feed, Screen-Shake.
  2. Eigenes modulares Verzeichnis `src/hunt/`. Feature-Flag `CONFIG.HUNT.ENABLED`. Keine Regression im Classic-Modus.
- Referenzplan: `docs/archive/Feature_JagdModus.md`
- Teilphasen:
  - [x] 11.1 Game-Mode-Infrastruktur (HuntMode, HuntConfig, Menue-Toggle, Feature-Flag)
  - [x] 11.2a HP-System (Player-Erweiterung, HealthSystem)
  - [x] 11.2b Collision-Umstellung (HP statt Kill)
  - [x] 11.3 HUD: HP-Bar, Overheat-Bar, Kill-Feed, Schadens-Indikator
  - [x] 11.4 MG mit Ueberhitzung (OverheatGunSystem, Tracer, Falloff)
  - [x] 11.5 3-Stufen-Raketen (schwach/mittel/stark, Arena-Pickups)
  - [x] 11.6 Zerstoerbare Spur (niedrige Trail-HP, schnell kaputt)
  - [x] 11.7 Schild-Powerup + 3D-Powerup-Modelle (lizenzfrei)
  - [x] 11.8 Screen-Shake, Schadens-Indikator, Kill-Feed
  - [x] 11.9 Respawn-System + erweitertes Scoring
  - [x] 11.10 Bot-KI fuer Jagd-Modus (HuntBotPolicy)
  - [x] 11.11 Abschluss, Balancing, Cleanup
- Verifikation pro Teilphase:
  - `npm run test:core`, `npm run test:physics`, `npm run smoke:selftrail`, `npm run build`
  - Classic-Modus Regressionstest bei jeder Phase
  - Pflicht-Gates: `npm run docs:sync` und `npm run docs:check`
- Prompt-Regel:
  - Am Ende jeder Teilphase den im Referenzplan definierten "Naechster-Chat-Prompt" ausgeben und damit direkt die Folgephase starten.

---

## Phase 12: [x] KI-freundliche Modularisierung (kleine Splits)

Geplant: 2026-03-02
Letztes Update: 2026-03-02
**Parallelbetrieb:** Laeuft parallel zu Phase 11. Einige Teilphasen haben Dependency-Gates (siehe unten).

- Ziele:
  1. Verbleibende grosse Module in kleine, KI-stabile Aufgaben schneiden.
  2. Pro Teilphase maximal 2-5 produktive Dateien anfassen.
  3. Wartbarkeit erhoehen ohne funktionale Regression.
- Referenzplan: `docs/archive/Feature_Modularisierung_Phase12_KI_Freundliche_Splits.md`
- Teilphasen:
  - **Block A - konfliktfrei, sofort startbar (parallel zu Phase 11):**
  - [x] 12.1 `Config.js` Split A - Map-Presets auslagern
  - [x] 12.2 `Config.js` Split B - Config-Sections komponieren
  - [x] 12.3 `PortalGateSystem` Split A - Mesh-Fabrik auslagern
  - [x] 12.4 `PortalGateSystem` Split B - Placement/Resolver auslagern
  - [x] 12.5 `EditorMapManager` Split A - Import/Export Serializer auslagern
  - [x] 12.6 `EditorMapManager` Split B - Mesh/Registry Ops auslagern
  - **Block B - parallel zu Phase 11 moeglich (kein Datei-Overlap):**
  - [x] 12.7 `main.js` Split A - Runtime Diagnostics entkoppeln
  - [x] 12.8 `main.js` Split B - Keybind-Editor Controller entkoppeln
  - [x] 12.11 `Player.js` Split B - Motion/Update Ops auslagern
  - **Block C - Dependency-Gates, warten auf Phase 11:**
  - [x] 12.9 `main.js` Split C - Match/UI-Flow Controller entkoppeln — **GATE: wartet auf 11.1 [x]**
  - [x] 12.10 `Player.js` Split A - Effects/Inventory Ops auslagern — **GATE: wartet auf 11.2a [x]**
  - **Abschluss:**
  - [x] 12.12 Abschluss, Verifikation, Cleanup
- Verifikation pro Teilphase:
  - Gemappte Tests gemaess `.agents/test_mapping.md`
  - Pflicht-Gates: `npm run docs:sync` und `npm run docs:check`
- Git-Checkpoint pro Teilphase:
  - Nach erfolgreicher Verifikation genau ein atomarer Commit (Rollback-freundlich).
  - Commit-Schema: `refactor(phase12.X): <kurze-beschreibung>`
- Prompt-Regel:
  - Am Ende jeder Teilphase den im Referenzplan definierten "Naechster-Chat-Prompt" ausgeben und damit direkt die Folgephase starten.

### Restrisiken / Nacharbeiten (Stand: 2026-03-02)

- Hunt-Balancing ist auf Konfigurationsniveau abgestimmt, benoetigt aber weitere Spieltests mit echten Rundenlaengen.
- Hunt-Powerup-Modelle nutzen aktuell prozedurale 3D-Meshes; externe GLTF-Assets koennen spaeter als optionaler Upgrade-Pfad folgen.

---

## Phase 13: [x] UI-Entkopplung und selektive Settings-Synchronisierung

Geplant: 2026-03-02
Letztes Update: 2026-03-02
**Parallelbetrieb:** Ja, in zwei konfliktfreien Agenten-Spuren (A: View-Sync, B: Event-Semantik).

- Ziele:
  1. UI-Verantwortung fuer Menu-Context/Toast eindeutig machen.
  2. `UIManager.syncAll()` in kleine Bereiche aufteilen.
  3. Selektive UI-Sync auf Basis typisierter Change-Keys einfuehren.
  4. Wirkung ueber feste Validierungsgates messen.
- Referenzplan: `docs/archive/Feature_Modularisierung_Phase13_UI_Sync_Wartbarkeit.md`
- Teilphasen:
  - [x] 13.0 Baseline, Scope und Schnittstellenvertrag fixieren
  - [x] 13.1A `UIManager` in fachliche Sync-Methoden aufteilen (Agent A)
  - [x] 13.1B Typisierte Settings-Change-Keys emittieren (Agent B)
  - [x] 13.2A Selektive UI-Sync-API im `UIManager` einfuehren (Agent A)
  - [x] 13.2B Slider-/Input-Change-Coalescing im `MenuController` (Agent B)
  - [x] 13.3 Integration I: `main.js` auf selektive UI-Sync umstellen
  - [x] 13.4 Integration II: Context/Toast-Verantwortung final eindeutig machen
  - [x] 13.5 Abschluss: Regression, Performance-Vergleich, Doku-Abschluss
- GATES:
  - 13.2A startet erst nach stabilem Key-Vertrag aus 13.1B.
  - 13.3 startet erst wenn 13.2A und 13.2B abgeschlossen sind.
  - 13.4 startet erst nach erfolgreichem Integrationstest aus 13.3.
- Verifikation pro Teilphase:
  - Gemappte Tests gemaess `.agents/test_mapping.md`
  - Pflicht-Gates: `npm run docs:sync` und `npm run docs:check`
- Prompt-Regel:
  - Am Ende jeder Teilphase den im Referenzplan definierten "Naechster-Chat-Prompt" ausgeben und damit direkt die Folgephase starten.

---

## Phase 14: [/] Hotpath-Performance und modulare Laufzeit-Optimierung

Geplant: 2026-03-02
Letztes Update: 2026-03-02
**Parallelbetrieb:** Ja, in zwei Lanes (A: UI-Hotpath, B: Core/AI-Hotpath) plus Integrations-Agent.

- Ziele:
  1. Per-frame DOM- und GC-Last im Runtime-Pfad reduzieren.
  2. Hotpath-Aenderungen in kleine, rollback-freundliche Teilphasen schneiden.
  3. Wirksamkeit ueber feste Testintervalle und Benchmark-Gates nachweisen.
- Referenzplan: `docs/Feature_Modularisierung_Phase14_Hotpath_Performance.md`
- Teilphasen:
  - [x] 14.0 Baseline, Metrik-Gates und Ownership finalisieren
  - [ ] 14.1A HuntHUD Kill-Feed inkrementell statt Full-Rebuild
  - [ ] 14.1B RuntimeDiagnostics FPS-Ringbuffer ohne per-frame reduce/shift
  - [ ] 14.2A HUD/Crosshair nur bei Aenderung in DOM schreiben
  - [ ] 14.2B Bot-Portal-Intent ohne Loop-Allokationen
  - [ ] 14.3A HUD-Tick-Entzerrung (getrennte Frequenzen Score/Feed/Indikator)
  - [ ] 14.3B Overheat-Snapshot als mutable Ref + dirty-Flag
  - [ ] 14.4 Integration I: PlayingState nur dirty Overheat in `huntState` spiegeln
  - [ ] 14.5 Integration II: Recorder im Runtime-Pfad sauber toggelbar machen
  - [ ] 14.6 Wave-Regression (S+M) und Merge-Hygiene
  - [ ] 14.7 Abschluss-Benchmark und KPI-Vergleich gegen Baseline
  - [ ] 14.8 Doku-Abschluss, Restrisiken, Masterplan-Status auf abgeschlossen
- KPI-Gates (Baseline 2026-03-02):
  - FPS-Mittel Overall: Baseline `59.54`, Gate `>= 56.56` (max. -5%).
  - Draw Calls Overall: Baseline `28.49`, Gate `<= 31.34` (max. +10%).
  - Stuck-Events: Baseline `0`, Gate `<= 0`.
  - Funktionale Gates: alle Intervall-S/M/L-Testkommandos ohne neue Fehler.
- Verifikation:
  - Intervall S je Mikro-Phase: lane-spezifische Tests gemaess `docs/Feature_Modularisierung_Phase14_Hotpath_Performance.md`
  - Intervall M je Wave: `npm run smoke:roundstate`, `npm run smoke:selftrail`
  - Intervall L zum Abschluss: `npm run benchmark:baseline`, `npm run docs:sync`, `npm run docs:check`
- Prompt-Regel:
  - Nach jeder Phase direkt die naechste Phase starten, nur bei rotem Gate stoppen.

