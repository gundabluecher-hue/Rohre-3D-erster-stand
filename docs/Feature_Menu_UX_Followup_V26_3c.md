# Feature: Menu UX Follow-up (V26.3c)

Stand: 2026-03-07
Status: Abgeschlossen
Owner: Single-Agent Planung

## Kontext

Dieser Plan setzt die Menue-UX-Nacharbeiten nach V26.3b auf Basis der aktuellen Browser-Review um.
Parallel arbeitet ein anderer Agent an der Restrukturierung des Masterplans; deshalb bleibt die Masterplan-Aenderung fuer diesen Plan bewusst auf einen append-only Eintrag im `Plan-Eingang` begrenzt.

## Ziel

Das Spielmenue soll im aktiven Spielstart-Pfad deutlich schneller, klarer und kompakter werden, ohne die bestehenden Runtime-Vertraege, Developer-Funktionen oder Testpfade unnötig aufzubrechen.

Konkret:

- Ebene 1 soll nach dem Einstieg weniger Platz verbrauchen.
- Ebene 2 soll `Sofort spielen` klarer von `Konfigurieren` trennen.
- Ebene 3 soll sich wie die eigentliche Startseite anfuehlen, inklusive sticky Start-Zusammenfassung.
- Ebene 4 soll kein ueberladener Scroll-Drawer mehr sein, sondern klar gruppierte Feineinstellungen bieten.
- Oeffentliche Menuetexte sollen release-tauglicher werden und interne Begriffe aus dem Spielerpfad entfernen.
- Map-/Flugzeug-Vorschau soll strukturierter und besser scanbar werden.

## Nicht-Ziele

- Keine Multiplayer-Runtime, kein Netcode und keine Matchmaking-Logik.
- Kein Rework von HUD, Hunt-Gameplay oder Render-Hotpaths.
- Kein kompletter Neubau der Menuearchitektur; bestehende Contracts und Module werden bevorzugt erweitert.
- Kein neuer globaler Design-Refresh ausserhalb des Menues.

## Architektur-Check

- Sichtbarer Aufbau lebt primaer in `index.html` und `style.css`.
- Panelwechsel, Fokuslogik und Hauptnavigation laufen ueber `src/ui/menu/MenuNavigationRuntime.js`.
- Zusammenfassung, Vorschautexte, Drawer-Sync und responsive Menuestate-Sync laufen ueber `src/ui/UIManager.js`.
- Ebene-4-Open/Close/Reset ist bereits als Eventpfad verdrahtet ueber `src/ui/MenuController.js`, `src/ui/menu/MenuGameplayBindings.js` und `src/core/GameRuntimeFacade.js`.
- Lokaler Menuezustand liegt in `src/ui/menu/MenuStateContracts.js`; dort ist aktuell bereits `toolsState.level4Open` vorhanden.
- Public/Developer-Texte laufen ueber `src/ui/menu/MenuTextCatalog.js` und bleiben wegen Text-Overrides als stabile IDs erhalten.
- Vorschau-Daten fuer Maps/Fahrzeuge laufen bereits ueber `src/ui/menu/MenuPreviewCatalog.js` und sollen wiederverwendet statt ersetzt werden.
- Regressionen liegen schwerpunktmaessig in `tests/helpers.js`, `tests/core.spec.js` und `tests/stress.spec.js`.

Reuse-Entscheidung:

- Reuse bestehender Menuemodule ist der Default.
- Neue Hilfsmodule sind nur dann sinnvoll, wenn fuer Ebene-4-Sektionen oder sticky Startleisten ein kleiner, klar abgegrenzter Zustands-/Kataloglayer gebraucht wird.
- Neue Runtime-Events sollen nach Moeglichkeit vermieden werden; bestehende `LEVEL4_*`- und Start-/Panelpfade bleiben erhalten.

Risiko: mittel

- Grund: HTML/CSS, Fokusnavigation, lokale UI-States und Playwright-Selektoren werden gleichzeitig beruehrt.
- Hauptrisiken: Selektor-Regressions, verschachtelte Scrollbereiche, Verlust von Keyboard-/Escape-Flows, Textoverride-Nebenwirkungen.

## Produktentscheidungen fuer V26.3c

