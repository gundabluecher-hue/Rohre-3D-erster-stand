# Phase 9: Modularisierung UI & Settings (main.js Split)

**Goal:** Aufteilung der ueberladenen `main.js` in fokussierte Module (`SettingsManager`, `ProfileManager`, `MenuController`), ohne die Game-Loop-Logik zu zerbrechen. Dadurch wird die Wartbarkeit massiv verbessert.

**Affected files:**

- `src/core/main.js` (wird verkleinert)
- `src/core/SettingsManager.js` (NEW)
- `src/core/ProfileManager.js` (NEW)
- `src/ui/MenuController.js` (NEW)

## Phasen

### [x] Phase 9.1: SettingsManager extrahieren

- **Aufgabe:** Auslagern der Default-Settings, des LocalStorage Ladens/Speicherns (`_loadSettings`, `_saveSettings`, `_sanitizeSettings`) und der Input-Normalisierung.
- **Umbau:** `main.js` instanziiert den `SettingsManager` und reicht ihn bei Bedarf weiter.
- **Verifikation:** `npm run dev` starten, Settings aufrufen, aendern, Seite refreshen -> Werte muessen erhalten bleiben. `npm run test` falls Unit-Tests existieren.

### [x] Phase 9.2: ProfileManager extrahieren

- **Aufgabe:** Auslagern der Profil-Verwaltung (`_loadProfiles`, `_saveProfiles`, `_normalizeProfileName`, Finden des aktiven Profils).
- **Umbau:** Verbindung zwischen `main.js` und dem neuen `ProfileManager` herstellen.
- **Verifikation:** Neues Profil anlegen, aktivieren, neuladen -> Neues Profil muss aktiv bleiben.

### [ ] Phase 9.3: MenuController extrahieren

- **Aufgabe:** Auslagern des kompletten kritischen DOM-Bindings (Event-Listener fuer Buttons, Slider, Checkboxen, Panels aus-/einblenden) in `MenuController.js`.
- **Umbau:** `MenuController` sendet Events oder ruft Callbacks in `main.js` (StartMatch, ReturnToMenu) auf. Die Settings-Slider sprechen direkt mit dem `SettingsManager`.
- **Verifikation:** Manueller End-to-End Test des kompletten Main-Menues, aller Untermenues, Einstellungs-Aenderungen und anschliessendem fehlerfreien Spielstart.
