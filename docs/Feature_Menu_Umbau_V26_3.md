# Feature: V26.3 - Menue-Umbau (modular, Multiplayer-ready, Developer-Modus)

Stand: 2026-03-06  
Status: Abgeschlossen (26.3.0-26.3.9)  
Owner: Single-Agent Umsetzung

## Ableitung

- Produktableitung basiert auf `menu_anleitung_v2.md` (2026-03-05) mit Fokus auf:
  - Progressive Disclosure (`Quickstart` + `Benutzerdefiniert`)
  - klare Trennung von `MatchSettings`, `PlayerLoadout`, `LocalSettings`
  - vorbereitete Host/Client-Logik fuer spaetere Online-Lobby

## Festgelegte Produktentscheidungen (fixiert am 2026-03-05)

1. Multiplayer ist ein eigener Hauptpunkt in der Hauptnavigation.
2. Developer-Modus ist owner-kontrolliert und spaeter fuer Spieler sperrbar.
3. Preset-Modell ist zweigeteilt:
   - `fixed presets` (vom Owner erstellt, nicht frei editierbar)
   - `open presets` (von Spielern erstellt und bearbeitbar)

## Ziel

Das Hauptmenue wird in eine klar modulare, leicht erweiterbare Struktur ueberfuehrt, sodass:
- neue Menuepunkte/Untermenues ohne grosse Querschnittsaenderungen eingebaut werden koennen,
- ein Multiplayer-Einstiegspunkt bereits vorhanden ist (inkl. technischer Anbindungspunkte),
- ein Developer-Modus fuer UI-Iteration verfuegbar ist (Schrift/Theming, Fixed-Preset, Debug-Hinweise).

## Produktziele (funktional)

- Menue-Informationsarchitektur aufraeumen (klarere Einstiegswege, geringere Klicktiefe).
- Zwei-Ebenen-UX einziehen:
  - `Quickstart`: sofort spielen, zuletzt genutzt, Preset-Kacheln
  - `Benutzerdefiniert`: klickbarer Stepper mit modularen Panels
- V6-Schnellpresets (`Arcade`, `Competitive`, `Chaos`) integrieren.
- Multiplayer-Menuepfad vorbereiten:
  - Host/Join/Local-Lobby UI-Stubs
  - Event-Vertrag zur spaeteren Runtime-/Netzwerk-Anbindung
  - sauberer Fallback, solange Multiplayer-Gameplay noch nicht aktiv ist
- Developer-Modus integrieren:
  - UI-Schriftstil umschaltbar (ueber CSS-Variablen/Themes)
  - Fixed-Preset (Preset sperren, manuelle Aenderungen optional blockieren)
  - sichtbare Dev-Hinweise fuer Test-/Balancing-Durchlaeufe
- Settings-Domaenen konsequent trennen:
  - `MatchSettings` (host-kontrolliert)
  - `PlayerLoadout` (pro Spieler)
  - `LocalSettings` (nur lokal, z. B. Keybinds/HUD)

## Nicht-Ziele

- Keine echte Online-/Netzwerk-Implementierung (Matchmaking, Replikation, Netcode) in V26.3.
- Kein Rework von Ingame-HUD oder Render-Hotpaths.
- Kein erzwungener Umbau aller bestehenden Menue-Controls auf einmal (iterativ, kompatibel).

## Architektur-Check (Ist -> Soll)

- Ist:
  - Navigation und Panel-Sichtbarkeit liegen in `src/ui/UIManager.js`.
  - Action-Events laufen ueber `src/ui/MenuController.js` und `src/ui/menu/*Bindings.js`.
  - UI-Refs werden zentral in `src/core/GameBootstrap.js` gesammelt.