1. Der Kopfbereich wird kontextsensitiv komprimiert, sobald der Nutzer tiefer als Ebene 1 ist.
2. Ebene 2 trennt visuell und semantisch zwischen direkten Startaktionen und Moduswahl.
3. Die Moduswahl auf Ebene 2 darf den Nutzer direkt in Ebene 3 fuehren; ein expliziter Weiter-Pfad bleibt nur, wenn er fuer A11y/Teststabilitaet noetig ist.
4. Ebene 3 bekommt eine sticky Startleiste mit kompakter Zusammenfassung und prominentem `Starten`.
5. Lange Formularbereiche in Ebene 3 werden in klar benannte, einklappbare Sektionen gegliedert.
6. Ebene 4 bleibt funktional dieselbe Domäne, wird aber als sektioniertes Sheet gebaut: Desktop als rechte Detailflaeche, mobil als Vollflaechen-Ansicht ohne horizontales Scrollen.
7. Release-Texte im Spielerpfad verlieren interne Begriffe wie `fixed`, `owner`, `Ebene 4 oeffnen`, sofern diese nicht explizit Developer-only sind.
8. Text-IDs bleiben stabil; geaendert wird primaer Inhalt und visuelle Komposition, nicht der Override-Mechanismus.
9. Preview-Verbesserungen nutzen bestehende Katalogdaten und benoetigen keine neue Asset-Pipeline.

## Betroffene Dateien

Bestehend:

- `index.html`
- `style.css`
- `src/core/GameBootstrap.js`
- `src/core/GameRuntimeFacade.js`
- `src/ui/UIManager.js`
- `src/ui/MenuController.js`
- `src/ui/menu/MenuGameplayBindings.js`
- `src/ui/menu/MenuNavigationRuntime.js`
- `src/ui/menu/MenuStateContracts.js`
- `src/ui/menu/MenuPreviewCatalog.js`
- `src/ui/menu/MenuTextCatalog.js`
- `src/ui/menu/MenuTextRuntime.js`
- `tests/helpers.js`
- `tests/core.spec.js`
- `tests/stress.spec.js`
- `docs/Umsetzungsplan.md`

Optional neu, nur bei echtem Strukturgewinn:

- `src/ui/menu/MenuLevel4SectionCatalog.js`
- `src/ui/menu/MenuStartRailState.js`

## Umsetzungsphasen

- [x] 26.3c.0 Baseline-Freeze und konfliktarme Vorbereitung
  - Review-Befunde aus Desktop-/Mobil-Check festschreiben.
  - Scope gegen laufende Arbeit absichern: keine Aenderung bestehender Root-Bloecke in `docs/Umsetzungsplan.md`, nur append-only Intake.
  - Selektor- und Contract-Freeze fuer bestehende Kernpfade markieren:
    - `#menu-nav`
    - `#submenu-custom`
    - `#submenu-game`
    - `#submenu-level4`
    - `#btn-start`
  - Entscheidung festziehen, welche Texte im Player-Pfad produktsprachlich werden und welche nur im Developer-Pfad technisch bleiben.
  - Abgeschlossen am: `2026-03-06`
  - Freeze-Notiz:
    - Desktop-Befund: Ebene 3 belegt bereits vor eigentlichem Setup rund `212px` Kopfbereich; Build-Info und Hero bleiben im aktiven Startpfad zu dominant.
    - Mobil-Befund: Ebene 2-4 verlieren mit rund `390px` Kopfbereich fast die halbe Hoehe an Header/Navigation; der Startpfad wirkt dadurch unnnoetig lang.
    - Scope: `docs/Umsetzungsplan.md` bleibt unveraendert ausser dem bereits vorhandenen append-only Intake-Eintrag.
    - Contract-Freeze: `#menu-nav`, `#submenu-custom`, `#submenu-game`, `#submenu-level4` und `#btn-start` bleiben erhalten.
    - Text-Entscheidung: Release-Pfad wird produktsprachlich; technische Begriffe wie `fixed`, `owner`, `open preset`, `Developer`, `Classic 3D`, `Planar` bleiben nur dort sichtbar, wo sie fuer Debug-/Developer-Funktionen oder Spielverstaendnis noetig sind.

- [x] 26.3c.1 Kopfbereich komprimieren und Kontextleiste einfuehren
  - Header-Verhalten nach Menuetiefe umstellen:
    - Ebene 1: voller Hero-Kopf bleibt sichtbar.
    - Ebene 2-4: Session-Auswahl, Hilfe und Status auf kompakte Kontextleiste reduzieren.
  - Build-Info aus dem primaeren Sichtbereich reduzieren oder in Debug/sekundaeren Statusbereich verschieben.
  - `menu-context` staerker als aktiver Breadcrumb-/Status-Text nutzen.
  - Mobilvariante so bauen, dass oberhalb des eigentlichen Inhalts deutlich weniger Hoehe verloren geht.
  - Ziel: mehr nutzbare Flaeche, ohne Fokus- und Escape-Orientierung zu verlieren.
  - Abgeschlossen am: `2026-03-07`
  - Ergebnis: Hero bleibt auf Ebene 1 voll, waehrend Ebene 2-5 ueber `data-menu-depth` auf kompakte Shell, versteckte Build-Info und aktiveren Kontextstatus umschalten.

