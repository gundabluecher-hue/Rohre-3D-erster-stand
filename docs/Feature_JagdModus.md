# Feature: Jagd-Modus

Neuer Spielmodus, aktivierbar im Menue. Kampfbetonte Variante mit Maschinengewehr (Ueberhitzung), gestuften Raketen, Lebensleiste, zerstoerbarer Spur, Schild-Powerups und Respawn-Option.

**Architektur-Prinzip**: Jedes Jagd-Subsystem ist ein eigenstaendiges Modul unter `src/hunt/`. Kein Jagd-Code in bestehenden Classic-Pfaden. Feature-Flag `CONFIG.HUNT.ENABLED` als Kill-Switch.

## Kernkonzept

- **Lebensleiste** (100 HP) statt Soforttod. Passive HP-Regen + Heal-Powerup.
- **MG mit Ueberhitzung**: Permanente Waffe, Fadenkreuz-Zielen, Overheat-Balken statt Munition. Schadens-Falloff ueber Entfernung. Sichtbare Tracer-Leuchtspuren.
- **3-Stufen-Raketen**: Schwach (haeufig), Mittel (selten), Stark (sehr selten) als Arena-Pickups.
- **Spur zerstoerbar**: Wenige Treffer reichen (niedrige Trail-HP), schnell kaputt.
- **Kollision = HP-Abzug** statt Soforttod.
- **Schild-Powerup**: Absorbiert HP-Schaden bevor es bricht.
- **Respawn**: Optional per Menue-Einstellung (Respawn an/aus).
- **Kill-Feed**: Einblendung wer wen getroffen/eliminiert hat.
- **Schadens-Indikator**: Richtungsanzeige am HUD-Rand woher Schaden kam.
- **Screen-Shake**: Kamerawackeln bei Treffern.
- **Erweitertes Scoring**: Kills, Assists, Schadenspunkte, eigenes Jagd-Scoreboard.
- **3D-Powerup-Modelle**: Lizenzfreie 3D-Modelle fuer alle Powerups (online suchen, GLB/GLTF).

---

## Architektur

### Modulstruktur (neu: `src/hunt/`)

```
src/hunt/
  HuntMode.js          - Modus-Lifecycle, Feature-Flag-Pruefung
  HuntConfig.js        - Alle HUNT-spezifischen Konstanten
  HealthSystem.js      - HP, Damage, Heal, Regen, isDead()
  OverheatGunSystem.js - MG-Logik, Overheat, Falloff, Tracer
  RocketPickupSystem.js- 3-Stufen-Raketen Spawn/Pickup/Damage
  DestructibleTrail.js - Trail-HP, Segment-Zerstoerung
  HuntHUD.js           - HP-Bar, Overheat-Bar, Kill-Feed, Schadens-Indikator
  HuntScoring.js       - Kills, Assists, Schadenspunkte
  HuntBotPolicy.js     - Bot-KI fuer Jagd-Modus
  RespawnSystem.js     - Respawn-Timer, Spawn-Logik
  ScreenShake.js       - Kamera-Shake bei Treffern
```

### Betroffene bestehende Dateien (minimal-invasiv)

| Datei | Aenderung |
|-------|-----------|
| `Config.js` | `HUNT`-Block mit Feature-Flag + Verweis auf `HuntConfig` |
| `RuntimeConfig.js` | `activeGameMode` Feld |
| `Player.js` | `hp`, `maxHp`, `takeDamage()`, `heal()` Felder (duenn) |
| `PlayerLifecycleSystem.js` | Modus-Weiche: `kill()` vs `takeDamage()` |
| `ProjectileSystem.js` | Hook fuer `MG_BULLET`-Typ + `ROCKET`-Stufen |
| `Trail.js` / `TrailSpatialIndex.js` | `segmentHP`-Feld, `destroySegment()` Methode |
| `HUD.js` | Delegation an `HuntHUD` wenn Modus aktiv |
| `Powerup.js` | 3D-Modelle laden statt einfacher Wuerfel |
| `MenuController.js` / `index.html` | Modus-Toggle + Respawn-Option |
| `CrosshairSystem.js` | Overheat-Indikator am Fadenkreuz |
| `Renderer.js` | Screen-Shake Hook |
| `Bot.js` | Delegation an `HuntBotPolicy` wenn Modus aktiv |

