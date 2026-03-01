# Umsetzungsplan (Master)

Dies ist der konsolidierte Plan fuer anstehende und laufende Implementierungen.
Neue Findings aus dem Analysebericht fliessen hier ein.

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

## Phase 1: [x] Kritische Build- und Pfad-Fixes

Erledigt: 25.02.2026

- Ziele:
  1. Build-Fehler rund um `three`-Aufloesung im UI-Pfad beheben.
  2. Importpfad im Round-State-Smoke auf ES-Module-Pfad aktualisieren.
- Dateien: `src/ui/Leaderboard.js`, `scripts/round-state-controller-smoke.mjs`
- Verifikation: `npm run smoke:selftrail`, `npm run smoke:roundstate`

## Phase 2a: [x] Kernfixes & UX - Menue und Profil

Erledigt: 25.02.2026

- Ziele:
  1. Profilname-Bugfix (sichere Eingabe).
  2. Build-/Versionsanzeige im Menue.
  3. Untermenues strukturieren.
  4. Mehrprofil-Flow stabilisieren.
- Dateien: `src/ui/UIManager.js`, `index.html`, `style.css`, `src/core/main.js`
- Verifikation: Manueller Profil-/Menue-Flow

## Phase 2b: [x] Kernfixes & UX - Gameplay

Erledigt: 25.02.2026

- Ziele:
  1. Portal-Ebenen reproduzierbar machen.
  2. First-Person-Boost-Kamera auf Nase/Flugzeugspitze legen.
- Dateien: `src/core/main.js`, `src/entities/Player.js`, `src/entities/Arena.js`
- Verifikation: In-Game-Kamera und Portal-Teleports manuell testen

## Phase 3a: [x] 3D-Map-Editor - Schema & Loading

Erledigt: 25.02.2026

- Ziele:
  1. Versioniertes JSON-Schema (v1, v2) sicherstellen.
  2. Map-Migration fuer alte JSONs implementieren.
  3. Laden von Custom-Maps in der Engine stabilisieren.
- Dateien: `src/entities/MapSchema.js`, `src/entities/CustomMapLoader.js`
- Verifikation: Alte Test-Map laden, kein Crash, korrektes Upgrade

## Phase 3b: [x] 3D-Map-Editor - End-to-End Integration

Erledigt: 25.02.2026

- Ziele:
  1. Editor fuer Map-Export anpassen.
  2. Editor-Playtest-Button im Spiel integrieren.
- Dateien: `editor/js/EditorMapManager.js`, `editor/js/ui/EditorSessionControls.js`, `src/core/main.js`
- Verifikation: End-to-End Flow bauen, speichern, im Browser spielen

## Phase 4a: [x] Bot-KI Struktur & Raycast-Navigation

Erledigt: 27.02.2026

- Ziele:
  1. KI-Struktur refactoren (Wahrnehmung/Entscheidung/Aktion).
  2. Kollisionsvermeidung durch robustere Mehrfach-Raycast-Proben.
- Dateien: `src/entities/Bot.js`, `src/entities/EntityManager.js`
- Verifikation: Stabilere Bot-Navigation, weniger Wandtreffer

## Phase 4b: [x] Bot-KI Anti-Stuck & Messung

Erledigt: 27.02.2026

- Ziele:
  1. Anti-Stuck-Verhalten und Recovery-Manoever verbessern.
  2. Winrate/Stuck-Events ueber automatische Runs messen.
- Dateien: `src/entities/Bot.js`, `src/state/RoundRecorder.js`, `scripts/bot-validation-runner.mjs`, `package.json`
- Verifikation: `npm run bot:validate` (4 Szenarien / 4 Runden)
- Ergebnis: Winrate 75.0%, Stuck-Events 0, BOUNCE_WALL 0, Ueberlebenszeit 53.04s
- Detailreport: `docs/Testergebnisse_Phase4b_2026-02-27.md`, `data/bot_validation_report.json`

## Phase 5: [x] Test-Runtime & Headless Fehler (P1)

Erledigt: 27.02.2026

- Ziele:
  1. Fehlende Helper-Werte (`derivedSkipRecent`) fuer Fahrzeuge in `smoke:selftrail` beheben.
  2. Fehlende HUD-Anzeige (T7) im Headless-Mode fixen.
  3. Arena-Generierung (T10) im Headless-Mode fixen.
- Dateien: `scripts/self-trail-debug-smoke.mjs`, `src/entities/Player.js`, `tests/helpers.js`, `tests/core.spec.js`, `src/core/main.js`, `playwright.config.js`
- Verifikation: `npm run smoke:selftrail`, `npm run test:core`, `npm run test:physics`, `npm run build` (alle gruen am 27.02.2026)

## Phase 6: [x] Toolchain-Warnungen und Bundle-Hinweise

Erledigt: 27.02.2026

- Ziele:
  1. Node-Warnung `[MODULE_TYPELESS_PACKAGE_JSON]` in `smoke:roundstate` entfernen.
  2. Vite-CJS-Deprecation-Hinweis im Test/Build-Pfad adressieren.
  3. Chunk-Warnung >500 kB reduzieren (Code-Splitting oder Limit-Entscheidung).
