# AI Project Onboarding (Aktiv)

Stand: 2026-03-07

Diese Datei ist der aktuelle Einstieg fuer KI-Assistenz in diesem Repository.

## 1. Projektkontext

CuviosClash ist ein schnelles 3D-Browser-Spiel mit Trail-Kollisionen in einer Rohr-/Arena-Umgebung.
Hauptziel im Match: ueberleben, Gegner zu Kollisionen zwingen, Round- und Match-Siege erzielen.

## 2. Canonical Quellen (zuerst lesen)

1. `docs/ai_architecture_context.md`
2. `docs/Umsetzungsplan.md`
3. `docs/Analysebericht.md`
4. Neuester `docs/Testergebnisse_YYYY-MM-DD.md`
5. `docs/Dokumentationsstatus.md`

Hinweis: Historische Deep-Dive-Dokumente liegen in `docs/archive/`.

## 3. Harte Entwicklungsregeln

- Runtime-Pfade sind unter `src/` (nicht `js/modules/`).
- Zentrale Konstanten nur aus `src/core/Config.js`.
- Three.js-Cleanup ueber `src/core/three-disposal.js` und saubere `dispose()`-Pfade.
- Keine unnoetigen Allokationen in Hot Paths (`update`, Kollision, Bot-Sensing).
- State-Namen in Runtime/Doku konsistent halten (`PLAYING`, `ROUND_END`, `MATCH_END`).

## 4. Task-Start Checkliste

1. Scope aus User-Anfrage und `docs/Umsetzungsplan.md` ableiten.
2. Betroffene Module in `src/` und `tests/` identifizieren.
3. Aendern, dann Tests gemaess `.agents/test_mapping.md` ausfuehren.
4. Doku-/Prozess-Aktualitaet mit `npm run docs:sync` und `npm run docs:check` pruefen.
