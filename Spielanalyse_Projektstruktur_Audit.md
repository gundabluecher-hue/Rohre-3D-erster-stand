# Spielanalyse + Projektstruktur-Audit (Deep Dive)

Stand: 2026-02-22  
Projekt: `Rohre-3D-erster-stand`

## Schnellstatus (Stand 2026-02-23)

- `Phase 0 (Stabilisierung)`: `ABGESCHLOSSEN`
  - Bot-Crashfix, Particle-Lifecycle-Fix, TimeScale-Reset, Trail-Alt-API-Bereinigung revalidiert (`Umsetzungsstatus`-Append)
- `Phase 1 (strukturelle Entkopplung)`: `TEILWEISE ABGESCHLOSSEN`
  - erledigt: `SettingsStore`-Extraktion, Profil-Refactor-Verifikation, `RoundStateOps`-Auslagerung, `MatchSessionFactory`-Extraktionsschritte (Aufbau + Runtime-Wiring + Map-Feedback-Plan + `initializeMatchSession(...)` + symmetrischer Teardown-Helper), `MatchUiStateOps` fuer Start-/Round-/Return-UI-Orchestrierung (inkl. Round-End-Countdown-Helper), `startMatch()`/`_returnToMenu()`-Cleanup-Helper im `Game`, `update()`-State-Branch-Helper (`PLAYING`/`ROUND_END`/`MATCH_END`), `RoundStateControllerOps`-Vorbereitung (Tick-/Transition-Entscheidungen fuer `ROUND_END`/`MATCH_END`)
  - offen: vollstaendiger `MatchSession`-/`MatchFactory`-Ausbau, vollstaendiger `RoundStateController`, Abschluss `UIManager`-Migration
- `Phase 2 (Renderer + Scene Lifecycle)`: `TEILWEISE ABGESCHLOSSEN`
  - erledigt: Scene-Roots, `clearMatchScene()`, mehrere Disposal-Verbesserungen
  - offen: weitere Zentralisierung des Resource-Disposals / restliche Lifecycle-Entkopplung
- `Phase 3 (Qualitaetssicherung)`: `TEILWEISE ABGESCHLOSSEN`
  - erledigt: mehrere Node-/Headless-Smokes inkl. reproduzierbarer Self-Trail-Debug-Smoke
  - offen: dauerhafte Testabdeckung fuer BotAI/MapSchema/CustomMapLoader + Settings/Profile-Regressionschecks + optionaler Snapshot-Check

Hinweis:
- Die zuletzt offenen Self-Trail-Verifikationspunkte wurden per reproduzierbarem Headless-Smoke praktisch geschlossen (siehe letzter Audit-Append).
- Ein echter manueller Ingame-Praxistest bleibt optionaler Zusatztest, aber kein Blocker fuer den Self-Trail-Fixstand.

## Ziel

Dieses Dokument fasst eine tiefe Analyse des Spiels zusammen:

1. Mehrere technische Durchlaeufe (Build/Smoke/Codepfade)
2. Architektur-, Gameplay-, Rendering- und Performance-Bewertung
3. Einbezug der parallel geaenderten Dateien im Worktree
4. Konkrete Verbesserungsvorschlaege fuer die Projektstruktur

## Durchgefuehrte Durchlaeufe (mehrere Wege)

### Durchlauf A: Produktions-Build (Vite)

- Befehl: `npm run build`
- Ergebnis: Build erfolgreich
- Beobachtung:
  - Vite meldet einen grossen Bundle-Chunk (`~707 kB` minified, Warnung >500 kB)
  - Das ist kein Build-Fehler, aber ein Performance-/Ladezeit-Thema

### Durchlauf B: Bot-AI Headless-Smoketest (Logic-Pfad ohne Browser)

- Ziel: Bot-Update direkt ausfuehren (nicht ueber das Spiel UI)
- Ergebnis: reproduzierbarer Laufzeitfehler
- Fehler:
  - `ReferenceError: maxProbes is not defined`
- Ursache in Code:
  - `js/modules/Bot.js:887` (`maxProbes`)
  - weitere undeclarte Variablen im selben Block: `opennessSum`, `opennessCount`, `forwardProbe`, vermutlich auch `bestRisk`/`bestProbe` (Nutzung sichtbar ab `js/modules/Bot.js:902`, `js/modules/Bot.js:909`)
- Wirkung:
  - Bot-Matches koennen zur Laufzeit abbrechen, sobald dieser Pfad ausgefuehrt wird

### Durchlauf C: Trail-Collision-API Headless-Smoketest

- Ziel: `Trail.checkCollision()` direkt testen
- Ergebnis 1 (ohne Segmente): `false` (unauffaellig)
- Ergebnis 2 (mit Segmenten): reproduzierbarer Laufzeitfehler
- Fehler:
  - `TypeError: Cannot read properties of undefined (reading 'get')`
- Ursache in Code:
  - `js/modules/Trail.js:188` verwendet `this.grid.get(...)`, aber `this.grid` wird im Konstruktor nicht initialisiert
  - `js/modules/Trail.js:266` nutzt `this._tmpCollisionNormal`, nicht initialisiert
  - `js/modules/Trail.js:267` gibt `this._collisionResult` zurueck, ebenfalls nicht initialisiert
- Einordnung:
  - aktuell wird primär `EntityManager.checkGlobalCollision(...)` genutzt; dennoch ist die Trail-API in diesem Zustand latent kaputt und gefaehrlich fuer spaetere Refactors

### Durchlauf D: Custom-Map/Schema-Pfad (neue Neben-Aenderungen)

- Ziel: neuen `MapSchema`- und `CustomMapLoader`-Pfad praktisch testen
- Ergebnis:
  - `MapSchema` Parse + Runtime-Konvertierung erfolgreich
  - `CustomMapLoader` (custom + fallback) erfolgreich
- Positiv:
  - Neue Mapping-/Editor-Integration wirkt funktional und testbar
  - Gute Richtung fuer Datenvalidierung und Migration

### Durchlauf E: Worktree-Scan (parallel veraenderte Dateien)

- `git status --short` + `git diff --stat` ausgefuehrt
- Ergebnis:
  - Viele parallele Aenderungen in Runtime, UI, Editor und Build-Artefakten
  - Neue Module/Ordner hinzugekommen (`js/entities/`, `js/modules/MapSchema.js`, `js/modules/CustomMapLoader.js`, `js/modules/UIManager.js`)
- Wichtig fuer Analyse:
  - Das Projekt befindet sich sichtbar in einer Teil-Refactor-Phase (UI/Map/Vehicle-System)
  - Einige Probleme wirken wie Integrationsreste einer laufenden Umbauphase

## Kurzfazit (Executive Summary)

Das Spiel hat eine starke Basis: gute Feature-Tiefe (Portale, Planar-Modus, Items, Bots, Splitscreen, Editor-Anbindung), viele Performance-Optimierungen (Instancing, Objekt-Reuse, Pools, adaptive Qualitaet) und ein bemerkenswert umfangreiches Bot-/Recorder-System.

Die groessten Risiken liegen aktuell nicht im Feature-Umfang, sondern in:

- Integrationsfehlern im laufenden Refactor
- einem ueberladenen `main.js` (zu viele Verantwortlichkeiten)
- fragilen Lifecycle-Grenzen zwischen persistierenden Systemen und `Renderer.clearScene()`
- fehlender automatisierter Absicherung fuer pure Logic-Pfade (Bot/Trail)

## Befunde (priorisiert)

## Kritisch

### 1) Bot-AI kann zur Laufzeit abstuerzen (undeclarte Variablen in `_senseEnvironment`)

- Stellen:
  - `js/modules/Bot.js:887`
  - `js/modules/Bot.js:902`
  - `js/modules/Bot.js:903`
  - `js/modules/Bot.js:906`
  - `js/modules/Bot.js:909`
- Befund:
  - In `_senseEnvironment(...)` werden Variablen genutzt, die in dem Block nicht initialisiert sind (`maxProbes`, `opennessSum`, `opennessCount`, `forwardProbe`, etc.).
- Risiko:
  - Bot-Runden instabil bzw. sofortiger Crash
- Prioritaet:
  - Sofort fixen vor weiterer Bot-Tuning-Arbeit

### 2) Partikelsystem wird beim Match-Start weggeraeumt und nicht neu aufgebaut

- Stellen:
  - `js/main.js:91` (Partikelsystem wird einmalig im Konstruktor erstellt)
  - `js/main.js:1186` (`this.particles.clear()`)
  - `js/main.js:1187` (`this.renderer.clearScene()`)
  - `js/modules/Renderer.js:308` (`clearScene`)
  - `js/modules/Renderer.js:320`
  - `js/modules/Renderer.js:321`
- Befund:
  - `Renderer.clearScene()` entfernt und disposet alle Nicht-Licht-Objekte.
  - Das betrifft auch die persistent gedachte `ParticleSystem.mesh`.
  - `ParticleSystem` wird danach nicht neu erstellt und auch nicht erneut in die Szene eingefuegt.
- Wirkung:
  - Effekte koennen im Match fehlen oder spaeter in einen invaliden/disposeten Zustand laufen.

### 3) Zeitlupen-Effect (`SLOW_TIME`) setzt TimeScale, aber setzt nicht sauber auf `1.0` zurueck

- Stellen:
  - `js/main.js:1606`
  - `js/main.js:1607`
  - Reset nur bei Rundenstart: `js/main.js:1285`
- Befund:
  - In `update()` wird `timeScale` auf Slow-Motion gesetzt, wenn ein Effekt aktiv ist.
  - Es gibt im selben Tick keinen Default-Reset auf `1.0`, falls kein `SLOW_TIME` mehr aktiv ist.
- Wirkung:
  - Zeitlupe kann nach Effektende bis zum naechsten Rundenstart aktiv bleiben.

## Hoch

### 4) Trail-Collision-Hilfs-API ist inkonsistent / kaputt (latente Crashquelle)

- Stellen:
  - `js/modules/Trail.js:188`
  - `js/modules/Trail.js:266`
  - `js/modules/Trail.js:267`
- Befund:
  - Verwaiste Alt-API (`this.grid`, `_tmpCollisionNormal`, `_collisionResult`) neben neuer globaler Kollision in `EntityManager`.
- Wirkung:
  - Refactor-Risiko und Debug-Fallen
- Empfehlung:
  - Entweder komplett entfernen oder sauber reparieren und durch Tests absichern

### 5) Spielregel/UI-Inkonsistenz: UI erlaubt 1-15 Siege, Runtime erzwingt mindestens 5

- Stellen:
  - UI/Settings clampen auf 1-15 (u.a. `js/main.js:623`, `js/main.js:1319` Kontext)
  - harte Mindestgrenze in Match-Ende: `js/main.js:1319`
