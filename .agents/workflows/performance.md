---
description: Gezieltes Performance-Profiling, Bottleneck identifizieren, optimieren und Vorher/Nachher vergleichen.
---

## 0. Kontext-Aufbau

- Lies `docs/Umsetzungsplan.md` und `git log -n 3 --oneline`.
- Frage den User: **Was ist langsam?** (FPS-Drops, Ladezeiten, bestimmte Szenarien?)

---

## 1. Baseline messen

- Führe `npm run test:core` aus (Performance-Test #4).
- Dokumentiere die Baseline:

```text
📊 PERFORMANCE BASELINE
════════════════════════
FPS (4 Bots): [Wert]
Frame Time avg: [Wert]ms
Draw Calls: [Wert]
Memory: [Wert]MB
Szenario: [Beschreibung]
```

---

## 2. Bottleneck identifizieren

Analysiere den Code auf typische Performance-Probleme:

- **CPU**: Zu häufige Berechnungen, unnötige Schleifen, fehlende Caching
- **GPU**: Zu viele Draw Calls, fehlende Instanced Rendering, Overdraws
- **Memory**: Objekt-Allokationen pro Frame, fehlende Pooling
- **GC**: Häufige Garbage Collection durch temporäre Objekte

Zeige die Top-3 Bottlenecks:

```text
🔥 BOTTLENECKS
═══════════════
1. [Datei:Funktion] – [Problem] – Geschätzter Impact: [Hoch/Mittel/Gering]
2. [Datei:Funktion] – [Problem] – Geschätzter Impact: [Hoch/Mittel/Gering]
3. [Datei:Funktion] – [Problem] – Geschätzter Impact: [Hoch/Mittel/Gering]
```

---

## 3. Optimierung umsetzen

Nutze den `/code` Workflow (Schritte 1-4) für die Umsetzung.
Commit-Prefix: `perf:` statt `feat:`

---

## 4. Nachher messen

Wiederhole die Baseline-Messung aus Schritt 1 und vergleiche:

```text
📊 PERFORMANCE VERGLEICH
══════════════════════════
                Vorher    Nachher    Diff
FPS (4 Bots):   [X]       [Y]       [+Z%]
Frame Time:     [X]ms     [Y]ms     [-Z%]
Draw Calls:     [X]       [Y]       [-Z%]
Memory:         [X]MB     [Y]MB     [-Z%]
```

---

## 5. Abschluss

- Dokumentiere Ergebnisse in `docs/Performance_Log.md` (append, nicht überschreiben)
- Falls keine Verbesserung: Rollback vorschlagen