- Soll:
  - Datengetriebener Menue-Aufbau mit separatem Panel-/Action-Registry-Layer.
  - Klare Trennung:
    - Navigation/Panel-State
    - Preset-Logik
    - Multiplayer-Bridge
    - Developer-Mode State/UI
    - Access-Control-Policy (`public`, `owner_only`, `locked`)
    - Kompatibilitaetsregeln (Tags + Auto-Anpassung)
  - Bestehende IDs/Flows bleiben waehrend Migration kompatibel (kein Big-Bang).

## Betroffene Dateien (geplant)

Bestehend:
- `index.html`
- `style.css`
- `src/core/GameBootstrap.js`
- `src/core/main.js`
- `src/core/SettingsManager.js`
- `src/ui/MenuController.js`
- `src/ui/UIManager.js`
- `src/ui/SettingsChangeKeys.js`
- `src/ui/UISettingsSyncMap.js`
- `src/ui/SettingsStore.js`
- `tests/core.spec.js`
- `tests/stress.spec.js`
- `tests/helpers.js`
- `docs/Umsetzungsplan.md`
- `docs/ai_architecture_context.md`

Neu (Zielbild, modular):
- `src/ui/menu/MenuSchema.js`
- `src/ui/menu/MenuPanelRegistry.js`
- `src/ui/menu/MenuNavigationRuntime.js`
- `src/ui/menu/MenuStateMachine.js`
- `src/ui/menu/MenuStateContracts.js`
- `src/ui/menu/MenuAccessPolicy.js`
- `src/ui/menu/MenuCompatibilityRules.js`
- `src/ui/menu/MenuPresetCatalog.js`
- `src/ui/menu/MenuPresetApplyOps.js`
- `src/ui/menu/MenuPresetStore.js`
- `src/ui/menu/MenuMultiplayerBridge.js`
- `src/ui/menu/MenuDeveloperModeOps.js`
- `src/ui/menu/MenuDeveloperThemeCatalog.js`
- optional: `src/ui/menu/MenuDevPanelBindings.js`

## Verbindliche Leitplanken (Ergaenzung 2026-03-05)

- Datenvertrag `MatchSettings` / `PlayerLoadout` / `LocalSettings` mit `schemaVersion` ist Pflicht.
- Presetvertrag ist fix: `id`, `kind`, `ownerId`, `lockedFields`, `sourcePresetId`, `createdAt`, `updatedAt`.
- Access-Policy wird doppelt erzwungen: UI-Sichtbarkeit + Event-Guard im Runtime-Handler.
- Feature-Flags werden zentral gepflegt (`menuV26Enabled`, `multiplayerStubEnabled`, `developerModeEnabled`, `allowOpenPresetEditing`).
- Kompatibilitaetsregeln laufen deterministisch (Prioritaet + Auto-Fix-Strategie dokumentiert).
- Menuefluss nutzt eine explizite State-Machine statt verteilter Bool-Flags.
- Accessibility-Minimum ist Pflicht: Keyboard-only, Fokussteuerung, ARIA-Status, Kontrast.
- DoD wird nur erreicht, wenn Event-Contract-, Rechte- und Accessibility-Tests gruen sind.

## Parallelbetrieb mit V29 (kollisionsfrei)

- Ziel: V26.3 (Menu/UI) und V29 (Cinematic/Recording) sollen parallel umsetzbar bleiben.
- V26.3 besitzt primaer:
  - `index.html`, `style.css`, `src/ui/**`, `src/ui/menu/**`, `src/ui/Settings*`, `tests/core.spec.js`, `tests/stress.spec.js`.
- V29 besitzt primaer:
  - `src/core/MediaRecorderSystem.js`, `src/entities/systems/CinematicCameraSystem.js`, ggf. kamera-/rendernahe Verdrahtung.
- Shared-Schnittstelle (zulassige Ueberlappung):
  - Lifecycle-Events in `src/core/main.js` oder dedizierter Event-Bridge.
  - Event-Contract fix: `match_started`, `match_ended`, `menu_opened`, optional `recording_requested`.
