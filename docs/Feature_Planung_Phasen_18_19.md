# Feature: Variables Schadensfeedback (Phasen 18 & 19)

Diese Spezifikation teilt das Backlog-Item **V4 (Treffer-/Schadensfeedback verbessern)** in KI-freundliche, testgetriebene Phasen auf.
Das Ziel ist ein sicherer Parallelbetrieb: Agent A implementiert die Partikel/Audio/Logik-Schnittstellen (Phase 18), waehrend Agent B parallel oder im Anschluss die automatisierten Validierungen und Regressionstests ergaenzt (Phase 19).

---

## Phase 18: Implementierung Schadensfeedback (Agent A - Code)

**Ziele:**

1. Klarere Audio-Signale fuer Treffer, Schild-Absorption und Standard-Hits implementieren (`src/core/Audio.js`).
2. Visuelle Effekte/Partikel nach Schadensart (MG, Rakete, Trail, Schild) in entsprechenden Komponenten einbinden.
3. Die Game-Loop sicher halten (kein GC-Leak), indem existierende Particle-Pools genutzt oder erweitert werden.

**Teilphasen (Agent A):**

- [ ] **18.1 Audio-Hooks (`src/core/Audio.js` & Config)**
  - Setup einer neuen Subconfig oder Parameter in `Audio.js` fuer `hit_shield`, `hit_hull_hit`.
  - Stub-Aufrufe wo moeglich platzieren.
- [ ] **18.2 System-Update: ProjectileSystem/HealthSystem (`src/entities/systems/ProjectileSystem.js` & `HealthSystem.js`)**
  - Unterscheidung des Treffertyps ermitteln (Ist es ein Panzertreffer oder Schildtreffer? War es eine Rakete oder MG?).
  - Emittern/Event fuer Schaden genauer aufschluesseln.
- [ ] **18.3 UI & VFX Binding (`src/hunt/HuntHUD.js` o.a.)**
  - Crosshair-Farb-Trigger bei Schildtreffer z.B. blau markieren.
  - Partikel-Farbe fuer Shields (blau) und Huelle/Base (orange/rot) anpassen.
- [ ] **18.4 Aufrueck-Integration**
  - Falls neu initialisierte Audio-/Particle-Elemente den State der Map beieinflussen, im `Reset` integrieren.

---

## Phase 19: Validierung & QA (Agent B - QA)

**Ziele:**

1. Sicherstellen, dass die neuen Events tatsaechlich geworfen werden.
2. Leistungs-Degradation (Frame-Drop) im Partikel-Massenaufkommen abfangen.

**Teilphasen (Agent B):**

- [ ] **19.1 Dummy-Sound-Tests**
  - `tests/physics.spec.js` o.a. um Audio-Emissions-Assertions (Mock-Aufruf pruefen) erweitern.
- [ ] **19.2 UI/Crosshair Integritaet**
  - Ueberpruefen, ob `HuntHUD` bei dem neu geschaffenen Schadensevent tatsaechlich den `hit`-Style respektive farblichen Sub-Stift im DOM aktualisiert.
- [ ] **19.3 Regression Core-Play**
  - `npm run smoke:roundstate` durchlaufen und auf Console-Wedges im `HealthSystem` lauschen.

---

## Koordinations-Gates

- **Gate 1:** Phase 19.1/2 kann mit Dummy/Interface-Pruefungen parallel zu 18 starten.
- **Gate 2:** Vollintegration (18.4 und 19.3) nur bedingungslos durchfuehrbar, wenn 18.2 gruen ist (`npm run test:core`).
