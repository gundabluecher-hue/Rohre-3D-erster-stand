# Spielanalyse + Projektstruktur-Audit (Deep Dive)

Stand: 2026-02-22  
Projekt: `Rohre-3D-erster-stand`

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