- Regel:
  - Kein V29-UI-Toggle in V26.3 Kernphasen 26.3.0-26.3.8.
  - Falls UI-Toggle fuer Recording gewuenscht ist, nur als eigenes Sub-Ticket nach 26.3.9.

## Phasenplan (Single-Agent)

- [x] 26.3.0 Baseline, UX-Freeze und Migrationsleitplanken (abgeschlossen 2026-03-05)
  - Ziele:
    - Ist-Menuepfade dokumentieren (Startflow, Untermenues, ESC-Rueckweg, Profile).
    - Kompatibilitaetsmatrix `alte IDs` vs `neue Registry` festlegen.
  - Baseline Freeze (2026-03-05):
    - Startflow: `#menu-nav [data-submenu="submenu-game"] -> #btn-start` bleibt als Kompatibilitaetspfad aktiv.
    - ESC-Rueckweg: `Escape` fuehrt aus Match zurueck ins Menue (`main-menu` sichtbar, Hauptnavigation aktiv).
    - Profilpfad: `submenu-profiles` mit `btn-profile-save/load/delete` bleibt waehrend Migration unveraendert erreichbar.
  - Kompatibilitaetsmatrix (Alt -> Registry Alias):
    - `submenu-game` -> `quickstart` (Alias bleibt aktiv)
    - `submenu-settings` -> `custom.settings`
    - `submenu-controls` -> `custom.controls`
    - `submenu-profiles` -> `custom.profiles`
    - `submenu-portals` -> `custom.portals`
    - `submenu-debug` -> `debug`
  - Verifikation:
    - `npm run test:core`
    - `npm run test:stress`
  - Exit:
    - Baseline dokumentiert; Migration ohne Big-Bang moeglich.

- [x] 26.3.1 Menue-Schema und Panel-Registry einfuehren (abgeschlossen 2026-03-05)
  - Ziele:
    - Datengetriebenes Panel-/Nav-Schema (`id`, `label`, `icon`, `visibility`, `order`, `accessPolicy`) einfuehren.
    - Registry fuer Panel-Metadaten + Lookup-API bereitstellen.
    - Zwei Ebenen (`quickstart`, `custom`) inkl. klickbarer Stepper-Definition einziehen.
    - Settings-Domaenen (`MatchSettings`, `PlayerLoadout`, `LocalSettings`) in Schema verankern.
    - Versionierte State-Contracts (`schemaVersion`) einfuehren.
  - Hauptpfade:
    - `src/ui/menu/MenuSchema.js`
    - `src/ui/menu/MenuPanelRegistry.js`
    - `src/ui/menu/MenuStateContracts.js`
    - `src/ui/menu/MenuAccessPolicy.js`
    - `src/core/GameBootstrap.js` (Refs behutsam erweitern)
  - Umsetzung:
    - Datengetriebenes `menu-schema.v1` mit Panel-Metadaten, Quickstart/Custom/Multiplayer/Developer-Level und Alt-ID-Aliasen eingebracht.
    - Versionierte Contracts fuer `MatchSettings`/`PlayerLoadout`/`LocalSettings` inkl. `schemaVersion` und Feature-Flags in `SettingsManager` erzwungen.
    - Panel-Registry in `UIManager` angebunden, sodass Kontextlabels ueber Registry statt nur DOM-Text aufgeloest werden.
  - Verifikation:
    - `npm run test:core`
  - Exit:
    - UI kann Panel-Informationen ueber Registry statt harter Query-Ketten beziehen.

