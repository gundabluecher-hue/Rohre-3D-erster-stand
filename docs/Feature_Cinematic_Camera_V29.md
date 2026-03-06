# Feature: Cinematic Camera & Auto-Recording (V29)

Stand: 2026-03-06  
Status: Erweitert (Nachtrag umgesetzt am 2026-03-06)  
Owner: Single-Agent Umsetzung

## Ziel

Filmische Kamera-Perspektiven und automatische Match-Aufzeichnung aufbauen, ohne den laufenden Menue-Umbau (V26.3) funktional oder organisatorisch zu blockieren.

## Scope

- `src/core/MediaRecorderSystem.js` (neu)
- `src/entities/systems/CinematicCameraSystem.js` (neu)
- optionale Verdrahtung in `src/core/main.js` oder dedizierter Runtime-Bridge
- zugehoerige Tests fuer Lifecycle-/Recording-Flows

## Nachtrag 2026-03-06 (User-Request)

- Auto-Download fuer Match-Recordings aktivieren.
- Download-Dateinamen auf `videos/...` praefixieren (Ordnerkonvention im Browser-Download).
- Eine globale, im Menue belegbare Taste fuer Cinematic-Kamera umschalten (ein Key fuer beide Spieler).

## Nicht-Ziele

- Kein grosser Menue-Refactor in V29.
- Keine verpflichtende UI-Integration in V29-Kernphasen.
- Kein Ausbau auf vollwertigen Video-Editor oder Post-Processing-Toolchain.

## Architektur & Komponenten

1. Auto-Recording Pipeline (`src/core/MediaRecorderSystem.js`)
   - `canvas.captureStream(fps)` als Quelle.
   - `MediaRecorder` Lifecycle (`start`, `dataavailable`, `stop`) kapseln.
   - Export-/Download-Pfad kapseln (Dateiname, MIME, Error-Handling).

2. Cinematic Camera Rig (`src/entities/systems/CinematicCameraSystem.js`)
   - Modus-Switch zwischen Player-Cam und Cinematic-Cam.
   - Pfad-/Tracking-Modi (z. B. spline, orbit, follow) als Strategie-Set.
   - Keine direkte Kopplung an Menue-DOM.

3. Lifecycle-Verzahnung (Shared Contract)
   - Events: `match_started`, `match_ended`, `menu_opened`.
   - Optional: `recording_requested` fuer spaetere UI-Trigger.
   - Contract-Versionierung: `lifecycle.v1`.

## Parallelbetrieb mit V26.3 (Non-Overlap-Freeze)

- V29 besitzt primaer:
  - `src/core/MediaRecorderSystem.js`
  - `src/entities/systems/CinematicCameraSystem.js`
  - kamera-/recordingnahe Runtime-Verdrahtung
- V26.3 besitzt primaer:
  - `index.html`, `style.css`, `src/ui/**`, `src/ui/menu/**`
- Zulassige Ueberlappung:
  - `src/core/main.js` nur fuer Event-Routing und Adapter-Wiring.
  - Nachtrag 2026-03-06: gezielte Controls-UI-Ergaenzung fuer globale Cinematic-Taste in
    - `index.html`
    - `src/ui/KeybindEditorController.js`
    - `src/ui/menu/MenuControlBindings.js`
    - `src/core/GameBootstrap.js`
- Verbotene Ueberlappung waehrend V26.3 Kernphasen:
  - keine V29-getriebene Umstrukturierung der Menue-Navigation.
  - keine Aenderungen an `src/ui/UIManager.js` oder `src/ui/MenuController.js`.

## Feature-Flags

- `cinematicEnabled` (globaler Kamera-Feature-Schalter)
- `autoRecordingEnabled` (automatisches Start/Stop aktiv)
- optional spaeter: `recordingUiEnabled` (UI-Toggle separat, nicht Kern von V29)

## Fallback- und Plattformstrategie

- Wenn `MediaRecorder` nicht verfuegbar:
  - Feature deaktivieren, Toast/Console-Hinweis, kein Hard-Fail.
