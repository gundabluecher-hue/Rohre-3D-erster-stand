$f = 'js/modules/EntityManager.js'
$c = [System.IO.File]::ReadAllText($f)

$c = $c -replace 'this\.spatialGrid = new Map\(\); // Key: hash\(cx, cz\), Value: Set of segment data', "this.spatialGrid = new Map(); // Key: hash(cx, cz), Value: Set of segment data`r`n        this._keysBuffer = []; // Wiederverwendbarer Buffer fuer _getSegmentGridKeys"

$c = $c -replace 'return \[this\._getGridKey\(data\.midX, data\.midZ\)\];', "this._keysBuffer.length = 0;`r`n            this._keysBuffer.push(this._getGridKey(data.midX, data.midZ));`r`n            return this._keysBuffer;"

$c = $c -replace '        const keys = \[\];', '        this._keysBuffer.length = 0;'
$c = $c -replace '                keys\.push\(', '                this._keysBuffer.push('
$c = $c -replace '        return keys;', '        return this._keysBuffer;'

$c = $c -replace 'const ai = new BotAI\(\{ difficulty: this\.botDifficulty, recorder: this\.recorder \}\);', "const ai = new BotAI({ difficulty: this.botDifficulty, recorder: this.recorder });`r`n            ai._sensePhase = i % 3; // Time-Slicing: Bot-Scans auf verschiedene Frames verteilen"

[System.IO.File]::WriteAllText($f, $c, [System.Text.UTF8Encoding]::new($false))
Write-Host "EntityManager.js OK"
