# Feature: Menu Ebenen Follow-up (V26.3b)

Stand: 2026-03-06
Status: Geplant
Owner: Single-Agent Umsetzung

## Ziel

Das Hauptmenue wird auf einen klaren 4-Ebenen-Flow umgestellt:

1. Ebene 1: Session-Typ waehlen (`Single Player`, `Multiplayer`, `Splitscreen`)
2. Ebene 2: Spielweg waehlen (`Schnellstart`, `Arcade`, `Fight`, `Normal`)
3. Ebene 3: Start-Setup (`Map`, `Flugzeug`, `Hell/Dunkel`) plus sichtbarer `Starten`-Button
4. Ebene 4: Untermenue von Ebene 3 fuer `Steuerung`, `Gameplay-Feineinstellungen`, `Erweiterte Map-Optionen` und `Tools`

Produktziel:

- Ein Match muss schnell startbar bleiben.
- Die vielen Einstellmoeglichkeiten bleiben verfuegbar, aber werden aus dem schnellen Hauptpfad herausgenommen.
- Multiplayer bleibt technisch Stub, wird aber im gleichen Flow kompakt vorbereitet statt als eigener paralleler Menuezweig.
- Bestehende Menuepunkte werden nicht ersatzlos gestrichen, sondern sinnvoll in Ebene 4 oder den Developer-Pfad umgehangen.
- Button-Texte und Panel-Namen sollen spaeter ohne erneuten Strukturumbau aenderbar sein.
- Nutzer sollen auf allen Ebenen den aktuellen Stand sofort sehen koennen, ohne mentale Rueckspruenge.
- Die Konfiguration soll sich schnell anfuehlen, auch wenn der Nutzer oft zwischen `single`, `splitscreen` und `multiplayer` wechselt.

## Produktentscheidungen fuer den Follow-up

1. `Session-Typ` wird als eigener Menue-/Settings-Wert gefuehrt (`single`, `multiplayer`, `splitscreen`) und nicht mehr nur indirekt ueber `mode=1p/2p` modelliert.
2. `Multiplayer` bleibt in V26.3b ein UI-/Lifecycle-Stub und startet keine echte Netzwerksession.
3. `Fight` mappt intern auf den vorhandenen Kampfpfad `HUNT`.
4. `Arcade` nutzt den vorhandenen Fixed-Preset-Pfad (`arcade`) als Schnellvorlage.
5. `Normal` bedeutet `CLASSIC` ohne erzwungenes Preset.
6. `Schnellstart` wird in zwei direkte Aktionen aufgeteilt:
   - `Letzte Einstellungen starten`
   - `Random Map starten`
7. `Hell/Dunkel` wird als lokales UI-/Darstellungs-Setting in `LocalSettings` gefuehrt.
8. Bisherige Punkte `Profile`, `Preset-Verwaltung`, `Map-Editor`, `Vehicle-Editor`, `Portal-/Ebenen-Details` bleiben erhalten und wandern nach Ebene 4 in `Tools` oder `Erweiterte Map-Einstellungen`.
9. `Debug / Info` wird aus dem Spieler-Hauptfluss herausgenommen und nur noch ueber den Developer-Modus oder einen owner-only Pfad erreichbar gemacht.
10. Der `Developer-Modus` bleibt owner-only, ist per Feature-Flag deaktivierbar und enthaelt zusaetzlich UI-Textpflege fuer Button- und Panel-Namen.
11. Button-Texte und Panel-Bezeichnungen werden in einen zentralen Textkatalog gezogen; der Developer-Modus darf darauf lokale Overrides setzen.
12. Texte im Katalog erhalten stabile IDs im Stil `menu.level2.arcade.label`, damit UI-Texte geaendert werden koennen, ohne DOM- oder Test-Selektoren zu brechen.
13. Ebene 2 trennt visuell und semantisch zwischen `Schnellaktionen` und `Modi`.
14. Auswahl von `Arcade`, `Fight` oder `Normal` befuellt Ebene 3 direkt mit sinnvollen Defaults statt leer zu starten.
15. Ebene 3 enthaelt immer eine feste, kompakte Auswahl-Zusammenfassung (`Session-Typ | Modus | Map | Flugzeug | Theme`).
16. Ebene 3 zeigt `Zuletzt benutzt` und `Favoriten` fuer Map und Flugzeug.
17. `Hell/Dunkel` wird in Ebene 3 explizit als `lokal` gekennzeichnet; Match-relevante Felder werden separat markiert.
18. `Splitscreen` zeigt in Ebene 3 direkt ein kompaktes Loadout fuer `P1` und `P2`.
19. `Multiplayer` hat in Ebene 3 zwei definierte UI-Zustaende:
   - `nicht in Lobby`
   - `in Lobby`
