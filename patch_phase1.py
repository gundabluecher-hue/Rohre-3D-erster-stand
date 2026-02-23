#!/usr/bin/env python3
# Phase 1 Performance-Optimierung: Patch-Skript
import re

# ========================================================
# Aufgabe 1: Arena.js
# ========================================================
with open('js/modules/Arena.js', 'r', encoding='utf-8') as f:
    arena = f.read()

# Prüfen ob schon gepatcht
if 'NORMAL_PX' not in arena:
    # Statische Normalen nach den Imports hinzufügen
    arena = arena.replace(
        "import { CONFIG } from './Config.js';",
        "import { CONFIG } from './Config.js';\n\n"
        "// Statische Normalen-Vektoren fuer Arena-Wandkollisionen (readonly, einmalig alloziert)\n"
        "const NORMAL_PX = Object.freeze(new THREE.Vector3(1, 0, 0));   // +X (rechte Wand)\n"
        "const NORMAL_NX = Object.freeze(new THREE.Vector3(-1, 0, 0));  // -X (linke Wand)\n"
        "const NORMAL_PY = Object.freeze(new THREE.Vector3(0, 1, 0));   // +Y (Boden)\n"
        "const NORMAL_NY = Object.freeze(new THREE.Vector3(0, -1, 0));  // -Y (Decke)\n"
        "const NORMAL_PZ = Object.freeze(new THREE.Vector3(0, 0, 1));   // +Z (hintere Wand)\n"
        "const NORMAL_NZ = Object.freeze(new THREE.Vector3(0, 0, -1));  // -Z (vordere Wand)"
    )
    print("Arena.js: Normalen-Konstanten hinzugefuegt")
else:
    print("Arena.js: Normalen-Konstanten bereits vorhanden")

if '_tmpVecGate1' not in arena:
    arena = arena.replace(
        "this._tmpSphere = new THREE.Sphere();  // Wiederverwendbar fuer Kollision",
        "this._tmpSphere = new THREE.Sphere();  // Wiederverwendbar fuer Kollision\n"
        "        // Hilfsvektoren fuer checkSpecialGates (hochfrequent, vermeidet GC)\n"
        "        this._tmpVecGate1 = new THREE.Vector3();\n"
        "        this._tmpVecGate2 = new THREE.Vector3();"
    )
    # Auch die deutsche Schreibweise probieren (Kommentar könnte variieren)
    if '_tmpVecGate1' not in arena:
        arena = arena.replace(
            "this._tmpSphere = new THREE.Sphere();",
            "this._tmpSphere = new THREE.Sphere();\n"
            "        // Hilfsvektoren fuer checkSpecialGates (hochfrequent, vermeidet GC)\n"
            "        this._tmpVecGate1 = new THREE.Vector3();\n"
            "        this._tmpVecGate2 = new THREE.Vector3();"
        )
    print("Arena.js: _tmpVecGate1/2 hinzugefuegt")
else:
    print("Arena.js: _tmpVecGate1/2 bereits vorhanden")

# 6x new THREE.Vector3() in getCollisionInfo durch Konstanten ersetzen
arena = arena.replace("normal: new THREE.Vector3(1, 0, 0) }", "normal: NORMAL_PX }")
arena = arena.replace("normal: new THREE.Vector3(-1, 0, 0) }", "normal: NORMAL_NX }")
arena = arena.replace("normal: new THREE.Vector3(0, 1, 0) }", "normal: NORMAL_PY }")
arena = arena.replace("normal: new THREE.Vector3(0, -1, 0) }", "normal: NORMAL_NY }")
arena = arena.replace("normal: new THREE.Vector3(0, 0, 1) }", "normal: NORMAL_PZ }")
arena = arena.replace("normal: new THREE.Vector3(0, 0, -1) }", "normal: NORMAL_NZ }")
print("Arena.js: getCollisionInfo Normalen ersetzt")

# checkSpecialGates: lokale const durch this._tmpVecGate ersetzen
arena = arena.replace(
    "const tmpVec = new THREE.Vector3();\n        const tmpVec2 = new THREE.Vector3();\n",
    "// _tmpVecGate1 und _tmpVecGate2 als Instanz-Felder wiederverwendet\n"
)
arena = arena.replace(
    "        tmpVec.subVectors(previousPosition, gate.pos);",
    "        this._tmpVecGate1.subVectors(previousPosition, gate.pos);"
)
arena = arena.replace(
    "        tmpVec2.subVectors(position, gate.pos);",
    "        this._tmpVecGate2.subVectors(position, gate.pos);"
)
arena = arena.replace(
    "            const dotPrev = tmpVec.dot(gate.forward);",
    "            const dotPrev = this._tmpVecGate1.dot(gate.forward);"
)
arena = arena.replace(
    "            const dotCurr = tmpVec2.dot(gate.forward);",
    "            const dotCurr = this._tmpVecGate2.dot(gate.forward);"
)
print("Arena.js: checkSpecialGates gepatcht")

with open('js/modules/Arena.js', 'w', encoding='utf-8', newline='') as f:
    f.write(arena)
print("Arena.js: Gespeichert")

# ========================================================
# Aufgabe 2: EntityManager.js
# ========================================================
with open('js/modules/EntityManager.js', 'r', encoding='utf-8') as f:
    em = f.read()

