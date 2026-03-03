# Feature: Phase 15 - Modulare Bot-Schnittstelle fuer Deep-Learning-Bridge (2-Agenten-Plan)

Stand: 2026-03-03
Quelle: `C:\Users\gunda\.gemini\antigravity\brain\53eac758-e45f-4d43-b536-1eff858c307a\Deep_Learning_Strategie.md.resolved`

## Ziel

Die Bot-Schnittstelle soll so modularisiert werden, dass lernende Bots sauber integrierbar sind, ohne Classic/Hunt-Gameplay zu brechen.

1. Stabile Bridge zwischen Spiel-Engine und Bot-Gehirn (Observation/Action).
2. Fixe Observation-Semantik mit versioniertem Schema.
3. Item-Input mit fixen 20 Slots fuer zukunftssichere Erweiterbarkeit.
4. Modus-spezifische Bot-Policies (Classic/Hunt) mit gemeinsamem Interface.

## Nicht-Ziele

1. Kein sofortiges vollstaendiges DL-Training in dieser Phase.
2. Kein Entfernen der bestehenden Rule-Based-Logik als Fallback.
3. Keine Balance-Aenderungen an Waffen/Physik.

## Architektur-Check (Ist-Zustand)

Bestehende Schnittstellen:

1. `src/entities/systems/PlayerInputSystem.js` ruft fuer Bots `botAI.update(...)` direkt auf.
2. `src/entities/ai/BotPolicyRegistry.js` erzeugt Policies ueber Factorys.
3. `src/entities/ai/BotPolicyTypes.js` validiert aktuell nur `update(...)`.
4. `src/entities/EntityManager.js` waehlt Policy-Typ und mappt `player -> ai`.
5. `src/state/MatchSessionFactory.js` gibt Bot-Setup-Optionen in `EntityManager.setup(...)`.

Reuse vs New:

1. Reuse: `BotPolicyRegistry`, `RuleBasedBotPolicy`, `HuntBotPolicy`, `PlayerInputSystem`.
2. Neu: dedizierte Bridge-Module fuer Observation, Action-Mapping, Schema-Validierung, optionale Trainer-Bridge.

Risiko-Rating: `mittel`

1. Hauptrisiko ist semantischer Drift im Observation-Vektor.
2. Technisch kontrollierbar mit fixen Indizes, Contract-Tests und Fallback auf Rule-Based.

Dokumentations-Impact:

1. `docs/Umsetzungsplan.md` (Phase 15 Board/Gates)
2. `docs/ai_architecture_context.md` (Bot-Architektur)
3. `docs/Testergebnisse_2026-03-03.md` (oder Tagesdokument)

## Parallelbetrieb mit zwei Agenten

Rollen:

- Agent A (Observation-Lane): Schema, Observation-Extraktion, Runtime-Context
- Agent B (Action/Policy-Lane): Action-Contract, Registry, Mode-Policies, Trainer-Adapter
- Integrations-Agent: Runtime-Config, Session-Wiring, finale Regression und Doku

Datei-Ownership:

1. Agent A: `src/entities/ai/observation/**`, `src/entities/systems/PlayerInputSystem.js`, `src/entities/EntityManager.js`
2. Agent B: `src/entities/ai/actions/**`, `src/entities/ai/BotPolicy*.js`, `src/hunt/HuntBotPolicy.js`
3. Integrations-Agent: `src/core/RuntimeConfig.js`, `src/core/SettingsManager.js`, `src/state/MatchSessionFactory.js`

## Fortschrittsboard

- [x] 15.0 Scope, Contract und Semantik einfrieren
- [ ] 15.1A Observation-Schema V1 + Index-Konstanten (Agent A)
- [x] 15.1B Action-Contract + Fallback-Regeln (Agent B)
- [ ] 15.2A Observation-Extraktion aus Runtime entkoppeln (Agent A)
- [ ] 15.2B 20-Slot-Item-Encoding + Mode-ID Features (Agent B)
- [ ] 15.3A Runtime-Context-Wiring in Entity/Input-System (Agent A)
- [ ] 15.3B Registry auf modulare Bridge-Policies erweitern (Agent B)
- [ ] 15.4A Classic-Bridge-Policy integrieren (Agent A)
- [ ] 15.4B Hunt-Bridge-Policy integrieren (Agent B)
- [ ] 15.5 Integration: RuntimeConfig/Settings/Session-Auswahl
- [ ] 15.6 Optional: WebSocket-Bridge fuer externes Training (Feature-Flag)
- [ ] 15.7 Abschluss: Regression, Doku, Restrisiken

GATES:

