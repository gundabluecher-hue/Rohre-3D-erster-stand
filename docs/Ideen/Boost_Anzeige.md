# Idee: Boost-Anzeige (UI)

## Beschreibung

Eine optische Anzeige im HUD (Heads-Up Display) in Form einer blauen Leiste, die dem Spieler den aktuell verfügbaren "Boost" visualisiert. Wenn Boost verbraucht wird, leert sich die Leiste, und sie füllt sich wieder auf, wenn Boost regeneriert oder aufgesammelt wird.

## Gameplay-Impact

- **Spielerwert:** Bessere Übersicht und Ressourcenkontrolle. Spieler können ihren Boost-Einsatz taktischer planen.
- **Feedback:** Direktes visuelles Feedback beim Einsatz und Aufladen der Fähigkeit.

## Scope & Betroffene Module

- **UI/HTML (`index.html`):** Neues HTML-Element für die Leiste (z.B. ein Container mit einem Füll-Balken).
- **CSS (`css/style.css` o.ä.):** Styling der Leiste in Blau, mit weichen CSS-Transitions für die Größenänderung.
- **Spiellogik / UI-Controller (`src/entities/Player.js` / UI-Skripte):** Der aktuelle Boost-Wert des Spielers muss in jedem Frame (oder bei Änderung) an das UI übermittelt werden, um die Breite der Leiste in Prozent anzupassen.

## Varianten

- **Minimal:** Einfacher HTML-Balken (blau auf grau), dessen Breite per JS anhand des Boost-Wertes aktualisiert wird.
- **Standard:** Animierte Leiste mit HUD-Rahmen. Verfärbt sich leicht, wenn der Boost kritisch niedrig ist.
- **Full:** Ins Spiel integrierte Anzeige (z.B. Leuchten am Schiff selbst) oder komplettes HUD-Overlay mit Partikeln.

## Offene Fragen

- Ist die Boost-Mechanik (Verbrauch/Aufladung) bereits vollständig in der `Player.js` implementiert?
- Brauchen wir die Anzeige mehrfach für lokale Multiplayer-Sichtfenster (Splitscreen)?

## Score

- **Fun:** 7/10 (Essenzielles Feedback für schnelles Gameplay)
- **Feasibility:** 9/10 (HTML/CSS-Balken ist sehr einfach umzusetzen)
- **Fit:** 10/10 (Passt nahtlos in ein Sci-Fi-Rennspiel)
