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

- Keine offenen kritischen Findings (Stand: 27.02.2026).

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
- Verifikation: `npm run smoke:selftrail` (erfolgreich) und manuelle Sichtpruefung im Spiel.