1. 15.2A startet erst nach 15.1A.
2. 15.2B startet erst nach 15.1B.
3. 15.3A/15.3B starten erst wenn 15.2A und 15.2B auf `[x]` stehen.
4. 15.4A/15.4B starten erst nach 15.3A und 15.3B.
5. 15.5 startet erst nach 15.4A und 15.4B.
6. 15.7 startet erst nach gruener Verifikation von 15.6 oder explizitem Skip-Entscheid.

---

## Phase 15.0 - Scope, Contract und Semantik einfrieren

Ziel:

1. Stabilen V1-Vertrag festlegen (Observation-Laenge, Action-Semantik, Mode-ID).
2. Entscheidung dokumentieren, was in V1 bewusst noch nicht enthalten ist.

Dateien (2-5):

- `docs/Feature_BotSchnittstelle_Modulare_Integration.md`
- `docs/ai_architecture_context.md`

Arbeitsschritte:

1. Observation-Vektorlaenge V1 festschreiben.
2. Indizes semantisch benennen (z. B. `WALL_DISTANCE_FRONT`, `MODE_ID`, `ITEM_SLOT_00..19`).
3. Fallback-Regel dokumentieren: bei Contract-Verletzung Rule-Based verwenden.

Definition of Done:

- V1-Vertrag ist stabil dokumentiert.
- Beide Agenten koennen konfliktfrei mit 15.1A/15.1B starten.

Verifikation:

- `npm run test:core`
- `npm run docs:sync`
- `npm run docs:check`

Eingefrorener V1-Vertrag (Stand: 2026-03-03):

1. Observation-Schema:
   - `OBSERVATION_SCHEMA_VERSION = "v1"`
   - `OBSERVATION_LENGTH_V1 = 40`
   - Indizes `0..19` sind Core-Features, `20..39` sind `ITEM_SLOT_00..ITEM_SLOT_19`.
2. Verbindliche Schluesselindizes:
   - `WALL_DISTANCE_FRONT = 3`
   - `MODE_ID = 18`
   - `ITEM_SLOT_00 = 20`
   - `ITEM_SLOT_19 = 39`
3. Wertebereiche:
   - Ratio-Features: `0..1`
   - Signed-Features: `-1..1`
   - Booleans: `0` oder `1`
   - `MODE_ID`: `0=classic`, `1=hunt`
4. Action-Semantik V1:
   - Bool-Flags: `pitchUp`, `pitchDown`, `yawLeft`, `yawRight`, `boost`, `shootItem`, `shootMG`
   - Integer-Felder: `useItem`, `shootItemIndex` (jeweils `-1..19`)
   - Contract-Verletzung wird sanitisiert; bei ungueltiger Payload gilt Fallback auf `rule-based`.
5. Explizite Nicht-Bestandteile von V1:
   - Keine Rekurrenz/History-Frames im Observation-Vektor.
   - Keine Telemetrie-/Reward-Felder im Runtime-Observation-Pfad.
   - Keine netzwerkgebundene Trainer-Bridge als Pflichtbestandteil.

---

## Phase 15.1A - Observation-Schema V1 + Index-Konstanten (Agent A)

Ziel:

1. Fixe, versionierte Schema-Datei fuer Observation schaffen.
2. Semantik maschinenpruefbar machen.

Dateien (2-5):

- `src/entities/ai/observation/ObservationSchemaV1.js` (neu)
- `src/entities/ai/observation/ObservationSemantics.js` (neu)
- `tests/physics.spec.js` (Contract-Testfall ergaenzen)

Arbeitsschritte:

1. Konstanten fuer alle V1-Indizes definieren.
2. `OBSERVATION_LENGTH_V1` und `OBSERVATION_SCHEMA_VERSION` exportieren.
3. Test fuer feste Laenge + eindeutige Indexbelegung aufnehmen.

Definition of Done:

- Vektorlaenge und Semantik sind codiert und getestet.
- Keine Runtime-Abhaengigkeit in der Schema-Datei.

Verifikation:

- `npm run test:core`
- `npm run test:physics`

---

## Phase 15.1B - Action-Contract + Fallback-Regeln (Agent B)

Ziel:

1. Einheitlichen Action-Ausgabevertrag fuer alle Bot-Policies festlegen.
2. Unsichere/ungueltige Action-Payloads robust abfangen.

Dateien (2-5):

- `src/entities/ai/actions/BotActionContract.js` (neu)
- `src/entities/ai/BotPolicyTypes.js`
- `tests/physics.spec.js` (Contract-Testfall ergaenzen)

Arbeitsschritte:

1. `sanitizeBotAction(...)` definieren (bool/indices clampen).
2. Contract-Assert um optionale Methoden erweitern (`getObservation?`, `reset?`).
3. Invalid-Action -> neutral input + log warning.