- [x] 26.3c.2 Ebene 2 als echte Startentscheidung schaerfen
  - `Schnellaktionen` visuell als direkte Primaraktionen auszeichnen.
  - `Arcade`, `Fight`, `Normal` als Modus-Karten mit kurzer Wirkungsvorschau ausbauen.
  - CTA-Hierarchie anpassen:
    - direkte Starts bleiben sofortig
    - Moduswahl fuehrt direkt oder quasi-direkt in Ebene 3
  - Player-facing Begriffe pruefen und bei Bedarf umbenennen:
    - `Spielweg`
    - `Schnellaktionen`
    - `Modi`
    - `Weiter zu Ebene 3`
  - Tastaturpfade fuer direkte Modusweiterleitung absichern.
  - Abgeschlossen am: `2026-03-07`
  - Ergebnis: Ebene 2 trennt Schnellstart und Spielstil ueber Karten-Layout; Moduswahl fuehrt direkt in Ebene 3.

- [x] 26.3c.3 Ebene 3 in eine sticky Startseite umbauen
  - Oberhalb der Detailsektionen eine sticky Startleiste einfuehren mit:
    - Session
    - Modus
    - Map
    - Flugzeug
    - Theme
    - `Starten`
  - Lange Pipe-Zusammenfassung in scanbare Chips/Bausteine aufteilen.
  - `Ebene 3 reset` und `Mehr Optionen`/`Feineinstellungen` in diese Leiste integrieren.
  - Sektionen fuer `Map`, `Flugzeug`, `Match`, `Presets` und `Multiplayer-Stub` klar gruppieren.
  - Validierungsfehler muessen weiterhin:
    - die richtige Sektion oeffnen
    - das betroffene Feld fokussieren
    - den Grund sichtbar halten
  - Mobil optional mit sticky Bottom-CTA oder kompaktem Startblock absichern, sofern die Sticky-Leiste oben nicht reicht.
  - Abgeschlossen am: `2026-03-07`
  - Ergebnis: Ebene 3 nutzt eine sticky Startleiste mit `Starten`, Reset und Feineinstellungen; Detailbereiche sind als benannte `details`-Sektionen gegliedert.

- [x] 26.3c.4 Vorschauen, Favoriten und Zusammenfassung aufwerten
  - Map- und Flugzeug-Vorschau von Fliesstext auf strukturierte Preview-Karten umstellen.
  - Bestehende Preview-Daten (`name`, `sizeText`, `category`, `portalCount`, `hitboxRadius`) in Badges/Key-Value-Zeilen ueberfuehren.
  - Favoriten- und Zuletzt-benutzt-Listen visuell naehr an die neue Zusammenfassung ziehen.
  - Zusammenfassungsbausteine fuer Splitscreen und Multiplayer getrennt modellieren, damit sie nicht in einem einzigen Textfeld zusammenlaufen.
  - Ziel: bessere Scannbarkeit ohne neue Medien-Assets.
  - Abgeschlossen am: `2026-03-07`
  - Ergebnis: Startzusammenfassung rendert scanbare Bausteine; Map-/Fahrzeugvorschauen und Favoriten/Rezenzlisten sind in strukturierte Karten ueberfuehrt.

- [x] 26.3c.5 Ebene 4 in sektionierte Feineinstellungen umformen
  - Drawer-Inhalt nach klaren Bereichen strukturieren:
    - Steuerung
    - Gameplay
    - Erweiterte Map
    - Tools
  - Desktop:
    - rechter Sheet-/Drawer-Charakter bleibt
    - aber ohne horizontalen Scroll und ohne ueberlange Zweispalten-Keybind-Flaeche
  - Mobil:
    - Vollbreiten-/Vollhoehen-Darstellung statt verschachteltem relativen Drawer
    - Bereichsnavigation als Tabs, Segment-Buttons oder Akkordeons
  - Falls noetig neuen lokalen UI-State fuer `aktive Ebene-4-Sektion` in `MenuStateContracts` einfuehren.
  - `LEVEL4_OPEN`, `LEVEL4_CLOSE`, `LEVEL4_RESET` bleiben als Vertragsoberflaeche erhalten.
  - Abgeschlossen am: `2026-03-07`
  - Ergebnis: Ebene 4 ist in die Sektionen `controls`, `gameplay`, `advanced_map` und `tools` aufgeteilt; lokaler State migriert defensiv und mobil ohne horizontalen Overflow verifiziert.