- Befund:
  - `requiredWins = Math.max(5, this.winsNeeded)`
- Wirkung:
  - Nutzer waehlt z.B. 1 Sieg, Spiel ignoriert das stillschweigend
- Empfehlung:
  - Entweder UI-Text/Slider anpassen oder harte Runtime-Grenze entfernen

### 6) `Renderer.clearScene()` ist zu breit und erzeugt Kopplungsprobleme

- Stellen:
  - `js/modules/Renderer.js:308`
  - `js/modules/Renderer.js:320`
  - `js/modules/Renderer.js:321`
- Befund:
  - Methode disposet pauschal Szeneobjekte; persistente Systeme muessen implizit wissen, was vorher entfernt werden muss.
- Wirkung:
  - Genau diese Kopplung hat das Partikelproblem beguenstigt.
- Empfehlung:
  - Layer-/Root-Gruppen pro Match (`matchRoot`, `persistentRoot`, `debugRoot`) einfuehren

### 7) Potenzieller GPU-Resource-Leak bei Projektil-Assets ueber Match-Neustarts

- Stellen:
  - `js/modules/EntityManager.js:59`
  - `js/modules/EntityManager.js:479`
  - `js/modules/EntityManager.js:679`
- Befund:
  - Geometrien/Materialien in `_projectileAssets` werden gecacht, aber beim `clear()` des EntityManagers nicht explizit disposed.
- Wirkung:
  - Bei mehrfachen Matches mit Projektilnutzung moeglicher GPU-Speicheranstieg

### 8) Powerup-Item-Material-Leak (Wireframe-Child-Material nicht disposed)

- Stellen:
  - Erstellung Child-Wire-Material: `js/modules/Powerup.js:82`
  - Child wird angehaengt: `js/modules/Powerup.js:89`
  - Beim Pickup/Clear wird nur `item.mesh.material.dispose()` aufgerufen:
    - `js/modules/Powerup.js:117`
    - `js/modules/Powerup.js:128`
- Befund:
  - `wire.material` bleibt liegen
- Wirkung:
  - Vermeidbarer Speicher-/GPU-Leak bei langem Spielen

## Mittel

### 9) `main.js` ist ein "God Object" (zu viele Verantwortlichkeiten)

- Stellen (Beispiele):
  - `js/main.js:54` (`class Game`)
  - `js/main.js:528` (Runtime-Config-Mutation)
  - `js/main.js:578` (grosse Menu-Listener-Verkabelung)
  - `js/main.js:1170+` (Match-Aufbau)
  - `js/main.js:1475+` (Update-State-Machine)
- Befund:
  - UI, Settings-Persistenz, State-Machine, Gameplay-Orchestrierung, Debug, Build-Info, Input-Capture etc. in einer Klasse
- Wirkung:
  - Hohe Aenderungskosten, schwieriges Debugging, schwer testbar

### 10) Teilrefactor: `UIManager` existiert, aber `Game` behaelt parallele UI-Logik

- Stellen:
  - `js/modules/UIManager.js:21` bis `js/modules/UIManager.js:24`
  - `js/modules/UIManager.js:27` (`_setupVehicleSelects`)
  - `js/main.js:578` (`_setupMenuListeners`)
  - `js/main.js:587` bis `js/main.js:598` (erneute Vehicle-Population)
  - `js/main.js:309`, `js/main.js:321` (eigene Menu-Context-Logik im `Game`)
- Befund:
  - UI-Zustaendigkeiten sind noch auf `Game` + `UIManager` verteilt
- Wirkung:
  - Duplicate logic, Divergenz-Risiko, Integrationsfehler bei weiteren UI-Aenderungen

### 11) Globale Mutation von `CONFIG` erschwert Testbarkeit und entkoppelte Systeme

- Stellen:
  - `js/main.js:528`
  - `js/main.js:534`
  - `js/main.js:541`
  - `js/main.js:557`
- Befund:
  - User-Settings werden direkt in globale `CONFIG`-Defaults geschrieben
- Wirkung:
  - Seiteneffekte ueber Match-/Testgrenzen, schlecht fuer headless Tests und klare Runtime-Zustaende

### 12) `InputManager` verhindert standardmaessig alle Tastatur-Browseraktionen

- Stellen:
  - `js/modules/InputManager.js:46`
  - `js/modules/InputManager.js:51`
  - `js/modules/InputManager.js:54`
  - `js/modules/InputManager.js:56`
- Befund:
  - `preventDefault()` wird fuer alle Keydown/Keyup Events aufgerufen
- Wirkung:
  - Browser-Shortcuts, Formularbedienung und Debug-Workflows koennen unerwartet stoeren

### 13) Vermeidbare Frame-Allocation im HUD

- Stelle:
  - `js/modules/HUD.js:135`
- Befund:
  - `new THREE.Euler()` in jedem HUD-Update
- Wirkung:
  - Klein, aber unnötiger GC-Druck bei 60 FPS

### 14) Kleiner Material-Fehler in `SpaceshipMesh` (Rim nutzt undefinierte `secondaryMat`)

- Stelle:
  - `js/entities/spaceship-mesh.js:78`
- Befund:
  - `this.secondaryMat` wird in der Klasse nicht initialisiert
- Wirkung:
  - Fallback-Verhalten statt beabsichtigtem Material (visuelle Inkonsistenz)

## Staerken des Spiels (wichtig, weil Basis sehr gut ist)

## Gameplay/Feature-Design

- Gute Arena-Arcade-Basis mit hoher Lesbarkeit
- Split-Screen + 1P/2P + Bots
- Planar-Modus als eigenstaendiger Spielmodus (kein reiner Toggle-Gimmick)
- Portalsystem mit Map-/Planar-spezifischer Platzierung
- Inventar + Item-Projektil-Nutzung + Lock-On
- Runde/Match-Struktur + HUD + Recorder/Validation-Ansatz

## Technik/Performance

- Viele GC-Optimierungen (shared temp vectors/objects) in `EntityManager`, `Player`, `Renderer`
- Instanced Trails (`Trail`) und Instanced Particles (`Particles`)
- Projektil-Pooling in `EntityManager`
- Adaptive Qualitaetsumschaltung + Performance-Overlay
- Custom-Map-Schema/Migration ist ein klarer Schritt Richtung robuster Datenpipeline

## Parallel geaenderte Bereiche ("nebenbei veraendert") und Einordnung

### Beobachtete Worktree-Aenderungen (Auszug)

- Runtime-Spielcode:
  - `js/main.js`
  - `js/modules/Arena.js`
  - `js/modules/Bot.js`
  - `js/modules/Config.js`
  - `js/modules/EntityManager.js`
  - `js/modules/Player.js`
  - `js/modules/Trail.js`
- Neue Module:
  - `js/modules/CustomMapLoader.js`
  - `js/modules/MapSchema.js`
  - `js/modules/UIManager.js`
  - `js/entities/` (neue Fahrzeug-/Mesh-Registry und Mesh-Klassen)
- Editor/UI:
  - `editor/js/EditorAssetLoader.js`
  - `editor/js/EditorMapManager.js`
  - `editor/js/EditorUI.js`
  - `index.html`
  - `style.css`
- Build-Artefakte:
  - `dist/index.html`
  - `dist/assets/*`

### Interpretation fuer die Analyse

- Das Projekt ist mitten in einer Erweiterungs-/Refactor-Phase (Custom Maps + UI-Entkopplung + neue Vehicle-Pipeline).
- Das ist positiv, erzeugt aber typisch folgende Risiken:
  - halbfertige Verantwortungsverschiebungen (z.B. `Game` vs `UIManager`)
  - verwaiste Altpfade (z.B. Trail-local collision API)
  - Integrationsbugs zwischen Lifecycle und neuen persistenten/manuell verwalteten Systemen

## Wie man die Projektstruktur verbessern kann (konkret)

## Hauptprobleme der aktuellen Struktur

1. `main.js` ist zu gross und mischt Domänen.
2. Runtime-Config ist global mutierbar (`CONFIG` als Defaults + State zugleich).
3. UI, Game-State und Debug-Tools sind zu eng gekoppelt.
4. Renderer-Szene-Lifecycle ist zu implizit (persistente vs match-lokale Objekte nicht getrennt).
5. Wenig headless-testbare Grenzflaechen fuer Logiksysteme.

## Zielstruktur (Vorschlag)

```text
js/
  app/
    bootstrap/
      create-game-app.js
      wire-dom.js
    state/
      app-state-machine.js         # MENU / PLAYING / ROUND_END / MATCH_END
      match-state.js
    settings/
      settings-store.js            # localStorage + Profiles
      settings-schema.js           # sanitize/normalize
      runtime-settings.js          # immutable match snapshot
    debug/
      perf-overlay.js
      recorder-tools.js

  game/
    core/
      GameApp.js                   # Orchestrator (kleiner als heutiges main.js)
      GameLoop.js
      EventBus.js (optional)
    world/
      Arena.js
      Renderer.js
      SceneRoots.js                # persistentRoot/matchRoot/debugRoot
    entities/
      EntityManager.js
      Player.js
      Trail.js
      projectiles/
        projectile-factory.js
        projectile-pool.js
    systems/
      PowerupSystem.js
      ParticleSystem.js
      AudioManager.js
      BotSystem.js / BotAI.js
      CameraSystem.js (oder im Renderer klar getrennt)
      CollisionSystem.js
    ui-bridge/
      HudPresenter.js              # nur Spiel->UI-Daten
      CrosshairPresenter.js

  ui/
    menu/
      UIManager.js
      menu-navigation.js
      keybind-editor.js
      profile-ui.js
    hud/
      HUD.js
      hud-dom-renderer.js

  editor/
    ... (bestehende Editor-Dateien, weiter getrennt)

  data/
    config/
      config-defaults.js           # unveraenderliche Defaults
      maps-defaults.js
    maps/
      MapSchema.js
      CustomMapLoader.js

  entities/                        # Falls Mesh-Factory beibehalten wird
    vehicle-registry.js
    ...
```

## Struktur-Prinzipien (entscheidend)

### 1) `CONFIG` aufteilen: Defaults vs Runtime-Settings

Aktuell:

- `CONFIG` ist Default-Konfiguration
- und wird gleichzeitig zur Laufzeit ueberschrieben

Besser:

- `config-defaults.js`: unveraenderlich
- `runtimeSettings` (pro Match Snapshot): aus UI/Settings erzeugt
- Systeme bekommen `runtimeSettings` injiziert (oder lesen aus `matchContext`)

Vorteile:

- testbarer
- weniger versteckte Seiteneffekte
- mehrere Match-Konfigurationen sind sauberer handhabbar

### 2) Klare Lifecycle-Grenzen in der Szene

Renderer sollte nicht "alles ausser Licht" wegwerfen. Besser:

