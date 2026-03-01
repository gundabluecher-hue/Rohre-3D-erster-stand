# Idee: Boost-Anzeige (UI)

## Beschreibung

Eine optische Anzeige im HUD in Form einer blauen Leiste, die den verfuegbaren Boost visualisiert.
Wenn Boost verbraucht wird, leert sich die Leiste. Bei Cooldown/Regeneration fuellt sie sich wieder.

## Gameplay-Impact

- Spielerwert: Besseres Ressourcenmanagement und klarere Entscheidungen beim Boosten.
- Feedback: Direkte visuelle Rueckmeldung waehrend Verbrauch und Wiederaufladung.

## Scope und betroffene Module

- UI/HTML (`index.html`): Boost-Bar fuer P1/P2 im HUD.
- CSS (`style.css`): Styling der Leiste inkl. Transition und Cooldown-Farbzustand.
- UI-Logik (`src/ui/HUD.js`): Ableitung der Fuellmenge aus `boostTimer` und `boostCooldown`.

## Varianten

- Minimal: Einfacher Balken mit Width-Update in Prozent.
- Standard: Animierte Leiste mit Rahmen und Low-Energy-Farbwechsel.
- Full: Erweiterte Effekte (z. B. Partikel/Glow im Cockpit-Layout).

## Offene Fragen

- Soll die Anzeige in allen Kamera-Modi sichtbar sein oder nur im Fighter-HUD?
- Reicht Width-basierte Darstellung, oder wird eine radial/circular Variante gewuenscht?

## Score

- Fun: 7/10
- Feasibility: 9/10
- Fit: 10/10
