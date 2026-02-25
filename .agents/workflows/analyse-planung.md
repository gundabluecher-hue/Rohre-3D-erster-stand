---
description: Führt tiefgehende Tests aus, erstellt einen Analysebericht und leitet einen priorisierten 3-Phasen-Plan (Wichtig, Mittel, Unwichtig/Backlog) inklusive finalem Review ab.
---

## 0. Kontext-Aufbau (immer zuerst!)

Lies `docs/Umsetzungsplan.md` und zeige die Statusübersicht (wie in `/fix-planung` Schritt 0).
Lies auch den letzten `docs/Analysebericht.md` (falls vorhanden), um zu wissen welche Probleme bereits bekannt sind.

---

1. **System- & Code-Integritätstests durchführen**: Führe nacheinander die folgenden 125 Testroutinen aus. Nutze dafür die aufgeteilten NPM-Skripte und beachte die Ausführungsumgebung (lokal vs. CI/CD):

   *Hinweis zur Automatisierung:* Nutze **Playwright/Puppeteer** für alle render- und UI-basierten Tests im Headless-Modus. Richte einen **Nightly Build (CI/CD)** ein, der alle 125 Tests durchführt. Lokal sollen via Pre-Commit-Hook nur die `[SMOKE]`-Tests laufen.

   - **`npm run test:core`** *(Test 1-20 - Core & Infrastruktur)*:
     1. `[SMOKE]` Linter (Statische Code-Analyse)
     2. `[SMOKE]` Build (Produktions-Build prüfen)
     3. `[SMOKE]` Unit-Tests (Kernkomponenten)
     4. Performance (Game-Loop Simulation)
     5. `[SMOKE]` Physics (Kollisionserkennung)
     6. AI-Logik (Bot-Entscheidungsbäume)
     7. Memory (Stresstest auf Leaks)
     8. `[SMOKE]` Data Integrity (LocalStorage Checksums)
     9. Rendering (Shader/Materialien)
     10. Modding/API (Sandbox-Schnittstellen)
     11. Network/Latency (Dispatch-Latenzen)
     12. Input/Steuerung (Responsibilität)
     13. Audio (Spacial-Audio/Limits)
     14. UI/UX (DOM/Canvas-Overlays)
     15. Garbage Collection (Profiling)
     16. Scene Graph (Frustum Culling)
     17. Kompatibilität (WebGL Fallbacks)
     18. Asset Loading (Stresstest)
     19. Error Handling (Graceful Degradation)
     20. `[SMOKE]` State Migration (Abwärtskompatibilität)

   - **`npm run test:gpu`** *(Test 21-40 - Erweitertes Rendering & GPU)*:
     21. Frustum Culling Edge Cases
     22. Occlusion Culling Effizienz
     23. Shadow Map Resolution Scaling
     24. Shadow Map Cascades Übergänge
     25. Bloom Thresholds & Bleeding
     26. Chromatic Aberration Intensity Limit
     27. Vignette Scaling auf Ultrawide
     28. Anti-Aliasing (MSAA/FXAA) Glitches
     29. Texture Filtering (Anisotropic) Ladefehler
     30. Mipmap Levels Transition
     31. Particle System Count Limits
     32. Particle Collision Boundaries
     33. Decal Projection Verzerrungen
     34. Instanced Mesh Culling Z-Fighting
     35. LOD Transitions Popping
     36. UI Canvas Resolution Scaling
     37. Font Rendering High-DPI
     38. WebGL Context Loss Recovery
     39. WebGL Context Restore State
     40. GPU VRAM Overhead Monitoring

   - **`npm run test:physics`** *(Test 41-60 - Erweiterte Physik & AI - je 100x Durchläufe für Stochastik)*:
     41. Raycast Precision bei High-Speed (x100 Random Vektoren)
     42. Spherecast Penetration Detection (x100 Random Spawns)
     43. Continuous Collision Detection (CCD) (x100 Fast Actors)
     44. Rigidbody Sleep State Trigger
     45. Physics Step Interpolation Jitter
     46. Kinematic vs Dynamic Rigidbodies
     47. Trigger Volume Edge-Crossing
     48. Friction Material Multipliers
     49. Restitution/Bounciness Stacking
     50. Spatial Hash Grid Rebuild Cost
     51. Pathfinding A* CPU-Spikes (x100 Random Wegpunkte)
     52. NavMesh Generation Dynamic
     53. NavMesh Dynamic Obstacle Carving
     54. Steering Behaviors (Crowd Avoidance)
     55. Swarm/Flocking Agent Separation
     56. Finite State Machine Deadlocks (x300 Transition Loops)
     57. Behavior Tree Fallback Nodes
     58. Target Acquisition Prioritization
     59. Line of Sight (LoS) Ray Queries (x1000 Queries)
     60. Sensorial Radius Masking

   - **`npm run test:stress`** *(Test 61-125 - Net/Mem Limits, I/O & Security)*:
     61. Websocket Connection Drop Handling (10x Drops)
     62. Websocket Reconnection Backoff
     63. WebRTC Datachannel Fallback
     64. Packet Loss Sim (20% Drop-Rate, x1000 Pakete)
     65. High Latency Sim (500ms Ping, 60 Sekunden Dauer)
     66. Jitter Buffer Overflow/Underflow
     67. Client-Side Prediction Drift
     68. Server Reconciliation Snapbacks
     69. Entity Interpolation Buffer
     70. Bandwidth Chunking Limits
     71. Frame Time Variance Detection
     72. Draw Call Batching Thresholds
     73. CPU Bound vs GPU Bound Toggle
     74. Script Execution Time per Frame
     75. Main Thread Blocking (16ms Limit)
     76. CSS Reflows in UI Updates
     77. DOM Node Count Leak Detection (5 Minuten Dauer-Loop)
     78. WebWorker Message Cloning Latency
     79. IndexedDB Bulk Write Time
     80. LocalStorage Quota Exceed Exception
     81. SharedArrayBuffer Fallbacks
     82. Audio Context Background Suspend
     83. Positional Audio Panning Curve
     84. Audio Buffer Concurrent Decodes
     85. Multiple Sound Overlaps (Voice Limit)
     86. Output Device Switching Hot-Plug
     87. Input Device Polling Rate Jitter
     88. Gamepad Axis Deadzone Drift
     89. Gamepad Button Mapping Edge Cases
     90. Keyboard Ghosting Kombinationen
     91. Mouse Delta Smoothing Jump
     92. Touch Screen Multi-Touch Pinch
     93. Browser Tab Visibility Change Event
     94. Background Throttling Timer Rescue
     95. Power Saving Mode FPS Detect
     96. Device Pixel Ratio Hot-Swap
     97. Savegame Checksum Tampering
     98. Savegame Version Schema Validate
     99. Corrupt Savegame Recovery
     100. JSON Parsing Exception Trapping
     101. Binary Serialization Endianness
     102. Entity ID Generation Collisions
     103. Event Bus Infinite Loop Guard
     104. Event Listener Unmount Leaks
     105. Promise Rejection Global Handler
     106. XSS Vulnerability in Chat/Input
     107. Rate Limiting Command Spam
     108. Analytics/Telemetrie Opt-Out
     109. Error Reporting Payload Size
     110. Dependency Version Resolving
     111. Minification Variable Mangling
     112. Source Map Resolving in Prod
     113. Hot Module Replacement Status
     114. Localization Missing Keys Check
     115. Font Load Timeout Fallback
     116. Texture Fallback Images (Missing/404)
     117. CSS Variable Scope Bleeding
     118. CSS Animation GPU Acceleration
     119. Game Logic Determinism Check
     120. Final Memory Heap Snapshot Compare
     121. Arithmetic Robustness (NaN/Infinity Guards in Kern-Berechnungen)
     122. State Transition Validation (Prüfung illegaler Zustandsübergänge)
     123. Component Lifecycle Consistency (Initialisierungs- & Zerstörungslogik)
     124. Data Transform Integrity (Validierung von Input-zu-Output Mappings)
     125. Global Registry/Store Sync (Verhinderung von "Stale States" in Stores)