- `persistentRoot`: dauerhaft (z.B. Partikel-System, Debug-Helpers falls gewollt)
- `matchRoot`: Arena, Player, Trails, Powerups, Projektile
- `debugRoot`: optional zuschaltbare Overlays/Helper

Dann:

- `renderer.clearMatchScene()` statt globalem Deep-Dispose
- weniger Kopplung, weniger versteckte Nebenwirkungen

### 3) `Game` als Orchestrator, nicht als UI/Storage/Debug-Sammelbehaelter

Aus `main.js` auslagern:

- Settings Persistence + Profile Management
- Menu Event Wiring
- Build Info / Clipboard
- Perf Overlay
- Match Setup Factory
- Round/Match State Machine

### 4) UI strikt in "State lesen / Events senden"

`UIManager` sollte:

- DOM lesen/schreiben
- UI-Events in Commands umwandeln

`GameApp` sollte:

- Commands verarbeiten
- Spielzustand aendern

Keine doppelte Vehicle-Liste oder doppelte Menu-Context-Logik in zwei Klassen.

### 5) Reine Logiksysteme testbar machen

Besonders geeignet fuer Tests:

- `BotAI`
- `MapSchema` + `CustomMapLoader`
- Kollision/Trail-Geometrie
- Settings-Sanitizer
- Portalplatzierungsregeln

Das haette die aktuellen Bot-/Trail-Probleme frueh sichtbar gemacht.

## Empfohlene Migrationsstrategie (pragmatisch, mit wenig Risiko)

## Phase 0 (sofort, Stabilisierung)

1. Bot-Crash in `js/modules/Bot.js` fixen.
2. Partikel-Lifecycle fixen (`ParticleSystem` nach `clearScene()` neu erstellen oder Szene-Roots einfuehren).
3. `SLOW_TIME` TimeScale-Reset korrekt implementieren.
4. Trail-Alt-API entfernen oder reparieren (bevor sie versehentlich wieder benutzt wird).

## Phase 1 (kleine strukturelle Entkopplung)

1. `SettingsStore` aus `main.js` extrahieren.
2. `MatchFactory`/`MatchSession` fuer `startMatch()`-Aufbau extrahieren.
3. `RoundStateController` fuer Round-End/Match-End Regeln extrahieren.
4. `UIManager`-Migration abschliessen (keine doppelte UI-Logik mehr im `Game`).

## Phase 2 (Renderer + Scene Lifecycle)

1. Scene-Roots einfuehren (`persistentRoot`, `matchRoot`, `debugRoot`)
2. `Renderer.clearScene()` ersetzen durch gezielte Clear-Methoden
3. Resource-Disposal zentralisieren (`dispose()`-Kontrakt fuer Systeme)

## Phase 3 (Qualitaetssicherung)

1. Node-basierte Smoketests fuer `BotAI`, `MapSchema`, `CustomMapLoader`
2. Kleine Regressions-Tests fuer Settings/Profile-Sanitizing
3. Optional: Playtest-URL + scriptbarer Headless-Snapshot-Check fuer Init-Pfade

## Konkrete Quick Wins (hoher Nutzen, wenig Aufwand)

1. `BotAI._senseEnvironment()` Variablen initialisieren + Smoketest behalten.
2. `Game.update()` TimeScale pro Tick deterministisch setzen:
   - Standard `1.0`
   - nur bei aktivem `SLOW_TIME` absenken
3. `ParticleSystem` als match-lokales System neu erstellen oder aus `clearScene()` ausnehmen.
4. `PowerupManager` beim Entfernen auch Child-Materialien disposen.
5. `requiredWins`-Logik mit UI synchronisieren (oder UI-Text klar machen).
6. `InputManager` `preventDefault()` nur fuer tatsächlich gebundene Tasten anwenden.

## Rest-Risiken / offene Fragen

1. Wie wichtig ist bewusstes Beibehalten von `dist/` im Repo? (Derzeit erzeugt das viel Rauschen im Diff.)
2. Soll `ParticleSystem` persistent sein oder pro Match neu erstellt werden?
3. Ist die 5-Siege-Minimum-Regel ein bewusstes Designziel oder ein Debug-Schutz, der vergessen wurde?
4. Soll die alte Trail-Collision-API noch irgendwo genutzt werden (z.B. geplante Features/Bots)?

## Verwendete Checks / Kommandos (Auszug)

```powershell
rg --files
git status --short
git diff --stat
npm run build
rg -n "..." js/modules/Bot.js js/modules/Trail.js ...
node --input-type=module -   # mehrere Headless-Smoketests (Bot, Trail, MapSchema, CustomMapLoader)
```

## Schlussbewertung

Das Projekt ist technisch ambitioniert und fuer ein Arcade-3D-Spiel bereits weit ueber "Prototype"-Niveau (Bots, Recorder, Custom-Map-Pipeline, mehrere Fahrzeuge, HUD, Splitscreen). Die wichtigsten naechsten Schritte sind weniger neue Features, sondern Stabilisierung + saubere Modularisierung der Orchestrierung (`main.js`) und des Scene-Lifecycles.

Wenn diese 3-4 kritischen Punkte gefixt und die Struktur in kleinen Phasen verbessert wird, steigt die Entwicklungsgeschwindigkeit deutlich und Regressionsrisiko sinkt spuerbar.

## Umsetzungsstatus (Session 2026-02-22, append)

Revalidierung vor Fortsetzung wurde durchgefuehrt (Git-Status/Diffs/Log + gezielte `rg`-Checks auf `Renderer`, `Player`, `main.js`, `three-disposal.js` sowie Bot/Trail/Input/Powerup/EntityManager).

### Revalidiert als erledigt / vorhanden

- Bot `_senseEnvironment`-Crashfix vorhanden (deklarierte Probe-/Openness-Variablen in `js/modules/Bot.js`)
- `SLOW_TIME` TimeScale-Reset vorhanden (Default `1.0` pro Tick + Absenkung nur bei aktivem Effekt)
- Trail-Alt-API `Trail.checkCollision()` offenbar entfernt (kein Treffer mehr in `js/modules/Trail.js`)
- `requiredWins` Runtime an UI-Range angepasst (1-15 statt harter Mindestwert 5)
- `InputManager.preventDefault()` nur fuer relevante Tasten / Bindings
- `EntityManager.dispose()` + `PowerupManager.dispose()` im Match-Lifecycle genutzt
- `PowerupManager.dispose()` entsorgt Shared-Geometrien
- `Renderer` Scene-Roots (`persistentRoot`, `matchRoot`, `debugRoot`) + `clearMatchScene()` vorhanden
- `main.js` nutzt `clearMatchScene()`
- `Player.dispose()` Deep-Disposal + `js/modules/three-disposal.js` vorhanden
- Shared-Player-Geometrien gegen Doppel-Dispose markiert
- Projektil-Asset-Disposal in `EntityManager.dispose()` vorhanden

### Zusaetzlich in dieser Session behoben

- Resource-Lifecycle-Restpunkt in `Arena.build()`:
  - `CanvasTexture`-Template wurde erzeugt und geklont, aber Original nicht genutzt/entsorgt
  - Fix: Basis-Textur direkt fuer Boden verwenden, nur Wand-Textur klonen (`js/modules/Arena.js`)
- `ParticleSystem.dispose()` ergaenzt (`js/modules/Particles.js`) und im Match-Lifecycle explizit aufgerufen (`js/main.js`)
  - vor `clearMatchScene()` bei `startMatch()` und `_returnToMenu()`

### Verifikation

- Gezielter Node-Smoke fuer `ParticleSystem.dispose()` erfolgreich (inkl. doppeltem `dispose()` ohne Crash)
- `npm run build` erfolgreich (Vite Chunk-Warnung bleibt, kein Build-Fehler)

### Offene Risiken / naechste Schritte

- Kein echter Browser-Restart-Stresstest (mehrfach Start Match / Return to Menu mit DevTools-Memory-Profiling) in dieser Session
- Naechster sinnvoller Schritt (Phase 1): kleine `SettingsStore`-Extraktion aus `main.js` (nur Load/Save/Profile-Persistenz + Profilname-Lookup, ohne UI-Logik und ohne `_applySettingsToRuntime()`-Umbau)

### Zusatz-Append (Session 2026-02-22, Profil-UI / Phase 1e Verifikation)

- Profil-/Settings-Refactor-Stand (`SettingsStore`, `ProfileDataOps`, `ProfileUiStateOps`, `ProfileControlStateOps`) erneut revalidiert (gezielte `rg`-Checks + Funktionsbloecke in `js/main.js`)
- Browser-UI-Smoke fuer Profilbereich erfolgreich (headless Chromium via Playwright gegen `npm run dev`, ohne `npm run build`)
- Verifizierte Use-Cases:
  - Select eines vorhandenen Profils -> Save-Button zeigt `Aktives Profil aktualisieren`
  - Speichern mit gleichem Namen aktualisiert Profil (kein `Name existiert bereits`)
  - Mirror-Verhalten unveraendert (Input fokussiert = kein Mirror, unfokussiert = Mirror)
  - Save / Load / Delete weiterhin funktional
- Zusaetzlich browserseitig verifiziert:
  - Profil-Update-Fallback funktioniert, wenn `activeProfileName` leer/inkonsistent ist, aber `profile-select` auf existierendes Profil zeigt (`_syncProfileActionState()` / `_saveProfile()` mit `resolveActiveProfileName(...)`-Fallback)
- Ergebnis: keine beabsichtigte Verhaltensaenderung durch Phase 1e sichtbar; kein weiterer Fix in dieser Session notwendig

### Zusatz-Append (Session 2026-02-22, RoundStateOps / Phase 1f kleiner Refactor)

- Revalidierung vor Fortsetzung erneut erfolgt (Audit-Abschnitte + Git/Worktree-Status + gezielte `rg`-Checks auf `main.js`, `Renderer`, `SettingsStore`, Profil-Helper)
- Kleiner verhaltensneutraler Refactor in `js/main.js`:
  - Round-/Match-End-Entscheidungslogik aus `_onRoundEnd()` in neues Pure-Helper-Modul `js/modules/RoundStateOps.js` ausgelagert (`deriveRoundEndOutcome(...)`)
  - `main.js` behält weiterhin State-Mutationen, HUD-/DOM-Schreiben, Recorder-Logik und Lifecycle
- Beibehalten / explizit verifiziert:
  - `requiredWins`-Ableitung bleibt `Math.max(1, parseInt(..., 10) || 1)` (UI-Range 1..15 unveraendert)
  - Match-End nur bei Multiplayer oder Bots (`humanPlayerCount > 1 || totalBots > 0`)
  - UI-Texte fuer Match-End / Round-End / Unentschieden unveraendert
- Verifikation:
  - 2 Node-basierte Headless-Smokes fuer `RoundStateOps` erfolgreich (Match-End, Round-End, Unentschieden inkl. Singleplayer-No-Match-Fall)
