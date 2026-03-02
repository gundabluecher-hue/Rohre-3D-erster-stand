# Analysebericht (Delta)

Vergleichsbasis: Bericht vom 2026-02-27.
Aktueller Stand: 2026-03-02.
Nachvalidierung: 2026-03-02 (`npm run test:core`, `npm run test:physics`, `npm run test:stress`).

## Neue Issues / Warnungen

- Keine neuen offenen Warnungen nach dem aktuellen Nachvalidierungs-Lauf.

## Regressionen

- Keine aktive SelfTrail-Regression mehr im aktuellen Lauf (Smoke PASS, `failures: []`).

## Erledigt / Behoben Seit 2026-02-27

- Nachvalidiert: `smoke:selftrail` ist am 2026-02-28 erfolgreich durchgelaufen (drone/manta/aircraft, keine Failures).
- Aktualisiert: Verifikationslage zwischen Analysebericht, Umsetzungsplan und aktuellem Smoke-Stand konsistent gemacht.
- Behoben: Hunt-Input-Regressionspfad fuer Human-Player (MG/Item-Schuss) ist wieder aktiv; `SHOOT_MG` wird in Binding- und Runtime-Controls korrekt gefuehrt.