Definition of Done:

- Jede Policy liefert normierte Actions oder faellt kontrolliert zurueck.
- Kein Crash bei invaliden Outputs.

Verifikation:

- `npm run test:core`
- `npm run test:physics`

---

## Phase 15.2A - Observation-Extraktion aus Runtime entkoppeln (Agent A)

Ziel:

1. Runtime-Daten zentral und normalisiert extrahieren.
2. Absolute Spielwerte auf verhaeltnisbasierte Features abbilden.

Dateien (2-5):

- `src/entities/ai/observation/ObservationSystem.js` (neu)
- `src/entities/ai/observation/ObservationNormalizeOps.js` (neu)
- `src/entities/systems/PlayerInputSystem.js`

Arbeitsschritte:

1. Extraktor `buildObservation(player, context)` implementieren.
2. Normierungen (speed ratio, wall distance ratio, health ratio) kapseln.
3. `PlayerInputSystem` so erweitern, dass Observation-Erzeugung separierbar bleibt.

Definition of Done:

- Observation-Erzeugung ist aus Update-Logik herausgeloest.
- Keine direkte Kopplung an konkrete Bot-Policy-Implementierungen.

Verifikation:

- `npm run test:core`
- `npm run test:physics`

---

## Phase 15.2B - 20-Slot-Item-Encoding + Mode-ID Features (Agent B)

Ziel:

1. Fixes Item-Feature-Feld mit 20 Slots einfuehren.
2. Mode-ID als stabiles Feature bereitstellen.

Dateien (2-5):

- `src/entities/ai/observation/ItemSlotEncoder.js` (neu)
- `src/entities/ai/observation/ModeFeatureEncoder.js` (neu)
- `tests/physics.spec.js`

Arbeitsschritte:

1. Item-Type -> Slot-Mapping zentral definieren.
2. One-Hot/Padding bis 20 Slots erzwingen.
3. Mode-ID (`classic`, `hunt`) in numerische Features codieren.

Definition of Done:

- Neue Items koennen spaeter freie Slots belegen ohne Schema-Bruch.
- Mode-Feature ist deterministisch und testbar.

Verifikation:

- `npm run test:core`
- `npm run test:physics`

---

## Phase 15.3A - Runtime-Context-Wiring in Entity/Input-System (Agent A)

Ziel:

1. Einheitlichen Bot-Runtime-Context bereitstellen.
2. Observation-System kontrolliert in den Tick integrieren.

Dateien (2-5):

- `src/entities/EntityManager.js`
- `src/entities/systems/PlayerInputSystem.js`
- `src/entities/ai/BotRuntimeContextFactory.js` (neu)

Arbeitsschritte:

1. Context-Fabrik fuer arena/players/projectiles/mode/rules bauen.
2. Policy-Aufruf auf `policy.update(dt, player, context)` migrierbar machen (kompatibel halten).
3. Backward-Compatibility fuer Legacy-Signatur sicherstellen.

Definition of Done:

- Kontext ist zentral gebaut und wiederverwendbar.
- Legacy-Policies laufen unveraendert weiter.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:selftrail`

---

## Phase 15.3B - Registry auf modulare Bridge-Policies erweitern (Agent B)

Ziel:

1. Policy-Registry um Bridge-Typen erweitern.
2. Feature-Flag/Fallback fuer sichere Einfuehrung setzen.

Dateien (2-5):

- `src/entities/ai/BotPolicyTypes.js`
- `src/entities/ai/BotPolicyRegistry.js`
- `src/entities/ai/ObservationBridgePolicy.js` (neu)

Arbeitsschritte:

1. Neue Policy-Typen fuer `classic-bridge` und `hunt-bridge` registrieren.
2. Registry-Fallback auf `rule-based` bei fehlender Factory absichern.
3. Logging fuer aktive Policy-Typen standardisieren.

Definition of Done:

- Bridge-Policies sind zentral registrierbar.
- Fehlkonfigurationen fuehren nicht zu Spielabbruch.

Verifikation:

- `npm run test:core`
- `npm run test:physics`

---

## Phase 15.4A - Classic-Bridge-Policy integrieren (Agent A)

Ziel:

1. Classic-Modus ueber das neue Bridge-Interface betreiben.
2. Rule-Based als Ersatzpfad erhalten.

Dateien (2-5):

- `src/entities/ai/ClassicBridgePolicy.js` (neu)
- `src/entities/ai/RuleBasedBotPolicy.js`
- `tests/physics.spec.js`

Arbeitsschritte:

1. Classic-Policy liest Observation-Vektor statt direktem Engine-Zugriff.
2. Action-Ausgabe ueber Contract sanitisieren.
3. Failure-Path explizit auf `RuleBasedBotPolicy` routen.

Definition of Done:

- Classic-Bot laeuft stabil ueber Bridge-API.
- Kein Regression-Bruch in bestehenden Bot-Tests.

Verifikation:

- `npm run test:core`
- `npm run test:physics`

---

## Phase 15.4B - Hunt-Bridge-Policy integrieren (Agent B)

Ziel:

1. Hunt-Bot auf gleiche Bridge-Schnittstelle heben.
2. Modus-spezifische Heuristik separat halten.

Dateien (2-5):

- `src/hunt/HuntBotPolicy.js`
- `src/entities/ai/HuntBridgePolicy.js` (neu)
- `tests/physics.spec.js`

Arbeitsschritte:

1. Hunt-Policy ueber Observation/Action-Layer anbinden.
2. Hunt-spezifische Prioritaeten (MG/Rocket/Health) als eigene Ops kapseln.
3. Contract-Tests fuer Hunt-spezifische Action-Sets ergaenzen.

Definition of Done:

- Hunt-Bot nutzt dieselbe Schnittstelle wie Classic.
- Modus-spezifische Logik bleibt nachvollziehbar getrennt.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:roundstate`