- [x] 26.3.2 Navigation aus UIManager entkoppeln (abgeschlossen 2026-03-05)
  - Ziele:
    - Navigation/Panel-Sichtbarkeit nach `MenuNavigationRuntime.js` verlagern.
    - `UIManager` auf Sync/Context/Toast-Fokus reduzieren.
    - State-Machine fuer Hauptpfade (`quickstart`, `custom`, `multiplayer`, `developer`) einfuehren.
  - Hauptpfade:
    - `src/ui/UIManager.js`
    - `src/ui/menu/MenuNavigationRuntime.js`
    - `src/ui/menu/MenuStateMachine.js`
  - Umsetzung:
    - Navigation/Panel-Sichtbarkeit nach `MenuNavigationRuntime` verschoben (inkl. Escape-/Pfeiltasten-Fokuslogik und ARIA-States).
    - Explizite State-Machine fuer `main/quickstart/custom/multiplayer/developer/debug` eingefuehrt.
    - `UIManager` auf Sync, Context-Status und Toasts reduziert; Navigation laeuft ueber Runtime-Fassade.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:stress`
  - Exit:
    - Untermenue-Navigation laeuft ueber dedizierte Runtime, API bleibt stabil.

- [x] 26.3.3 Schnellpreset-System produktiv aufbauen (V6) (abgeschlossen 2026-03-05)
  - Ziele:
    - `Arcade`, `Competitive`, `Chaos` zentral katalogisieren.
    - Preset-Anwendung als pure Ops (inkl. Delta/Changed-Keys) einfuehren.
    - Presets in zwei Klassen trennen: `fixed presets` (owner) und `open presets` (player).
    - UI-Rueckmeldung (`geladen`, `custom`, `fixed`, `open`) standardisieren.
    - Preset-Metadatenvertrag (`id/kind/ownerId/lockedFields/sourcePresetId/createdAt/updatedAt`) durchziehen.
  - Hauptpfade:
    - `src/ui/menu/MenuPresetCatalog.js`
    - `src/ui/menu/MenuPresetApplyOps.js`
    - `src/ui/menu/MenuPresetStore.js`
    - `src/core/SettingsManager.js`
    - `src/ui/SettingsChangeKeys.js`
    - `src/ui/UISettingsSyncMap.js`
    - `src/ui/MenuController.js`
  - Umsetzung:
    - V6-Katalog (`Arcade`, `Competitive`, `Chaos`) als `fixed presets` mit Metadatenvertrag eingefuehrt.
    - Pure Apply-Ops + Preset-Store fuer `fixed/open` Presets integriert (inkl. Contract-Felder `id/kind/ownerId/lockedFields/sourcePresetId/createdAt/updatedAt`).
    - Runtime-Handling in `GameRuntimeFacade` verdrahtet (`preset_apply/save/delete`) und selektive UI-Sync-Keys fuer Preset-Status erweitert.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:stress`
  - Exit:
    - Presets sind konsistent anwendbar, UI-Sync bleibt selektiv und stabil.

- [x] 26.3.4 Multiplayer-Menuepfad als anbindbare Bridge vorbereiten (abgeschlossen 2026-03-05)
  - Ziele:
    - Multiplayer als eigenen Hauptnavigationseintrag implementieren.
    - Neues Multiplayer-Untermenue (Host/Join/Lobby-Stub) in Menuestruktur aufnehmen.
    - Ereignisse als klaren Vertrag emittieren (z. B. `multiplayer_host`, `multiplayer_join`, `multiplayer_ready_toggle`).
    - No-op Default-Bridge mit klaren Statusmeldungen, solange Runtime nicht implementiert ist.
    - Dirty-State-Regel vorbereiten: Host-Aenderungen markieren Ready-Status als invalid.
    - Event-Contract versionieren und dokumentieren (`v1` Payload-Felder + Fallbacks).
    - Kollision vermeiden: keine Kamera-/Recording-Logik aus V29 im Menue-Flow verdrahten.
  - Hauptpfade:
    - `index.html`
    - `src/ui/MenuController.js`
    - `src/ui/menu/MenuMultiplayerBridge.js`
    - `src/core/main.js` (Event-Handling/Toasts)
  - Umsetzung:
    - Multiplayer als eigener Hauptpunkt (`submenu-multiplayer`) in der Hauptnavigation integriert.
    - `MenuMultiplayerBridge` mit versioniertem Event-Contract (`lifecycle.v1`) und `host/join/ready` Stub-Events eingefuehrt.
    - Lifecycle-Routing in `main.js` ergaenzt; Host-Settings aendern Ready-Status deterministisch (`multiplayer_ready_invalidated`).
  - Verifikation:
    - `npm run test:core`
    - `npm run test:stress`
  - Exit:
    - Multiplayer-Menue ist sichtbar nutzbar, erzeugt aber keine Runtime-Regression.

