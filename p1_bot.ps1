$f = 'js/modules/Bot.js'
$c = [System.IO.File]::ReadAllText($f)

$c = $c -replace 'this\._collisionCache = new Map\(\);\r?\n        this\._lastSensePos = new THREE\.Vector3\(\);', "this._collisionCache = new Map();`r`n        this._lastSensePos = new THREE.Vector3();`r`n`r`n        // Time-Slicing: Sensor-Scans auf verschiedene Frames verteilen`r`n        this._sensePhase = 0;         // Frame-Slot dieses Bots (0..2), von EntityManager gesetzt`r`n        this._sensePhaseCounter = 0;  // Hochzaehlender Frame-Zaehler"

$old = "        this._resetDecision();\r`n        this._senseEnvironment(player, arena, allPlayers, projectiles);\r`n`r`n        if (this.sense.immediateDanger"
$new = "        this._resetDecision();`r`n`r`n        // Time-Slicing: Vollstaendiger Scan nur in zugeordnetem Frame-Slot`r`n        this._sensePhaseCounter = (this._sensePhaseCounter + 1) % 3;`r`n        const shouldFullSense = this._sensePhaseCounter === this._sensePhase;`r`n        if (shouldFullSense) {`r`n            this._senseEnvironment(player, arena, allPlayers, projectiles);`r`n        } else {`r`n            // Nur kritische Checks in anderen Frames (Projektile + Hoehe)`r`n            this._senseProjectiles(player, projectiles);`r`n            this._senseHeight(player, arena);`r`n        }`r`n`r`n        if (this.sense.immediateDanger"

$c = $c.Replace("        this._resetDecision();`r`n        this._senseEnvironment(player, arena, allPlayers, projectiles);`r`n`r`n        if (this.sense.immediateDanger",
    "        this._resetDecision();`r`n`r`n        // Time-Slicing: Vollstaendiger Scan nur in zugeordnetem Frame-Slot`r`n        this._sensePhaseCounter = (this._sensePhaseCounter + 1) % 3;`r`n        const shouldFullSense = this._sensePhaseCounter === this._sensePhase;`r`n        if (shouldFullSense) {`r`n            this._senseEnvironment(player, arena, allPlayers, projectiles);`r`n        } else {`r`n            // Nur kritische Checks in anderen Frames (Projektile + Hoehe)`r`n            this._senseProjectiles(player, projectiles);`r`n            this._senseHeight(player, arena);`r`n        }`r`n`r`n        if (this.sense.immediateDanger")

[System.IO.File]::WriteAllText($f, $c, [System.Text.UTF8Encoding]::new($false))
Write-Host "Bot.js OK"