20. Start-Validierung zeigt bei unvollstaendigen Angaben den Grund an und springt per Aktion direkt zum betroffenen Feld.
21. `Tools` werden visuell klar vom Kern-Startpfad getrennt.
22. Der `Developer-Modus` bekommt einen echten `Release-Schnitt`: Wenn deaktiviert, werden Panel, Debug-Hinweise und Text-Overrides voll ignoriert.
23. Ebene 4 ist kein eigener Parallelpfad in der Hauptnavigation, sondern ein Untermenue oder Slide-in ab Ebene 3.
24. Der `Starten`-Button lebt nur noch auf Ebene 3.
25. Jede Ebene bekommt einen eigenen Reset-Pfad statt nur globalem Komplett-Reset.
26. Entwuerfe werden getrennt pro `sessionType` gepuffert, damit Wechsel zwischen `single`, `splitscreen` und `multiplayer` keine Konfiguration ueberschreiben.
27. Konflikte und Sperren werden direkt am betroffenen Feld angezeigt, nicht nur als globale Fehlermeldung.
28. Empfohlene Kombinationen werden als Presets bzw. Standard-Kombinationen modelliert, nicht nur als lose Badges.
29. Map- und Flugzeugauswahl erhalten Suche und Filter.
30. Ebene 3 bekommt eine Mini-Vorschau fuer Map und Flugzeug.
31. Aktuelle Konfiguration kann als kurzer Code oder importierbares/exportierbares JSON gesichert werden.
32. Der Developer-Modus bekommt zusaetzlich eine `Release-Vorschau`, die den deaktivierten Release-Zustand simuliert.
33. Waehrend der Entwicklung werden Menuetelemetrie-Daten fuer Abbrueche, Rueckspruenge und Schnellstart-Nutzung gesammelt.

## Architektur-Check

- Reuse:
  - `MenuController`, `MenuNavigationRuntime`, `UIManager`, `SettingsManager`, Preset-Store und Lifecycle-Bridge bleiben die Hauptanker.
  - Vorhandene DOM-IDs fuer Controls, Vehicles und Multiplayer-Stubs sollen soweit moeglich erhalten bleiben.
- Umbau:
  - Primaere Navigation wird auf Session-Auswahl reduziert.
  - Bisherige Panels `Quickstart/Custom/Settings/Controls/Portals` werden auf die neue Ebenenlogik umgeordnet.
  - `LocalSettings` braucht zusaetzlich UI-State fuer `sessionType`, `themeMode` und spaetere Text-Overrides.
  - `SettingsManager` und `RuntimeConfig` brauchen einen klaren Uebergang von `sessionType` auf die bestehende Runtime-Welt (`numHumans`, Multiplayer-Stub, Splitscreen).
  - Bestehende Legacy-Menuepunkte muessen in `Tools`, `Erweiterte Map-Einstellungen` und `Developer` umsortiert werden statt zu entfallen.
  - Ein zentraler UI-Textkatalog plus Override-Store wird benoetigt, damit Button-Namen spaeter im Developer-Modus aenderbar bleiben.
  - Entwurfs-, Reset-, Import/Export- und Telemetriepfade muessen getrennt vom eigentlichen Runtime-Settings-Apply bleiben.
  - Das Datenmodell trennt sauber:
    - `sessionType`
    - `modePath` bzw. Spielweg (`quick_action`, `arcade`, `fight`, `normal`)
    - `startSetup`
    - `toolsState`
    - `draftStateBySessionType`
    - `telemetryState`
  - Ebene 4 wird als untergeordneter UI-State von Ebene 3 gebaut, nicht als separater Top-Level-State.
  - Controller- und Tastatur-Navigation muessen pro Ebene definiert werden (`Enter`, `Escape`, `Zurueck`, Fokusreihenfolge, optional D-Pad/Schultertasten).
- Risiko: `medium`
  - Grund: UI-Flow, DOM-Selektoren und Menuetests werden gleichzeitig beruehrt.
  - Zusatzrisiko: im Worktree existieren bereits uncommitted Aenderungen in `tests/core.spec.js`, die vor der Implementierung sauber mit dem neuen Scope abgeglichen werden muessen.

## Betroffene Dateien

