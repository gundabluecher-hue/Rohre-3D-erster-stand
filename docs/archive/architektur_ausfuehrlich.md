# Rohr-3D: Ausführliche Spiel - Architektur & Abhängigkeitsgraph

Dieses Dokument liefert eine tiefe Analyse der Architektur des "Rohre-3D" Spiels. Es erweitert den grundlegenden Import-Graphen um detaillierte Beschreibungen für jeden Knotenpunkt sowie architektonische Design-Entscheidungen.

## 1. Detaillierter Architektur-Graph (Mermaid)

Der folgende Graph veranschaulicht nicht nur die Abhängigkeiten, sondern gruppiert die Module nach ihren exakten Zuständigkeiten (System Core, Game State, Entities, UI). Um das Diagramm überschaubar zu halten und gleichzeitig extrem detailliert zu sein, ist es in logische Subsysteme unterteilt.

```mermaid
graph TD;

    %% STYLING FOR BETTER VISIBILITY
    classDef core fill:#f9f,stroke:#333,stroke-width:2px;
    classDef state fill:#bbf,stroke:#333,stroke-width:2px;
    classDef entity fill:#bfb,stroke:#333,stroke-width:2px;
    classDef ui fill:#fbb,stroke:#333,stroke-width:2px;

    subgraph CoreSystem [Core System (`src/core`)]
        main[main.js<br/>Einstiegspunkt]:::core
        Config[Config.js<br/>Zentrale Einstellungen]:::core
        GameLoop[GameLoop.js<br/>RAF & Timing]:::core
        Renderer[Renderer.js<br/>Three.js Setup]:::core
        InputManager[InputManager.js<br/>Tasten & Maus]:::core
        Audio[Audio.js<br/>Sound Engine]:::core
    end

    subgraph GameState [Game State & Match Management (`src/state`)]
        MatchSessionFactory[MatchSessionFactory.js<br/>Startet Match]:::state
        RoundStateController[RoundStateController.js<br/>Zustandsautomat]:::state
        RoundStateOps[RoundStateOps.js<br/>Logik-Operationen]:::state
        RoundEndCoordinator[RoundEndCoordinator.js<br/>End-of-Round]:::state
        RoundRecorder[RoundRecorder.js<br/>Statistiken]:::state
    end

    subgraph WorldEntities [World & Entities (`src/entities`)]
        Arena[Arena.js<br/>3D Level & Kollision]:::entity
        EntityManager[EntityManager.js<br/>Bot/Player/Projektile]:::entity
        Player[Player.js<br/>Benutzergesteuert]:::entity
        Bot[Bot.js<br/>KI Gegner]:::entity
        vehicle-registry[vehicle-registry.js<br/>Fahrzeug-Fabrik]:::entity
        Trail[Trail.js<br/>Lichtspuren/Waffen]:::entity
        Particles[Particles.js<br/>VFX]:::entity
        Powerup[Powerup.js<br/>Items]:::entity
        CustomMapLoader[CustomMapLoader.js]:::entity
        GeneratedLocalMaps[GeneratedLocalMaps.js]:::entity
        MapSchema[MapSchema.js]:::entity
    end

    subgraph UserInterface [User Interface & Profiles (`src/ui`)]
        HUD[HUD.js<br/>In-Game Overlay]:::ui
        UIManager[UIManager.js<br/>Menüs]:::ui
        SettingsStore[SettingsStore.js<br/>LocalStorage]:::ui
        ProfileDataOps[ProfileDataOps.js]:::ui
        ProfileControlStateOps[ProfileControlStateOps.js]:::ui
        ProfileUiStateOps[ProfileUiStateOps.js]:::ui
        MatchUiStateOps[MatchUiStateOps.js]:::ui
    end

    %% CORE DEPENDENCIES
    main --> Config
    main --> Renderer
    main --> GameLoop
    main --> InputManager
    main --> Audio
    main --> MatchSessionFactory
    main --> UIManager
    main --> RoundStateController

    %% STATE DEPENDENCIES
    MatchSessionFactory --> Arena
    MatchSessionFactory --> EntityManager
    MatchSessionFactory --> Powerup
    MatchSessionFactory --> Particles
    RoundStateController --> RoundStateOps
    RoundEndCoordinator --> MatchUiStateOps

    %% ENTITY DEPENDENCIES
    EntityManager --> Player
    EntityManager --> Bot
    EntityManager --> vehicle-registry
    Arena --> Config
    Player --> Trail
    Player --> vehicle-registry
    Bot --> vehicle-registry
    vehicle-registry --> Config

    %% UI DEPENDENCIES
    UIManager --> SettingsStore
    UIManager --> vehicle-registry
    HUD --> Config
```

---

## 2. Ausführliche Erklärung der Komponenten (10x mehr Detail)

Die Code-Basis ist modular aufgebaut und nutzt stark das Konzept von Factories (`...Factory.js`) und funktionalen Operationen (`...Ops.js`), um den Zustand streng von der Logik zu trennen.

### 2.1 Core System

* **`main.js`**: Dies ist der absolute Dreh- und Angelpunkt (Orchestrator). Er verbindet das DOM mit der Three.js Welt. Hier werden die globalen Singleton-artigen Instanzen erzeugt (z.B. den `Renderer`, `GameLoop`, `InputManager`). Er reagiert auf UI-Events ("Starte lokales Spiel") und ruft dann die `MatchSessionFactory` auf.
* **`Config.js`**: Das Herzstück der Magic Numbers. Jegliches Balancing (Geschwindigkeit, Hitbox-Größen, Arena-Radien, Default-Farben) ist hier als exportiertes Konstanten-Objekt abgelegt. Fast jede Datei importiert `Config`.
* **`GameLoop.js`**: Kapselt `requestAnimationFrame`. Trennt das Rendering vom logischen Update (`tick`). Berechnet das Delta-Time (`dt`), welches an alle updatenden Systeme weitergereicht wird.
* **`Renderer.js`**: Versteckt die Komplexität von `THREE.WebGLRenderer`, verwaltet Kameras (Main Camera, Minimap Camera) und den Resize-Event-Listener des Browsers.