- [x] 26.3.5 Developer-Modus einziehen (UI-Fonts, Fixed-Preset, Debug-Hinweise) (abgeschlossen 2026-03-05)
  - Ziele:
    - Developer-Modus per Access-Policy owner-only aktivierbar.
    - Sperrmodus vorbereiten, damit spaeter Spielerzugriff deaktiviert werden kann.
    - Zugriffskonzept: `hidden_for_players`, `owner_only`, `open` als konfigurierbare Modi.
    - Schrift-/Theme-Umschaltung ueber CSS-Variablen und Theme-Katalog.
    - Fixed-Preset-Modus: owner-waehlbar, fuer Spieler read-only.
    - Zugriff nicht nur visuell sperren: Events ohne Owner-Rechte werden zentral abgewiesen.
  - Hauptpfade:
    - `index.html`
    - `style.css`
    - `src/ui/menu/MenuAccessPolicy.js`
    - `src/ui/menu/MenuDeveloperThemeCatalog.js`
    - `src/ui/menu/MenuDeveloperModeOps.js`
    - `src/core/SettingsManager.js`
    - `src/ui/SettingsStore.js`
  - Umsetzung:
    - Developer-Panel (`submenu-developer`) mit owner-kontrollierten Schaltern fuer Mode, Theme, Actor, Visibility-Mode und Fixed-Preset-Lock integriert.
    - Theme-Katalog + Ops eingefuehrt; CSS-Variablen fuer Menu-Look/Fonts jetzt runtime-umschaltbar.
    - Access-Policy doppelt aktiv: UI-Hiding in `MenuNavigationRuntime` und Runtime/Event-Guard in `GameRuntimeFacade`.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:stress`
  - Exit:
    - Dev-UIschalter und Fixed-Preset arbeiten deterministisch, persistieren korrekt.

- [x] 26.3.6 MenuController-Events in Feature-Bindings weiter aufteilen (abgeschlossen 2026-03-05)
  - Ziele:
    - Multiplayer- und Developer-Bindings als eigene Binding-Module trennen.
    - Event-Typen konsistent versionieren/dokumentieren.
  - Hauptpfade:
    - `src/ui/MenuController.js`
    - `src/ui/menu/MenuGameplayBindings.js`
    - `src/ui/menu/MenuProfileBindings.js`
    - `src/ui/menu/MenuControlBindings.js`
    - `src/ui/menu/MenuDevPanelBindings.js` (neu)
  - Umsetzung:
    - Neue Feature-Binding-Fassade `MenuDevPanelBindings` fuer Preset-/Multiplayer-/Developer-Ereignisse eingefuehrt.
    - `MenuGameplayBindings` wieder auf Match-/Settings-Interaktionen fokussiert.
    - `MenuController` emittiert jetzt versionierte Events (`menu-controller.v1`) fuer konsistente Runtime-Vertragspruefung.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:stress`
  - Exit:
    - `MenuController` bleibt Fassade; neue Features sind separiert wartbar.