- Wenn `captureStream` fehlt oder fehlschlaegt:
  - Recording deaktivieren, Camera-Feature bleibt nutzbar.
- MIME-Fallback-Reihenfolge definieren (`webm` Varianten), mit Detektion zur Laufzeit.
- Mobile/Browser-Limits als bekannte Restrisiken dokumentieren.

## Phasenplan (Block V29)

- [x] 29.0 Baseline-Verifikation & Canvas-Probe (abgeschlossen 2026-03-05)
  - Ziele:
    - Browserfaehigkeit von `captureStream`/`MediaRecorder` pruefen.
    - Lifecycle-Hooks im Ist-Zustand dokumentieren.
  - Verifikation:
    - `npm run test:core`
    - gezielte Probe-Skripte lokal

- [x] 29.1 Implementierung `MediaRecorderSystem` (abgeschlossen 2026-03-05)
  - Ziele:
    - Stream-/Recorder-Lifecycle kapseln.
    - Export, Filename-Konzept, Fehlerpfade implementieren.
  - Verifikation:
    - `npm run test:core`

- [x] 29.2 Implementierung `CinematicCameraSystem` (abgeschlossen 2026-03-05)
  - Ziele:
    - Camera-Mode-Strategien und sanfter Mode-Wechsel.
    - Sichere Rueckkehr auf Player-Cam.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:gpu`

- [x] 29.3 Lifecycle-Anbindung (Auto-Start/Stop) (abgeschlossen 2026-03-05)
  - Ziele:
    - `lifecycle.v1` Event-Contract anbinden.
    - Start/Stop an Matchgrenzen koppeln.
  - Verifikation:
    - `npm run test:core`
    - `npm run smoke:roundstate`

- [x] 29.4 Abschluss-Gate, Regression & Doku-Freeze (abgeschlossen 2026-03-05)
  - Ziele:
    - Non-Overlap mit V26.3 gegenpruefen.
    - Restrisiken (Browser/MIME/Performance) dokumentieren.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:gpu`
    - `npm run docs:sync`
    - `npm run docs:check`

## Teststrategie

- Pflicht:
  - `test:core` fuer Lifecycle- und Runtime-Verhalten
  - `test:gpu` fuer Kamera-/Render-Sicherheit
- Bei Lifecycle-Aenderungen:
  - `smoke:roundstate`
- Nicht Ziel in V29:
  - grosser Menue-/DOM-Testumbau (bleibt V26.3)

## Risiken / Gegenmassnahmen

- Risiko: Browser-Inkompatibilitaet beim Recording.
  - Gegenmassnahme: Runtime-Feature-Detection + sanfter Fallback.
- Risiko: Ueberlappung mit V26.3 in `main.js`.
  - Gegenmassnahme: Event-Contract + Adaptergrenzen, keine UI-Refactors in V29.
- Risiko: Performance-Einbruch bei aktivem Recording.
  - Gegenmassnahme: Flag-gesteuerte Aktivierung, FPS-/Frametime-Beobachtung im Abschlussgate.

## Abschlussnotizen (2026-03-05)

- Non-Overlap zu V26.3 eingehalten:
  - Keine Aenderung an `src/ui/UIManager.js` und `src/ui/MenuController.js`.
  - Recording nur an WebGL-Canvas + Match-Lifecycle angebunden (`MatchLifecycleSessionOrchestrator`).
  - Cinematic-System nur im Kamera-Rig verdrahtet (`CameraRigSystem`).

## Nachtragsnotizen (2026-03-06)

- Auto-Download ist aktiv (`autoDownload: true`) und nutzt den Download-Praefix `videos/`.
- Globale Menue-Taste `CINEMATIC_TOGGLE` ist belegbar und toggelt Cinematic fuer beide Spieler.
- Lokaler Repo-Ordner `videos/` ist als Artefaktordner angelegt (`videos/.gitkeep`).

## Dokumentations-Hook

Bei Implementierungsabschluss verpflichtend:

- `npm run docs:sync`
- `npm run docs:check`
