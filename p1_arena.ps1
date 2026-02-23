$f = 'js/modules/Arena.js'
$c = [System.IO.File]::ReadAllText($f)

$c = $c -replace "import \{ CONFIG \} from '\./Config\.js';", "import { CONFIG } from './Config.js';`n`n// Statische Normalen fuer Arena-Wandkollisionen (einmalig alloziert)`nconst NORMAL_PX = Object.freeze(new THREE.Vector3(1, 0, 0));`nconst NORMAL_NX = Object.freeze(new THREE.Vector3(-1, 0, 0));`nconst NORMAL_PY = Object.freeze(new THREE.Vector3(0, 1, 0));`nconst NORMAL_NY = Object.freeze(new THREE.Vector3(0, -1, 0));`nconst NORMAL_PZ = Object.freeze(new THREE.Vector3(0, 0, 1));`nconst NORMAL_NZ = Object.freeze(new THREE.Vector3(0, 0, -1));"

$c = $c -replace 'this\._tmpSphere = new THREE\.Sphere\(\);  // Wiederverwendbar fuer Kollision', "this._tmpSphere = new THREE.Sphere();  // Wiederverwendbar fuer Kollision`r`n        this._tmpVecGate1 = new THREE.Vector3();`r`n        this._tmpVecGate2 = new THREE.Vector3();"

$c = $c -replace 'normal: new THREE\.Vector3\(1, 0, 0\) \}', 'normal: NORMAL_PX }'
$c = $c -replace 'normal: new THREE\.Vector3\(-1, 0, 0\) \}', 'normal: NORMAL_NX }'
$c = $c -replace 'normal: new THREE\.Vector3\(0, 1, 0\) \}', 'normal: NORMAL_PY }'
$c = $c -replace 'normal: new THREE\.Vector3\(0, -1, 0\) \}', 'normal: NORMAL_NY }'
$c = $c -replace 'normal: new THREE\.Vector3\(0, 0, 1\) \}', 'normal: NORMAL_PZ }'
$c = $c -replace 'normal: new THREE\.Vector3\(0, 0, -1\) \}', 'normal: NORMAL_NZ }'

$c = $c -replace 'const tmpVec = new THREE\.Vector3\(\);\r?\n        const tmpVec2 = new THREE\.Vector3\(\);\r?\n\r?\n', "// tmpVecGate1/2 als Instanz-Felder`r`n`r`n"
$c = $c -replace '        tmpVec\.subVectors\(previousPosition, gate\.pos\);', '        this._tmpVecGate1.subVectors(previousPosition, gate.pos);'
$c = $c -replace '        tmpVec2\.subVectors\(position, gate\.pos\);', '        this._tmpVecGate2.subVectors(position, gate.pos);'
$c = $c -replace '            const dotPrev = tmpVec\.dot\(gate\.forward\);', '            const dotPrev = this._tmpVecGate1.dot(gate.forward);'
$c = $c -replace '            const dotCurr = tmpVec2\.dot\(gate\.forward\);', '            const dotCurr = this._tmpVecGate2.dot(gate.forward);'

[System.IO.File]::WriteAllText($f, $c, [System.Text.UTF8Encoding]::new($false))
Write-Host "Arena.js OK"