- [x] 26.3.7 HTML/CSS-Komposition modernisieren (anpassbar, aber kompatibel) (abgeschlossen 2026-03-05)
  - Ziele:
    - Menue-Markup vereinheitlichen (`data-menu-panel`, `data-menu-action`, klare Rollen).
    - CSS in nachvollziehbare Bloecke (layout/panels/controls/dev) strukturieren.
    - Schriftfamilien/Themes ueber zentrale CSS-Variablen steuerbar halten.
    - Bestehende Kern-Selectors fuer Tests waehrend Migration stabil halten.
  - Hauptpfade:
    - `index.html`
    - `style.css`
  - Umsetzung:
    - Markup auf `data-menu-panel`/`data-menu-action` erweitert, ohne bestehende IDs/Selectoren zu brechen.
    - Neue Panels fuer `Benutzerdefiniert` (klickbarer Stepper), `Multiplayer` und `Developer` final in DOM verankert.
    - CSS auf zentrale Theme-Variablen umgestellt (Fonts/Farben/Panel-Look) und fuer neue Panel-Bloecke erweitert.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:stress`
  - Exit:
    - Menue ist leichter anpassbar, bestehende Flows brechen nicht.

- [x] 26.3.8 Testausbau fuer neue Menuepfade (abgeschlossen 2026-03-06)
  - Ziele:
    - Tests fuer Presets (`fixed`/`open`), Multiplayer-Hauptpunkt und Developer-Access ergaenzen.
    - Regressionen der alten Menuepfade absichern.
    - Event-Contract-Tests (Payload, Version, Guarding) und Accessibility-Checks ergaenzen.
  - Hauptpfade:
    - `tests/core.spec.js`
    - `tests/stress.spec.js`
    - `tests/helpers.js`
  - Umsetzung:
    - `tests/helpers.js` um gezielte Submenu-Helper (`openSubmenu`, `openCustomSubmenu`, `openMultiplayerSubmenu`, `openDeveloperSubmenu`) erweitert.
    - `tests/core.spec.js` um neue Menuefaelle `T20c` bis `T20j` erweitert (Multiplayer-Hauptpunkt, Event-Contract `lifecycle.v1`, Preset-Metadatenvertrag, Owner-Guard, Keyboard/ARIA, Compatibility-Rules).
    - `tests/stress.spec.js` um Preset-/Multiplayer-/Owner-Guard-Stressfaelle `T74` bis `T76` erweitert und auf stabilen DOM-Dispatch-Pfad fuer Preset-Burst gebracht.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:stress`
  - Exit:
    - Neue Menuefeatures und Altpfade sind automatisiert abgedeckt.

- [x] 26.3.9 Abschluss-Gate, Doku-Freeze und Restrisiken (abgeschlossen 2026-03-06)
  - Schritte:
    - Delta-Bewertung (Bedienfluss, Erweiterbarkeit, offene Multiplayer-Runtime-Luecken).
    - API-Vertrag fuer spaetere Multiplayer-Runtime als TODO-Backlog fixieren.
    - DoD-Checkliste abnehmen: Contracts versioniert, Access-Guards aktiv, Tests gruen.
    - Parallel-Check zu V29 abnehmen (Dateigrenzen + Lifecycle-Event-Contract unverletzt).
  - Umsetzung:
    - Fehlendes Modul `MenuCompatibilityRules` als versionierter Vertrag (`menu-compatibility.v1`) eingefuehrt und in `SettingsManager` + `GameRuntimeFacade` als Auto-Fix-Layer verdrahtet.
    - Deterministische Regelprioritaeten fuer Preset-/Developer-/Mode-Kompatibilitaet aktiviert (inkl. `fixed`-Preset-Integritaet und Guard-Normalisierung).
    - Abschlussdokumentation in Feature-Plan und Masterplan aktualisiert; V29-Parallelgrenzen (`UI/Menu` vs `Camera/Recording`) unverletzt bestaetigt.
  - Verifikation:
    - `npm run test:core`
    - `npm run test:stress`
    - `npm run docs:sync`
    - `npm run docs:check`
  - Exit:
    - Menue-Umbau abgeschlossen, Docs konsistent, Folgeschritte klar.

