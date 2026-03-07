# Feature: Performance-Offensive (V28.5)

Stand: 2026-03-07
Status: Offen
Owner: Single-Agent Planung

## Kontext

Bestehende Performance-Arbeiten (Phase 24 und 25) haben zentrale Hotspots bereits reduziert.
Fuer den aktuellen Stand bleiben aber messbare Restthemen:

- Baseline `data/performance_ki_baseline_report.json` (generatedAt `2026-03-05`):
  - overall `fpsAverage=59.686`, `drawCallsAverage=32.813`
  - Szenario `V2 (maze)`: `drawCallsAverage=70.875`, `drawCallsMax=112`
- Lifecycle-Messung `tmp/perf_phase25_8_lifecycle_after.json`:
  - `startMatchLatencyMs=1810`
  - `returnToMenuLatencyMs=31.10`
- Renderpfad nutzt aktuell dauerhaft `preserveDrawingBuffer: true` in `src/core/Renderer.js`.
- Portal-Meshes werden pro Instanz mit eigenen Geometrie-/Materialobjekten gebaut (`src/entities/arena/PortalGateMeshFactory.js`).

Die Kombination erzeugt weiter Luft nach oben fuer GPU-Kosten, Start-Latenz und Allocation-Budget in Hotpaths.

## Ziel

Performance in Runtime und Lifecycle gezielt verbessern, ohne Gameplay-Verhalten zu veraendern.

Abnahmekriterien:

- `V2` Draw Calls im Baseline-Benchmark mindestens `-25%` gegen Stand `2026-03-05`.
- `overall fpsAverage` nicht schlechter als `-2%` gegen Stand `2026-03-05`.
- `startMatchLatencyMs` von `1810` auf `<=1300`.
- Keine neuen `stuckEvents` in Baseline-Szenarien.
- Alle relevanten Tests (core/physics/gpu/stress) gruen.

## Nicht-Ziele

- Kein Balancing-Rework als eigenes Ziel.
- Kein Big-Bang-Umbau von Renderer oder Entity-Architektur.
- Keine neuen Spielfeatures ausser Mess-/Diagnosehilfen.

## Architektur-Check

Bestehende Module/Schnittstellen:

- Renderpfad: `src/core/Renderer.js`, `src/core/renderer/RenderViewportSystem.js`, `src/core/renderer/RenderQualityController.js`
- Gameplay-Hotpath: `src/entities/runtime/EntityTickPipeline.js`, `src/entities/ai/**`, `src/entities/systems/**`
- Arena/Portal-Build: `src/entities/arena/ArenaBuilder.js`, `src/entities/arena/ArenaGeometryCompilePipeline.js`, `src/entities/arena/PortalGateMeshFactory.js`, `src/entities/arena/portal/PortalLayoutBuilder.js`
- UI-Hotpath: `src/ui/HUD.js`, `src/hunt/HuntHUD.js`, `src/ui/HudRuntimeSystem.js`
- Messung: `scripts/bot-benchmark-baseline.mjs`, `data/performance_ki_baseline_report.json`, `tmp/perf_phase25_*`

Reuse-vs-Neu Entscheidung:

- Default ist Reuse bestehender Systeme.
- Neue Dateien nur bei klarem Strukturgewinn:
  - optional `scripts/perf-lifecycle-measure.mjs` (stabile Start-/Menu-Latenzmessung)
  - optional `src/core/renderer/RenderResourceCache.js` (Shared-Material/Geometry-Caches)
- Keine neue Parallel-Architektur fuer AI/Renderer.

Risiko: mittel

- Grund: Hotpath-Aenderungen koennen versteckte Gameplay-/Render-Regressions ausloesen.
- Hauptrisiken: visuelle Unterschiede durch Renderbudget, Timing-Effekte in Bot/Trail-Kollision, Recorder-Kompatibilitaet.

Dokumentations-Impact-Liste:

- `docs/Umsetzungsplan.md`
- `docs/Analysebericht.md` (falls neue Befunde)
- `docs/ai_architecture_context.md` (nur wenn Architekturvertraege geaendert werden)
- Testergebnisdoku aus Benchmark-Lauf (`docs/Testergebnisse_YYYY-MM-DD.md`)

## Betroffene Dateien (geplant)

Bestehend:

- `src/core/Renderer.js`
- `src/core/renderer/RenderQualityController.js`
- `src/core/renderer/CameraRigSystem.js`
- `src/core/renderer/camera/CameraCollisionSolver.js`
- `src/core/main.js`
- `src/core/MediaRecorderSystem.js`
- `src/entities/arena/PortalGateMeshFactory.js`
- `src/entities/arena/portal/PortalLayoutBuilder.js`
- `src/entities/arena/ArenaBuilder.js`
- `src/entities/ai/BotSensors.js`
- `src/entities/ai/BotSensingOps.js`
- `src/entities/systems/trails/TrailCollisionQuery.js`
- `src/entities/Player.js`
- `src/entities/Arena.js`
- `src/hunt/HuntHUD.js`
- `src/ui/HudRuntimeSystem.js`
- `scripts/bot-benchmark-baseline.mjs`
- `tests/core.spec.js`
- `tests/physics-core.spec.js`
- `tests/physics-hunt.spec.js`
- `tests/physics-policy.spec.js`
- `tests/gpu.spec.js`
- `tests/stress.spec.js`
- `docs/Umsetzungsplan.md`

Optional neu:

- `scripts/perf-lifecycle-measure.mjs`
- `src/core/renderer/RenderResourceCache.js`