- Ergebnis: keine beabsichtigte Verhaltensaenderung sichtbar; Phase-1-Refactor-Schritt weitergefuehrt ohne grossen Umbau

### Zusatz-Append (Session 2026-02-22, Self-Trail Grid-Robustheit + Debug-Instrumentierung)

- Revalidierung vor Fortsetzung erneut durchgefuehrt (Audit-Abschnitte + Git/Worktree-Status + gezielte `rg`-Checks auf `main.js`, `RoundStateOps`, `EntityManager`, `Renderer`, `SettingsStore`)
- Beobachtung / Rest-Risiko bestaetigt:
  - Trail-Spatial-Grid-Registrierung nutzte zuvor nur `midX/midZ` (eine Zelle pro Segment)
  - Dadurch konnten lange Trail-Segmente (z. B. bei Frame-Drops) trotz geometrischer Naehe vom 3x3-Grid-Check verfehlt werden
- Minimaler Robustheits-Fix in `js/modules/EntityManager.js` umgesetzt (verhaltensneutral ausser Bugfix):
  - neue `_getSegmentGridKeys(data)`-Ableitung fuer alle betroffenen X/Z-Grid-Zellen eines Segment-AABB (inkl. Radius)
  - `registerTrailSegment(...)` registriert Segmente in alle relevanten Zellen (statt nur Mittelpunkt-Zelle)
  - `unregisterTrailSegment(...)` bleibt kompatibel und akzeptiert jetzt Single-Key oder Key-Array
- Bereits vorhandener Self-Trail-Blindfenster-Fix bleibt aktiv:
  - dynamisches `deriveSelfTrailSkipRecentSegments(player)` statt festem `skipRecent=25`
- Headless-Verifikation (Node):
  - reproduzierbarer Long-Segment-Fall (`fromX=0` bis `toX=40`) wurde vor dem Fix verfehlt (`hit=null`)
  - nach Fix wird Treffer erkannt (`hit=true`) und Multi-Cell-Unregister entfernt sauber alle Registrierungen
  - `deriveSelfTrailSkipRecentSegments(...)` liefert im Default-nahen Test weiterhin typischerweise `5`
- Browser-/Runtime-Verifikation (ohne Build):
  - `npm run dev` + headless Chromium (Playwright) gegen `?playtest=1`
  - synthetischer Long-Segment-Test im laufenden Runtime-Kontext erkennt Treffer korrekt
  - keine `pageerror`/Console-Errors im Testlauf
- Zusaetzliche Debug-Instrumentierung (nur optional aktiv):
  - URL-Flag `?traildebug=1` (alternativ `?collisiondebug=1`) aktiviert gezielte Konsolenlogs in `EntityManager`
  - Log-Typen:
    - `register-segment` (lange/mehrzellige Segmente, inkl. `segmentLength`, `keyCount`)
    - `skip-recent` (gesampelte Kandidaten, die wegen `skipRecent` uebersprungen werden)
    - `self-hit` (erkannte Self-Trail-Treffer inkl. `skipRecent`)
  - Log-Cap vorhanden (80 Eintraege), um Konsole nicht zu fluten
- Waehrend der Session wurden zusaetzliche Commits im Repo sichtbar:
  - `38997b7` (RoundOutcome-Auslagerung + Self-Trail-Tuning)
  - `63d368a` (`.gitignore` fuer lokale Editor-Logs)
  - `bf8df5c` (Editor-Refactor, unverwandt zur Runtime)
- Ergebnis:
  - gezielter Kollisions-Bugfix fuer Long-Segment/Grid-Randfaelle umgesetzt und technisch verifiziert
  - manueller Ingame-Smoke mit echten engen Loopings / FPS-Schwankungen weiterhin als naechster sinnvoller Schritt offen

### Zusatz-Append (Session 2026-02-22, Self-Trail Debug-Log-Auswertung / Headless-Fallback-Smoke)

- Verbindliche Revalidierung erneut durchgefuehrt:
  - Audit-Abschnitte gelesen (inkl. Phase 1e / 1f / Self-Trail-Append)
  - Git-Status/Diffs/Cached-Diffs/Log geprueft
  - gezielte `rg`-Checks bestaetigen weiterhin vorhandene Marker in `main.js`, `RoundStateOps.js`, `EntityManager.js`, `Renderer.js`, `SettingsStore.js`
- Revalidiert als weiterhin vorhanden / unveraendert (bezogen auf Self-Trail-Round-Refactor-Zielbereich):
  - `deriveRoundEndOutcome(...)`-Auslagerung aktiv (`js/modules/RoundStateOps.js`)
  - `main.js` nutzt weiterhin `deriveRoundEndOutcome(...)`, `clearMatchScene()`, `particles.dispose()`, `setTimeScale(1.0)` und States `ROUND_END`/`MATCH_END`
  - `EntityManager` enthaelt weiterhin:
    - dynamisches `deriveSelfTrailSkipRecentSegments(player)`
    - Multi-Cell-Grid-Registrierung via `_getSegmentGridKeys(...)`
    - Debug-Flags `?traildebug=1` / `?collisiondebug=1` und Log-Typen `register-segment` / `skip-recent` / `self-hit`
- Seit letztem validierten Audit-Stand neu sichtbar (Repo-Historie):
  - neuer Top-Commit `3cf085b` (`fix(trail): harden self-trail grid detection and add debug logs`)
  - mehrere neuere Editor-Commits oberhalb des frueher genannten Bereichs (z. B. `816231e`, `b97f9eb`, `86d0529`, `7b0eabf`)
- Worktree-Beobachtung (uncommitted, nicht von diesem Schritt eingefuehrt):
  - runtime-relevante Source-Aenderungen in `js/main.js`, `js/modules/CustomMapLoader.js`, `js/modules/MapSchema.js`
  - Editor-UI-Aenderung in `editor/js/ui/EditorSessionControls.js`
  - umfangreicher lokaler Churn in `dist/` und `node_modules/` (inkl. Vite-/Rollup-/Playwright-Dateien)
  - keine uncommitted Aenderungen in `js/modules/EntityManager.js`, `js/modules/RoundStateOps.js`, `js/modules/Renderer.js`, `js/modules/SettingsStore.js`
- Browser-/Runtime-Verifikation (Headless-Fallback statt manuellem Ingame-Test, da Session ohne interaktives GUI-Handling):
  - `npm run dev` auf `127.0.0.1:4173` gestartet, Playwright-Headless gegen `?playtest=1&traildebug=1`
  - `GAME_INSTANCE`/Runtime erfolgreich initialisiert, Spielstatus `PLAYING`, keine `pageerror`
  - natuerliche Debug-Logs traten sofort auf (insb. viele `skip-recent`-Logs von Bot-Trail-Kandidaten)
  - in einem ersten Lauf wurde die Log-Cap (`80`) schnell erreicht; dadurch konnten spaetere `self-hit`-Logs im Capture unterdrueckt werden
  - zweiter gezielter Lauf mit erhobener Runtime-Log-Cap (`_trailCollisionDebugMaxLogs=500`) und frueher Injektion lieferte klare Payloads:
    - `register-segment`: langer Segment-Test mit `segmentLength=180`, `keyCount=19` (Multi-Cell-Registrierung sichtbar)
    - `skip-recent`: Self-Trail-Kandidat fuer Spieler 0 mit `dist=0`, `skipRecent=6`, Treffer korrekt unterdrueckt (`preHit=null`)
    - `self-hit`: anschliessend aelterer Segment-Kandidat fuer Spieler 0 mit `skipRecent=6`, Treffer korrekt erkannt (`hit={ hit:true, playerIndex:0 }`)
- Ergebnis:
  - Debug-Instrumentierung funktioniert praktisch im Runtime-Kontext und liefert auswertbare Payloads fuer alle drei Log-Typen
  - Self-Trail-Skip-Recent-Verhalten zeigt plausiblen Wert (`skipRecent=6` im getesteten Runtime-Zustand)
  - kein Follow-up-Fix erforderlich in dieser Session; keine beabsichtigte Verhaltensaenderung vorgenommen
  - echter manueller Ingame-Smoke mit engen Loopings / verschiedenen Schiffsgroessen / instabilerer FPS bleibt weiterhin sinnvoller naechster Praxistest

### Zusatz-Append (Session 2026-02-22, Self-Trail offene Punkte per reproduzierbarem Headless-Smoke geschlossen)

- Ziel der offenen Punkte praktisch abgeschlossen (CLI-/Headless-tauglicher Ersatz fuer manuellen GUI-Smoke):
  - reproduzierbarer Runtime-Smoke fuer Self-Trail/Debug-Logs ueber mehrere Schiffsgroessen
  - Long-Segment-/Frame-Drop-aehnliche Faelle synthetisch im echten Runtime-Kontext geprueft
  - keine Runtime-Injektion fuer Log-Cap mehr notwendig
- Kleine verhaltensneutrale Runtime-Erweiterung in `js/modules/EntityManager.js`:
  - neuer URL-Param `?traildebugmax=<n>` (alternativ `?collisiondebugmax=<n>`) fuer Debug-Log-Cap
  - Start-Info loggt jetzt effektives `maxLogs`
- Neuer reproduzierbarer Smoke-Workflow:
  - Script `scripts/self-trail-debug-smoke.mjs`
  - npm-Shortcut `npm run smoke:selftrail`
  - startet lokalen Vite-Dev-Server, oeffnet Playwright Headless gegen `?playtest=1&traildebug=1&traildebugmax=600`
  - prueft pro Fahrzeug:
    - `deriveSelfTrailSkipRecentSegments(player)` (per Browser-Modulimport)
    - `register-segment`-Logs mit mehrzelligen Long-Segmenten
    - `skip-recent`-Log + unterdrueckter Treffer (`preHit=null`)
    - `self-hit`-Log + erkannter Treffer (`hit=true`)
- Verifikation (gruen, keine Failures) mit mehreren Schiffen:
  - `drone` (`hitboxRadius=0.8`) -> `derivedSkipRecent=6`
  - `aircraft` (`hitboxRadius=1.1`) -> `derivedSkipRecent=10`
  - `manta` (`hitboxRadius=1.4`) -> `derivedSkipRecent=12`
  - Long-Segment-Test bis `segmentLength=180`, Multi-Cell-Registrierung bestaetigt (je nach Fall `keyCount` >= 20)
  - alle drei Debug-Log-Typen pro Fahrzeug nachweisbar (`register-segment`, `skip-recent`, `self-hit`)
- Ergebnis / Status:
  - die im letzten Append offenen technisch validierbaren Punkte sind damit abgeschlossen
  - ein echter manueller Ingame-Praxistest (menschliches Fluggefuehl, enge Loopings unter realer Eingabe/FPS) bleibt optionaler Zusatztest, aber kein blocker fuer diesen Fix-/Verifikationsstand

