# Aero Arena 3D - Spielanleitung

Willkommen bei **Aero Arena 3D**! Dies ist ein schnelles Arcade-Spiel für 1 oder 2 Spieler, inspiriert von klassischen Arena-Spielen, aber in einer vollen 3D-Umgebung mit Flugzeug-Steuerung.

## Spielziel

Steuere dein Flugzeug durch die Arena und ziehe eine Schweifspur hinter dir her.

- **Überlebe**: Weiche Wänden, Hindernissen und den Spuren anderer Spieler aus.
- **Kämpfe**: Nutze Powerups und Items, um deine Gegner auszuschalten.
- **Gewinn**: Der letzte Überlebende gewinnt die Runde. Wer zuerst das eingestellte Limit an Siegen erreicht (z.B. 5), gewinnt das Match.

## Steuerung

### Spieler 1 (Links / Blau)

| Aktion | Taste |
| :--- | :--- |
| **Lenken (Hoch/Runter)** | `W` / `S` |
| **Lenken (Links/Rechts)** | `A` / `D` |
| **Rollen (Links/Rechts)** | `Q` / `E` |
| **Boost** | `Shift` (Links) |
| **Item benutzen** | `1` - `5` |
| **Item abwerfen** | `G` |
| **Kamera wechseln** | `C` |

### Spieler 2 (Rechts / Orange)

*(Nur im 2-Spieler Modus)*

| Aktion | Taste |
| :--- | :--- |
| **Lenken** | Pfeiltasten (`↑`, `↓`, `←`, `→`) |
| **Rollen** | `N` / `M` |
| **Boost** | `Rechts-Shift` |
| **Item benutzen** | `0` |
| **Item abwerfen** | `H` |
| **Kamera wechseln** | `V` |

> **Tipp:** Du kannst "Auto-Roll" aktivieren, damit sich dein Flugzeug automatisch wieder waagerecht ausrichtet.

## Spielmodi & Features

- **Einzelspieler**: Tritt gegen KI-Bots an.
- **2-Spieler Split-Screen**: Spiele lokal gegen einen Freund am selben PC.
- **Bots**: Konfigurierbare KI-Gegner mit verschiedenen Schwierigkeitsgraden (Reaktion, Aggressivität).
- **Maps**: Wähle aus 5 verschiedenen Arenen:
    1. **Standard Arena**: Klassischer Raum.
    2. **Leer**: Kleiner & ohne Hindernisse.
    3. **Labyrinth**: Viele Wände und Gänge.
    4. **Komplex**: Anspruchsvolle Struktur.
    5. **Pyramide**: Zentrales Hindernis.

## Powerups & Items

Sammle bunte Würfel in der Arena ein, um dein Flugzeug zu verbessern oder Gegner zu ärgern. Du kannst bis zu 5 Items im Inventar haben.

| Icon | Name | Farbe | Effekt |
| :--- | :--- | :--- | :--- |
| ⚡ | **Schneller** | Grün | Erhöht deine Geschwindigkeit drastisch. (Vorsicht!) |
| 🐢 | **Langsamer** | Rot | Verlangsamt dich für präzise Manöver. |
| 🧱 | **Dick** | Gelb | Macht deine Spur dicker (Gegner treffen dich leichter). |
| ✂ | **Dünn** | Lila | Macht deine Spur dünn (schwerer für Gegner zu sehen). |
| 🛡 | **Schild** | Blau | Schützt kurzzeitig vor Kollisionen. |
| 🕙 | **Zeitlupe** | Grün | Verlangsamt das gesamte Spiel für alle. |
| 👻 | **Geist** | Pink | Du fliegst durch Wände (Geister-Modus). |
| 🔀 | **Invertieren** | Magenta | Vertauscht deine Steuerung kurzzeitig. |

## Editor

Das Spiel verfügt über einen integrierten **3D-Map-Editor**. Du kannst eigene Arenen bauen, Tunnel graben und Blöcke platzieren.

## Technische Architektur

Das Spiel ist eine reine **Web-Anwendung** (HTML5, CSS3, JavaScript ES6+), die ohne Build-Tools oder Frameworks (wie React oder Vue) auskommt, um maximale Performance und Einfachheit zu gewährleisten.

### Technologien

- **Rendering**: [Three.js](https://threejs.org/) (r160) für die 3D-Grafik.
- **Sprache**: Modernes **JavaScript** (ES Modules) für die Logik.
- **Styling**: Natives CSS für das User Interface (Overlays, HUDs).

### Software-Design

Die Architektur ist modular aufgebaut:

1. **Main Loop (`GameLoop.js`)**: Entkoppelt von der Bildwiederholrate (Fixed Timestep), um eine faire Physik bei jeder Framerate zu garantieren.
2. **Manager-System**:
    - `EntityManager.js`: Verwaltet alle dynamischen Objekte (Spieler, Items, Projektile).
    - `Arena.js`: Generiert die statische Welt (Wände, Boden, Hindernisse).
    - `Renderer.js`: Handhabt die Three.js Szene, Kameras und den Split-Screen-Effekt (via `setScissor`).
    - `InputManager.js`: Verarbeitet Tastatureingaben für bis zu 2 Spieler.
    - `Config.js`: Zentrale Konfigurationsdatei für Balancing (Geschwindigkeit, Hitboxen, Item-Wahrscheinlichkeiten).

### Besonderheiten

- **Split-Screen**: Die Szene wird einmal berechnet, aber aus zwei verschiedenen Kameraperspektiven auf denselben Canvas gezeichnet (Viewport-Splitting).
- **Kurven-Generierung**: Die Schweifspuren werden dynamisch als 3D-Meshes erzeugt, deren Geometrie sich in jedem Frame erweitert.

## Entwickler-Guide

Dieser Abschnitt erklärt, wie du das Spiel selbst weiterentwickeln, verändern und neu bauen kannst.

### Voraussetzungen

Um das Spiel professionell zu bearbeiten, benötigst du:

1. [Node.js](https://nodejs.org/) (Version 18 oder neuer)
2. Einen Code-Editor (z.B. [VS Code](https://code.visualstudio.com/))
3. Git (optional)

### Installation & Setup

1. Öffne ein Terminal im Projektordner.
2. Installiere die Abhängigkeiten:

    ```bash
    npm install
    ```

### Entwicklung starten

Du hast zwei Möglichkeiten:

**Option A: Mit Live-Reload (Empfohlen)**
Startet einen lokalen Entwicklungsserver. Änderungen am Code werden sofort im Browser sichtbar.

```bash
npm run dev
```

**Option B: Ohne Installation (Schnell)**
Nutze den mitgelieferten Launcher:

- Doppelklicke auf `start_game.bat`.
- *Hinweis:* Dies nutzt die Online-Version von Three.js (CDN). Du brauchst eine Internetverbindung.

### Projektstruktur

Hier findest du die wichtigsten Dateien:

- **`js/modules/Config.js`**: **Hier beginnt der Spaß!** Ändere Spielgeschwindigkeiten, Farben, Powerup-Effekte und mehr.
- `js/modules/Arena.js`: Logik für Map-Generierung und Wände.
- `js/modules/EntityManager.js`: Verwaltet Spieler und Items.
- `js/main.js`: Der Einstiegspunkt. Initialisiert alles.
- `index.html`: Das Grundgerüst und UI (Overlay, Menüs).

### Spiel bauen (Build)

Um eine optimierte Version für das Web zu erstellen (alles in wenigen Dateien komprimiert):

```bash
npm run build
```

Die fertigen Dateien landen im Ordner `dist/`. Diesen Ordner kannst du auf einen Webserver hochladen.
