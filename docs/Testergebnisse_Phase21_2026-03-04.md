# Testergebnisse Phase 21 - Baseline (2026-03-04)

## Ziel

Baseline und Guardrails fuer den sequentiellen Single-Agent-Durchlauf `21.0` bis `21.6`.

## 21.0 Verifikation (Baseline)

- `npm run test:core`
  - Ergebnis: PASS (`20 passed`)
  - Laufzeit: ca. `1.4m`
- `npm run test:physics`
  - Ergebnis: PASS (`47 passed`)
  - Laufzeit: ca. `3.0m`
- `npm run smoke:roundstate`
  - Ergebnis: PASS (`ok: true`)
  - Kernwerte: `transitionState ROUND_END/MATCH_END`, Tick-Szenarien konsistent

## 21.0 Import-/Scope-Checks

- `rg -n --fixed-strings "<legacy-main-entry>" src tests`
  - Ergebnis: `OK: no src/tests hits for legacy main entry path`
- `rg -n --fixed-strings "<legacy-modules-root>" src tests`
  - Ergebnis: `OK: no src/tests hits for legacy modules root`
- `rg -n '^import ' src/hunt/OverheatGunSystem.js src/entities/systems/ProjectileSystem.js src/core/main.js src/entities/Bot.js src/entities/ai/BotSensingOps.js src/ui/MenuController.js`
  - Ergebnis: `53` Import-Zeilen geprueft (keine Altpfad-Imports im Zielscope)

Hinweis: Treffer zu alten Runtime-Pfaden bestehen nur in `docs/archive/**` als historische Referenz, nicht im Runtime-Code.

## Hotpath-Guardrails (verbindlich fuer 21.x)

- Keine neuen per-frame Allokationen in `update`/`render`-Pfaden.
- Bestehende Temp-Vektoren und Objekt-Reuse beibehalten.
- Pools weiterverwenden (`Projectile`-State/Mesh, Tracer-Lifecycle etc.).
- Keine neuen Material-/Geometry-Instanzen pro Frame in Hotpaths erzeugen.

## 21.1 Verifikation (OverheatGunSystem Split)

- `npm run test:core`
  - Ergebnis: PASS (`20 passed`)
- `npm run test:physics`
  - Ergebnis: PASS (`47 passed`)

Split-Ergebnis:

- `src/hunt/mg/MGOverheatState.js` kapselt Overheat-/Lockout-/Snapshot-State.
- `src/hunt/mg/MGHitResolver.js` kapselt Hitscan- und Trail-Hit-Aufloesung inkl. Damage.
- `src/hunt/mg/MGTracerFx.js` kapselt Tracer Spawn/Update/Cleanup.
- `src/hunt/OverheatGunSystem.js` bleibt als orchestrierende Fassade kompatibel.

## 21.2 Verifikation (ProjectileSystem Split)

- `npm run test:core`
  - Ergebnis: PASS (`20 passed`)
- `npm run test:physics`
  - Ergebnis: PASS (`47 passed`)
- `npm run smoke:selftrail`
  - Ergebnis: PASS (`failures: []`)

Split-Ergebnis:

- `src/entities/systems/projectile/ProjectileStatePool.js` kapselt Projectile-State-Reuse.
- `src/entities/systems/projectile/ProjectileSimulationOps.js` kapselt Bewegung, Homing und Foam-Bounce-Simulation.
- `src/entities/systems/projectile/ProjectileHitResolver.js` kapselt Trail-/Arena-/Player-Trefferlogik.
- `src/entities/systems/ProjectileSystem.js` orchestriert nur noch Spawn, Pools/Facades und Lifecycle.

## 21.3 Verifikation (main.js Entkopplung)

- `npm run test:core`
  - Ergebnis: PASS (`20 passed`)
- `npm run test:stress`
  - Ergebnis: PASS (`13 passed`)
- `npm run build`
  - Ergebnis: PASS

Split-Ergebnis:

- `src/core/GameBootstrap.js` kapselt Runtime-Bootstrap und DOM-UI-Referenzaufbau.
- `src/core/GameRuntimeFacade.js` kapselt Settings-/Menu-Runtime-Orchestrierung.
- `src/core/GameDebugApi.js` kapselt Recorder-/Validation-Debug-API.
- `src/core/main.js` delegiert auf die neuen Fassaden bei stabiler `Game`-API.
