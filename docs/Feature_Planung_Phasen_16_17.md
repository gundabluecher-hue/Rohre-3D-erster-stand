# Feature: Menue-Schnellpresets und UI-Erweiterungen (Phasen 16 & 17)

Diese Spezifikation teilt das Backlog-Item **V6 (Menue-Schnellpresets einfuehren)** und Teile von **V7 (Profile-UX ausbauen)** in KI-freundliche, testgetriebene Phasen auf.
Das Ziel ist ein sicherer Parallelbetrieb: Agent A entwickelt die Logik und UI-Komponenten (Phase 16), waehrend Agent B parallel oder zeitversetzt die automatisierten UI-Tests und Validierungen schreibt (Phase 17).

---

## Phase 16: Implementierung Menue-Schnellpresets (Agent A - Code)

**Ziele:**

1. Logik fuer vordefinierte Presets (Arcade, Competitive, Chaos) im `SettingsManager` implementieren.
2. UI-Buttons/Dropdowns fuer Presets im `MenuController` / `SettingsStore` einbauen.
3. Sichere State-Synchronisation beim Wechsel von Presets gewaehrleisten.

**Teilphasen (Agent A):**

- [ ] **16.1 Preset-Datenmodell (`src/core/config/Presets.js` oder `SettingsManager.js`)**
  - Definition der drei Presets (`Arcade`, `Competitive`, `Chaos`).
  - Methode zum sauberen Ueberschreiben der aktiven Settings.
- [ ] **16.2 UI-Binding (`src/ui/MenuController.js` & `SettingsStore.js`)**
  - Buttons im HTML/DOM integrieren (falls noetig in `index.html` oder dynamisch).
  - Klick-Handler, der das Preset laedt und `SettingsStore` / `UIManager` benachrichtigt.
- [ ] **16.3 Event-Sync ausloesen**
  - Sicherstellen, dass die in Phase 13 gebauten selektiven Change-Events (`UI_SETTINGS_CHANGED`) gefeuert werden.
- [ ] **16.4 Profile-Vorarbeiten (optional aus V7)**
  - Flag "Aktuelles Profil ist Custom" vs "Ist Preset X", um UI-Feedback zu geben.

---

## Phase 17: Validierung & Test-Erweiterung (Agent B - QA)

**Ziele:**

1. Parallele Bereitstellung von Playwright-Tests fuer die neu gebauten Presets.
2. Absicherung, dass Preset-Wechsel keine bestehenden Settings korrumpieren.

**Teilphasen (Agent B):**

- [ ] **17.1 Test-Setup `tests/ui.spec.js` (falls vorhanden) oder `tests/settings.spec.js`**
  - Boilerplate fuer Preset-TestFaelle vorbereiten.
- [ ] **17.2 State-Validierung (Integritaetstests)**
  - Test: Klick auf "Arcade" -> Pruefen ob intern die `SettingsManager` Werte uebereinstimmen.
  - Test: Klick auf "Competitive" -> Pruefen ob Slider im HTML korrekt springen.
- [ ] **17.3 UI-Toast/Feedback Test**
  - Test: Wird ein Toast "Preset Competitive geladen" angezeigt?
- [ ] **17.4 Regression Test**
  - Pruefen ob manuelles Aendern eines Sliders (nachdem ein Preset geladen wurde) das Preset auf "Custom" oder aehnlich aendert.

---

## Koordinations-Gates zwischen Agent A und B

- **Gate 1:** Phase 17.1 kann sofort durch Agent B gestartet werden (Stubbing).
- **Gate 2:** Phase 17.2 setzt voraus, dass Agent A Phase 16.1 und 16.2 (`[x]`) abgeschlossen hat.
- **Gate 3:** Phase 17.3 und 17.4 koennen nach 16.3 passieren.

Diese Aufteilung erfuellt die Kriterien: 2-5 Dateien pro Schritt, keine Konflikte (Agent A schreibt App-Code, Agent B schreibt Playwright-Test-Code).
