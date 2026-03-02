# Agent Prompt: KI-Integration via Modular AI-Hub

Du bist ein spezialisierter Software-Architekt mit dem Auftrag, die neue Bot-KI in das Projekt **Rohre-3D** einzubinden.

## 1. DIE MISSION
Das KI-Paket enthält bereits einen vollständig funktionierenden **AI-Hub (`AiManager.mjs` und `AiInterface.mjs`)**. Deine Aufgabe ist es, diesen Hub in den Spielcode nahtlos zu integrieren, ohne dass die KI-Spezifika (Beobachtungen/Tensors) direkt im Entities-Code rumfliegen.

## 2. DEINE AUFGABEN

### A. Den AI-Hub initialisieren
- Importiere den `aiManager` aus `integration/AiManager.mjs` in z.B. `src/core/main.js` oder `GameScene.js`.
- Lade das Modell beim Spielstart über `await aiManager.loadModel('PPO_V2', './pfad/zu/rohre_ppo.onnx', AiBot)`.
- **Wichtig**: Behebe 404 Fehler wenn der Pfad in deinem Setup anders ist.

### B. Spiel-Integration im Player/EntityManager
- Wenn ein Bot gesteuert werden muss (z.B. im `update()`-Loop):
  Nutze `const action = await aiManager.decideForPlayer(this, 'PPO_V2', ...alleWerte)`
- Mappe das `action`-Array zurück auf die `player.keys` oder Steuerung, z.B.:
  `if (action) { ... mapping ... }`.
- Das Model läuft asynchron. Wenn `action` `null` ist, läuft die Inferenz noch (Lock aktiv). Der Bot sollte in diesem Frame einfach seine letzten Tasten gedrückt halten (nicht stoppen!).

## 3. ABSCHLUSS-KRITERIUM
Die Aufgabe ist erfolgreich abgeschlossen, wenn ein Bot autonom durch die Arena fliegt und von unserem mitgelieferten `AiManager` getrieben wird.