---

## Teilphasen

### 11.1 [ ] Game-Mode-Infrastruktur

- `src/hunt/HuntMode.js`: Enum CLASSIC/HUNT, isHuntMode() Helper.
- `src/hunt/HuntConfig.js`: Alle Hunt-Konstanten (HP, Overheat, Raketen-Stufen, Regen, Schaden).
- `Config.js`: `HUNT.ENABLED` Feature-Flag + Verweis.
- `RuntimeConfig.js`: `activeGameMode` Feld.
- `MenuController.js` / `index.html`: Modus-Toggle + Respawn-Toggle.
- **Verifikation**: Modus umschaltbar, Feature-Flag wirkt, Classic unberuehrt.

### 11.2a [ ] HP-System (Player-Erweiterung)

- `Player.js`: `hp`, `maxHp`, `shieldHP`, `takeDamage(amount)`, `heal(amount)`, `isDead()`.
- `src/hunt/HealthSystem.js`: Passive HP-Regen-Logik, Schadens-Berechnung.
- Classic-Modus: HP = 1, jeder Schaden = Tod (abwaertskompatibel).
- **Verifikation**: HP-Werte korrekt initialisiert, `takeDamage()`/`heal()` funktionieren.

### 11.2b [ ] Collision-Umstellung (HP statt Kill)

- `PlayerLifecycleSystem.js`: Modus-Weiche Kollision → `takeDamage()` statt `kill()`.
- Verschiedene Schadenshoehen: Wand (wenig), Trail (mittel), Spieler-Crash (viel).
- **Verifikation**: Kollision zieht HP ab, Tod erst bei HP <= 0, Classic unverändert.

### 11.3 [ ] HUD: Lebensleiste, Overheat, Kill-Feed, Schadens-Indikator

- `src/hunt/HuntHUD.js`: HP-Bar, Overheat-Bar, Kill-Feed-Liste, Richtungs-Indikator.
- `index.html` / `style.css`: HTML/CSS fuer Hunt-HUD-Elemente.
- `HUD.js`: Delegation an HuntHUD wenn Modus aktiv.
- Nur sichtbar im Jagd-Modus.
- **Verifikation**: Alle UI-Elemente sichtbar und reaktiv.

### 11.4 [ ] Maschinengewehr mit Ueberhitzung

- `src/hunt/OverheatGunSystem.js`: Overheat-Mechanik (0-100%), Abkuehlung, Sperr-Phase bei Ueberhitzung.
- `ProjectileSystem.js`: Neuer Typ `MG_BULLET` (klein, schnell, Tracer-Leuchtspur).
- Schadens-Falloff: Voller Schaden nah, 50% auf Maxdistanz.
- `CrosshairSystem.js`: Overheat-Farbe am Fadenkreuz (gruen → gelb → rot).
- **Verifikation**: Schiessen erhitzt, Ueberhitzung sperrt, Tracer sichtbar, Falloff korrekt.

### 11.5 [ ] 3-Stufen-Raketen

- `src/hunt/RocketPickupSystem.js`: 3 Stufen-Typen als Arena-Pickups.
  - **Schwach**: 15 HP Schaden, haeufig (60% Spawn-Chance).
  - **Mittel**: 35 HP Schaden, selten (30% Spawn-Chance).
  - **Stark**: 60 HP Schaden, sehr selten (10% Spawn-Chance).
- Explosion + Partikel bei Treffer.
- Visuelle Unterscheidung (Groesse, Farbe, Glow-Intensitaet).
- **Verifikation**: Alle 3 Stufen spawnen mit korrekter Haeufigkeit, Schaden stimmt.

### 11.6 [ ] Zerstoerbare Spur (niedrige Trail-HP)

- `Trail.js`: `segmentHP` Feld pro Segment (niedrig, z.B. 2-3 Treffer).
- `TrailSpatialIndex.js`: `destroySegment()` Methode.
- `ProjectileSystem.update()`: Trail-Treffer pruefen und zerstoeren.
- `src/hunt/DestructibleTrail.js`: Zerstoerungseffekt (Partikel).
- **Verifikation**: Schuesse zerstoeren Segments schnell, Luecken entstehen.