- Dateien: `package.json`, `playwright.config.js`, `vite.config.js`
- Verifikation: `npm run smoke:roundstate`, `npm run test:core`, `npm run smoke:selftrail`, `npm run build` (alle gruen am 27.02.2026)

## Phase 7: [x] Boost-Anzeige (UI)

Erledigt: 28.02.2026

- Ziele:
  1. Visueller HTML/CSS-Balken fuer den Spieler-Boost im Fighter-HUD.
  2. Dynamische Aktualisierung basierend auf Timer/Cooldown in `HUD.js`.
- Dateien: `index.html`, `style.css`, `src/ui/HUD.js`
- Verifikation: `npm run smoke:selftrail` (erfolgreich am 2026-02-28) und manuelle Sichtpruefung im Spiel.

## Phase 8: [x] Modulare Architektur fuer Performance und KI-Erweiterbarkeit

Geplant: 2026-03-01
Letztes Update: 2026-03-01
Erledigt: 2026-03-01

- Ziele:
  1. Kernmodule schrittweise modularisieren (`main.js`, `EntityManager`, `Bot`), ohne Verhalten zu brechen.
  2. KI ueber klare Policy-Schnittstellen erweiterbar machen.
  3. Hotpath-Allocations reduzieren und messbar validieren.
- Referenzplan: `docs/Feature_Modulare_Architektur_KI_Performance.md`
- Teilphasen:
  - 8.1 [x] Playing-State aus `main.js` extrahieren (Erledigt: 2026-03-01)
  - 8.2 [x] Entity-Update-Pipeline in Subsysteme schneiden (Erledigt: 2026-03-01)
  - 8.3 [x] Bot-Policy-Schnittstelle einfuehren (Erledigt: 2026-03-01)
  - 8.4 [x] Bot-Logik in Sensing/Decision/Action Module splitten (Erledigt: 2026-03-01)
  - 8.5 [x] Hotpath-Allocations und Kollisionspfad optimieren (Erledigt: 2026-03-01)
  - 8.6 [x] Messung/Baseline fuer Performance und KI-Stabilitaet (Erledigt: 2026-03-01)
  - 8.7 [x] Abschluss, Cleanup, Architektur-Doku finalisieren (Erledigt: 2026-03-01)
- Verifikation pro Teilphase:
  - Gemappte Tests gemaess `.agents/test_mapping.md`
  - Pflicht-Gates: `npm run docs:sync` und `npm run docs:check`

- Phase 9: [x] Modularisierung UI & Settings (main.js Split)

Geplant: 2026-03-01

- Ziele:
  1. `main.js` massiv verkleinern durch Auslagerung von persistenten Profilen und Einstellungen.
  2. Trennung von Rendering/Game-Loop und DOM-Menue-Steuerung.
- Referenzplan: `docs/Feature_Modularisierung_UI_Settings.md`
- Teilphasen:
  - [x] 9.1 SettingsManager extrahieren
  - [x] 9.2 ProfileManager extrahieren
  - [x] 9.3 MenuController extrahieren
- Verifikation pro Teilphase:
  - Manuelle Funktionalitaetstests (Laden/Speichern, UI-Buttons).
  - Pflicht-Gates: `npm run docs:sync` und `npm run docs:check`

## Phase 10: [ ] Vertiefte Modularisierung fuer Performance und Wartbarkeit

Geplant: 2026-03-01
Letztes Update: 2026-03-01

- Ziele:
  1. Laufzeit- und UI-Orchestrierung weiter entkoppeln (`main.js` als duenne Shell).
  2. `EntityManager`, `Arena` und `Bot` in klar testbare Subsysteme schneiden.
  3. Performance-Hotpaths (Projectile, Trail, Collision) isolieren und reproduzierbar messen.
- Referenzplan: `docs/Feature_Modularisierung_Phase10_Performance_Wartbarkeit.md`
- Teilphasen:
  - [x] 10.1 Core Runtime Loop final entkoppeln (Erledigt: 2026-03-01)
  - [x] 10.2 UI-Verantwortung konsolidieren (UIManager vs MenuController) (Erledigt: 2026-03-01)
  - [x] 10.3 HUD- und Crosshair-Logik als eigene Systeme (Erledigt: 2026-03-01)
  - [ ] 10.4 EntityManager Split I - ProjectileSystem
  - [ ] 10.5 EntityManager Split II - TrailSpatialIndex
  - [ ] 10.6 Arena Split - Builder / Collision / PortalGate
  - [ ] 10.7 Bot Split II - Recovery/Targeting/Scoring Ops
  - [ ] 10.8 RuntimeConfig Snapshot statt globaler Streuung
  - [ ] 10.9 Abschluss, Baseline-Vergleich, Cleanup
- Verifikation pro Teilphase:
  - Gemappte Tests gemaess `.agents/test_mapping.md`
  - Pflicht-Gates: `npm run docs:sync` und `npm run docs:check`
- Prompt-Regel:
  - Am Ende jeder Teilphase den im Referenzplan definierten "Naechster-Chat-Prompt" ausgeben und damit direkt die Folgephase starten.