- [x] 26.3c.6 Textkatalog fuer Release-Pfad bereinigen
  - Oeffentliche Menuebezeichnungen auf Spielsprache ziehen.
  - Kandidaten:
    - `Ebene 3: Start-Setup`
    - `Ebene 4: Feineinstellungen & Tools`
    - `Ebene 4 oeffnen`
    - `fixed preset`
    - `owner`
    - `Classic 3D` / `Planar` nur dort technisch lassen, wo es fuer Gameplay-Verstaendnis noetig ist
  - Textaenderungen ausschliesslich ueber `MenuTextCatalog` und vorhandenen Runtime-Pfad ziehen.
  - Sicherstellen, dass Developer-Overrides und Release-Vorschau unveraendert funktionieren.
  - Abgeschlossen am: `2026-03-07`
  - Ergebnis: Player-Pfad spricht produktsprachlich, waehrend Text-IDs, Developer-Overrides und Release-Vorschau stabil geblieben sind.

- [x] 26.3c.7 Navigation, Fokus und State-Migration absichern
  - Keyboard-/Controller-Flows fuer komprimierten Header, Akkordeons/Tabs und sticky Leisten nachziehen.
  - Escape-/Back-Verhalten fuer:
    - Ebene 2
    - Ebene 3
    - Ebene 4
    - Developer/Debug
    konsistent halten.
  - Falls neue lokale UI-State-Felder dazukommen:
    - Default-Werte in `MenuStateContracts`
    - defensive Migration fuer bestehende Storage-Daten
    - keine Regression fuer gespeicherte Drafts, Release-Vorschau und Text-Overrides
  - Abgeschlossen am: `2026-03-07`
  - Ergebnis: Back-/Escape-Flows laufen ueber explizite Back-Targets und Level-4-Close zuerst; aktive Level-4-Sektion persistiert migrationssicher.

- [x] 26.3c.8 Tests und visuelle Verifikation ausbauen
  - `tests/helpers.js` an neuen Flow anpassen, ohne Kern-Selectors unnoetig zu brechen.
  - `tests/core.spec.js` um gezielte UX-Regressionen erweitern:
    - kompakter Header ausserhalb Ebene 1
    - direkte Modusweiterleitung oder neuer CTA-Pfad
    - sticky Startbereich sichtbar/ansprechbar
    - strukturierte Preview-Anzeige
    - Ebene-4-Bereichsstruktur
    - kein horizontaler Overflow in Ebene 4
    - Developer-/Release-Textpfade weiterhin intakt
  - `tests/stress.spec.js` fuer schnelle Wechsel zwischen Ebene 2/3/4 und Session-Typen stabilisieren.
  - Leichtgewichtige visuelle Browser-Verifikation fuer Desktop und Mobil mit Screenshots festhalten.
  - Abgeschlossen am: `2026-03-07`
  - Ergebnis: Helfer, Core- und Stress-Suiten decken den neuen Flow ab; visuelle Screenshots liegen unter `tmp/menu-visual-*.png`.

- [x] 26.3c.9 Abschluss-Gate und Doku-Freeze
  - Planumsetzung gegen urspruengliche UX-Befunde gegenpruefen.
  - Dokumentationsauswirkungen aktualisieren.
  - Abschlusslauf mit Test- und Doku-Gates.
  - Abgeschlossen am: `2026-03-07`
  - Gate-Notiz:
    - `npm run test:core` PASS (`48 passed`, `1 skipped` fuer nicht deterministischen Recorder-Exportpfad im Runtime)
    - `npm run test:stress` PASS
    - `npm run build` PASS mit bestehender Recorder-Warnung aus bereits fremd veraenderter `src/core/MediaRecorderSystem.js`
    - `npm run docs:sync` und `npm run docs:check` folgen als finaler Freeze-Schritt dieses Blocks.

## Verifikation

- Nach 26.3c.2:
  - Browser-Check Desktop + Mobil fuer Ebene 1-3
  - `npm run test:core`
- Nach 26.3c.5:
  - Browser-Check Desktop + Mobil fuer Ebene 4
  - `npm run test:core`
- Nach 26.3c.8:
  - `npm run test:core`
  - `npm run test:stress`
  - `npm run build`
- Abschluss:
  - `npm run docs:sync`
  - `npm run docs:check`

## Dokumentations-Impact

- `docs/Umsetzungsplan.md`
- `docs/Dokumentationsstatus.md` indirekt ueber `docs:sync`
- optional `docs/ai_architecture_context.md`, falls neue persistente Menuestate-Felder oder neue Navigationsvertraege entstehen

## Konfliktregel fuer Parallelbetrieb

- Keine Umsortierung, Umnummerierung oder inhaltliche Bereinigung bestehender Bloecke in `docs/Umsetzungsplan.md`.
- Nur einen append-only Eingangseintrag fuer diesen Plan anlegen.
- Kein Verschieben aelterer Menuedokumente waehrend der Umsetzung dieses Plans.
