---
description: Bestehenden Code umstrukturieren ohne Funktionsänderung – sauberer, wartbarer, schneller.
---

## 0. Kontext-Aufbau

- Lies `docs/Umsetzungsplan.md` für den aktuellen Stand.
- Lies `git log -n 5 --oneline`.
- Frage den User: **Was soll refactored werden?** (Modul, Pattern, Struktur?)

---

## 1. Ist-Analyse

Untersuche den betroffenen Code:

- Zeige die aktuelle Struktur (Funktionen, Klassen, Abhängigkeiten)
- Identifiziere **Code Smells**: Duplikation, zu lange Funktionen, unklare Verantwortlichkeiten
- Zeige dem User:

```text
🔍 REFACTORING-ANALYSE
═══════════════════════
Datei(en): [Liste]
Probleme: [Code Smells]
Vorschlag: [Was soll sich ändern]
Risiko: [Gering/Mittel/Hoch]
```

---

## 2. Sicherung & Baseline-Test

- Führe `/session-backup` aus.
- Führe `npm run test:core` aus → **Baseline-Ergebnis** merken.

---

## 3. Refactoring durchführen

Setze die Änderungen um. **Goldene Regel**: Verhalten darf sich NICHT ändern.

- Module aufteilen / zusammenführen
- Funktionen extrahieren / umbenennen
- Patterns vereinheitlichen
- Imports aufräumen

---

## 4. Nachher-Test

- Führe `npm run test:core` erneut aus.
- **Vergleiche** mit Baseline: Gleiche Tests müssen weiterhin bestehen.
- Bei Abweichung: Fehler analysieren oder `/rollback`.

---

## 5. Commit & Push

```bash
git add -A && git commit -m "refactor: [Bereich] – [Kurzbeschreibung]" -m "- Datei.js: Was umstrukturiert (Warum)"
git push
```
