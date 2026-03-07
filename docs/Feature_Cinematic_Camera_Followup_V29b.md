# Feature: Cinematic Camera Follow-up (V29b)

Stand: 2026-03-07  
Status: Geplant  
Owner: Single-Agent Umsetzung

## Ziel

Die Cinematic-Kamera nach dem Hotfix weiter stabilisieren und bedienbar machen, mit Fokus auf:

1. Optionaler Cinematic-Einfluss bei `THIRD_PERSON + cockpitCamera`
2. Einstellbare Cinematic-Intensitaet (`sway`, `lift`, `enter/exit`)
3. Klareres Laufzeit-Feedback zu aktivem Kamera-/Cinematic-Modus
4. Erweiterte Regressionstests fuer Cockpit- und Toggle-Transitions
5. Resolver-Guards fuer konsistente Bot-Policy-Zuordnung nach Spielmodus

Ausdruecklich nicht in diesem Plan enthalten: isolierter Bugfix aus Punkt 5 der Vorschlagsliste (`T82` Einzelbehebung). Dieser ist separat im Masterplan geparkt.

## Betroffene Dateien (geplant)

- `src/core/config/ConfigSections.js`
- `src/core/config/SettingsRuntimeContract.js`
- `src/core/SettingsManager.js`
- `src/core/RuntimeConfig.js`
- `src/core/renderer/CameraRigSystem.js`
- `src/entities/systems/CinematicCameraSystem.js`
- `src/core/main.js`
- `src/ui/UIManager.js`
- `src/ui/menu/MenuGameplayBindings.js`
- `tests/gpu.spec.js`
- `tests/core.spec.js`
- `tests/physics-policy.spec.js`
- `docs/Analysebericht.md`
- `docs/Umsetzungsplan.md`

## Architektur-Check

- Bestehende Module werden weiterverwendet; kein neuer Kamera-Subsystem-Fork.
- Kamera-Verhalten bleibt im `CameraRigSystem`/`CinematicCameraSystem`.
- Settings-Contract bleibt Single Source of Truth ueber `ConfigSections` + `SettingsRuntimeContract` + `RuntimeConfig`.
- Laufzeit-Feedback bleibt in bestehenden UI-/Toast-Pfaden (`main.js`, `UIManager`), keine neue DOM-Infrastruktur.
- Policy-Guard bleibt im bestehenden Resolver-/RuntimeConfig-Pfad, keine parallele Policy-Pipeline.

Risiko-Einstufung: **mittel** (Kamera-Hotpath + Policy-Resolver sind regressionskritisch).

## Phasenplan

- [ ] **29b.0 Baseline-Freeze & Scope-Check**
  - Kamera- und Policy-Iststand dokumentieren (`T20l`, `T33`, `T33b`, `T81`, `T82`).
  - Zielwerte fuer Cinematic-Parameter und Feedback-Verhalten festhalten.

- [ ] **29b.1 Cockpit-Cinematic Feature-Flag (Vorschlag 1)**
  - Neuer Camera-Flag fuer `THIRD_PERSON + cockpitCamera` einziehen.
  - Default auf aktuellem Verhalten halten, aber runtime-/settings-faehig machen.
  - Kamera-Apply-Pfad auf Flag schalten statt harter Verzweigung.

- [ ] **29b.2 Cinematic-Tuning in Settings (Vorschlag 2)**
  - `swayAmount`, `liftAmount`, `enterSpeed`, `exitSpeed` konfigurierbar machen.
  - Settings-Schema + Runtime-Normalisierung + sichere Fallbacks erweitern.
  - Bei Bedarf schlanke UI-Anbindung in bestehendem Gameplay-/Camera-Settings-Bereich.

- [ ] **29b.3 Laufzeit-Feedback zu Modus/Cinematic (Vorschlag 3)**
  - Klarer Status-Text bei Kamerawechsel/Cinematic-Toggle.
  - HUD-/Toast-Feedback so platzieren, dass es Match-Flow nicht stoert.

- [ ] **29b.4 Transition-Regressionen absichern (Vorschlag 4)**
  - Test fuer Toggle waehrend laufendem Match bei aktivem Cockpit.
  - Test fuer Rueckwechsel auf `FIRST_PERSON` ohne haengenden Blend.
  - Bestehende Tests (`T33`, `T33b`) an neue Konfigurationspfade anbinden.

- [ ] **29b.5 Policy-Mapping Guardrails erweitern (Vorschlag 6)**
  - Resolver-Guard einfuehren: kein klassischer Bridge-Typ in Hunt-Kontext.
  - Deterministische Fallback-Regeln und Assertions fuer Fehlkonfiguration.
  - Policy-Tests um Guard-Verhalten erweitern.

- [ ] **29b.6 Abschluss-Gate & Doku-Freeze**
  - Integrationslauf, Risiko-Review, Doku-Update.
  - Abschluss mit `docs:sync` und `docs:check`.

## Verifikation (geplant)

- Nach 29b.1/29b.2:
  - `npm run test:gpu -- -g "T33|T33b"`
  - `npm run test:core -- -g "T20l"`

- Nach 29b.3/29b.4:
  - `npm run test:gpu`
  - `npm run test:core`

- Nach 29b.5:
  - `npm run test:physics -- -g "T81|T82"`

- Abschluss-Gate:
  - `npm run test:core`
  - `npm run test:gpu`
  - `npm run test:physics`
  - `npm run build`
  - `npm run docs:sync`
  - `npm run docs:check`
