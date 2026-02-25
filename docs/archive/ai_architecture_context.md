# AI Architecture Context: Rohre-3D

> **Format:** Highly structured markdown designed for LLM context injection.
> **Purpose:** Provides an immediate, absolute understanding of the game's architecture, data-flow, and strict paradigms.

## 1. Project Paradigm

* **Engine:** Three.js (WebGL), Vanilla JavaScript (ES6 Modules). No big frameworks (React/Vue/Svelte).
* **Architecture Pattern:** State-Machine + Functional Core / Imperative Shell.
* **State Management:** State is passed explicitly. Heavy use of pure functions (`...Ops.js`) for logic, and Managers/Controllers for state holding.
* **Module System:** ES6 `import`/`export` across the `src/` directory (subfolders: `core`, `entities`, `state`, `ui`).

## 2. Core Modules & Responsibilities (Dictionary)

### 2.1 Bootstrapping

* `main.js`: The Entry Point. Attaches DOM listeners, creates singletons (`Renderer`, `GameLoop`, `InputManager`). Triggers `MatchSessionFactory`.
* `Config.js`: Golden source of truth for all game constants (speeds, bounds, colors, radii).
* `GameLoop.js`: Wraps `requestAnimationFrame`. Emits `dt` (Delta Time) to all dependent update loops.
* `Renderer.js`: Wraps `THREE.WebGLRenderer`. Manages the scene graph and camera resizing. Includes a Minimap Setup.

### 2.2 Game State (The Match Lifecycle)

* **Match Initiation:** `MatchSessionFactory.js` instantiates a new game session (generates bots, places player, creates the Arena).
* **State Machine:** `RoundStateController.js` loops through predefined states (COUNTDOWN, PLAYING, ROUND_OVER).
* **Logic (Pure):** `RoundStateOps.js` contains side-effect-free methods evaluating round results (e.g., did someone hit a wall?).
* **End Coordination:** `RoundEndCoordinator.js` captures the collision event, computes the winner, updates persistent profiles, and prompts the UI overlay.

### 2.3 World & Physics (The Simulation)

* `Arena.js`: Generates a `THREE.TubeGeometry`. Computes internal bounds constraints (preventing players from drifting out of the ring).
* `EntityManager.js`: The heart of the simulation loop. Iterates over entities (`update(dt)`). **CRITICAL POINT:** Handles exact OBB (Oriented Bounding Box) mathematical collision checks for light trails.
* `Player.js` & `Bot.js`: Entity controllers. Map inputs (keyboard/mouse vs. AI-logic) to physical movement transforms across the wall of the Arena.
* `vehicle-registry.js`: Factory mapping String IDs ("spaceship", "orb") to specific imported `THREE.Mesh` models.
* `Trail.js`: Computes dynamic, deadly geometries behind vehicles (Tron mechanics).
* `Particles.js` / `Powerup.js`: Visual FX and collectables management.

### 2.4 Interface & Persistence

* `UIManager.js`: DOM Manipulator. Shows/Hides HTML screens (`#main-menu`, `#hud`).
* `HUD.js`: High-frequency UI updater syncing Three.js values (speed, health) to the HTML overlay.
* `SettingsStore.js` / `Profile...Ops.js`: Persists game settings and user data to `window.localStorage`.

## 3. Strict Development Rules for AI

1. **Do not mutate state in `*Ops.js` files:** These must remain pure functions returning new state objects.
2. **Use `Config.js`:** Never hardcode mathematical constants (hitboxes, speeds) directly into `Player.js` or `Arena.js`.
3. **Three.js Cleanup:** Always utilize `three-disposal.js` when removing entities to prevent catastrophic WebGL memory leaks.
4. **Collision Math:** Trail collision is mathematically complex (OBB). Do not lightly refactor `checkGlobalCollision()` in `EntityManager.js` without full context.
5. **Performance & GC:** Do not create new objects (e.g. `new THREE.Vector3()` or `{hit: true}`) in hot loops (like `update()` or AI raycasting). Use fast-path boolean checks (`Arena.checkCollisionFast`) and cached result objects (`_collisionResult`, `_trailCollisionResult`) to prevent Garbage Collection spikes. Time-slice heavy Bot calculations.

*Reference `docs/architektur_ausfuehrlich.md` for the visual Mermaid.js component graph.*