### Zusatz-Append (Session 2026-02-23, Phase 1 kleiner MatchSessionFactory-Extraktionsschritt)

- Ziel:
  - `startMatch()`-Aufbau weiter entkoppeln (naechster Restpunkt aus Phase 1), ohne UI-/Gameplay-Verhalten zu aendern
- Umsetzung (verhaltensneutraler Refactor):
  - neues Modul `js/modules/MatchSessionFactory.js` mit `createMatchSession(...)`
  - kapselt Match-Session-Assembly aus `Game.startMatch()`:
    - Entsorgung vorheriger Match-Systeme (`EntityManager`, `PowerupManager`, `ParticleSystem`) + `renderer.clearMatchScene()`
    - Neuaufbau von `ParticleSystem`, `Arena`, `PowerupManager`, `EntityManager`
    - Map-Aufloesung via `resolveArenaMapSelection(...)` inkl. Custom-Map-Definition in `CONFIG.MAPS[CUSTOM_MAP_KEY]`
    - `EntityManager.setup(...)` inkl. human/bot-Setup-Optionen
    - Rueckgabe eines Match-Session-Objekts (`particles`, `arena`, `powerupManager`, `entityManager`, `mapResolution`, `effectiveMapKey`, `numHumans`, `numBots`, `winsNeeded`)
  - `js/main.js` nutzt jetzt `createMatchSession(...)` und behaelt bewusst:
    - UI-Sichtbarkeiten / HUD
    - Map-Warn-/Fallback-Toasts
    - Callback-Wiring (`onPlayerFeedback`, `onPlayerDied`, `onRoundEnd`)
    - Kamera-Erzeugung, Score-Reset, `_startRound()`
- Nicht Teil dieses Schritts (weiterhin offen):
  - vollstaendige `MatchSession`-/`MatchFactory`-Abstraktion fuer Lifecycle + Callback-Wiring
  - `RoundStateController` statt Helper-only `RoundStateOps`
  - Abschluss `UIManager`-Migration
- Verifikation:
  - Syntaxchecks erfolgreich (`node --check js/modules/MatchSessionFactory.js`, `node --check js/main.js`)
  - Regressions-Smoke erfolgreich: `npm run smoke:selftrail`
    - `startMatch()`/Match-Neuaufbau mehrfach durchlaufen (mehrere Fahrzeuge)
    - Self-Trail-Debug-Logs weiter intakt (`register-segment`, `skip-recent`, `self-hit`)
    - keine Failures im Smoke-JSON
- Ergebnis:
  - Phase 1 Restpunkt `MatchFactory/MatchSession` wurde begonnen und sichtbar vorangetrieben
  - `startMatch()` ist kleiner und klarer, ohne beabsichtigte Verhaltensaenderung

### Zusatz-Append (Session 2026-02-23, Phase 1 MatchSessionFactory-Wiring-Fortsetzung)

- Ziel (Fortsetzung des vorherigen Phase-1-Schritts):
  - weiteres Entkoppeln von `Game.startMatch()` durch Auslagerung von Runtime-Wiring (Callbacks/Kameras/Score-Reset)
- Umsetzung (verhaltensneutraler Refactor):
  - `js/modules/MatchSessionFactory.js` erweitert um `wireMatchSessionRuntime(...)`
  - kapselt jetzt:
    - `entityManager.onPlayerFeedback`
    - `entityManager.onPlayerDied`
    - `entityManager.onRoundEnd`
    - Kamera-Erzeugung (`renderer.createCamera(...)` je Human-Player)
    - initialen Score-Reset aller Player
  - `js/main.js` uebergibt weiterhin UI-/Game-spezifische Closures (Toast-/Message-/Round-End-Verhalten), aber das Verkabeln selbst passiert im Helper
- Nicht Teil dieses Schritts (weiterhin offen):
  - vollstaendige `MatchSession`-Lifecycle-Kapselung (inkl. UI/HUD-Orchestrierung)
  - `RoundStateController` (State-Transitions + DOM/HUD-Schreibpfade) statt Helper-only `RoundStateOps`
  - Abschluss `UIManager`-Migration
- Verifikation:
  - Syntaxchecks erfolgreich (`node --check js/modules/MatchSessionFactory.js`, `node --check js/main.js`)
  - Regressions-Smoke erfolgreich: `npm run smoke:selftrail`
    - mehrfacher `startMatch()`-/Match-Neuaufbau im Headless-Lauf weiterhin stabil
    - keine Failures, Self-Trail-Debug-Logs unveraendert vorhanden
- Ergebnis:
  - `startMatch()` wurde weiter verkleinert (weniger Verdrahtungs-/Setup-Details im `Game`)
  - Phase-1-Restpunkt `MatchFactory/MatchSession` weiter reduziert, aber noch nicht vollstaendig abgeschlossen

### Zusatz-Append (Session 2026-02-23, Phase 1 MapResolution-Feedback-Helper + initializeMatchSession)

- Ziel (Reihenfolge wie geplant: erst 1 dann 2):
  - 1) Map-Warn-/Fallback-Toast-Logik aus `startMatch()` auslagern (ohne UI-Aufruf im Helper)
  - 2) `createMatchSession(...)` + `wireMatchSessionRuntime(...)` zu `initializeMatchSession(...)` zusammenfassen
- Umsetzung (verhaltensneutraler Refactor):
  - `js/modules/MatchSessionFactory.js` erweitert um `deriveMapResolutionFeedbackPlan(...)`
    - liefert `consoleEntries` + `toasts` als reinen Message-Plan (keine direkten `console`-/UI-Aufrufe erforderlich)
    - bildet die bisherige Logik fuer:
      - Fallback-/Custom-Map-Warnungen
      - Hinweis-Toast bei Custom-Map-Warnings
      - "nur nicht unterstuetzte Editor-Objekte"
      - "nur Portale, aber Portale deaktiviert"
  - `js/modules/MatchSessionFactory.js` erweitert um `initializeMatchSession(...)`
    - orchestriert intern:
      - `createMatchSession(...)`
      - `wireMatchSessionRuntime(...)`
      - `deriveMapResolutionFeedbackPlan(...)`
    - gibt `{ session, runtime, feedbackPlan }` zurueck
  - `js/main.js` (`startMatch()`) nutzt jetzt `initializeMatchSession(...)`
    - UI-spezifische Closures bleiben im `Game`
    - `feedbackPlan.consoleEntries` und `feedbackPlan.toasts` werden im `Game` angewendet
- Ergebnis in `startMatch()`:
  - deutlich weniger Inline-Details fuer Session-Aufbau, Runtime-Wiring und Map-Feedback-Bedingungen
  - Fokus bleibt auf UI-Orchestrierung + Startsequenz
- Verifikation:
  - Syntaxchecks erfolgreich (`node --check js/modules/MatchSessionFactory.js`, `node --check js/main.js`)
  - Regressions-Smoke erfolgreich: `npm run smoke:selftrail`
    - mehrfacher `startMatch()`-Pfad weiterhin stabil
    - keine Failures, Self-Trail-Debug-Logs unveraendert vorhanden
- Reststatus Phase 1:
  - `MatchFactory/MatchSession`-Restpunkt weiter reduziert, aber noch offen (vollstaendige Lifecycle-/UI-Orchestrierungskapselung fehlt weiterhin)

### Zusatz-Append (Session 2026-02-23, Phase 1 Start-Match-UI-Orchestrierung via MatchUiStateOps)

- Ziel:
  - `startMatch()` weiter verkleinern durch Auslagerung der Start-UI-Entscheidungen (Menu/HUD/Overlay/Toast/Splitscreen/P2-HUD)
- Umsetzung (verhaltensneutraler Refactor):
  - neues Pure-Helper-Modul `js/modules/MatchUiStateOps.js` mit `deriveMatchStartUiState({ numHumans })`
  - liefert einen kleinen UI-Plan:
    - `splitScreenEnabled`
    - `p2HudVisible`
    - Sichtbarkeiten fuer `mainMenu`, `hud`, `messageOverlay`, `statusToast`
  - `js/main.js` erweitert um `_applyMatchStartUiState(uiState)` fuer DOM-/Renderer-Anwendung
  - `startMatch()` nutzt nun `deriveMatchStartUiState(...)` + `_applyMatchStartUiState(...)` statt mehrerer Inline-UI-Zeilen
- Nicht Teil dieses Schritts:
  - Rueckweg-/Ende-UI-Orchestrierung (`_returnToMenu()`, Round/Match-End Overlays) ist noch nicht im selben Stil extrahiert
  - vollstaendige `UIManager`-Migration bleibt weiterhin offen
- Verifikation:
  - Syntaxchecks erfolgreich (`node --check js/modules/MatchUiStateOps.js`, `node --check js/main.js`)
  - Regressions-Smoke erfolgreich: `npm run smoke:selftrail`
    - mehrfacher `startMatch()`-Pfad weiterhin stabil
    - keine Failures, Self-Trail-Debug-Logs unveraendert vorhanden
- Ergebnis:
  - `startMatch()` enthaelt weniger UI-Detaillogik und ist als Ablaufsteuerung klarer lesbar
  - Phase-1-Entkopplung weiter vorangetrieben, aber noch nicht abgeschlossen

### Zusatz-Append (Session 2026-02-23, Phase 1 startMatch-Game-Helper-Cleanup)

- Ziel:
  - `startMatch()` weiter auf Ablaufsteuerung reduzieren, ohne neue Module mit UI-Seiteneffekten zu ueberladen
- Umsetzung (verhaltensneutral):
  - `js/main.js` erweitert um `_applyInitializedMatchSession(initializedMatch)`
    - uebernimmt Session-Objekte/Felder (`particles`, `arena`, `powerupManager`, `entityManager`, `mapKey`, `numHumans`, `numBots`, `winsNeeded`)
  - `js/main.js` erweitert um `_applyMatchFeedbackPlan(feedbackPlan)`
    - wendet `consoleEntries` und `toasts` aus dem bereits ausgelagerten Feedback-Plan an
  - `startMatch()` ruft diese Helper jetzt direkt nach `initializeMatchSession(...)` auf
- Verifikation:
  - Syntaxcheck erfolgreich (`node --check js/main.js`)
  - Regressions-Smoke erfolgreich (`npm run smoke:selftrail`), keine Failures
- Ergebnis:
  - `startMatch()` ist lesbarer und naeher an einer reinen Startsequenz-Orchestrierung
  - Phase-1-Restpunkt `MatchFactory/MatchSession` weiter reduziert, aber weiterhin nicht vollstaendig abgeschlossen

### Zusatz-Append (Session 2026-02-23, Phase 1 MatchUiStateOps-Erweiterung fuer Round/Return-UI)