if '_keysBuffer' not in em:
    em = em.replace(
        "this.spatialGrid = new Map(); // Key: hash(cx, cz), Value: Set of segment data",
        "this.spatialGrid = new Map(); // Key: hash(cx, cz), Value: Set of segment data\n"
        "        this._keysBuffer = []; // Wiederverwendbarer Buffer fuer _getSegmentGridKeys (vermeidet Array-Allokation pro Frame)"
    )
    print("EntityManager.js: _keysBuffer hinzugefuegt")
else:
    print("EntityManager.js: _keysBuffer bereits vorhanden")

# _getSegmentGridKeys: const keys = [] durch Buffer ersetzen
em = em.replace(
    "        const keys = [];\n\n        for (let cx = minCellX; cx <= maxCellX; cx++) {\n"
    "            for (let cz = minCellZ; cz <= maxCellZ; cz++) {\n"
    "                keys.push((cx + 1000) * 2000 + (cz + 1000));\n"
    "            }\n"
    "        }\n"
    "        return keys;",
    "        this._keysBuffer.length = 0; // Buffer leeren statt neues Array erstellen\n\n"
    "        for (let cx = minCellX; cx <= maxCellX; cx++) {\n"
    "            for (let cz = minCellZ; cz <= maxCellZ; cz++) {\n"
    "                this._keysBuffer.push((cx + 1000) * 2000 + (cz + 1000));\n"
    "            }\n"
    "        }\n"
    "        return this._keysBuffer;"
)
# Einzel-Key-Fallback umschreiben
em = em.replace(
    "            return [this._getGridKey(data.midX, data.midZ)];",
    "            this._keysBuffer.length = 0;\n"
    "            this._keysBuffer.push(this._getGridKey(data.midX, data.midZ));\n"
    "            return this._keysBuffer;"
)
print("EntityManager.js: _getSegmentGridKeys gepatcht")

with open('js/modules/EntityManager.js', 'w', encoding='utf-8', newline='') as f:
    f.write(em)
print("EntityManager.js: Gespeichert")

# ========================================================
# Aufgabe 3: Bot.js – Time-Slicing
# ========================================================
with open('js/modules/Bot.js', 'r', encoding='utf-8') as f:
    bot = f.read()

# _sensePhase und _sensePhaseCounter im Konstruktor (nach _collisionCache)
if '_sensePhase' not in bot:
    bot = bot.replace(
        "        this._collisionCache = new Map();\n        this._lastSensePos = new THREE.Vector3();",
        "        this._collisionCache = new Map();\n"
        "        this._lastSensePos = new THREE.Vector3();\n"
        "\n"
        "        // Time-Slicing: Sensor-Scans auf verschiedene Frames verteilen\n"
        "        this._sensePhase = 0;         // Welcher Frame-Slot gehoert diesem Bot (0..2)\n"
        "        this._sensePhaseCounter = 0;  // Hochzaehlender Frame-Zaehler"
    )
    print("Bot.js: _sensePhase/_sensePhaseCounter hinzugefuegt")
else:
    print("Bot.js: _sensePhase bereits vorhanden")

# update()-Methode: _senseEnvironment durch Time-Slicing ersetzen
old_sense = (
    "        this._resetDecision();\n"
    "        this._senseEnvironment(player, arena, allPlayers, projectiles);\n"
    "\n"
    "        if (this.sense.immediateDanger"
)
new_sense = (
    "        this._resetDecision();\n"
    "\n"
    "        // Time-Slicing: Vollstaendiger Scan nur in zugeordnetem Frame-Slot\n"
    "        this._sensePhaseCounter = (this._sensePhaseCounter + 1) % 3;\n"
    "        const shouldFullSense = this._sensePhaseCounter === this._sensePhase;\n"
    "        if (shouldFullSense) {\n"
    "            this._senseEnvironment(player, arena, allPlayers, projectiles);\n"
    "        } else {\n"
    "            // Nur kritische Checks in anderen Frames\n"
    "            this._senseProjectiles(player, projectiles);\n"
    "            this._senseHeight(player, arena);\n"
    "        }\n"
    "\n"
    "        if (this.sense.immediateDanger"
)
bot = bot.replace(old_sense, new_sense)
print("Bot.js: Time-Slicing in update() eingefuegt")

with open('js/modules/Bot.js', 'w', encoding='utf-8', newline='') as f:
    f.write(bot)
print("Bot.js: Gespeichert")

# ========================================================
# Aufgabe 3b: EntityManager.js – _sensePhase mit botIndex % 3 initialisieren
# ========================================================
with open('js/modules/EntityManager.js', 'r', encoding='utf-8') as f:
    em = f.read()

# Nach BotAI-Erstellung sensePhase setzen
em = em.replace(
    "            const ai = new BotAI({ difficulty: this.botDifficulty, recorder: this.recorder });",
    "            const ai = new BotAI({ difficulty: this.botDifficulty, recorder: this.recorder });\n"
    "            ai._sensePhase = i % 3; // Time-Slicing: Bot-Scans auf verschiedene Frames verteilen"
)
print("EntityManager.js: _sensePhase-Initialisierung hinzugefuegt")

with open('js/modules/EntityManager.js', 'w', encoding='utf-8', newline='') as f:
    f.write(em)
print("EntityManager.js: Gespeichert (final)")

print("\n=== Phase 1 Patch abgeschlossen ===")
print("Bitte Spiel testen: portal_madness mit 5+ Bots")