- `index.html`
- `style.css`
- `src/core/GameBootstrap.js`
- `src/core/SettingsManager.js`
- `src/core/RuntimeConfig.js`
- `src/ui/UIManager.js`
- `src/ui/MenuController.js`
- `src/ui/menu/MenuSchema.js`
- `src/ui/menu/MenuNavigationRuntime.js`
- `src/ui/menu/MenuStateMachine.js`
- `src/ui/menu/MenuStateContracts.js`
- `src/ui/menu/MenuGameplayBindings.js`
- `src/ui/menu/MenuCompatibilityRules.js`
- `src/ui/menu/MenuDeveloperModeOps.js`
- `src/ui/menu/MenuAccessPolicy.js`
- `src/ui/menu/MenuTextCatalog.js`
- `src/ui/menu/MenuTextOverrideStore.js`
- `src/ui/menu/MenuTextRuntime.js`
- `src/ui/menu/MenuDraftStore.js`
- `src/ui/menu/MenuTelemetryStore.js`
- `src/ui/menu/MenuConfigShareOps.js`
- `src/ui/menu/MenuPreviewCatalog.js`
- `src/ui/menu/MenuPresetCatalog.js`
- `tests/helpers.js`
- `tests/core.spec.js`
- `tests/stress.spec.js`
- `docs/Feature_Menu_Umbau_V26_3.md`
- `docs/Umsetzungsplan.md`

## Umsetzungsphasen

- [ ] 26.3b.0 Baseline und UX-Freeze
  - Aktuellen Ist-Flow gegen den gewuenschten 4-Ebenen-Flow festziehen.
  - Panel-Mapping fixieren:
    - Ebene 1 = Hauptnavigation
    - Ebene 2 = Spielweg
    - Ebene 3 = Start-Setup
    - Ebene 4 = Feineinstellungen
  - Datenmodell-Freeze festziehen:
    - `sessionType`
    - `modePath`
    - `startSetup`
    - `toolsState`
    - `draftStateBySessionType`
    - `telemetryState`
  - Entscheidung dokumentieren, wie alle bisherigen Menuepunkte neu einsortiert werden:
    - `Profile`
    - `Preset-Verwaltung`
    - `Map-Editor`
    - `Vehicle-Editor`
    - `Portale / Ebenen`
    - `Debug / Info`
    - `Developer`

- [ ] 26.3b.1 Session-Level (Ebene 1) einziehen
  - Hauptnavigation auf `Single Player`, `Multiplayer`, `Splitscreen` reduzieren.
  - `sessionType` als eigenen Menue-State und Settings-Vertrag verankern.
  - Migration definieren: `single -> mode=1p`, `splitscreen -> mode=2p`, `multiplayer -> mode=1p oder spaeterer Runtime-Stub`.
  - `Multiplayer`-Stub so verschieben, dass er nicht mehr als eigener Hauptfluss konkurriert.
  - Pro Session-Typ die sichtbaren Felder fuer Ebene 3 definieren.
  - Session-Wechsel laedt und speichert getrennte Entwuerfe pro Pfad.

- [ ] 26.3b.2 Spielweg-Level (Ebene 2) bauen
  - Ebene 2 visuell in `Schnellaktionen` und `Modi` aufteilen.
  - Ebene 2 als klarer Auswahlbildschirm fuer:
    - `Letzte Einstellungen starten`
    - `Random Map starten`
    - `Arcade`
    - `Fight`
    - `Normal`
  - `Arcade/Fight/Normal` muessen sauber auf Runtime/Preset/GameMode gemappt werden.
  - `Schnellstart` darf ohne weiteren Menue-Sprung starten.
  - `Fight` bleibt intern `HUNT`, ohne dass der UI-Name technische Begriffe tragen muss.
  - Jede Moduswahl setzt gute Defaults fuer Ebene 3 vorab.
  - Empfohlene Standard-Kombinationen werden als konkrete Presets modelliert und hier angebunden.

- [ ] 26.3b.3 Start-Setup-Level (Ebene 3) bauen
  - Ebene 3 mit `Map`, `Flugzeug`, `Hell/Dunkel`, kompakter Session-Zusammenfassung und `Starten`.
  - Die Zusammenfassung bleibt immer sichtbar.
  - `Map` und `Flugzeug` erhalten `Zuletzt benutzt` und `Favoriten`.
  - `Map` und `Flugzeug` erhalten Suche und Filter.
  - Map- und Flugzeugwahl zeigen eine kompakte Mini-Vorschau.
  - `Hell/Dunkel` wird klar als `lokal` markiert; Match-Einstellungen werden separat markiert.
  - `Splitscreen` zeigt direkt `Flugzeug P1` und `Flugzeug P2`.
  - `Multiplayer` zeigt hier zusaetzlich kompakte Lobby-Stub-Elemente (`Host/Join/Ready/Code`) statt eigenem Hauptpanel.
  - `Multiplayer` bekommt die klaren Zustandsbilder `nicht in Lobby` und `in Lobby`.
  - Ruecksprung zu Ebene 2 und Einstieg in Ebene 4 muessen eindeutig bleiben.
  - `Starten` startet immer von Ebene 3; Ebene 4 darf nie der einzige Weg zum Matchstart sein.
  - Ebene 3 bekommt einen Reset nur fuer diese Ebene.

