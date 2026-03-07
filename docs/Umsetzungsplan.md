# Umsetzungsplan (Aktiver Master)

Stand: 2026-03-07

Dieser Masterplan ist die einzige aktive Planquelle fuer offene Arbeit.
Abgeschlossene oder abgeloeste Planstaende liegen unter `docs/archive/plans/`.

## Status-Uebersicht

- [ ] Offen
- [/] In Bearbeitung
- [x] Abgeschlossen

## Nutzung

- Offene Punkte werden nur noch in diesem Dokument gepflegt.
- Abgeschlossene Root-Plaene werden nach `docs/archive/plans/completed/` verschoben.
- Abgeloeste Master-/Detailplaene werden nach `docs/archive/plans/superseded/` verschoben.
- Historische Altarchive unter `docs/archive/` bleiben als Referenz bestehen.

## Bearbeitungsprotokoll (merge-sicher)

- Bestehende Bloecke werden nicht umsortiert oder umnummeriert.
- Statusaenderungen passieren nur im jeweils betroffenen Block.
- Neue Plaene werden bei Parallelbetrieb nicht mitten in bestehende Bereiche eingefuegt.
- Ein zweiter Agent haengt neue Planideen oder neue Referenzplaene nur in `Plan-Eingang (append-only)` an.
- Die Rueckfuehrung aus dem Eingang in einen Hauptblock passiert spaeter in einem separaten Cleanup-Schritt.
- Prioritaeten und Index werden bewusst seltener angepasst als die Detailbloecke, um Merge-Konflikte klein zu halten.

## Schnellindex Offener Arbeit

- `V26 Gameplay & Features`: `V4`, `V5`, `V9`, `V11`, `V16`
- `V27 Profile, Statistiken & UI`: `V7`, `V8`, `V15`
- `V28 Architektur & Performance`: `V13`, Player-/Bot-God-Class-Refactoring
- `Nachlauf / Technik`: `N1` Multiplayer-Runtime, `N2` Recording-UI, `N3` T82-Policy-Fix (geparkt), `T1` Testersatz, `T2` Bundle-Groesse

## Prioritaeten (stabil, nur bei Bedarf anpassen)

**Wichtig:**

- V26-Restumfang abschliessen (`V4`, `V5`, `V9`, `V11`, `V16`).
- `maze`-Hotspot fuer V13 gezielt vorbereiten.

**Mittel:**

- V27 Profile, Statistiken und Balancing-Telemetrie.
- V28 God-Class-Abbau und Core-Performance.

**Querschnitt / Nachlauf:**

- Multiplayer-Runtime statt Menu-Stub.
- Recording-UI / manueller Trigger fuer V29.
- Dummy-Tests schrittweise durch echte Integritaetstests ersetzen.
- Bundle-Groesse ueber Code-Splitting weiter optimieren.

## Aktive Workstreams

### Block V26: Gameplay & Features

- Scope: `V4`, `V5`, `V9`, `V11`, `V16`
- Hauptpfade: `src/hunt/**`, `src/entities/**`, `src/core/**`, `src/ui/**`
- Konfliktregel: keine neuen fremden Plaene mitten in diesen Block einfuegen; neue Arbeit nur im `Plan-Eingang` ankuendigen

- [ ] 26.0 Baseline-Freeze und Gameplay-Metriken erfassen
- [ ] 26.1 V4 Treffer-/Schadensfeedback (Audio & VFX)
  - [ ] 26.1.1 Audio-Signale fuer MG, Raketen und Schild implementieren
  - [ ] 26.1.2 VFX-Signale (Partikel/Flashes) bei Treffern ausbauen
- [ ] 26.2 V5 Hunt-Mode Feintuning
  - [ ] 26.2.1 TTK und Overheat-Werte basierend auf Testdaten anpassen
  - [ ] 26.2.2 Respawn- und Pickup-Logik verfeinern
- [ ] 26.4 V9 Replay/Ghost-System fuer die letzte Runde aufbauen
- [ ] 26.5 V11 GLB-Map Loader Integration (konsolidiert aus altem Detailplan)
  - [ ] 26.5.1 `GLTFLoader`/`GLBMapLoader` einfuehren
  - [ ] 26.5.2 `glbModel` in Map-Definitionen und Schema aufnehmen
  - [ ] 26.5.3 `Arena.build()` asynchron machen und Fallback-Pfad absichern
  - [ ] 26.5.4 Beispiel-GLB oder reproduzierbares Test-Asset bereitstellen
  - [ ] 26.5.5 UI-Integration fuer Map-Auswahl und Ladezustand nachziehen
  - [ ] 26.5.6 GLB-Loader-Test, Fallback-Test und manuelle Verifikation abschliessen
