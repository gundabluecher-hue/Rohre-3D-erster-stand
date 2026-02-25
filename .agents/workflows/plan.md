---
description: Plant ein neues Feature oder eine Code-Erweiterung – von der Idee bis zum fertigen Umsetzungsplan.
---

## 0. Kontext-Aufbau

- Lies `docs/Umsetzungsplan.md` für den aktuellen Projekt-Stand.
- Lies `git log -n 5 --oneline` für den letzten Kontext.
- Scanne die Projektstruktur (`js/modules/`) um die bestehende Architektur zu verstehen.

---

## 1. Anforderung klären

Frage den User (falls nicht klar):

- **Was** soll gebaut werden? (Feature-Beschreibung)
- **Warum**? (Motivation/Problem das gelöst wird)
- **Wo** im Spiel? (Welche bestehenden Module sind betroffen?)

---

## 2. Architektur-Analyse

Untersuche die betroffenen Dateien:

- Welche Module existieren bereits?
- Welche Schnittstellen/Events gibt es?
- Wo muss neuer Code ansetzen vs. bestehenden erweitern?

Zeige dem User eine kurze **Übersicht**:

```text
🏗️ ARCHITEKTUR-ANALYSE
═══════════════════════
Betroffene Module: [Liste]
Neue Dateien: [Liste oder "keine"]
Abhängigkeiten: [Liste]
Risiko: [Gering/Mittel/Hoch]
```

---

## 3. Plan erstellen

Erstelle `docs/Feature_[Name].md` mit:

```markdown
# Feature: [Name]

## Beschreibung
Was und warum.

## Betroffene Dateien
- `js/modules/Datei.js` – Was wird geändert
- `js/modules/NeueDatei.js` – [NEU] Was wird erstellt

## Umsetzungsschritte
1. Schritt 1
2. Schritt 2
...

## Verifikation
Wie wird getestet, dass es funktioniert?
```

---

## 4. Umsetzungsplan aktualisieren

Falls das Feature groß genug ist:

- Füge eine neue Phase in `docs/Umsetzungsplan.md` hinzu
- Format: `## Phase X: [ ] Feature-Name`
- Mit Unterpunkten für jeden Umsetzungsschritt

---

## 5. User-Bestätigung

Zeige den Plan und frage: **Soll ich mit `/code` die Umsetzung starten?**
