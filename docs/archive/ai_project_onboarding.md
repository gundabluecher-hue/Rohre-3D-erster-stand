# 🤖 AI Project Onboarding: Rohre-3D

Welcome, AI Developer. This is your definitive starting point for understanding the "Rohre-3D" project. **Always read this document first** when starting a new conversation regarding this repository.

## 🎯 Context: What is "Rohre-3D"?

It's a fast-paced, 3D browser-based game reminiscent of "Tron" but set on the interior walls of giant tubes/pipes. Pilots (Player and AI Bots) fly forward automatically, leaving deadly light trails behind them. The goal is to survive and force opponents to crash into the trails or the level boundaries.

## 🛠️ Tech Stack

* **Graphics:** Three.js (WebGL rendering).
* **Logic:** Vanilla JavaScript (ES6+ Modules, no transpilers required for basic logic, served usually via Vite in `dev`).
* **UI:** Vanilla HTML/CSS overlaying the `<canvas>`.
* **Math:** Heavy use of linear algebra (Quaternions, Vectors, Matrices, OBB/Oriented Bounding Boxes) for collision precision.

## 📂 Key Architecture Documents

If the user asks you to implement a major feature, or debug a tricky physics bug, you **must** consult these architectural references to maintain structural integrity:

1. **`docs/ai_architecture_context.md`**: Your absolute best friend. Contains an LLM-optimized breakdown of exactly what each major Javascript file does and how state flows. Read this before touching `EntityManager.js` or `main.js`.
2. **`docs/architektur_ausfuehrlich.md`**: Contains a highly detailed textual explanation + a visual Mermaid.js graph showing how exactly modules import and depend on each other.

## 🚨 Golden Rules for this Codebase

* **Resource Leaks:** WebGL objects (`Geometry`, `Materials`, `Textures`) MUST be manually disposed when destroyed. Use the utility functions in `js/modules/three-disposal.js` exactly as instructed by the architecture context.
* **Zero-Allocation in Hot Loops:** The game loops at 60 FPS. Avoid creating new objects (like `new THREE.Vector3()` or returning new `{ hit: true }` structs) during `update()` or collision checks. Always use cached class variables (e.g. `this._tmpVec`, `this._collisionResult`) and fast-path boolean checks (e.g. `Arena.checkCollisionFast()`).
* **Centralized Configuration:** Do NOT scatter random magic numbers throughout the code. Constants (speeds, sizes, hitboxes) belong in `js/modules/Config.js`.
* **Language:** The user prefers German ("Antworte auf Deutsch"). Always respond in German unless specifically asked otherwise. Keep code comments in English unless they are explicitly meant for the user.
* **Environment:** "Nicht im Browser arbeiten". Do not open browser windows or try to run DOM automation unless given strict instruction. You are operating in an IDE/Editor environment processing files directly.

## 🚀 How to Start a Task

1. Verify the user's request.
2. If the request involves game logic, physics, or entity lifecycles, cross-reference `docs/ai_architecture_context.md` to understand where your changes belong.
3. Draft a plan (`implementation_plan.md`) if the change is substantial.
4. Execute. Do not break the pure-function pattern found in the `*Ops.js` files.
