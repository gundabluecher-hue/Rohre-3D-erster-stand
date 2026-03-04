# Umsetzungsplan (Master)

Dies ist der konsolidierte Plan fuer anstehende und laufende Implementierungen.
Neue Findings aus dem Analysebericht fliessen hier ein.

> Abgeschlossene Phasen 1-10 siehe [Archiv](archive/Umsetzungsplan_Archiv_Phase1-10.md).
> Abgeschlossene Phasen 11-15 siehe [Archiv](archive/Umsetzungsplan_Archiv_Phase11-15.md).
> Abgeschlossene Phase 17 siehe [Archiv](archive/Umsetzungsplan_Archiv_Phase17.md).
> Abgeschlossene Referenzplaene siehe `docs/archive/`.

## Status-Uebersicht

- [ ] Offen
- [/] In Bearbeitung
- [x] Abgeschlossen

---

## Prioritaeten (Triage)

**Wichtig:**

- Keine offenen kritischen Punkte.

**Mittel:**

- Weitere Dummy-Tests schrittweise durch echte Integritaetstests ersetzen.

**Unwichtig/Backlog:**

- Bundle-Groesse weiter optimieren (Code-Splitting), auch wenn aktuelles Warnlimit keine Build-Warnung mehr erzeugt.

---

## Produkt- und Gameplay-Verbesserungen (Backlog, Stand: 2026-03-03)

- Entscheidung: Aus der Vorschlagsliste vom 2026-03-03 sind Punkte `4`, `5`, `6`, `7`, `8`, `9`, `11`, `13`, `15`, `16` fuer den Umsetzungsplan freigegeben.
- Punkt `10` (Challenge-/Achievement-Idee) wurde auf Wunsch archiviert: `docs/archive/Idee_10_Achievements_Challenges.md`.
- [ ] V4 Treffer-/Schadensfeedback verbessern
  - Klarere Audio-/VFX-Signale bei MG-, Raketen- und Trail-Treffern sowie bei Schildabsorption.
  - Zielpfade: `src/hunt/HuntHUD.js`, `src/core/Audio.js`, `src/entities/systems/ProjectileSystem.js`.
- [ ] V5 Hunt-Mode Feintuning datenbasiert abschliessen
  - TTK, Overheat-Fenster, Respawn-Timer und Pickup-Spawns auf Telemetrie und Matchdaten abstimmen.
  - Zielpfade: `src/core/Config.js`, `src/hunt/HuntConfig.js`, `src/hunt/RespawnSystem.js`, `src/hunt/RocketPickupSystem.js`.
- [ ] V6 Menue-Schnellpresets einfuehren
  - Presets wie `Arcade`, `Competitive`, `Chaos` mit sauberem Sync in Settings/UI.
  - Zielpfade: `src/ui/MenuController.js`, `src/ui/UIManager.js`, `src/core/SettingsManager.js`.
- [ ] V7 Profile-UX ausbauen
  - Profil duplizieren, Import/Export und Standardprofil-Markierung ergaenzen.
  - Zielpfade: `src/ui/SettingsStore.js`, `src/ui/Profile*Ops.js`, `src/ui/MenuController.js`.
- [ ] V8 Post-Match-Statistiken erweitern
  - Kill/Death, Trefferquote, Ueberlebenszeit und Todesursachen pro Runde/Match sichtbar machen.
  - Zielpfade: `src/ui/HUD.js`, `src/ui/MatchFlowUiController.js`, `src/state/RoundRecorder.js`.
- [ ] V9 Replay/Ghost fuer letzte Runde
  - Leichten Replay-/Ghost-Pfad fuer Lern- und Highlight-Momente aufbauen.
  - Zielpfade: `src/state/RoundRecorder.js`, `src/core/main.js`, `src/ui/MatchFlowUiController.js`.
- [ ] V11 Mehr Map-Varianz ueber GLB/GLTF-Maps
  - Map-Pool um externe GLB-Umgebungen erweitern, inklusive Collider/Fallback-Pfad.
  - Referenz: `docs/Feature_GLB_Map_Loader.md`.
- [ ] V13 Performance-Hotspot `maze` gezielt optimieren
  - Draw-Calls per Batching/Instancing/LOD reduzieren, ohne Gameplay-Regression.
  - Zielpfade: `src/entities/Arena.js`, `src/core/Renderer.js`, `src/core/Config.js`.
- [ ] V15 Telemetrie-Dashboard fuer Balancing
  - Winrate-, Survival-, Stuck- und Schadensmetriken pro Mode/Map/Bot-Level auswertbar machen.
  - Zielpfade: `scripts/`, `data/`, `docs/Testergebnisse_*.md`.
- [ ] V16 Event-Playlist/Fun-Modes
  - Rotierende Spezialregeln als zeitlich limitierte Modi fuer Abwechslung und Retention.
  - Zielpfade: `src/core/Config.js`, `src/core/main.js`, `src/ui/MenuController.js`.
- [x] V18 Single-Agent-Durchlauf fuer weitere Modularisierung (ohne Stop)
  - Fokus: `OverheatGunSystem`, `ProjectileSystem`, `main.js`, `Bot.js`, `MenuController` in sequenziellen Phasen fuer einen Agenten.
  - Referenzplan: `docs/Feature_Modularisierung_SingleAgent_Durchlauf.md`.

---

## Single-Agent Block V18 (Stand: 2026-03-04)

- Rollenmodell:
  - Ein Agent setzt alle Phasen `21.x` strikt sequenziell um.
  - Keine Zwischenfreigaben durch zweite Instanz; Phase wechselt nur bei erfuellten Exit-Kriterien.

- [x] 21.0 Baseline, Scope und Guardrails
- [x] 21.1 OverheatGunSystem Split (State, HitResolver, TracerFx)
- [x] 21.2 ProjectileSystem Split (StatePool, SimulationOps, HitResolver)
- [x] 21.3 main.js Split (Bootstrap, RuntimeFacade, DebugApi)
- [x] 21.4 Bot-Fassade vereinfachen (Proxy-Abbau + SensorsFacade)
- [x] 21.5 MenuController Listener-Split (Gameplay/Profile/Controls)
- [x] 21.6 Abschluss, Stabilisierung, Doku-Freeze (`docs:sync`, `docs:check`)