## Umsetzungsphasen

- [ ] 28.5.0 Baseline-Refresh und Messharness absichern
  - Baseline neu erzeugen mit fester Matrix (`npm run benchmark:baseline`).
  - Lifecycle-Messung fuer `DOMContentLoaded -> GAME_INSTANCE`, `startMatch`, `returnToMenu` standardisieren.
  - Akzeptierte Messprofile fixieren:
    - Trendlauf kurz (`2500ms`)
    - Abschlusslauf voll (`8000ms`)
  - Exit:
    - reproduzierbarer Vorher-Stand liegt als Referenz vor.
  - Verifikation:
    - `npm run benchmark:baseline`
    - `npm run test:core`

- [ ] 28.5.1 GPU-Hotspot `maze`/Portale weiter reduzieren
  - Portal-Rendering auf Shared-Geometrie/Shared-Material pro Variantenschluessel umstellen.
  - Optional: instanzierte oder vorgepoolte Portal-Visuals statt pro Portal neuer Mesh-Pipeline.
  - Shadow-/Material-Kosten fuer rein dekorative Unterobjekte weiter budgetieren.
  - Exit:
    - `V2` zeigt klar reduzierte Draw-Calls bei stabiler Optik.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:gpu`
    - Trendmessung `V2` via Benchmark-Script

- [ ] 28.5.2 Renderer-/Kamera-Hotpath budgetieren
  - Unnoetige Voll-`scene.traverse`-Updates in Qualitaetswechseln vermeiden (dirty/once-Strategie).
  - Render-State-Umschaltungen minimieren (nur bei echtem Zustandwechsel).
  - Kamera-Kollisionsrechecks weiter auf relevante Bewegungen begrenzen.
  - Exit:
    - kein funktionaler Kameraverlust, sinkende CPU-Kosten im Renderpfad.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:gpu`

- [ ] 28.5.3 Bot-/Trail-CPU-Hotpaths nachziehen
  - Bot-Sensing-Caches und Probe-Budget pro Tick weiter straffen.
  - Trail-Kollisionsquery auf weniger redundante Kandidatenarbeit trimmen.
  - Bei Anpassungen strikt no-allocation im Tickpfad.
  - Exit:
    - CPU-Last sinkt in botlastigen Szenarien ohne KI-/Kollisionsdrift.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:physics`
    - optional `npm run smoke:selftrail` bei Trail-Query-Aenderungen

- [ ] 28.5.4 Allocation-/GC-Budget im Hotpath erzwingen
  - Hotpath-Methoden ohne `out`-Parameter (z. B. Richtungshelper) auf reuse-faehige Signaturen bringen.
  - Kritische Updatepfade auf neue Objektallokationen pro Frame pruefen und entfernen.
  - Guardrails dokumentieren (`no new object in update/render`).
  - Exit:
    - messbar weniger kurzlebige Objekte in kritischen Loops.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:physics`
    - `npm run test:stress`

- [ ] 28.5.5 Start-/Transition-Latenz reduzieren
  - Match-Start-Pfad auf Build-/Init-Arbeit entkoppeln (vorbereiten in Menuephase, lazy bei Bedarf).
  - Arena-/Asset-Reuse fuer wiederholte Starts derselben Konfiguration verbessern.
  - Rueckkehr ins Menue auf konstante, stabile Latenz pruefen.
  - Exit:
    - `startMatchLatencyMs <= 1300` im Lifecycle-Referenzlauf.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:stress`
    - Lifecycle-Messskript (bestehend oder neu)

- [ ] 28.5.6 Recording-Overhead isolieren
  - Renderer-Flags fuer Recording nur aktivieren, wenn Recording laeuft.
  - Capture-Intervall/FPS fuer Runtime-kritische Sessions konfigurierbar machen.
  - Sicherstellen, dass Non-Recording-Pfad keinen Recorder-Overhead mehr traegt.
  - Exit:
    - normale Matches ohne Recorder bleiben auf dem schnelleren Renderpfad.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:gpu`

- [ ] 28.5.7 HUD/UI-Hotpath nachziehen
  - HuntHUD/HUD-Updates weiter diff-basiert und nur bei Wertaenderungen schreiben.
  - Tick-Intervalle fuer nichtkritische UI-Elemente schrittweise anheben.
  - Exit:
    - keine sichtbaren UI-Regressions, geringere DOM-Write-Last.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:stress`

- [ ] 28.5.8 Abschluss-Gate und Doku-Freeze
  - Vollvergleich Vorher/Nachher mit Baseline-Matrix.
  - Delta-Doku mit Zahlen (`fps`, `drawCalls`, Lifecycle-Latenzen).
  - Restrisiken und ggf. Folgephase definieren.
  - Verifikation (End-Gate):
    - `npm run benchmark:baseline`
    - `npm run test:core`
    - `npm run test:physics`
    - `npm run test:gpu`
    - `npm run test:stress`
    - `npm run docs:sync`
    - `npm run docs:check`

## Teststrategie

- Pro Subphase nur pfadrelevante Tests ausfuehren.
- Vollbenchmark nur in `28.5.0` und `28.5.8`.
- Bei `src/entities/**`: mindestens `test:core` + `test:physics`.
- Bei `src/ui/**`: mindestens `test:core` + `test:stress`.
- Bei Renderpfaden: zusaetzlich `test:gpu`.

## Dokumentations-Hook

Vor Abschluss jeder Implementierungsphase:

- `npm run docs:sync`
- `npm run docs:check`

