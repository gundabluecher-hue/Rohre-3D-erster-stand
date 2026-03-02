Original prompt: bitte überprüfe den jagdmodus es funktioniert fast nichts

2026-03-02
- Skill `develop-web-game` aktiv für reproduzierbare Spielmodus-Diagnose.
- `.agents` Regeln/Workflows geladen (bugfix, test_mapping, reporting).
- `progress.md` neu erstellt.
- Hunt-Bug reproduziert im Browser: Human-Schuss in Hunt feuert nicht (shootCooldown bleibt 0 bei KeyF/KeyG).
- Laufzeit-Bindings zeigen `SHOOT_MG` fehlt nach `InputManager.setBindings`.
- Geplante Fixes: `InputManager` Action-Keys erweitern + Hunt-Schuss-Fallback im `PlayerLifecycleSystem` stabilisieren.
- Fix umgesetzt:
  - `src/core/InputManager.js`: `SHOOT_MG` in generischer Action-Liste integriert.
  - `src/core/RuntimeConfig.js`: `SHOOT_MG` in Runtime-Controls fuer P1/P2 uebernommen.
  - `src/entities/systems/PlayerInputSystem.js`: bei `shootItem` wird in Hunt der aktuelle `selectedItemIndex` gesetzt.
  - `src/entities/systems/PlayerLifecycleSystem.js`: Hunt-MG-Fallback bei `shootItem` ohne gueltigen Item-Index; deduplizierter `shootMG`-Pfad.
  - `src/core/config/ConfigSections.js`: Default-Keys fuer `SHOOT_MG` auf `KeyF`/`KeyJ` (ohne Konflikt mit `DROP`).
- Verifikation:
  - Playwright Runtime-Checks: Hunt-Schuss setzt `shootCooldown`/Overheat; Raketen-Schuss aus Inventory funktioniert.
  - `npm run test:core` PASS
  - `npm run test:physics` PASS
  - `npm run test:stress` PASS
  - `npm run docs:sync` PASS
  - `npm run docs:check` PASS
- Abschlussstatus: Hunt-Schusspfad fuer Human-Player repariert und per Tests validiert.
- Offene TODO-Empfehlung fuer naechsten Agenten: dedizierte Hunt-Controls UX pruefen (ob `SHOOT_MG` standardmaessig separat belegt werden soll).
2026-03-02 (Follow-up auf Nutzerfeedback)
- Debug/FPS Overlay Hotkey von `F` auf `O` umgestellt (inkl. UI-Hinweise).
- Hunt-Input entkoppelt:
  - `SHOOT` bleibt Item/Rakete.
  - `SHOOT_MG` ist eigene Taste (default getrennt) und bleibt im Keybind-Editor konfigurierbar.
- MG-Feedback verbessert: sichtbare Tracer-Streifen pro Schuss (kurze Fade-TTL).
- Hunt-HUD erweitert: Leben/Schild/Boost zusaetzlich in eigenen Farbbalken.
- Tests erfolgreich (sequentiell): `test:core`, `test:physics`, `test:stress`.
- Doku-Gates: `docs:sync` und `docs:check` erfolgreich (mojibake-Hinweis bleibt unveraendert bei 1).
2026-03-02 (Jagd-Modus: Spursegment per MG wegschiessen)
- Wunsch umgesetzt: MG-Treffer koennen jetzt Spursegmente im Hunt-Modus direkt zerstoeren.
- src/hunt/OverheatGunSystem.js erweitert:
  - Hitscan bewertet jetzt naechsten Treffer zwischen Spieler und Trail.
  - Trail-Trefferpfad fuegt Segment-Schaden hinzu und entfernt Segment sofort (default: volle Segment-HP als MG-Schaden).
  - tryFire liefert zusaetzlich trailHit-Flag fuer Verifikation.
- Regressionstest hinzugefuegt:
  - tests/physics.spec.js -> T61: Hunt-MG entfernt getroffenes Spursegment sofort.
- Verifikation:
  - npm run build PASS
  - npm run test:physics PASS (inkl. T61)
  - npm run test:core PASS
  - npm run docs:sync PASS (updated=0, mojibake=1)
  - npm run docs:check PASS (updated=0, mojibake=1)
- Skill-Hinweis:
  - develop-web-game Client-Skript aus Skill-Pfad konnte lokal nicht direkt laufen (playwright package resolution am Skill-Pfad fehlend); daher Verifikation ueber vorhandene Projekt-Playwright-Suite.

2026-03-02 (Follow-up: groessere MG-Kugeln) 
- MG-Visuals im Hunt-Modus deutlich vergroessert: Tracer jetzt mit dickerem Beam + grosser End-Kugel (TRACER_BEAM_RADIUS / TRACER_BULLET_RADIUS). 
- Verifikation: npx playwright test tests/physics.spec.js -g T61 PASS, npm run test:core PASS, npm run build PASS, docs:sync/check PASS.


2026-03-02 (Follow-up: groessere Raketen + Zielsuche + Segment-Hit einfacher) 
- HuntConfig erweitert: ROCKET-Tuning (groessere Visual-Skalen, groessere Kollisionsradius-Multiplikation, staerkere Homing-Werte inkl. Reacquire/Range).
- MG-Trail-Treffen erleichtert ueber Defaults in HUNT.MG (TRAIL_HIT_RADIUS=0.78, TRAIL_SAMPLE_STEP=0.45).
- ProjectileSystem erweitert: Hunt-Raketen werden sichtbar groesser skaliert, erhalten vergroesserten Hit-Radius und robustes Homing mit periodischem Reacquire/Fallback auf naechstes Ziel.
- Neuer Test T62 in tests/physics.spec.js prueft groessere Hunt-Rakete + Zielsuche.
- Verifikation: npx playwright test tests/physics.spec.js -g T62 PASS; npm run test:physics PASS; npm run test:core PASS; npm run build PASS; docs:sync/check PASS.

