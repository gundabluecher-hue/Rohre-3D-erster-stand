# Analysebericht (Delta)

Vergleichsbasis: vorheriger Bericht vom 2026-02-25.
Aktueller Vollmatrix-Lauf: 2026-02-27 (`docs/Testergebnisse_2026-02-27.md`).
Phase-6-Nachlauf (zielgerichtet): 2026-02-27 (`npm run smoke:roundstate`, `npm run test:core`, `npm run smoke:selftrail`, `npm run build`).

## Neue Issues / Warnungen

- Keine neuen offenen Warnungen im aktuellen Verifikationslauf der Phase 6.

## Regressionen

- Keine funktionalen Regressionen festgestellt (0 FAIL in T1-T125, 2/2 Smoke PASS).

## Erledigt / Behoben Seit 2026-02-25

- Behoben: Laufzeitfehler in `smoke:selftrail` (`derivedSkipRecent helper value not available`).
- Behoben: `test:core` T7 (HUD sichtbar) und T10 (Arena gebaut) sind wieder PASS.
- Behoben: Node-Warnung `[MODULE_TYPELESS_PACKAGE_JSON]` durch ESM-Umstellung (`"type": "module"`).
- Behoben: Vite-CJS-Deprecation-Hinweis im Test/Build-Pfad.
- Behoben: Chunk-Warnung >500 kB durch explizites `chunkSizeWarningLimit` in Vite-Config.