2. **Testergebnisse persistieren**: Speichere die Roh-Ergebnisse in `docs/Testergebnisse_YYYY-MM-DD.md` mit Datum im Dateinamen. Format pro Test: `✅ PASS` / `❌ FAIL` / `⚠️ WARN` + Kurzbeschreibung.

3. **Analysebericht (Nur NEUE Funde)**: Analysiere die Ausgaben aller 125 Tests. Falls ein vorheriger `docs/Analysebericht.md` existiert, **vergleiche** die neuen Ergebnisse mit dem letzten Bericht und markiere was **neu**, **behoben** oder **verschlechtert** ist. Dokumentiere in `docs/Analysebericht.md` ausschließlich **neue** Probleme, Regressionsfehler oder bisher unentdeckte Engpässe.

4. **Planung & Triage (Update des Master-Plans)**: Aktualisiere den **`docs/Umsetzungsplan.md`**. Integriere die **neu** im Analysebericht identifizierten Punkte in das bestehende Prioritätensystem (Wichtig, Mittel, Unwichtig).
   *Hinweis: Behalte die Struktur des Master-Plans bei. Bereits erledigte Alt-Aufgaben [x] bleiben zur Dokumentation stehen.*

5. **Phasen-Definition & Master-Update**: Passe die bestehenden Phasen an oder erstelle neue (z.B. Phase 7+), falls die neuen Funde nicht in Phase 1-6 passen. Jede Phasen-Überschrift **muss** eine Checkbox enthalten: `## Phase X: [ ] Titel`. Definiere pro Phase:
   - Exakte Ziele & betroffene Dateien.
   - Ein klares Verifikationskriterium (Review-Test).

6. **Finaler Review**: Überprüfe `docs/Umsetzungsplan.md` gegen `docs/Analysebericht.md`. Stelle sicher, dass keine Aspekte aus den 125 Tests vergessen wurden und die `/fix-planung` Kompatibilität (Checkboxen in Headings) gewahrt bleibt.