- Ziel:
  - gleiche UI-State-Helper-Logik nicht nur fuer `startMatch()`, sondern auch fuer `_startRound()`, `_onRoundEnd()` und `_returnToMenu()` nutzen
- Umsetzung (verhaltensneutraler Refactor):
  - `js/modules/MatchUiStateOps.js` erweitert um:
    - `deriveReturnToMenuUiState()`
    - `deriveRoundStartUiState()`
    - `deriveRoundEndOverlayUiState(roundEndOutcome)`
  - `js/main.js`:
    - `_applyMatchStartUiState(...)` intern auf generischen `_applyMatchUiState(...)` umgestellt
    - `_applyMatchUiState(...)` kann jetzt partielle Visibility-Patches sowie `messageText`/`messageSub` anwenden
    - `_startRound()` nutzt `deriveRoundStartUiState()` (Overlay/Toast ausblenden)
    - `_onRoundEnd()` nutzt `deriveRoundEndOverlayUiState(...)` (Message-Overlay-Text + Sichtbarkeit)
    - `_returnToMenu()` nutzt `deriveReturnToMenuUiState()`
    - Crosshair-Reset in Game-Helper ausgelagert (`_resetCrosshairUi()`)
- Verifikation:
  - Syntaxchecks erfolgreich (`node --check js/modules/MatchUiStateOps.js`, `node --check js/main.js`)
  - Regressions-Smoke erfolgreich: `npm run smoke:selftrail` (mehrfacher `startMatch()` + `_returnToMenu()`-Pfad)
    - keine Failures
    - Self-Trail-Debug-Logs unveraendert vorhanden
- Ergebnis:
  - `startMatch()`, `_startRound()`, `_onRoundEnd()` und `_returnToMenu()` haben weniger direkte UI-Detaillogik
  - UI-Zustandsentscheidungen sind konsistenter in Pure-Helpern gebuendelt
  - Phase-1-Entkopplung weiter vorangetrieben, aber weiterhin nicht abgeschlossen

### Zusatz-Append (Session 2026-02-23, Phase 1 5er-Block: Teardown-Symmetrie + Countdown-UI + Session-Ref-Helper)

- Ausgefuehrte 5 Schritte (hintereinander, verhaltensneutral):
  - 1) `MatchSessionFactory`: bisher internes Dispose als exportierten, wiederverwendbaren Helper verallgemeinert (`disposeMatchSessionSystems(renderer, session)`)
  - 2) `_returnToMenu()` auf den neuen Session-Teardown-Helper umgestellt (symmetrischer zu `create/initializeMatchSession`)
  - 3) `MatchUiStateOps`: `deriveRoundEndCountdownUiState(roundPause)` hinzugefuegt (Pure-Helper fuer `ROUND_END`-Countdown-Subtext)
  - 4) `Game`: Session-Referenz-Helper hinzugefuegt (`_getCurrentMatchSessionRefs()`, `_clearMatchSessionRefs()`) und in `startMatch()`/`_returnToMenu()` genutzt
  - 5) Verifikation komplett durchgefuehrt (Syntaxchecks + voller Multi-Vehicle-Self-Trail-Smoke)
- Umsetzung im Detail:
  - `js/modules/MatchSessionFactory.js`
    - `disposeMatchSessionSystems(...)` wird jetzt sowohl beim Match-Neuaufbau als auch beim Menue-Rueckweg wiederverwendbar
  - `js/modules/MatchUiStateOps.js`
    - `deriveRoundEndCountdownUiState(...)` liefert nur bei `countdown > 0` einen UI-Patch fuer `messageSub`
  - `js/main.js`
    - `startMatch()` uebergibt `currentSession` jetzt via `_getCurrentMatchSessionRefs()`
    - `ROUND_END`-Update nutzt `deriveRoundEndCountdownUiState(...)` + `_applyMatchUiState(...)`
    - `_returnToMenu()` nutzt `disposeMatchSessionSystems(...)` + `_clearMatchSessionRefs()`
- Verifikation:
  - Syntaxchecks erfolgreich:
    - `node --check js/modules/MatchSessionFactory.js`
    - `node --check js/modules/MatchUiStateOps.js`
    - `node --check js/main.js`
  - Regressions-Smoke erfolgreich:
    - `npm run smoke:selftrail`
    - 3 Fahrzeuge (`drone`, `manta`, `aircraft`)
    - keine Failures
    - Self-Trail-Debug-Logs (`register-segment`, `skip-recent`, `self-hit`) weiterhin vorhanden
- Ergebnis:
  - Match-Session Start/Stop-Pfade sind symmetrischer und klarer
  - `ROUND_END`-UI-Update folgt nun ebenfalls dem Pure-Helper-/Apply-Muster
  - Phase 1 weiter reduziert, aber noch nicht abgeschlossen

### Zusatz-Append (Session 2026-02-23, Phase 1 5er-Block: update()-State-Branch-Entkopplung)

- Ausgefuehrte 5 Schritte (hintereinander, verhaltensneutral mit kleinem Sicherheits-Guard):
  - 1) `Game`: zentrale Teardown-Wiederverwendung weitergezogen (`disposeMatchSessionSystems(...)` + Session-Ref-Helper bereits aktiv in Start/Stop-Pfaden genutzt)
  - 2) `ROUND_END`-Branch aus `update(dt)` in `_updateRoundEndState(dt)` extrahiert
  - 3) `MATCH_END`-Branch aus `update(dt)` in `_updateMatchEndState(dt)` extrahiert
  - 4) `PLAYING`-Branch in mehrere Helper zerlegt:
    - `_updatePlayingState(dt)` (Orchestrierung)
    - `_updatePlayingHudTick(dt)` (HUD/Fighter-HUD/Lock-Farben)
    - `_applyPlayingTimeScaleFromEffects()` (TimeScale-Reset + `SLOW_TIME`)
  - 5) Vollverifikation (Syntax + Self-Trail-Multi-Vehicle-Smoke) erfolgreich
- Umsetzung im Detail:
  - `js/main.js`
    - `update(dt)` delegiert State-spezifische Logik jetzt nur noch an `_updatePlayingState`, `_updateRoundEndState`, `_updateMatchEndState`
    - `ROUND_END`-Countdown nutzt weiterhin den bereits ausgelagerten `deriveRoundEndCountdownUiState(...)`-Pfad
    - `MATCH_END`-Helper enthaelt einen kleinen Sicherheits-Guard:
      - nach `Escape` -> `_returnToMenu()` wird frueh `return`ed, damit kein `updateCameras()` auf bereits freigegebener Session ausgefuehrt wird
      - das ist eine kleine Robustheitsverbesserung, keine beabsichtigte UX-/Gameplay-Aenderung
- Verifikation:
  - Syntaxchecks erfolgreich:
    - `node --check js/main.js`
    - `node --check js/modules/MatchSessionFactory.js`
    - `node --check js/modules/MatchUiStateOps.js`
  - Regressions-Smoke erfolgreich:
    - `npm run smoke:selftrail`
    - 3 Fahrzeuge (`drone`, `manta`, `aircraft`)
    - keine Failures
    - Self-Trail-Debug-Logs unveraendert vorhanden
- Ergebnis:
  - `update(dt)` ist als Top-Level-Orchestrierung deutlich lesbarer
  - Phase-1-Entkopplung im Runtime-Controller weiter vorangetrieben
  - grosser Restpunkt (`RoundStateController`/weitere Orchestrierungskapselung) bleibt weiterhin offen

### Zusatz-Append (Session 2026-02-23, Phase 1 RoundStateControllerOps-Vorbereitung (Tick-/Transition-Helper))

- Ziel:
  - naechsten grossen Phase-1-Restpunkt vorbereiten (`RoundStateController`), ohne sofort einen kompletten Controller einzufuehren
  - Round-/Match-End Tick-Entscheidungen aus `Game` in Pure-Helper verlagern
- Umsetzung (verhaltensneutral mit kleinem bestehenden Sicherheits-Guard im `MATCH_END`-Pfad):
  - neues Modul `js/modules/RoundStateControllerOps.js` mit Pure-Helpern:
    - `deriveRoundEndControllerTransition(roundEndOutcome, { defaultRoundPause })`
    - `deriveRoundEndTickStep({ dt, roundPause, enterPressed, escapePressed })`
    - `deriveMatchEndTickStep({ enterPressed, escapePressed })`
  - `js/main.js` nutzt diese Helper in:
    - `_onRoundEnd()` (Controller-Transition / `roundPause` + `state` + Overlay-Textdaten)
    - `_updateRoundEndState(dt)` (Tick-Decision fuer Return/Menu vs. Wait vs. Start-Round)
    - `_updateMatchEndState(dt)` (Tick-Decision fuer Restart/Return/Wait)
- Beibehaltener Verhaltensrahmen:
  - Overlay-Rendering bleibt ueber `MatchUiStateOps` + `_applyMatchUiState(...)`
  - `deriveRoundEndOutcome(...)` aus `RoundStateOps.js` bleibt die fachliche Ergebnisquelle
  - `MATCH_END`-Escape-Pfad bleibt robust (kein `updateCameras()` nach `_returnToMenu()`)
- Verifikation:
  - Syntaxchecks erfolgreich (`node --check js/modules/RoundStateControllerOps.js`, `node --check js/main.js`)
  - gezielter Node-Check fuer neue Pure-Helper erfolgreich (Transitions + Tick-Aktionen inkl. `RETURN_TO_MENU`/`START_ROUND`/`RESTART_MATCH`)
  - Hinweis zum bestehenden Headless-Smoke-Runner:
    - `npm run smoke:selftrail` zeigte in dieser Session mehrfach einen Runner-Timeout / `page.waitForFunction`-Timeout im Playwright-Skript (`GAME_INSTANCE`/`PLAYING`-Warten), ohne direkten Code-Fehler im Refactor-Pfad
    - daher fuer diesen Schritt primaer Syntax + Node-Helper-Verifikation genutzt; erneuter Runtime-Smoke bleibt sinnvoll nach Runner-Stabilisierung
- Ergebnis:
  - Round-/Match-End Tick-Entscheidungen sind sichtbar aus `Game`-Imperativcode herausgeloest
  - klarer Vorbau fuer spaeteren vollstaendigen `RoundStateController`, aber Restpunkt bleibt offen

### Zusatz-Append (Session 2026-02-23, Phase 1 5er-Block: erster `RoundStateController` + Smoke-Runner-Reha)

- Kontext (vor Verifikation behoben):
  - Runtime-Regression blockierte Spielstart (nur Menue erreichbar):
    - doppelter `THREE`-Import in `js/modules/Arena.js`
    - fehlende Arena-Methoden (`getRandomPosition*`, `getPortalLevels*`, `update(dt)`)
  - Startup-Blocker wurde behoben; Spielstart (`PLAYING`) wieder verifiziert
