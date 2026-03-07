# Analysebericht (Delta)

Vergleichsbasis: Bericht vom 2026-02-27.
Aktueller Stand: 2026-03-07.
Nachvalidierung: 2026-03-07 (`server.ps1` + Chromium-Smoke auf statischem Launcherpfad, `npm run build`, `npm run test:core`).

## Neue Issues / Warnungen

- Keine neuen offenen Warnungen nach dem aktuellen Nachvalidierungs-Lauf.
- Behoben 2026-03-07: Der statische Launcherpfad startete nicht mehr, weil der Browser den Bare-Specifier `mp4-muxer` ausserhalb von Vite nicht aufloesen konnte.
- Behoben 2026-03-07: Die Cinematic-Kamera blieb in Third-Person wirkungslos, sobald `cockpitCamera` aktiv war (Blend blieb bei `0`).

## Regressionen

- Keine aktive SelfTrail-Regression mehr im aktuellen Lauf (Smoke PASS, `failures: []`).
- Behoben: Der normale Start ueber `start_game.bat`/`server.ps1` initialisiert Menu und `GAME_INSTANCE` wieder sauber.
- Behoben: Hunt-MG priorisierte Off-Axis Gegner per Dot-Kegel und verfehlte dadurch gegnerische Spursegmente auf der Schusslinie.
- Behoben: Hunt-MG konnte bei ueberlappender Schusslinie eigene Spur vor gegnerischer Spur waehlen.
- Behoben: Trail-Kollision konnte bei grossen Frame-Schritten gegnerische Spur zwischen Frames ueberspringen.
- Behoben: Player-Hitbox konnte nach Vehicle-Load als leere Box enden; dadurch fielen OBB-basierte Trail-Treffer (insb. gegnerische Spur) aus.
- Behoben: MG-Trail-Treffer konnte Segment nur ankratzen statt sicher entfernen.
- Behoben: Nach Treffer auf Trail eines toten Gegners konnte Visual stehen bleiben, obwohl Kollision bereits entfernt war.

## Erledigt / Behoben Seit 2026-02-27

- Nachvalidiert: `smoke:selftrail` ist am 2026-02-28 erfolgreich durchgelaufen (drone/manta/aircraft, keine Failures).
- Aktualisiert: Verifikationslage zwischen Analysebericht, Umsetzungsplan und aktuellem Smoke-Stand konsistent gemacht.
- Behoben: Hunt-Input-Regressionspfad fuer Human-Player (MG/Item-Schuss) ist wieder aktiv; `SHOOT_MG` wird in Binding- und Runtime-Controls korrekt gefuehrt.
- Behoben: Hunt-MG nutzt fuer Spielerziele wieder eine physische Ray-vs-Hitbox-Pruefung; gegnerische Spur kann auf Schusslinie wieder zerstoert werden.
- Abgesichert: Neuer Physik-Regressionstest `T64` in `tests/physics.spec.js` deckt den Off-Axis-Fall explizit ab.
- Behoben: Hunt-MG priorisiert bei Trail-Overlap gegnerische Spur vor eigener Spur (eigene Spur bleibt Fallback).
- Abgesichert: Neuer Physik-Regressionstest `T83` in `tests/physics.spec.js` deckt den Overlap-Fall explizit ab.
- Behoben: PlayerLifecycle nutzt Sweep-Trail-Kollisionscheck als Fallback, damit gegnerische Spur auch bei grossen Delta-Zeiten zuverlaessig triggert.
- Abgesichert: Neuer Physik-Regressionstest `T84` in `tests/physics.spec.js` deckt den Tunnel-Fall explizit ab.
- Behoben: `Player._createModel()` setzt bei invalider/leerer Vehicle-Hitbox eine gueltige Radius-Fallback-OBB; Trail-Kollision greift damit wieder robust.
- Abgesichert: Neuer Physik-Regressionstest `T85` in `tests/physics.spec.js` deckt gegnerische Trail-Kollision bei kleinen Frame-Schritten (Offset-Fall) ab.
- Behoben: `OverheatGunSystem._applyTrailHit` erzwingt fuer MG standardmaessig `destroy-on-hit` (abschaltbar ueber `HUNT.MG.DESTROY_TRAIL_ON_HIT=false`).
- Abgesichert: Neuer Physik-Regressionstest `T86` in `tests/physics.spec.js` prueft echte `ownerTrail`-Segmente (nicht nur Dummy-Registrierung).
- Behoben: `Trail.destroySegmentByEntry` markiert InstancedMesh-Matrix sofort fuer GPU-Update, damit entfernte Segmente auch ohne Owner-Update-Frame verschwinden.
- Abgesichert: Neuer Physik-Regressionstest `T87` in `tests/physics.spec.js` deckt den toter-Gegner-Visualfall ab.
- Behoben: `index.html` mappt `mp4-muxer` jetzt auch fuer den statischen Browserpfad; `server.ps1` liefert `.mjs` als JavaScript aus.
- Behoben: `CameraRigSystem` wendet Cinematic-Offsets jetzt auch im Cockpit-Third-Person-Pfad an.
- Abgesichert: Neuer GPU-Regressionstest `T33b` in `tests/gpu.spec.js` prueft Cinematic-Blend bei `cockpitCamera=true` + `THIRD_PERSON`.