## Teststrategie (nur notwendige Tests)

- Regel:
  - Fokus auf `test:core` + `test:stress` fuer Menue-/UI-Aenderungen.
  - Keine Vollsuite pro Teilphase.
- Zusatz:
  - `smoke:roundstate` nur dann, wenn Match-Transition-Logik in `src/state/**` direkt angepasst wird.
  - Neue Pflichtfaelle in `core/stress`: Event-Contracts, Access-Guards, Keyboard/Fokus-Navigation.

## Phasen-Delta (laufend)

- 2026-03-05 (26.3.0): Baseline-Menuefluss und Alt-ID-Kompatibilitaetspfad dokumentiert; Migrations-Guardrails fuer Aliasbetrieb (`submenu-game` als `quickstart`-Alias) festgelegt.
- 2026-03-05 (26.3.1): `MenuSchema/MenuPanelRegistry/MenuStateContracts/MenuAccessPolicy` eingefuehrt und in `UIManager/SettingsManager/GameBootstrap` verdrahtet; Settings-Domaenen jetzt versioniert.
- 2026-03-05 (26.3.2): Menue-Navigation in `MenuNavigationRuntime` ausgelagert und mit `MenuStateMachine` versioniert; `UIManager` entkoppelt von direkter Nav-Logik.
- 2026-03-05 (26.3.3): Preset-Engine mit `fixed/open` Klassen, Apply-Ops und Store eingebracht; Preset-Events laufen ueber `MenuController` und Runtime-Fassade.
- 2026-03-05 (26.3.4): Multiplayer-Hauptpunkt inkl. Host/Join/Lobby-Stub umgesetzt; v1-Event-Contract in `MenuMultiplayerBridge` und Lifecycle-Routing in `main.js` verdrahtet.
- 2026-03-05 (26.3.5): Owner-only Developer-Modus mit zentralem Visibility-Modus (`hidden_for_players|owner_only|open`) umgesetzt; Theme-Katalog und Runtime-Guards aktiv.
- 2026-03-05 (26.3.6): Feature-Events aus `MenuGameplayBindings` ausgelagert nach `MenuDevPanelBindings`; Menu-Event-Contract auf `menu-controller.v1` versioniert.
- 2026-03-05 (26.3.7): DOM-Komposition mit `data-menu-panel`/`data-menu-action` vereinheitlicht; Quickstart/Custom/Multiplayer/Developer-Panels sind nun kompatibel und theme-faehig.
- 2026-03-06 (26.3.8): Core/Stress-Tests um neue Menuepfade erweitert (`T20c-T20j`, `T74-T76`) inkl. fixed/open-Presetvertrag, Owner-Guard, Event-Contract und A11y-Basics.
- 2026-03-06 (26.3.9): Abschluss-Gates bestanden; `MenuCompatibilityRules` (`menu-compatibility.v1`) als deterministischer Auto-Fix-Layer fuer Preset-/Developer-/Mode-Konsistenz produktiv eingebracht.

## Risiken / Gegenmassnahmen

- Risiko: Zu grosser HTML/CSS-Big-Bang erschwert Fehlersuche.
  - Gegenmassnahme: Registry + Runtime zuerst, Markup danach in kompatiblen Schritten.
- Risiko: Preset/FIxed-Preset kollidiert mit manuellem Settings-Flow.
  - Gegenmassnahme: klare Prioritaetsregeln (fixed > preset > custom) plus Tests.
- Risiko: Multiplayer-UI suggeriert fertige Funktion.
  - Gegenmassnahme: klarer "Preview/Stub"-Status in UI und Toast-Feedback.
- Risiko: Developer-Modus beeinflusst regulare Nutzer.
  - Gegenmassnahme: owner-only Access-Policy + spaeter zentral sperrbar.

## Dokumentations-Hook

Bei Implementierungsabschluss verpflichtend:

- `npm run docs:sync`
- `npm run docs:check`