### 11.7 [ ] Schild-Powerup (Jagd-Variante) + 3D-Powerup-Modelle

- Schild absorbiert konfigurierbaren HP-Schaden bevor es bricht.
- Visuelles Feedback (Schild flackert/schrumpft bei Schaden).
- **3D-Modelle fuer alle Powerups**: Lizenzfreie GLB/GLTF-Modelle suchen und einbinden.
  - Shield, Heal, Speed, Raketen-Pickups, etc.
  - Fallback auf bestehende Wuerfel-Geometrie falls Modell nicht laedt.
- **Verifikation**: Schild absorbiert korrekt, 3D-Modelle laden, Lizenzen dokumentiert.

### 11.8 [ ] Screen-Shake, Schadens-Indikator, Kill-Feed

- `src/hunt/ScreenShake.js`: Kamera-Shake-Intensitaet abhaengig von Schadenshoehe.
- `Renderer.js`: Shake-Hook in Kamera-Update.
- Schadens-Richtungs-Indikator (roter Bogen am HUD-Rand).
- Kill-Feed: Letzte 3-5 Events einblenden (Spieler → Gegner: -XX HP / ELIMINATED).
- **Verifikation**: Shake bei Treffern spuerbar, Richtung korrekt, Kill-Feed aktualisiert.

### 11.9 [ ] Respawn-System + erweitertes Scoring

- `src/hunt/RespawnSystem.js`: Respawn nach Tod (konfigurierbar, per Menue an/aus).
- Respawn-Timer (z.B. 3s), zufaellige Spawn-Position, kurze Unverwundbarkeit.
- `src/hunt/HuntScoring.js`: Kills, Assists, Total Damage → eigenes Scoreboard.
- Scoreboard im Runden-Ende-Screen anzeigen.
- **Verifikation**: Respawn funktioniert wenn aktiviert, Scoring zaehlt korrekt.

### 11.10 [ ] Bot-KI fuer Jagd-Modus

- `src/hunt/HuntBotPolicy.js`: Bot-Policy fuer Hunt-Modus.
- Entscheidungen: MG feuern, Raketen nutzen, HP-Management, Fluchtverhalten bei niedriger HP.
- Aggressivitaet skaliert mit eigener HP vs Gegner-HP.
- **Verifikation**: Bots schiessen, nutzen Raketen, fliehen bei niedriger HP.

### 11.11 [ ] Abschluss, Balancing, Cleanup

- Schadenswerte balancen (HP, Overheat-Rate, Raketen-Haeufigkeit).
- Alle bestehenden Tests pruefen.
- `npm run docs:sync` und `npm run docs:check`.
- **Verifikation**: Alle Tests gruen, Gameplay ausgeglichen, Classic intakt.

---

## Risikobewertung: **Mittel**

- Groesste Gefahr: Regressionen im Classic-Modus.
- Mitigation: Feature-Flag, Modus-Weichen, Classic-Tests bei jeder Phase.
- Performance: Object-Pooling fuer MG-Projektile (bereits in ProjectileSystem vorhanden).
- 3D-Modelle: Fallback auf Wuerfel wenn Modell fehlt.

---

## Verifikationsplan

### Automatisierte Tests

- `npm run test:core` - Kernlogik intakt
- `npm run test:physics` - Kollisions-Aenderungen korrekt
- `npm run smoke:selftrail` - Trail-Regression pruefen
- `npm run build` - Build fehlerfrei

### Manuelle Tests

- Modus + Respawn im Menue umschaltbar
- Classic-Modus komplett unveraendert
- Hunt-Modus: HP-Bar, Overheat-Bar, Kill-Feed, Richtungs-Indikator sichtbar
- MG: Tracer sichtbar, Ueberhitzung sperrt, Falloff merkbar
- Raketen: 3 Stufen spawnen, unterschiedlicher Schaden
- Trail: Schuesse zerstoeren Segmente schnell
- Schild: Absorbiert Schaden, bricht korrekt
- Screen-Shake bei Treffern
- Respawn funktioniert (wenn aktiviert)
- Bots agieren sinnvoll
- 3D-Powerup-Modelle laden korrekt