- Ausgefuehrte 5 Schritte (hintereinander, verhaltensneutral im Refactor-Teil):
  - 1) neues Modul `js/modules/RoundStateController.js` eingefuehrt (dunner Wrapper ueber `RoundStateControllerOps`)
  - 2) `Game` instanziiert Controller frueh im Konstruktor (`this.roundStateController`)
  - 3) `_onRoundEnd()` nutzt jetzt `roundStateController.deriveRoundEndTransition(...)`
  - 4) `_updateRoundEndState(dt)` und `_updateMatchEndState(dt)` nutzen jetzt Controller-Tick-Methoden statt direkter Ops-Calls
  - 5) gemeinsame Action-Ausfuehrung in `Game` eingefuehrt (`_executeRoundStateTickAction`) fuer `RETURN_TO_MENU` / `START_ROUND` / `RESTART_MATCH`
- Zusaetzliche Regressions-/Tooling-Fixes (zur belastbaren Verifikation):
  - `js/modules/EntityManager.js`
    - fehlender Self-Trail-Debug-Log `register-segment` in `registerTrailSegment(...)` wiederhergestellt
    - dadurch prueft der Headless-Smoke wieder `keyCount`/Long-Segment-Multi-Cell-Registrierung
  - `scripts/self-trail-debug-smoke.mjs`
    - bestehende Runner-Stabilisierung (Lockfile + Existing-Server-Probe) weiter verifiziert
    - Cleanup-Fix: Playwright-Browser wird jetzt auch bei Fehlern im `finally` geschlossen (verhindert Haenger nach `waitForFunction`-Timeout)
- Verifikation:
  - Syntaxchecks erfolgreich:
    - `node --check js/modules/RoundStateController.js`
    - `node --check js/main.js`
    - `node --check js/modules/EntityManager.js`
    - `node --check scripts/self-trail-debug-smoke.mjs`
  - Regressions-Smoke erfolgreich:
    - `npm run smoke:selftrail`
    - `serverMode: spawned-local` (Lock/Server-Probe/Cleanup-Pfad mitgetestet)
    - 3 Fahrzeuge (`drone`, `manta`, `aircraft`)
    - keine Failures
    - erwartete Debug-Logs wieder vorhanden (`register-segment`, `skip-recent`, `self-hit`)
    - Long-Segment-/Multi-Cell-Nachweis wieder gruen (`maxRegisterKeyCount=20`, `maxRegisterSegmentLength=180`)
- Ergebnis:
  - erster echter `RoundStateController`-Baustein ist im Projekt vorhanden (wenn auch noch duenn)
  - `Game` enthaelt weniger direkte Tick-/Transition-Entscheidungsverdrahtung fuer Round/Match-End
  - Phase-1-Restpunkt `RoundStateController` ist sichtbar reduziert, aber weiterhin nicht vollstaendig abgeschlossen

### Zusatz-Append (Session 2026-02-23, Phase 1 5er-Block: `_onRoundEnd()` weiter entschlackt + Controller kennt On-Round-End-Plan)

- Ausgefuehrte 5 Schritte (hintereinander, verhaltensneutral):
  - 1) `RoundStateController` um `deriveOnRoundEndPlan(players, inputs)` erweitert (kombiniert Outcome + Transition)
  - 2) `Game._onRoundEnd()`-Recording-Dump in `_finalizeRoundRecording(winner)` ausgelagert
  - 3) Gewinner-Score-Inkrement in `_applyRoundEndWinnerScore(winner)` ausgelagert
  - 4) Controller-Inputs fuer Round-End in `_buildRoundEndControllerInputs(winner)` gekapselt
  - 5) `_onRoundEnd()` nutzt jetzt `_deriveOnRoundEndPlan(winner)` + `_applyRoundEndControllerTransition(...)`
- Wirkung:
  - `Game` importiert `deriveRoundEndOutcome(...)` nicht mehr direkt
  - fachliche Round-End-Outcome+Transition-Kette liegt naeher an der `RoundStateController`-Schicht
- Zwischen-Verifikation:
  - Syntaxchecks erfolgreich (`node --check js/modules/RoundStateController.js`, `node --check js/main.js`)
  - Headless-Smoke zuerst mit transientem Playwright-Launch-Crash (Chromium-Prozess schliesst sofort), anschliessend Retry erfolgreich (kein Code-Fehler im Refactor-Pfad)

### Zusatz-Append (Session 2026-02-23, Phase 1 5er-Block: Round/Match-End-Tick-Anwendung in Game weiter zerlegt)

- Ausgefuehrte 5 Schritte (hintereinander, verhaltensneutral):
  - 1) Tick-Input-Lesen fuer `ROUND_END` in `_readRoundEndTickInputs(dt)` ausgelagert
  - 2) Tick-Input-Lesen fuer `MATCH_END` in `_readMatchEndTickInputs()` ausgelagert
  - 3) Countdown-UI-Anwendung in `_applyRoundEndTickUi(roundEndTick)` ausgelagert
  - 4) Kamera-Update-Entscheidung in `_updateRoundStateCamerasIfNeeded(dt, shouldUpdateCameras)` zentralisiert
  - 5) Schritt-Anwendung pro Tick in `_applyRoundEndTickStep(...)` und `_applyMatchEndTickStep(...)` gekapselt; `_updateRoundEndState()` / `_updateMatchEndState()` wurden weiter ausgeduennt
- Verifikation:
  - Syntaxchecks erfolgreich (`node --check js/main.js`, `node --check js/modules/RoundStateController.js`)
  - Regressions-Smoke erfolgreich:
    - `npm run smoke:selftrail`
    - `serverMode: spawned-local`
    - 3 Fahrzeuge (`drone`, `manta`, `aircraft`)
    - keine Failures
    - Self-Trail-Debug-Logs weiterhin vorhanden (`register-segment`, `skip-recent`, `self-hit`)
- Ergebnis:
  - `ROUND_END`/`MATCH_END`-Pfade in `Game` sind weiter in Input -> Controller -> Apply zerlegt
  - naechster sinnvoller Schritt bleibt die weitere Verschiebung von Round-End-Orchestrierung (Recorder/Score/Outcome/UI) in eine dediziertere Controller-/Coordinator-Schicht

### Zusatz-Append (Session 2026-02-23, Phase 1 weiterer Block: `RoundEndCoordinator` + Node-Smoke fuer RoundState)

- Ziel:
  - `_onRoundEnd()` weiter von Recorder-/Score-/Plan-Orchestrierung entlasten
  - einen kleinen, schnellen Node-Smoke fuer `RoundStateController`/Round-End-Orchestrierung etablieren (Phase-3-Testabdeckung vorbereiten)
- Umsetzung (verhaltensneutral):
  - neues Modul `js/modules/RoundEndCoordinator.js`
    - `finalizeRoundRecording(...)` (inkl. Fehlerfang + Debug-Logging wie bisher im `Game`)
    - `applyRoundEndWinnerScore(...)`
    - `buildRoundEndControllerInputs(...)`
    - `deriveOnRoundEndCoordinatorPlan(...)`
    - `coordinateRoundEnd(...)` (Recorder + Score + Controller-Plan in einem Orchestrierungsschritt)
  - `js/main.js`
    - `_onRoundEnd()` nutzt jetzt `coordinateRoundEnd(...)`
    - mehrere vorherige lokale Helfer (`_finalizeRoundRecording`, `_applyRoundEndWinnerScore`, `_buildRoundEndControllerInputs`, `_deriveOnRoundEndPlan`) entfallen aus `Game`
  - neuer Node-Smoke `scripts/round-state-controller-smoke.mjs`
    - testet `RoundStateController`-Tick-Aktionen (`WAIT`, `START_ROUND`, `RETURN_TO_MENU`, `RESTART_MATCH`)
    - testet `coordinateRoundEnd(...)` Happy-Path (`ROUND_END`), Match-End-Pfad (`MATCH_END`) und Recorder-Fehlerfall (Fehler wird protokolliert, Ablauf bleibt stabil)
  - `package.json`
    - neuer Script-Shortcut `npm run smoke:roundstate`
- Verifikation:
  - Syntaxchecks erfolgreich:
    - `node --check js/modules/RoundEndCoordinator.js`
    - `node --check js/main.js`
    - `node --check scripts/round-state-controller-smoke.mjs`
  - Node-Smoke erfolgreich:
    - `npm run smoke:roundstate` -> `ok: true`
    - Hinweis: Node gibt weiterhin nur einen nicht-blockierenden `[MODULE_TYPELESS_PACKAGE_JSON]`-Warnhinweis aus (ESM-Reparse), kein Testfehler
  - Regressions-Smoke erfolgreich:
    - `npm run smoke:selftrail`
    - 3 Fahrzeuge (`drone`, `manta`, `aircraft`)
    - keine Failures
- Ergebnis:
  - `_onRoundEnd()` ist weiter reduziert und konsistenter als Orchestrierungspunkt
  - Round-End-Recorder/Score/Controller-Plan-Logik liegt nun in einer dedizierten Schicht (`RoundEndCoordinator`)
  - Phase 1 (RoundStateController/Orchestrierung) weiter reduziert; Phase 3-Testabdeckung leicht verbessert (neuer schneller Node-Smoke)

### Zusatz-Append (Session 2026-02-23, Phase 1 weiterer Block: UI-Plan im `RoundEndCoordinator` + gemeinsame Tick-Step-Basis)

- Ziel:
  - `Game` soll beim Round-End weniger Overlay-Feldwissen (`messageText`/`messageSub`) tragen
  - weitere Reduktion doppelter Apply-Logik in `ROUND_END`/`MATCH_END` Tick-Pfaden
- Umsetzung (verhaltensneutral):
  - `js/modules/RoundEndCoordinator.js`
    - importiert `deriveRoundEndOverlayUiState(...)` aus `MatchUiStateOps`
    - neues `deriveRoundEndCoordinatorUiState(plan)` erzeugt fertigen Overlay-UI-State aus der Controller-Transition
    - `coordinateRoundEnd(...)` liefert jetzt zusaetzlich `uiState`
  - `js/main.js`
    - `_onRoundEnd()` nutzt `_applyRoundEndCoordinatorPlan(roundEndPlan)` statt direktem Overlay-Feld-Mapping
    - `_applyRoundEndControllerTransition(...)` wurde in state-fokussierte Variante aufgeteilt (`_applyRoundEndControllerTransitionState(...)`)
    - neue gemeinsame Tick-Basis `_applyRoundStateTickStepBase(tickStep, dt)` kapselt `RETURN_TO_MENU`-Kurzpfad + Kamera-Update fuer `ROUND_END` und `MATCH_END`
  - `scripts/round-state-controller-smoke.mjs`
    - erweitert um Assertions fuer `result.uiState` (Overlay sichtbar + Texte vorhanden, auch im Recorder-Fehlerfall)
