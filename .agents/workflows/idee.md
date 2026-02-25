---
description: Strukturiert eine grobe Spielidee zu einem durchdachten Feature-Konzept mit Bewertung und nächsten Schritten.
---

## 1. Idee aufnehmen

Frage den User nach der groben Idee. Falls nötig, stelle Rückfragen:

- **Was** schwebt dir vor? (Kurzbeschreibung)
- **Für wen?** (Spieler-Erlebnis: Spaß, Taktik, Optik, Performance?)
- **Inspiration?** (Gibt es Vorbilder aus anderen Spielen?)

---

## 2. Idee ausarbeiten

Erstelle `docs/Ideen/[Name].md` mit folgender Struktur:

```markdown
# Idee: [Name]

Erstellt: DD.MM.YYYY
Status: 💡 Konzept

## Beschreibung
Was ist das Feature? Wie erlebt es der Spieler?

## Gameplay-Wirkung
- Wie verändert es das Spielgefühl?
- Interaktion mit bestehenden Mechaniken (Power-Ups, Bots, Arenen)?

## Umfang
- Geschätzte Komplexität: [Klein / Mittel / Groß]
- Betroffene Module: [grobe Liste]
- Neue Assets nötig? [Ja/Nein – welche?]

## Varianten
- **Variante A**: [Einfachste Umsetzung]
- **Variante B**: [Erweiterte Version]
- **Variante C**: [Volle Vision]

## Offene Fragen
- [Was ist noch unklar?]

## Bewertung
| Kriterium | Wertung (1-5) |
|-----------|:---:|
| Spielspaß | ? |
| Umsetzbarkeit | ? |
| Passt zum Spiel | ? |
| **Gesamt** | **?** |
```

---

## 3. Gemeinsam bewerten

Gehe die **Bewertungstabelle** mit dem User durch und fülle sie aus. Diskutiere Varianten – welche ist realistisch, welche ist die "Traumversion"?

---

## 4. Entscheidung & nächste Schritte

Frage den User:

- **🗑️ Verwerfen** → Datei bleibt als Archiv, Status auf `❌ Verworfen`
- **💤 Backlog** → Status auf `📋 Backlog`, wird später aufgegriffen
- **🚀 Umsetzen** → Status auf `🚀 Geplant`, schlage vor:
  - `/plan` zum technischen Plan erstellen
  - Oder direkt neue Phase im Umsetzungsplan anlegen
