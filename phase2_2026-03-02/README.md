# Bot-KI Implementierungspaket — phase2 (2026-03-02)

Dieses Paket enthält alle Dateien, um die KI in das Spiel **Rohre-3D** zu integrieren.
Kein Python, kein Training, keine `node_modules` notwendig.

## Ordnerstruktur

```
model/
  rohre_ppo.onnx          Das trainierte KI-Modell (ONNX, Opset 17)
integration/
  AiManager.mjs           Zentraler AI-Hub (Singleton)
  AiInterface.mjs         Basis-Klasse fuer KI-Modelle
  ai_bridge.mjs           JavaScript-Schnittstelle (erweitert AiInterface)
  state_serializer.mjs    State-Extraktion (wird von ai_bridge.mjs verwendet)
README.md                 Diese Datei
CHANGELOG.md              Was ist neu in diesem Paket
```

## Voraussetzungen

- **onnxruntime-web**: Wird automatisch per CDN importiert. Falls NPM gewünscht ist, den Import in `ai_bridge.mjs` anpassen zu `onnxruntime-web`.
- Das Spiel nutzt Three.js (bereits vorhanden).

## Integration in 3 Schritten

### 1. Dateien kopieren

Kopiere den Ordner `integration/` in dein Spielverzeichnis, z.B. nach `src/ai/`.
Kopiere `model/rohre_ppo.onnx` in das öffentliche Verzeichnis des Spiels (z.B. `public/ai/` oder `assets/ai/`), damit der Browser die Datei laden kann.

### 2. Importieren & Managen

Integriere das **mitgelieferte modulare Interface-System**:

```javascript
import { aiManager } from './ai/AiManager.mjs';
import { AiBot } from './ai/ai_bridge.mjs';
```

### 3. Nutzen (Out of the Box)

```javascript
// Einmalig beim Spielstart:
// ACHTUNG: Pfad muss relativ zum absoluten Web-Root sein (vermiede 404 Fehler)!
await aiManager.loadModel('PPO_V2', '/assets/ai/rohre_ppo.onnx', AiBot);

// Im Game-Loop pro Frame fuer den BOT:
// ACHTUNG (Problem 4): Exakt diese Parameter übergeben!
const action = await aiManager.decideForPlayer(
    botPlayer,     // Das Bot-Spieler-Objekt
    'PPO_V2',      // Das registrierte Modell
    allPlayers,    // Array aller Spieler
    arena,         // Die Arena-Instanz
    projectiles,   // Array aller aktiven Projektile
    [],            // powerups (optional, aber muss übergeben werden)
    gameTime,      // ACHTUNG (Problem 3): Darf nicht 0 sein! Akkumulierte Delta-Zeit.
    CONFIG         // Globales Spielkonfig-Objekt
);

// action ist ein Array mit 6 Ganzzahlen:
// [yaw(0-2), pitch(0-2), boost(0-1), item_use(0-5), item_shoot(0-1), shoot_idx(0-4)]
// Wenn null (Inferenz läuft noch), alte Keys beibehalten!
```

## Kompatibilitätshinweise

- Das Paket wurde mit **Three.js r150+** getestet.
- Bei neueren Spielversionen: Prüfe ob die Player-Klasse noch `position`, `speed`, `activeEffects`, `inventory`, `hitboxRadius`, `isBoosting`, `boostCooldown`, `alive`, `isGhost`, `hasShield` als Properties besitzt.
- Die Observation hat **180 Dimensionen** — das Modell erwartet diesen Vektor exakt. Falls das Modell fehlschlägt, prüfe ob `serializeState` 180 Werte ausgibt.

## Performanz

- Ziel: < 2ms Inferenzzeit pro Frame (Browser, CPU) — typisch 0.5–1.5ms.
- Bei Performance-Problemen: Nutze `ort.InferenceSession.create(url, { executionProviders: ['wasm'] })`.
