# GLB/GLTF Map-Loader Integration (Zukunftsplan)

> **Status:** Geplant (nicht begonnen)
> **Erstellt:** 2026-03-02
> **Geschätzter Aufwand:** 4-5 Stunden

Externes 3D-Modell-Laden (GLB/GLTF) als Map-Geometrie für das Spiel. Aktuell sind Maps rein Code-basiert (JSON-Obstacles → `THREE.BoxGeometry`). Ziel: GLB-Dateien können als visuelle Map-Umgebung geladen werden, mit automatischer Kollisionsbox-Extraktion.

## Ist-Zustand

- Three.js `^0.160.0` (Vite/npm), kein GLTFLoader vorhanden
- `Arena.js`: `build(mapKey)` liest `CONFIG.MAPS[mapKey]` → Boxen via `_addObstacle()` → Kollision via `THREE.Box3` AABB
- `Config.js`: `MAPS`-Objekt mit `size`, `obstacles[]`, `portals[]`, `gates[]`
- Kollision: `getCollisionInfo()` / `checkCollisionFast()` iterieren über `this.obstacles[]` (Box3-Array)

## Getroffene Entscheidungen

- **Kollisions-Strategie:** ✅ AABB pro Child-Mesh (einfach+performant)
- **GLB-Quellen:** ✅ Programmatisch generiertes Test-GLB zum Validieren des Loaders
- **Dateigröße & Ladezeit:** GLB erfordert async Laden → `async build()` + Ladeindikator nötig

---

## Phase 1: GLTFLoader einrichten & Model-Asset-Pipeline

**[NEU] `src/entities/GLBMapLoader.js`**

- Import `GLTFLoader` aus `three/addons/loaders/GLTFLoader.js` (bereits in Three.js enthalten)
- `async loadGLBMap(url, options)` → Lädt GLB, gibt zurück:
  - `scene` (THREE.Group) – 3D-Modell für die Szene
  - `colliders[]` – Array von `{ box: THREE.Box3, kind }` aus Child-Meshes
  - `bounds` – Gesamt-BoundingBox für Arena-Limits
- Namenskonvention für Child-Meshes:
  - `_nocol` → rein visuell, keine Kollision
  - `_foam` → Foam-Kollision (Abprall statt Tod)

## Phase 2: Map-Definition erweitern

**[ÄNDERN] `Config.js` + `MapSchema.js`**

Neues optionales Feld `glbModel` in Map-Definitionen:

```js
sci_fi_station: {
    name: 'Sci-Fi Station',
    size: [100, 40, 100],
    glbModel: '/assets/models/maps/sci_fi_station.glb',
    obstacles: [],  // Fallback
    portals: [...]
}
```

## Phase 3: Arena-Build async machen

**[ÄNDERN] `Arena.js` + `EntityManager.js`**

1. `build(mapKey)` → `async build(mapKey)`
2. GLB laden, Szene einfügen, Colliders extrahieren
3. Hybrid-Modus: Box-Obstacles zusätzlich möglich
4. Fehlerbehandlung: Fallback auf Box-Obstacles bei GLB-Fehler

## Phase 4: Beispiel-GLB-Maps bereitstellen

**[NEU] `assets/models/maps/`**

| Datei | Quelle | Lizenz | Beschreibung |
|---|---|---|---|
| `modular_pipes.glb` | OpenGameArt/Quaternius | CC0 | Modulares Rohrsystem |
| `sci_fi_corridor.glb` | Quaternius Sci-Fi Kit | CC0 | Sci-Fi-Korridor |
| `dungeon_maze.glb` | Quaternius Dungeons | CC0 | Dungeon-Labyrinth |

Modelle müssen manuell heruntergeladen/zusammengebaut werden. Alternative: programmatisch Test-GLB generieren zum Validieren.

## Phase 5: UI-Integration

- Map-Dropdown zeigt GLB-Maps an
- Ladebalken/Spinner während GLB-Laden

## Phasen-Reihenfolge

| Phase | Abhängigkeiten | Aufwand |
|---|---|---|
| 1. GLBMapLoader Modul | Keine | ~1h |
| 2. Map-Definition erweitern | Phase 1 | ~30min |
| 3. Arena.build → async | Phase 1+2 | ~1.5h |
| 4. Beispiel-GLB bereitstellen | Phase 1 | ~1h |
| 5. UI Ladeindikator | Phase 3 | ~30min |

## Verifikation

- Bestehende Tests müssen bestehen (`core.spec.js`, `physics.spec.js`)
- Neuer Test `glb-loader.spec.js`
- Manuelle Prüfung: Standard-Maps unverändert, GLB-Map ladbar, Kollision funktioniert, Fehler-Fallback greift
