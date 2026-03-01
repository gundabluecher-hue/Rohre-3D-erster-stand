# Testergebnisse vom 2026-02-28

## Zusammenfassung

- **Gesamtstatus:** PASS (Nachvalidierung erfolgreich)
- **Playwright Suiten:** 4/4 PASS
- **Smoke-Tests:** 2/2 PASS

## Detailergebnisse

### Core Tests (`npm run test:core`)

- **Status:** PASS
- **Ergebnis:** 20/20 bestanden
- **Dauer:** 3.1m

### GPU Tests (`npm run test:gpu`)

- **Status:** PASS
- **Ergebnis:** 8/20 bestanden (12 skipped)
- **Typ:** Rendering-Infrastruktur

### Physics Tests (`npm run test:physics`)

- **Status:** PASS
- **Ergebnis:** 10/20 bestanden (10 skipped)
- **Typ:** Kollision & AI-Basis

### Stress Tests (`npm run test:stress`)

- **Status:** PASS
- **Ergebnis:** 10/65 bestanden (55 skipped)
- **Typ:** I/O & Sicherheit

### Smoke: RoundState (`npm run smoke:roundstate`)

- **Status:** PASS
- **Ergebnis:** Happy Path und Match End verifiziert.

### Smoke: SelfTrail (`npm run smoke:selftrail`)

- **Status:** PASS
- **Ergebnis:** `failures: []`
- **Probe-Fahrzeuge:** `drone`, `manta`, `aircraft`
- **Hinweis:** Ein frueherer Lauf am selben Datum meldete FAIL; der aktuelle Nachlauf ist der neueste verifizierte Stand.
