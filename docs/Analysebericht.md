# Analysebericht

Dieser Bericht fasst die Ergebnisse der 125 System- und Integritätstests (`test:core`, `test:gpu`, `test:physics`, `test:stress`) zusammen.

## Letzter Lauf

- **Datum:** 2026-02-25

## ⚠️ Neue Fixes & Warnungen

- **Kritisch (Wichtig):** `smoke:selftrail` wirft einen Laufzeitfehler: `derivedSkipRecent helper value not available` für alle Fahrzeuge (drone, manta, aircraft).
- **Kritisch (Wichtig):** `test:core` schlägt bei T7 (HUD sichtbar) und T10 (Arena ist gebaut) fehl.

## ✅ Erledigt / Behoben

- `smoke:roundstate` import Pfad gefixt.
- `smoke:selftrail` Build/Vite Fehler in `Leaderboard.js` behoben.
- Automatische Test-Struktur (Playwright) für 125 System- und Integritätstests (`test:core`, `test:gpu`, `test:physics`, `test:stress`) wurde erfolgreich initiiert.
