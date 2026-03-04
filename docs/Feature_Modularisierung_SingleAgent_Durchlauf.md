# Feature: Single-Agent Durchlaufplan fuer weitere Modularisierung

Stand: 2026-03-04

## Ziel

Die verbleibenden Architektur-Hotspots werden so in kleine Module aufgeteilt, dass **ein einzelner Agent** alle Phasen `21.x` in einem Lauf ohne Stop abarbeiten kann.

## Betriebsmodus (verbindlich)

- Ein Agent arbeitet strikt sequentiell: `21.0 -> 21.1 -> 21.2 -> 21.3 -> 21.4 -> 21.5 -> 21.6`.
- Nach jeder Phase gilt: Verifikation ausfuehren, gefundene Regressionen direkt im selben Phasenkontext beheben, Verifikation erneut laufen lassen.
- Erst wenn die Exit-Kriterien der aktuellen Phase erfuellt sind, sofort mit der naechsten Phase weitermachen.
- Kein Hand-off, kein Gate-Waiting, kein Zwischenstopp fuer Freigaben.
- Stop nur bei Hard-Blockern (z. B. defekte Toolchain, reproduzierbarer externer Fehler, fehlende Runtime-Abhaengigkeit).

## Architektur-Leitplanken

- Reuse vor Neubau: bestehende Muster (`*System.js`, `*Ops.js`) beibehalten.
- Hotpath-Schutz: in `update`/`render`-Pfaden keine neuen per-frame Allokationen.
- Kompatibilitaets-Fassade waehrend Splits erhalten; API-Brueche erst in einer dedizierten Konsolidierungsphase.
- Jede Phase endet mit kleinem atomarem Commit.

## Betroffene Dateien

Bestehend (primaer):

- `src/hunt/OverheatGunSystem.js`
- `src/entities/systems/ProjectileSystem.js`
- `src/core/main.js`
- `src/entities/Bot.js`
- `src/entities/ai/BotSensingOps.js`
- `src/ui/MenuController.js`
- `src/ui/UIManager.js`
- `docs/Umsetzungsplan.md`

Neu (Zielbild):

- `src/hunt/mg/MGOverheatState.js`
- `src/hunt/mg/MGHitResolver.js`
- `src/hunt/mg/MGTracerFx.js`
- `src/entities/systems/projectile/ProjectileStatePool.js`
- `src/entities/systems/projectile/ProjectileSimulationOps.js`
- `src/entities/systems/projectile/ProjectileHitResolver.js`
- `src/core/GameBootstrap.js`
- `src/core/GameRuntimeFacade.js`
- `src/core/GameDebugApi.js`
- `src/entities/ai/BotSensorsFacade.js`
- `src/ui/menu/MenuGameplayBindings.js`
- `src/ui/menu/MenuProfileBindings.js`
- `src/ui/menu/MenuControlBindings.js`

## Phase 21.0 - Baseline, Scope und Guardrails

- [x] 21.0.1 Baseline erfassen (`test:core`, `test:physics`, `smoke:roundstate`) und in neuem Ergebnisdokument protokollieren.
- [x] 21.0.2 Import-/Scope-Check auf Altpfade und Dead Imports (`rg`-Checks).
- [x] 21.0.3 Hotpath-Checkliste in Commit-Notiz aufnehmen (Temp-Objekte, Pools, keine Frame-Allocations).

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:roundstate`

Exit-Kriterien:

- Baseline dokumentiert.
- Tests gruen oder bekannte instabile Tests mit Wiederholung dokumentiert.

## Phase 21.1 - OverheatGunSystem aufteilen

- [x] 21.1.1 Overheat- und Lockout-Zustand nach `src/hunt/mg/MGOverheatState.js` extrahieren.
- [x] 21.1.2 Trefferberechnung (Hitscan + Trail-Hit) nach `src/hunt/mg/MGHitResolver.js` extrahieren.
- [x] 21.1.3 Tracer-Erzeugung/-Update/-Cleanup nach `src/hunt/mg/MGTracerFx.js` extrahieren.
- [x] 21.1.4 `OverheatGunSystem.js` als orchestrierende Fassade stabil halten.

Verifikation:

- `npm run test:core`
- `npm run test:physics`

Exit-Kriterien:

- Verhalten von MG-Hit, Trail-Hit, Overheat und Kill-Feed unveraendert.
- Keine neuen per-frame Material/Geometry-Leaks.

## Phase 21.2 - ProjectileSystem aufteilen

- [x] 21.2.1 Projectile State/Pools nach `ProjectileStatePool.js` verschieben.
- [x] 21.2.2 Bewegungs-/Homing-Update nach `ProjectileSimulationOps.js` verschieben.
- [x] 21.2.3 Treffer- und Collision-Logik nach `ProjectileHitResolver.js` verschieben.
- [x] 21.2.4 `ProjectileSystem.js` auf API-Fassade reduzieren.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:selftrail`