---

## Phase 15.5 - Integration: RuntimeConfig/Settings/Session-Auswahl

Ziel:

1. Policy-Auswahl zentral ueber RuntimeConfig steuern.
2. Session-Setup ohne harte Kopplung an Hunt-Health-Hack.

Dateien (2-5):

- `src/core/SettingsManager.js`
- `src/core/RuntimeConfig.js`
- `src/state/MatchSessionFactory.js`
- `src/entities/EntityManager.js`

Arbeitsschritte:

1. Runtime-Flag fuer Policy-Strategie einfuehren (`rule-based`, `bridge`, `auto`).
2. SessionFactory uebergibt gewaehlten Policy-Typ sauber an EntityManager.
3. EntityManager-Entscheidungslogik auf klaren Resolver umbauen.

Definition of Done:

- Policy-Auswahl ist reproduzierbar und testbar.
- Legacy-Default bleibt stabil.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run smoke:roundstate`

---

## Phase 15.6 - Optional: WebSocket-Bridge fuer externes Training (Feature-Flag)

Ziel:

1. Optionale Trainingsanbindung fuer Python/externen Trainer bereitstellen.
2. Produktionspfad unveraendert halten, wenn Flag aus ist.

Dateien (2-5):

- `src/entities/ai/training/WebSocketTrainerBridge.js` (neu)
- `src/entities/ai/ObservationBridgePolicy.js`
- `src/core/RuntimeConfig.js`

Arbeitsschritte:

1. Request/Response-Format fuer Observation->Action definieren.
2. Timeout/Fallback auf lokale Policy absichern.
3. Feature-Flag standardmaessig `false`.

Definition of Done:

- Trainings-Bridge ist optional aktivierbar.
- Bei Verbindungsfehlern bleibt Spiel steuerbar.

Verifikation:

- `npm run test:core`
- `npm run test:physics`

---

## Phase 15.7 - Abschluss: Regression, Doku, Restrisiken

Ziel:

1. Vollstaendige Regression und Doku-Abschluss.
2. Restrisiken plus Folgeoptionen dokumentieren.

Dateien (2-5):

- `docs/Testergebnisse_2026-03-03.md` (oder neues Tagesdokument)
- `docs/ai_architecture_context.md`
- `docs/Umsetzungsplan.md`

Arbeitsschritte:

1. End-to-end Testmatrix fuer Classic/Hunt/Bot-Policy-Auswahl laufen lassen.
2. Restrisiken (Schema-Migration V2, Trainer-Latenz, Telemetrie) dokumentieren.
3. Phase 15 auf abgeschlossen setzen.

Definition of Done:

- Testmatrix gruen, Dokumentation konsistent.
- Klare naechste Ausbaupfade definiert.

Verifikation:

- `npm run test:core`
- `npm run test:physics`
- `npm run test:stress`
- `npm run smoke:roundstate`
- `npm run smoke:selftrail`
- `npm run docs:sync`
- `npm run docs:check`

---

## Prompt-Vorlagen

Start erster Schritt:

`Starte Phase 15.0 aus docs/Feature_BotSchnittstelle_Modulare_Integration.md und fuehre danach direkt die Parallelphasen 15.1A und 15.1B aus.`

Weiter nach jeder Teilphase:

`Markiere Phase 15.X als erledigt und starte Phase 15.Y aus docs/Feature_BotSchnittstelle_Modulare_Integration.md. Fuehre danach die dort definierte Verifikation aus und gib den naechsten Prompt aus.`