- [ ] 26.6 V16 Event-Playlist / Fun-Modes Mechanik testen
- [ ] 26.8 Abschluss-Gate, Playtest und Doku-Freeze (`docs:sync`, `docs:check`)

### Block V27: Profile, Statistiken & UI

- Scope: `V7`, `V8`, `V15`
- Hauptpfade: `src/ui/**`, `src/state/**`, `scripts/**`, `data/**`
- Konfliktregel: Statistik-/Profil-Details nur in diesem Block pflegen

- [ ] 27.0 Baseline-Freeze und UI-Markup-Analyse
- [ ] 27.1 V7 Profile-UX Ausbau
  - [ ] 27.1.1 Duplizieren und Import/Export-Funktion
  - [ ] 27.1.2 Standardprofil-Markierung ergaenzen
- [ ] 27.2 V8 Post-Match-Statistiken
  - [ ] 27.2.1 Datenaggregator fuer Round/Match-Stats ausbauen
  - [ ] 27.2.2 UI-Overlay fuer vertiefte Statistiken am Rundenende
- [ ] 27.3 V15 Telemetrie-Dashboard fuer iteratives Balancing
- [ ] 27.4 Abschluss-Gate, UI-Verifikation und Doku-Freeze (`docs:sync`, `docs:check`)

### Block V28: Architektur & Performance

- Scope: `V13`, Player-/Bot-God-Class-Refactoring
- Hauptpfade: `src/entities/**`, `src/core/**`
- Konfliktregel: `maze`-Optimierung und Klassen-Splits bleiben in diesem Block gebuendelt

- [ ] 28.0 Baseline-Freeze und Regression-Setup
- [ ] 28.1 Player "God Class" Refactoring
  - [ ] 28.1.1 Three.js Rendering in `PlayerView` auslagern
  - [ ] 28.1.2 Input-Handling in `PlayerController` isolieren
- [ ] 28.2 Bot "God Class" Refactoring
  - [ ] 28.2.1 Rendering in `BotView` kapseln
  - [ ] 28.2.2 Sensing/Probing-Logik fuer kuenftiges ML-Training abstrahieren
- [ ] 28.3 V13 Performance-Hotspot `maze` (Draw-Calls / Batching optimieren)
- [ ] 28.4 Abschluss-Gate, Performance-Metrics pruefen und Doku-Freeze (`docs:sync`, `docs:check`)
- [ ] 28.5 Performance-Offensive (CPU/GPU/Startup)
  - [ ] 28.5.0 Baseline-Refresh und Messharness absichern
  - [ ] 28.5.1 GPU-Hotspot `maze`/Portale weiter reduzieren
  - [ ] 28.5.2 Renderer-/Kamera-Hotpath budgetieren
  - [ ] 28.5.3 Bot-/Trail-CPU-Hotpaths nachziehen
  - [ ] 28.5.4 Allocation-/GC-Budget im Hotpath erzwingen
  - [ ] 28.5.5 Start-/Transition-Latenz reduzieren
  - [ ] 28.5.6 Recording-Overhead isolieren
  - [ ] 28.5.7 HUD/UI-Hotpath nachziehen
  - [ ] 28.5.8 Abschluss-Gate und Doku-Freeze (`docs:sync`, `docs:check`)

## Nachlauf / Technik-Backlog

- [ ] N1 Multiplayer-Runtime statt UI-Stub
  - Ziel: Host/Join/Ready-Stubs in echte Netzwerksession und Runtime-Wiring ueberfuehren.
  - Zielpfade: `src/ui/menu/MenuMultiplayerBridge.js`, `src/core/main.js`, kuenftige Netzwerkmodule.
- [ ] N2 Recording-UI / manueller Trigger fuer V29
  - Ziel: optionalen UI-Toggle bzw. manuellen Recording-Trigger produktiv anbinden.
  - Zielpfade: `index.html`, `src/ui/KeybindEditorController.js`, `src/ui/menu/MenuControlBindings.js`, `src/core/MediaRecorderSystem.js`.
  - Status 2026-03-07: statischer Launcherpfad wieder kompatibel; Bare-Import `mp4-muxer` wird im Browserpfad ueber die Importmap aufgeloest und `server.ps1` liefert `.mjs` korrekt aus.
  - Status 2026-03-07: Cinematic-Kamera funktioniert wieder konsistent in `THIRD_PERSON`, auch wenn `cockpitCamera` aktiv ist (GPU-Regressionstest `T33b`).
