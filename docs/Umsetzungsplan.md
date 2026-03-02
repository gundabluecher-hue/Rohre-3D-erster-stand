# Umsetzungsplan (Master)

Dies ist der konsolidierte Plan fuer anstehende und laufende Implementierungen.
Neue Findings aus dem Analysebericht fliessen hier ein.

> Abgeschlossene Phasen 1-10 siehe [Archiv](Umsetzungsplan_Archiv_Phase1-10.md).

## Status-Uebersicht

- [ ] Offen
- [/] In Bearbeitung
- [x] Abgeschlossen

---

## Prioritaeten (Triage)

**Wichtig:**

- Keine offenen kritischen Findings (Stand: 28.02.2026, Nachvalidierung `smoke:selftrail` PASS).

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

## Phase 11: [ ] Jagd-Modus (neuer Spielmodus)

Geplant: 2026-03-02
**Parallelbetrieb:** Laeuft parallel zu Phase 12. Phase 12.9 und 12.10 warten auf Teilphasen aus Phase 11 (siehe Gates in Phase 12).

- Ziele:
  1. Neuer aktivierbarer Spielmodus "Jagd" mit HP, MG (Ueberhitzung), 3-Stufen-Raketen, zerstoerbarer Spur, Schild, Respawn, Kill-Feed, Screen-Shake.
  2. Eigenes modulares Verzeichnis `src/hunt/`. Feature-Flag `CONFIG.HUNT.ENABLED`. Keine Regression im Classic-Modus.
- Referenzplan: `docs/Feature_JagdModus.md`
- Teilphasen:
  - [x] 11.1 Game-Mode-Infrastruktur (HuntMode, HuntConfig, Menue-Toggle, Feature-Flag)
  - [x] 11.2a HP-System (Player-Erweiterung, HealthSystem)
  - [x] 11.2b Collision-Umstellung (HP statt Kill)
  - [x] 11.3 HUD: HP-Bar, Overheat-Bar, Kill-Feed, Schadens-Indikator
  - [x] 11.4 MG mit Ueberhitzung (OverheatGunSystem, Tracer, Falloff)
  - [x] 11.5 3-Stufen-Raketen (schwach/mittel/stark, Arena-Pickups)
  - [ ] 11.6 Zerstoerbare Spur (niedrige Trail-HP, schnell kaputt)
  - [ ] 11.7 Schild-Powerup + 3D-Powerup-Modelle (lizenzfrei)
  - [ ] 11.8 Screen-Shake, Schadens-Indikator, Kill-Feed
  - [ ] 11.9 Respawn-System + erweitertes Scoring
  - [ ] 11.10 Bot-KI fuer Jagd-Modus (HuntBotPolicy)
  - [ ] 11.11 Abschluss, Balancing, Cleanup
- Verifikation pro Teilphase:
  - `npm run test:core`, `npm run test:physics`, `npm run smoke:selftrail`, `npm run build`
  - Classic-Modus Regressionstest bei jeder Phase
  - Pflicht-Gates: `npm run docs:sync` und `npm run docs:check`
- Prompt-Regel:
  - Am Ende jeder Teilphase den im Referenzplan definierten "Naechster-Chat-Prompt" ausgeben und damit direkt die Folgephase starten.

---

## Phase 12: [ ] KI-freundliche Modularisierung (kleine Splits)

Geplant: 2026-03-02
Letztes Update: 2026-03-02
**Parallelbetrieb:** Laeuft parallel zu Phase 11. Einige Teilphasen haben Dependency-Gates (siehe unten).

- Ziele:
  1. Verbleibende grosse Module in kleine, KI-stabile Aufgaben schneiden.
  2. Pro Teilphase maximal 2-5 produktive Dateien anfassen.
  3. Wartbarkeit erhoehen ohne funktionale Regression.
- Referenzplan: `docs/Feature_Modularisierung_Phase12_KI_Freundliche_Splits.md`
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
  - [ ] 12.12 Abschluss, Verifikation, Cleanup
- Verifikation pro Teilphase:
  - Gemappte Tests gemaess `.agents/test_mapping.md`
  - Pflicht-Gates: `npm run docs:sync` und `npm run docs:check`
- Git-Checkpoint pro Teilphase:
  - Nach erfolgreicher Verifikation genau ein atomarer Commit (Rollback-freundlich).
  - Commit-Schema: `refactor(phase12.X): <kurze-beschreibung>`
- Prompt-Regel:
  - Am Ende jeder Teilphase den im Referenzplan definierten "Naechster-Chat-Prompt" ausgeben und damit direkt die Folgephase starten.
