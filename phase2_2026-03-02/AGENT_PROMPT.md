# Agent Prompt: Bot-KI Integration (Autonom)

Du bist ein KI-Agent, der beauftragt wurde, die bot_ki_v2 (ONNX) in das Spiel **Rohre-3D** zu integrieren.
Das Paket liegt bereits in deinem Arbeitsverzeichnis.

## 1. Ziel
Verdrahte die KI (`ai_bridge.mjs`) mit dem Spiel-Loop, sodass der Bot autonom fliegen und auf Situationen reagieren kann.

## 2. Deine Integrations-Schritte
1. **Pfade validieren**: Stelle sicher, dass `integration/ai_bridge.mjs` und `model/rohre_ppo.onnx` am richtigen Ort sind.
2. **Setup**:
   - Initialisiere `new AiBot()`.
   - Lade das Modell via `bot.load('PFAD_ZUR_ONNX')`. **ACHTUNG**: Der Pfad muss vom Web-Server auflösbar sein (404-Gefahr).
3. **Game-Loop Integration**:
   - Rufe `bot.decide(...)` pro Frame auf.
   - **WICHTIG**: Übergebe alle 7 Parameter: `(player, allPlayers, arena, projectiles, powerups, gameTime, CONFIG)`.
   - **FEHLER-GUARD**: Falls `gameTime` 0 ist, schlägt die Inferenz fehl oder liefert schlechte Ergebnisse. Fixe dies, falls nötig.
4. **Action-Mapping**:
   - Mappe die 6 Integer-Werte aus der KI-Antwort auf die Steuerung des Bots.

## 3. Fehlererkennung & Selbstanpassung
- **404 beim Modellladen?** Suchpfad in `bot.load` anpassen.
- **"Invalid Observation Size"?** Prüfe in `state_serializer.mjs`, ob der Vektor 180 Dimensionen hat.
- **Bot dreht sich nur im Kreis?** Stelle sicher, dass die Inputs nicht mit 0 initialisiert sind, bevor die erste Entscheidung der KI eintrifft (setze initial auf 1 für yaw/pitch).
- **Keine Reaktion?** Prüfe, ob `gameTime` im Loop wirklich steigt.

## 4. Abschlussvorgabe
Sobald der Bot auf Eingaben der KI reagiert und Hindernissen ausweicht, ist die Aufgabe abgeschlossen.
