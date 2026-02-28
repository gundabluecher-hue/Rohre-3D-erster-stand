# Feature: Boost-Anzeige (UI)

## Ziel

Visuelle Darstellung des aktuell verfuegbaren Boosts im HUD (Heads-Up Display) als blauer Balken fuer beide Spieler.

## Betroffene Dateien

- **[MODIFY]** `index.html`
  - Hinzufuegen von `<div class="hud-boost-bar"><div id="p1-hud-boost-fill" class="boost-fill"></div></div>` in `p1-fighter-hud` (und aequivalent fuer `p2`).
- **[MODIFY]** `style.css`
  - Styling fuer `hud-boost-bar` (Container) und `boost-fill` (der eigentliche blaue Ladebalken). Positionierung passend zum bestehenden Fighter-HUD.
- **[MODIFY]** `src/ui/HUD.js`
  - Konstruktor: Elemente fuer Boost-Fill selektieren.
  - `update()`-Methode: Berechnung der Fuellmenge.
    - Wenn aktiv: `(player.boostTimer / CONFIG.PLAYER.BOOST_DURATION) * 100`
    - Wenn Cooldown: `(1 - player.boostCooldown / CONFIG.PLAYER.BOOST_COOLDOWN) * 100`
    - Setzen von `element.style.width` oder `height`.

## Schritte

1. HTML-Struktur in `index.html` um die Boost-Elemente erweitern.
2. CSS in `style.css` ergaenzen (Farbe: Cyan/Blau, mit weicher Transition).
3. Logik in `HUD.js` implementieren.

## Verifikation

- **Automatisiert:** `npm run smoke:selftrail` (sicherstellen, dass keine js-Fehler durch fehlende HUD-Referenzen auftreten).
- **Manuell:** Lokalen Dev-Server starten (`npm run dev`), Spiel starten, Boost aktivieren (Standard: Shift) und visuelles Feedback im HUD ueberpruefen.
