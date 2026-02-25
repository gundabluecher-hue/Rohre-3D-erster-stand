# Next Chat Prompt (paste into next Codex chat)

Arbeite im Projekt `c:\\Users\\gunda\\Desktop\\Rohre-3D-erster-stand` weiter.

Wichtig: Bitte zuerst den aktuellen Ist-Stand revalidieren und nicht blind auf diesem Prompt aufbauen.

## Verbindliches Vorgehen vor dem Weiterarbeiten

1. `Spielanalyse_Projektstruktur_Audit.md` lesen (nur relevante Teile, inkl.):
   - `## Umsetzungsstatus (Session 2026-02-22, append)`
   - `### Zusatz-Append (Session 2026-02-22, Profil-UI / Phase 1e Verifikation)`
   - `### Zusatz-Append (Session 2026-02-22, RoundStateOps / Phase 1f kleiner Refactor)`
   - `### Zusatz-Append (Session 2026-02-22, Self-Trail Grid-Robustheit + Debug-Instrumentierung)`
2. Git-/Worktree-Status pruefen (nur lesen, nichts resetten):
   - `git status --short`
   - `git diff --name-status`
   - `git diff --stat`
   - `git diff --cached --name-status`
   - `git diff --cached --stat`
   - `git log --oneline -n 12`
3. Gezielte `rg`-Checks auf aktuellen Stand (Round/Match + Self-Trail + Debug):
   - `js/main.js`:
     - `deriveRoundEndOutcome`, `RoundStateOps`, `_onRoundEnd`, `_startRound`, `ROUND_END`, `MATCH_END`
     - `setTimeScale(1.0)`
     - `clearMatchScene`, `particles.dispose`
   - `js/modules/RoundStateOps.js`:
     - `deriveRoundEndOutcome`, `requiredWins`, `canWinMatch`
   - `js/modules/EntityManager.js`:
     - `TRAIL_SELF`, `checkGlobalCollision`
     - `deriveSelfTrailSkipRecentSegments`, `selfTrailSkipRecent`
     - `_getSegmentGridKeys`, `registerTrailSegment`, `unregisterTrailSegment`
     - `traildebug`, `register-segment`, `skip-recent`, `self-hit`
   - `js/modules/Renderer.js`:
     - `clearMatchScene`
   - `js/modules/SettingsStore.js`:
     - `SettingsStore`, `findProfileByName`, `findProfileIndexByName`
4. Kurz revalidieren:
   - Was ist weiterhin wie erwartet vorhanden?
   - Was hat sich seit letztem Commit / seit letztem validierten Stand geaendert (inkl. unverwandter Dateien / neue Commits)?
   - Welche Aenderungen sind uncommitted und runtime-relevant (nicht nur `dist/` / `editor/` / `node_modules/`)?

## Letzter validierter Stand (bitte revalidieren)

- Profil-/Settings-Refactor (Phase 1e) war revalidiert und browserseitig getestet:
  - `SettingsStore`
  - `ProfileDataOps.js`
  - `ProfileUiStateOps.js`
  - `ProfileControlStateOps.js`
  - `resolveActiveProfileName(...)`-Fallback in `main.js`
- Phase-1f-Refactor umgesetzt (verhaltensneutral):
  - Round-/Match-End-Entscheidungslogik aus `_onRoundEnd()` in `js/modules/RoundStateOps.js` ausgelagert (`deriveRoundEndOutcome(...)`)
- Self-Trail-Fix vorhanden:
  - dynamisches `deriveSelfTrailSkipRecentSegments(player)` statt fixer `skipRecent=25`
- Zusaetzlicher Self-Trail-Robustheits-Fix vorhanden:
  - Trail-Segmente werden im Spatial Grid ueber alle relevanten Zellen registriert (nicht nur Mittelpunkt-Zelle)
  - `unregisterTrailSegment(...)` kann Single-Key oder Key-Array verarbeiten
- Technische Verifikation bereits erfolgt:
  - Node-Smoke fuer Long-Segment/Grid-Fall erfolgreich
  - Browser-Headless-Smoke via `npm run dev` + Playwright erfolgreich (`?playtest=1`)
- Optionale Debug-Instrumentierung vorhanden:
  - `?traildebug=1` (alternativ `?collisiondebug=1`) loggt `register-segment`, `skip-recent`, `self-hit` (mit Log-Cap)

## Aufgabe fuer diese Session (bevorzugter Scope)

### Ziel: Manuellen Ingame-Smoke fuer Self-Trail praktisch abschliessen und Debug-Logs auswerten

Bevorzugt:
1. Browser-/Ingame-Smoke gegen `npm run dev`:
   - `http://127.0.0.1:4173/?playtest=1&traildebug=1` (oder Port revalidieren)
   - enge Kurven / Loopings / Rueckkehr in eigene Spur testen
   - mehrere Schiffe testen (klein/gross)
   - wenn moeglich auch bei etwas instabiler FPS testen
2. Konsole auswerten:
   - treten `skip-recent`-Logs auf, wenn Kollision gefuehlt "zu spaet" kommt?
   - treten `register-segment`-Logs mit hohem `keyCount` / langen Segmenten auf (Frame-Drops)?
   - bei echten Treffern: `self-hit` mit plausiblen `skipRecent`-Werten?
3. Nur falls weiterhin Aussetzer auftreten:
   - kleiner, gezielter Follow-up-Fix in `js/modules/EntityManager.js`
   - verhaltensneutral bleiben (kein grosser Umbau)

## Nicht in diesem Schritt anfassen

- `_applySettingsToRuntime()`
- Profil-/Settings-UI-Refactor
- Renderer/Scene-Lifecycle-Refactors
- `dist/` neu bauen, wenn nicht zwingend noetig
- `node_modules/` aufraeumen per destruktiven Befehlen

## Praktische Regeln

- Unverwandte Aenderungen im Worktree nicht ueberschreiben
- `dist/`, `editor/`, `node_modules/` nicht mit committen
- Selektiv stagen, falls ein Commit vorbereitet wird (nur relevante Dateien)
- Vor Commits `git diff --cached --check` ausfuehren

## Hilfreiche Verifikationen (optional)

- Gezielter Node-Smoke fuer `EntityManager.registerTrailSegment(...)` / `checkGlobalCollision(...)` (Long-Segment-Fall)
- Kleiner Headless-Browser-Smoke zur Konsolenlog-Erfassung mit `?traildebug=1`, falls manueller Test nicht moeglich
- `git show --stat --name-only 38997b7` falls der Stand unklar ist

## Nach der Arbeit (verbindlich)

- Zusammenfassung der Aenderungen
- Verifikationsergebnisse (insb. Ingame-Smoke + Debug-Log-Auswertung)
- Verhaltensaenderung ja/nein
- offene Risiken / naechste Schritte
- falls sinnvoll: kurzer Audit-Append (append only)

## WICHTIG: Format der finalen Ausgabe

Am Ende der Ausgabe muessen nach der Umsetzungsdokumentation klare Handlungsanweisungen stehen (separate Schluss-Sektion), z. B. `Klare Handlungsanweisungen (naechste Schritte)`.

Anforderungen an diese Schluss-Sektion:
- nummerierte Liste (`1.`, `2.`, `3.`)
- konkrete, sofort ausfuehrbare Schritte
- wenn passend mit exakten Befehlen / Dateien
- jeweils kurz mit Ziel/Erwartung
- keine vagen Formulierungen