### 2.2 Game State & Match Management

Die Steuerung des Spielablaufs basiert auf einer zustandsgesteuerten Architektur (State Machine).

* **`MatchSessionFactory.js`**: Nimmt Konfigurationen entgegen (Anzahl Bots, gewählte Map, Fahrzeug des Spielers) und "baut" die Spielwelt zusammen. Er instanziiert die `Arena` und den `EntityManager`.
* **`RoundStateController.js` & `...Ops.js`**: Diese Dateien verwalten den Lebenszyklus einer Runde (Countdown -> Playing -> Round End -> Scoreboard). Die Logikfunktionen (`Ops`) sind bewusst ohne Seiteneffekte (pure functions) geschrieben, um sie leicht testbar zu machen. Der Controller hält den Zustand und ruft die Operationen auf.
* **`RoundEndCoordinator.js`**: Wird getriggert, wenn eine Kollision passiert. Er berechnet Punkte, aktualisiert Profile und signalisiert der UI, dass das End-Menü gezeigt werden muss.
* **`RoundRecorder.js`**: Trackt Statistiken wie Überlebenszeit und Kills, um sie später im Profil zu speichern.

### 2.3 World & Entities

Dieses Subsystem enthält die eigentliche "Game Engine" Logik für 3D Raum und Physik.

* **`Arena.js`**: Baut den 3D-Zylinder/Röhre (Tube Geometry) auf. Enthält extrem wichtige Mathe-Methoden zur Berechnung von Zylinder-Kollisionen (Begrenzung des Spielfelds) und zur Normalen-Berechnung (damit Schiffe an der Wand entlanggleiten). **Performance:** Nutzt Zero-Allocation Caching (`_collisionResult`) und `checkCollisionFast` für Bot-Raycasts, um GC Spikes zu vermeiden.
* **`EntityManager.js`**: Der Master der Szene. Jedes Frame ruft die `GameLoop` den `EntityManager.update(dt)` auf. Dieser iteriert über alle Entities (`Player`, `Bot`, `Trail`, `Powerup`) und ruft deren `update()` auf. **Kritisch:** Hier passiert die `checkGlobalCollision()`, die prüft, ob Trails andere Spieler treffen (OBB - Oriented Bounding Box Kollisionen). Nutzt ebenfalls Result-Caching (`_trailCollisionResult`), um GC Spikes in hochfrequenten Loops zu umgehen.
* **`Player.js` & `Bot.js`**: Repräsentieren Piloten. `Player.js` liest den `InputManager` aus (W/A/S/D), während `Bot.js` eine rudimentäre KI besitzt, um Wänden/Trails auszuweichen. **Performance:** `Bot.js` nutzt starkes Time-Slicing (`_sensePhaseCounter`) und Fast-Path-Raycasting (`checkCollisionFast`), um die CPU in 8-Bot-Matches signifikant zu entlasten. Beide nutzen intern das gleiche Fahrzeug-Mesh.
* **`vehicle-registry.js`**: Ein Factory-Pattern Modul. Abhängig davon, welches Schiff der Nutzer gewählt hat (z.B. Manta, Orb, Spaceship), lädt diese Registry das korrekte Modul (`spaceship-mesh.js` etc.) und returnt ein `THREE.Group` Objekt zurück zum `EntityManager`.
* **`Trail.js`**: Verarbeitet die tödliche Lichtspur (wie in Tron). Generiert dynamisch 3D-Geometrie hinter den Fahrzeugen.

### 2.4 User Interface

Dieses Subsystem operiert primär im HTML DOM und nutzt HTML/CSS für die Darstellung, nicht WebGL.

* **`UIManager.js`**: Steuert die verschiedenen Menü-Bildschirme (Titelbildschirm, Hangar/Profilauswahl, Settings). Hört auf DOM-Events und kommuniziert dann mit `main.js`.
* **`HUD.js`**: Das In-Game Heads-Up-Display (Lebensanzeige, Tacho, Kill-Logs). Bekommt jeden Frame Updates vom `GameLoop` eingepumpt.
* **Profile Dateien (`ProfileDataOps.js` etc.)**: Speichern und Laden von Spielerprofilen (Highscore, Name, Farbe) im `localStorage` des Browsers.

## 3. Datenfluss-Beispiel (Eine typische Spielrunde)

1. Der Nutzer klickt auf "Play" im DOM.
2. `UIManager` fängt das `click` Event ab und ruft `startLocalGame(config)` in `main.js` auf.
3. `main.js` versteckt das Hauptmenü und ruft `MatchSessionFactory` auf.
4. `MatchSessionFactory` erstellt die `Arena`, fügt den `Player` über den `EntityManager` hinzu und platziert `Bot`s.
5. Die `GameLoop` beginnt.
6. Pro Frame:
    * `InputManager` liest Vektoren aus Maus/Tastatur.
    * `Player` nutzt Input-Vektoren für `position` / `rotation`.
    * `Trail` hängt ein neues Segment an die Player-Position an.
    * `EntityManager` rechnet via OBB-Intersection aus, ob ein `Bot` das Tail des `Player`s berührt hat.
    * Falls ja: Kollisionstrigger -> `RoundEndCoordinator` wird aufgerufen.
    * `Renderer` zeichnet die Szene (`renderer.render(scene, camera)`).