- [ ] 26.3b.4 Feineinstellungen-Level (Ebene 4) konsolidieren
  - Ebene 4 als Untermenue oder Slide-in von Ebene 3 aufbauen, nicht als harter Vollwechsel.
  - `Steuerung` und `Gameplay-Feineinstellungen` in einem Untermenue ab Ebene 3 zusammenfuehren.
  - Bisherige Controls-/Settings-/Portal-Feintuning-Elemente hier logisch gruppieren.
  - Bereich `Erweiterte Map-Einstellungen` fuer `Portale / Ebenen`.
  - Bereich `Tools` fuer `Profile`, `Preset-Verwaltung`, `Map-Editor`, `Vehicle-Editor`.
  - `Tools` visuell und interaktionell klar vom Kern-Startpfad absetzen.
  - Ebene 4 bekommt Bereichs- oder Ebenen-Reset statt nur globalem Reset.
  - `Tools` enthalten auch Import/Export fuer Konfigurations-Code bzw. JSON.

- [ ] 26.3b.5 Developer-Modus und Textkatalog erweitern
  - Bestehenden owner-only `Developer-Modus` in den neuen Flow ueberfuehren statt entfernen.
  - Zentralen Textkatalog fuer Buttons, Paneltitel und Hilfetexte einfuehren.
  - Stabile Text-IDs fuer alle katalogisierten Menuetexte definieren.
  - Lokale Developer-Overrides fuer UI-Texte ermoeglichen.
  - Release-Pfad absichern: Feature-Flag kann Developer-Modus, Debug-Hinweise und Text-Overrides voll deaktivieren.
  - Zusaetzlich `Release-Vorschau` im Developer-Modus anbieten.
  - Entwicklungs-Telemetrie fuer Menuenutzung sichtbar machen.

- [ ] 26.3b.6 Startlogik, Defaults und Kompatibilitaet nachziehen
  - Defaults auf schnellen Start ausrichten.
  - Start-Validierung an Ebene 3 koppeln.
  - Validierung zeigt Grund und bietet direkten Sprung zur betroffenen Stelle.
  - Konflikte und Sperren werden direkt am betroffenen Feld markiert.
  - Kompatibilitaetsregeln fuer `sessionType`, `Fight/Hunt`, `Random-Map`, `Hell/Dunkel` und Tools-Zugaenge nachziehen.
  - A11y erhalten: Fokus, Escape, Arrow-Navigation, ARIA-Status.
  - Controller-/Keyboard-Navigation pro Ebene absichern.

- [ ] 26.3b.7 Tests fuer neuen Menuefluss anpassen
  - `tests/helpers.js` auf neuen Level-Flow umbauen.
  - `tests/core.spec.js` auf neue Selektoren und Startpfade aktualisieren.
  - `tests/stress.spec.js` fuer schnelle Start/Zurueck-Zyklen im neuen Flow stabilisieren.
  - Tests fuer `Developer-Modus`, Textkatalog-Overrides und deaktivierten Release-Zustand ergaenzen.
  - Tests fuer per-Ebene-Reset, Drafts pro Session-Typ, Suche/Preview, Config-Import/Export und Telemetrie-Daten ergaenzen.

- [ ] 26.3b.8 Abschluss-Gate und Dokumentation
  - Betroffene Feature-Dokus aktualisieren.
  - `npm run docs:sync`
  - `npm run docs:check`

## Verifikation

- Nach 26.3b.2:
  - `npm run test:core`
- Nach 26.3b.5:
  - `npm run test:core`
- Nach 26.3b.6:
  - `npm run test:core`
  - gezielte Browser-Pruefung des neuen Flow
  - gezielte Browser-Pruefung fuer Feldkonflikte, Ebenen-Reset und Session-Drafts
- Nach 26.3b.7:
  - `npm run test:core`
  - `npm run test:stress`
  - gezielte Browser-Pruefung fuer Keyboard-/Controller-Navigation, Developer-Off-State, Preset-Standardkombinationen, Config-Import/Export und schnelle Starts
- Abschluss:
  - `npm run build`
  - `npm run docs:sync`
  - `npm run docs:check`

## Doku-Impact

Bei Implementierung muessen danach mindestens geprueft oder aktualisiert werden:

- `docs/Feature_Menu_Umbau_V26_3.md`
- `docs/Umsetzungsplan.md`
- `docs/ai_architecture_context.md` nur falls Vertrage/Panel-Zustaende sich strukturell aendern
- `docs/Dokumentationsstatus.md` indirekt ueber `docs:sync`
