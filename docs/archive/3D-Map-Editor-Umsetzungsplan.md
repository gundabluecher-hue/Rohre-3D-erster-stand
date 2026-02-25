# 3D Map Editor - Umsetzungsplan (kompakt)

Stand: 2026-02-21  
Projekt: Aero Arena 3D

## 1. Zielbild

Ein stabiler 3D-Map-Editor, der:
- Maps visuell erstellt und bearbeitet
- Maps sicher validiert
- Maps direkt im Spiel playtesten kann
- einen produktiven Workflow (Undo/Redo, Persistenz, gute UX) bietet

Priorisierung:
- P0: lauffaehiger End-to-End-Flow (Editor -> Spiel)
- P1: robuste Bearbeitung und schnelle Bedienung
- P2: Komfort und erweiterte Persistenz

## 2. Sinnvolle Hauptphasen

### Phase A - Fundament und End-to-End-Playtest (2-3 Tage)
Ziel:
- Datenmodell und Laufzeitpfad sauber verbinden.

Inhalt:
- Scope Freeze fuer MVP/V1
- versioniertes JSON-Schema (`schemaVersion`) finalisieren
- Migration fuer alte Map-JSONs
- Editor-Playtest (`custom_map_test`) im Spiel laden
- Fehlerpfade/Fallback fuer ungueltige Custom-Maps

Kern-Dateien:
- `editor/js/EditorMapManager.js`
- `js/modules/MapSchema.js` (neu)
- `js/modules/CustomMapLoader.js` (neu)
- `js/main.js`
- `js/modules/Arena.js`

Abnahme:
- "Map im Browser spielen" startet reproduzierbar exakt die aktuelle Editor-Map.

### Phase B - Editor-Kern stabilisieren (2-3 Tage)
Ziel:
- Editor-Operationen robust und konsistent machen.

Inhalt:
- eindeutige Objekt-IDs
- sauberes Create/Update/Delete-Lifecycle
- Selection-State und Transform-Flow haerten
- korrektes Freigeben von Geometrien/Materialien
- Asset-Loading robuster machen (Timeout/Fehler/Placeholder)

Kern-Dateien:
- `editor/js/EditorCore.js`
- `editor/js/EditorUI.js`
- `editor/js/EditorMapManager.js`
- `editor/js/EditorAssetLoader.js`

Abnahme:
- laengere Editing-Session ohne Geisterobjekte, inkonsistente Selektion oder offensichtliche Leaks.

### Phase C - Produktiver Workflow (2-3 Tage)
Ziel:
- Der Editor soll im Alltag schnell bedienbar sein.

Inhalt:
- Undo/Redo als Command-System
- bessere Properties-Bearbeitung (Position/Rotation/Scale konsistent)
- Multi-Select und Duplizieren
- Objektliste mit Suche/Filter
- Snap-Verbesserungen (Grid/Axis/Surface)

Kern-Dateien:
- `editor/js/EditorHistory.js` (neu)
- `editor/js/EditorUI.js`
- `editor/map-editor-3d.html`
- `editor/js/EditorInspector.js` (optional neu)

Abnahme:
- typischer Build-Flow (bauen, anpassen, rueckgaengig, exportieren) ist flach und schnell.

### Phase D - Validierung und Persistenz (1-2 Tage)
Ziel:
- Fehler frueh erkennen und Datei-Workflow professionalisieren.

Inhalt:
- Validierung: Arena-Grenzen, Tunnel-Minimallaenge, Spawn-Kollisionen, Portal-Regeln
- Warn-/Fehlerpanel mit klarer Trennung (blockierend vs Hinweis)
- Datei-Import/-Export (`.json`)
- AutoSave + "zuletzt geoeffnet"

Kern-Dateien:
- `editor/js/EditorValidation.js` (neu)
- `editor/js/EditorStorage.js` (neu)
- `editor/js/EditorMapManager.js`
- `editor/js/EditorUI.js`

Abnahme:
- ungueltige Maps werden klar gemeldet, gueltige Maps lassen sich sicher speichern/laden.

### Phase E - QA und Release (1 Tag)
Ziel:
- Release-faehiger Stand ohne P0-Blocker.

Inhalt:
- Smoke-Test-Matrix mit Referenzmaps
- Performance-Test bei hoher Objektzahl
- Regression auf Editor + Spielintegration
- Dokumentation aktualisieren

Kern-Dateien:
- `walkthrough.md`
- `Anleitung.md`
- `editor/README.md` (neu)

Abnahme:
- Build stabil, End-to-End-Flow stabil, keine offenen P0-Fehler.

## 3. Reihenfolge fuer Agent-Laeufe

1. Lauf 1: Phase A  
2. Lauf 2: Phase B  
3. Lauf 3: Phase C  
4. Lauf 4: Phase D  
5. Lauf 5: Phase E

Hinweis:
- Nach jedem Lauf: Build/Smoke-Test, kurze Doku, Commit.

## 4. Gesamte Akzeptanzkriterien

- Editor kann Maps erstellen, importieren, exportieren und im Spiel testen.
- Playtest nutzt die echte aktuelle Editor-Map (kein separates manuelles Mapping).
- Datenformat ist versioniert und migrierbar.
- Kernaktionen sind robust (inkl. Undo/Redo).
- Keine bekannten P0-Blocker nach Abschluss von Phase E.