Exit-Kriterien:

- Projektil-Handling (inkl. Hunt-Rockets) regressionsfrei.
- Pooling-Logik weiter wirksam (keine offensichtliche GC-Spike-Einfuehrung).

## Phase 21.3 - main.js weiter entkoppeln

- [x] 21.3.1 Bootstrap/DOM-Referenzaufbau nach `GameBootstrap.js` verschieben.
- [x] 21.3.2 Laufzeit-Orchestrierung in `GameRuntimeFacade.js` konsolidieren.
- [x] 21.3.3 Recorder-/Debug-API in `GameDebugApi.js` kapseln.
- [x] 21.3.4 `main.js` als schlanker Entry-Point mit Delegation erhalten.

Verifikation:

- `npm run test:core`
- `npm run test:stress`
- `npm run build`

Exit-Kriterien:

- Match Start/Stop, Round-End, Menu-Rueckkehr unveraendert.
- Keine Regression bei HUD/Crosshair/Toast-Flow.

## Phase 21.4 - Bot-Fassade vereinfachen

- [x] 21.4.1 Redundante Sensor-Proxy-Methoden in `Bot.js` abbauen.
- [x] 21.4.2 Stabile Adapterflaeche ueber `BotSensorsFacade.js` bereitstellen.
- [x] 21.4.3 `BotSensingOps.js` und verwandte Ops auf die neue Adapterflaeche umstellen.
- [x] 21.4.4 Verhalten (Recovery/Pursuit/PortalIntent) per bestehender API stabil halten.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:roundstate`

Exit-Kriterien:

- Bot-Verhalten nicht verschlechtert.
- Keine API-Regression fuer vorhandene Policies.

## Phase 21.5 - MenuController Listener-Split

- [x] 21.5.1 Gameplay-Bindings nach `MenuGameplayBindings.js` extrahieren.
- [x] 21.5.2 Profil-Bindings nach `MenuProfileBindings.js` extrahieren.
- [x] 21.5.3 Keybind/Steuerungs-Bindings nach `MenuControlBindings.js` extrahieren.
- [x] 21.5.4 `MenuController.js` als Event-Emitter/Fassade vereinfachen.

Verifikation:

- `npm run test:core`
- `npm run test:stress`

Exit-Kriterien:

- Settings-Change-Coalescing unveraendert.
- UI-Events und Profilaktionen funktionieren wie zuvor.

## Phase 21.6 - Abschluss, Stabilisierung, Doku-Freeze

- [x] 21.6.1 Gesamtlauf-Verifikation auf geaenderten Bereichen durchfuehren.
- [x] 21.6.2 Offene TODOs/Compat-Shims entscheiden: entfernen oder explizit als Schulden markieren.
- [x] 21.6.3 Ergebnisbericht und Delta-Liste fuer die komplette 21.x-Serie schreiben.
- [x] 21.6.4 Dokumentations-Freshness abschliessen.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run test:stress`
- `npm run smoke:roundstate`
- `npm run smoke:selftrail`
- `npm run build`
- `npm run docs:sync`
- `npm run docs:check`

Exit-Kriterien:

- Alle 21.x-Phasen abgehakt.
- Dokumentation frisch und konsistent.

## Commit-Protokoll (pro Phase)

Nach jeder abgeschlossenen Phase:

```bash
git add [scoped-files]
git commit -m "refactor(v18-21.x): [kurzer scope] - [ziel]"
```

Empfohlene Scope-Pruefung:

```bash
git diff --name-only
```

## Definition of Done

- `OverheatGunSystem`, `ProjectileSystem`, `main.js`, `Bot.js`, `MenuController.js` sind deutlich schlanker und delegieren.
- Neue Module haben klaren Verantwortungsfokus.
- Hotpaths bleiben allocationsarm.
- Verifikation und Dokumentationschecks sind gruen.
