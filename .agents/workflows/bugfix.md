---
description: Spieler meldet ein Problem aus dem Spiel – Log-Analyse, Rückfragen bei Unklarheiten, dann gezielter Fix.
---

## 0. Problembeschreibung aufnehmen

Fordere den Spieler auf, das Problem **so genau wie möglich** zu beschreiben:

- Was genau ist passiert?
- Wann ist es passiert? (Menü, Runde, nach Power-Up, etc.)
- Ist es reproduzierbar?
- Gab es eine Fehlermeldung oder einen Freeze?

Falls die Beschreibung unklar oder unvollständig ist: **Sofort nachfragen**, bevor du weiterarbeitest. Stelle gezielte Ja/Nein- oder Auswahlfragen.

---

## 1. Session-Logs auswerten

Lies die aktuellsten Spiel-Logs:

```
analysis/logs/session_1.log   ← aktuelle Session
analysis/logs/session_2.log   ← vorherige Session (falls relevant)
```

Filtere gezielt nach:

- `[ERROR]` und `[WARN]` Einträgen
- Zeitstempel, die zum beschriebenen Zeitpunkt passen
- Auffälligkeiten: Crashes, Context Lost, fehlende Initialisierungen, wiederholte Neustarts

Zeige dem User eine **Zusammenfassung** der relevanten Log-Einträge:

```text
🔍 LOG-ANALYSE
═══════════════
📅 Session: [Datum/Uhrzeit]
⚠️  3x Context Lost zwischen 21:28 - 21:30
❌ TypeError in EntityManager.js (Zeile ~420)
ℹ️  Letzte erfolgreiche Runde: 21:25
```

---

## 2. Rückfragen bei Unklarheiten

Falls die Logs das Problem **nicht eindeutig erklären** oder die Spielerbeschreibung nicht zu den Logs passt:

- Frage gezielt nach: "Hast du zu dem Zeitpunkt X gemacht?"
- Frage nach Browser/Gerät falls performance-relevant
- Frage ob das Problem nach einem Reload weiterhin auftritt

**Erst weiterarbeiten wenn die Ursache klar eingegrenzt ist.**

---

## 3. Ursache lokalisieren

Untersuche die betroffenen Dateien im Code:

- Suche nach dem Fehler-Pattern aus den Logs (grep)
- Prüfe die relevante(n) Datei(en) auf den Fehler
- Dokumentiere kurz die Root-Cause

Zeige dem User:

```text
🎯 URSACHE
═══════════
Datei:    src/EntityManager.js
Problem:  [Beschreibung]
Auswirkung: [Was der Spieler sieht]
```

---

## 4. Fix umsetzen

Erstelle den Fix mit `/code` Workflow-Logik:

- Commit-Prefix: `fix:`
- Scope: nur die betroffene(n) Datei(en)
- Teste ob das Problem behoben ist (Build-Check)

---

## 5. Bestätigung

Gib dem User eine kurze Zusammenfassung:

```text
✅ BUGFIX ABGESCHLOSSEN
═══════════════════════
Problem:  [Kurzbeschreibung]
Ursache:  [Root-Cause]
Fix:      [Was geändert wurde]
Commit:   [Hash + Message]
```

Frage: **"Kannst du das Spiel nochmal testen und prüfen ob das Problem weg ist?"**