- Verifikation:
  - Syntaxchecks erfolgreich:
    - `node --check js/modules/RoundEndCoordinator.js`
    - `node --check js/main.js`
    - `node --check scripts/round-state-controller-smoke.mjs`
  - Node-Smoke erfolgreich:
    - `npm run smoke:roundstate` -> `ok: true`
    - `uiState`-Assertions gruen
    - Hinweis: `[MODULE_TYPELESS_PACKAGE_JSON]` bleibt ein nicht-blockierender Node-Warnhinweis
  - Regressions-Smoke erfolgreich:
    - `npm run smoke:selftrail`
    - 3 Fahrzeuge (`drone`, `manta`, `aircraft`)
    - keine Failures
- Ergebnis:
  - `Game` kennt beim Round-End-Overlay weniger konkrete Textfeld-Verdrahtung
  - `ROUND_END`/`MATCH_END` teilen nun mehr Apply-Infrastruktur im `Game`
  - Phase-1-Restpunkt (RoundState-/UI-Orchestrierung) weiter reduziert, aber weiterhin offen

### Zusatz-Append (Session 2026-02-23, Phase 1 weiterer Block: gemeinsamer RoundState-Tick-Runner mit Hooks)

- Ziel:
  - verbleibende Duplikate in `_applyRoundEndTickStep(...)` / `_applyMatchEndTickStep(...)` weiter reduzieren
  - Tick-Verhalten durch Node-Smoke staerker absichern (Countdown-Text + Camera-Flags)
- Umsetzung (verhaltensneutral):
  - `js/main.js`
    - neuer gemeinsamer Tick-Core `_runRoundStateTickStepCore(tickStep, dt, hooks)`:
      - optionaler `beforeBase`-Hook (z. B. `RESTART_MATCH`)
      - gemeinsamer `RETURN_TO_MENU`-Kurzpfad
      - gemeinsames Kamera-Update
      - optionaler `afterBase`-Hook (z. B. `START_ROUND`)
    - `_applyRoundEndTickMutableState(roundEndTick)` ausgelagert (`roundPause` + Countdown-UI)
    - `_applyRoundEndTickStep(...)` nutzt jetzt Tick-Core + `afterBase`
    - `_applyMatchEndTickStep(...)` nutzt jetzt Tick-Core + `beforeBase`
  - `scripts/round-state-controller-smoke.mjs`
    - Tick-Assertions erweitert:
      - `countdownMessageSub` fuer `WAIT`
      - `shouldUpdateCameras`-Flags fuer `START_ROUND`, `RETURN_TO_MENU`, `RESTART_MATCH`
- Verifikation:
  - Syntaxchecks erfolgreich:
    - `node --check js/main.js`
    - `node --check scripts/round-state-controller-smoke.mjs`
  - Node-Smoke erfolgreich:
    - `npm run smoke:roundstate` -> `ok: true`
    - Tick-Assertions inkl. Camera-Flags/Countdown gruen
    - `[MODULE_TYPELESS_PACKAGE_JSON]`-Warnhinweis weiterhin nicht-blockierend
  - Regressions-Smoke erfolgreich:
    - `npm run smoke:selftrail`
    - 3 Fahrzeuge (`drone`, `manta`, `aircraft`)
    - keine Failures
- Ergebnis:
  - `ROUND_END`/`MATCH_END`-Tick-Anwendung im `Game` ist nochmals symmetrischer
  - Refactor-Risiko durch erweiterte `smoke:roundstate`-Tick-Assertions reduziert
  - Phase-1-Restpunkt weiter verkleinert, aber nicht abgeschlossen

### Zusatz-Append (Session 2026-02-23, Phase 1 weiterer Block: generischer RoundState-Update-Runner)

- Ziel:
  - die letzten kleinen Duplikate zwischen `_updateRoundEndState(dt)` und `_updateMatchEndState(dt)` reduzieren
  - Update-Pfade als deklarative Kombination aus `deriveTickStep` + `applyTickStep` lesbarer machen
- Umsetzung (verhaltensneutral):
  - `js/main.js`
    - `_deriveRoundEndTickStep(dt)` extrahiert (Controller + `ROUND_END`-Input-Reader)
    - `_deriveMatchEndTickStep()` extrahiert (Controller + `MATCH_END`-Input-Reader)
    - neuer generischer Helper `_runRoundStateTickUpdate(dt, deriveTickStep, applyTickStep)`
      - ruft Tick-Ableitung und Tick-Anwendung zentral auf
      - gibt den booleschen Kurzpfad (`return`/weiterlaufen) an den Aufrufer zurueck
    - `_updateRoundEndState(dt)` und `_updateMatchEndState(dt)` nutzen jetzt den generischen Runner
- Verifikation:
  - Syntaxcheck erfolgreich: `node --check js/main.js`
  - Node-Smoke erfolgreich:
    - `npm run smoke:roundstate` -> `ok: true`
    - Tick-/Coordinator-Assertions unveraendert gruen
    - `[MODULE_TYPELESS_PACKAGE_JSON]`-Warnhinweis weiterhin nicht-blockierend
  - Regressions-Smoke erfolgreich:
    - `npm run smoke:selftrail`
    - 3 Fahrzeuge (`drone`, `manta`, `aircraft`)
    - keine Failures
- Ergebnis:
  - `ROUND_END`/`MATCH_END`-Update-Pfade sind jetzt konsistenter als `derive -> apply` formuliert
  - `Game`-RoundState-Update-Top-Level wurde weiter verschlankt
  - Phase-1-Restpunkt weiter reduziert, aber weiterhin offen

### Zusatz-Append (Session 2026-02-23, Phase 1 weiterer 5er-Block: `RoundEndCoordinator` Effects-Plan + `_onRoundEnd()` Request/Apply-Entkopplung)

- Ausgefuehrte 5 Schritte (hintereinander, verhaltensneutral):
  - 1) `RoundEndCoordinator`: `deriveRoundEndCoordinatorEffectsPlan()` hinzugefuegt (zunaechst HUD-Update als expliziter PostAction-Plan)
  - 2) `coordinateRoundEnd(...)` liefert jetzt `effectsPlan` zusaetzlich zu `transition`/`uiState`
  - 3) `Game`: Request-Building fuer den Coordinator in `_buildRoundEndCoordinatorRequest(winner)` ausgelagert
  - 4) `Game`: Effects-Anwendung in `_applyRoundEndCoordinatorEffects(effectsPlan)` ausgelagert (HUD-Update via Plan statt direktem `_updateHUD()` in `_onRoundEnd()`)
  - 5) `Game`: UI-Anwendung in `_applyRoundEndCoordinatorUiState(uiState)` separiert; `_onRoundEnd()` arbeitet jetzt ueber `coordinateRoundEnd(...)` + `_applyRoundEndCoordinatorPlan(...)`
- Umsetzung im Detail:
  - `js/modules/RoundEndCoordinator.js`
    - neues `effectsPlan` mit `shouldUpdateHud: true` und `reason: 'ROUND_END'`
    - erleichtert spaetere Erweiterungen (weitere PostActions ohne direkte `Game`-Verdrahtung)
  - `js/main.js`
    - `_onRoundEnd()` kennt weniger Einzelteile (Recorder/HUD/UI-Details bleiben hinter Request-/Apply-Helpern)
    - `roundEndPlan` wird konsistenter als strukturierter Coordinator-Output behandelt (`transition`, `effectsPlan`, `uiState`)
  - `scripts/round-state-controller-smoke.mjs`
    - neue Assertions fuer `effectsPlan` (inkl. Recorder-Fehlerfall), damit die neue Rueckgabeform abgesichert bleibt
- Verifikation:
  - Syntaxchecks erfolgreich:
    - `node --check js/modules/RoundEndCoordinator.js`
    - `node --check js/main.js`
    - `node --check scripts/round-state-controller-smoke.mjs`
  - Node-Smoke erfolgreich:
    - `npm run smoke:roundstate` -> `ok: true`
    - `effectsPlan`-Assertions gruen
    - `[MODULE_TYPELESS_PACKAGE_JSON]`-Warnhinweis weiterhin nicht-blockierend
  - Regressions-Smoke erfolgreich:
    - `npm run smoke:selftrail`
    - 3 Fahrzeuge (`drone`, `manta`, `aircraft`)
    - keine Failures
- Ergebnis:
  - `_onRoundEnd()` ist weiter als schlanker Orchestrierungspunkt formuliert
  - `RoundEndCoordinator` beschreibt jetzt nicht nur State/UI, sondern auch PostActions (HUD) explizit
  - Phase-1-Restpunkt weiter reduziert, aber weiterhin nicht abgeschlossen

### Zusatz-Append (Session 2026-02-23, Phase 1 weiterer 5er-Block: Descriptor-basierter RoundState-Tick-Update-Runner)

- Ausgefuehrte 5 Schritte (hintereinander, verhaltensneutral):
  - 1) `Game`: `_buildRoundEndStateTickDescriptor()` eingefuehrt (`deriveTickStep` + `applyTickStep` fuer `ROUND_END`)
  - 2) `Game`: `_buildMatchEndStateTickDescriptor()` eingefuehrt (`deriveTickStep` + `applyTickStep` fuer `MATCH_END`)
  - 3) `Game`: `_runRoundStateTickDescriptor(dt, descriptor)` als kleine Descriptor-Adapter-Schicht ueber dem bestehenden generischen Runner hinzugefuegt
  - 4) `_updateRoundEndState(dt)` auf Descriptor-Pfad umgestellt
  - 5) `_updateMatchEndState(dt)` auf Descriptor-Pfad umgestellt
- Umsetzung im Detail:
  - `js/main.js`
    - RoundState-Update-Pfade sind jetzt noch klarer als zusammengesetzte Descriptoren formuliert
    - bereitet spaetere weitere Vereinheitlichung vor (z. B. feste Descriptor-Tabellen / State-Mapping)
- Verifikation:
  - Syntaxcheck erfolgreich: `node --check js/main.js`
  - Node-Smoke erfolgreich:
    - `npm run smoke:roundstate` -> `ok: true`
    - Coordinator-/Tick-Assertions weiterhin gruen
    - `[MODULE_TYPELESS_PACKAGE_JSON]`-Warnhinweis weiterhin nicht-blockierend
  - Regressions-Smoke erfolgreich:
    - `npm run smoke:selftrail`
    - 3 Fahrzeuge (`drone`, `manta`, `aircraft`)
    - keine Failures
- Ergebnis:
  - `ROUND_END`/`MATCH_END`-Updatepfade sind weiter formalisiert (Descriptor-Ansatz)
  - `Game`-RoundState-Orchestrierung nochmals etwas gleichfoermiger
  - Phase-1-Restpunkt weiter reduziert, aber weiterhin offen