- [ ] N3 T82 Policy-Wiring isolieren und spaeter separat beheben (Punkt 5 geparkt)
  - Ziel: Divergenz in `tests/physics-policy.spec.js` (`T82`: erwartet `hunt-bridge`, erhaelt `classic-bridge`) isolieren und minimal fixen.
  - Status: bewusst separat vom Cinematic-Follow-up geparkt; nicht Teil von `docs/Feature_Cinematic_Camera_Followup_V29b.md`.
  - Verifikation (bei Abarbeitung): `npm run test:physics -- -g "T81|T82"` plus `npm run docs:sync` und `npm run docs:check`.
- [ ] T1 Dummy-Tests schrittweise durch echte Integritaetstests ersetzen
  - Ziel: bestehende Platzhaltertests entlang des geaenderten Codes ersetzen.
  - Status 2026-03-07: Playwright-Menuecheck erfolgreich (`npm run test:core` = 48 passed / 1 skipped, `npm run test:stress` = 19 passed).
  - Offene Befunde 2026-03-07: `Profil speichern` bleibt nach Eingabe deaktiviert; `Build-Info kopieren` hat kein Runtime-Binding.
- [ ] T2 Bundle-Groesse weiter optimieren
  - Ziel: Code-Splitting und Ladepfade nur dann vertiefen, wenn der Nutzen messbar bleibt.

## Plan-Eingang (append-only)

Regeln:

- Neue Plaene eines zweiten Agenten nur hier am Ende anhaengen.
- Bestehende Bloecke dafuer nicht umsortieren.
- Pro neuem Plan genau einen Eintrag anlegen; die spaetere Einsortierung passiert separat.

Template:

- [ ] PX Kurztitel
  - Erstellt am: `YYYY-MM-DD`
  - Agent: `A` oder `B`
  - Plan-Datei: `docs/Feature_Name.md`
  - Datei-Scope: `src/...`, `tests/...`
  - Konfliktregel: kurzer Hinweis zu Datei-Overlap oder bewusstem Non-Overlap

<!-- PLAN-INTAKE-START -->
- [ ] PX Menu UX Follow-up V26.3c
  - Erstellt am: `2026-03-06`
  - Agent: `A`
  - Plan-Datei: `docs/Feature_Menu_UX_Followup_V26_3c.md`
  - Datei-Scope: `index.html`, `style.css`, `src/ui/**`, `tests/**`
  - Konfliktregel: nur append-only Intake-Eintrag; keine Umsortierung bestehender Masterplan-Bloecke waehrend paralleler Restrukturierung
- [ ] PX Performance-Offensive V28.5
  - Erstellt am: `2026-03-07`
  - Agent: `A`
  - Plan-Datei: `docs/Feature_Performance_Offensive_V28_5.md`
  - Datei-Scope: `src/core/**`, `src/entities/**`, `src/hunt/**`, `src/ui/**`, `scripts/**`, `tests/**`
  - Konfliktregel: Performance-Hotpaths nur innerhalb V28.5-Phasen aendern; keine Umsortierung bestehender Bloecke
- [ ] PX Cinematic Camera Follow-up V29b
  - Erstellt am: `2026-03-07`
  - Agent: `A`
  - Plan-Datei: `docs/Feature_Cinematic_Camera_Followup_V29b.md`
  - Datei-Scope: `src/core/**`, `src/entities/systems/CinematicCameraSystem.js`, `src/ui/**`, `tests/gpu.spec.js`, `tests/core.spec.js`, `tests/physics-policy.spec.js`, `docs/**`
  - Konfliktregel: beinhaltet Vorschlaege 1/2/3/4/6; Vorschlag 5 bleibt separat als `N3` geparkt
<!-- PLAN-INTAKE-END -->

## Archivierte Referenzen

- Abgeschlossen: `docs/archive/plans/completed/`
- Abgeloest: `docs/archive/plans/superseded/`
- Frueherer Masterstand: `docs/archive/plans/superseded/Umsetzungsplan_bis_2026-03-06.md`
- GLB-Detailplan alt: `docs/archive/plans/superseded/Feature_GLB_Map_Loader.md`

## Dokumentations-Hook

Vor Task-Abschluss immer:

- `npm run docs:sync`
- `npm run docs:check`
