# Testergebnisse 2026-02-25

## 1. System- & Code-Integritätstests

- **`npm run test:core`**: ❌ FAIL (18 PASS, 2 FAIL)
  - ❌ FAIL: T7: Spiel startet – HUD sichtbar
  - ❌ FAIL: T10: Arena ist gebaut
- **`npm run test:gpu`**: ✅ PASS (8 PASS, 12 SKIP)
- **`npm run test:physics`**: ✅ PASS (10 PASS, 10 SKIP)
- **`npm run test:stress`**: ✅ PASS (10 PASS, 52 SKIP)

## 2. Smoke Tests

- **`npm run smoke:roundstate`**: ✅ PASS (Erfolgreich ausgeführt)
- **`npm run smoke:selftrail`**: ❌ FAIL (Kompiliert jetzt, aber Laufzeitfehler: `drone/manta/aircraft: derivedSkipRecent helper value not available`)
