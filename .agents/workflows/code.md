---
description: Setzt ein geplantes Feature oder Code-Erweiterung um – von der Implementierung bis zum Commit.
---

## 0. Kontext-Aufbau

- Lies `docs/Umsetzungsplan.md` für den aktuellen Stand.
- Prüfe ob ein Feature-Plan existiert (`docs/Feature_*.md`). Falls ja, nutze ihn als Grundlage.
- Falls kein Plan existiert: Schlage vor, zuerst `/plan` auszuführen.
- Lies `git log -n 3 --oneline` für den letzten Kontext.

---

## 1. Sicherung

- Führe `/session-backup` aus oder erstelle einen WIP-Commit.

---

## 2. Scope & Branching bestätigen

Zeige dem User eine kompakte Übersicht:

```text
🔨 CODE-SESSION
═══════════════
Feature: [Name]
Branch-Vorschlag: feature/[name-kleingeschrieben]
Dateien: [Liste der zu ändernden/neuen Dateien]
Geschätzte Komplexität: [Gering/Mittel/Hoch]
```

Warte auf Bestätigung. Falls gewünscht, Branch erstellen:
`git checkout -b feature/[name]`

---

## 3. Implementierung

Setze den Code um. Beachte dabei:

- **Bestehende Patterns** im Projekt einhalten (prüfe ähnliche Module als Referenz)
- **Config-Werte** in `Config.js` auslagern, nicht hart-coden
- **Events/Callbacks** über bestehende Systeme dispatchen
- **Cleanup/Dispose** immer mitdenken (Memory-Leaks vermeiden)

---

## 4. Selbst-Review & Qualitaet

Vor dem Commit prüfe:

- [ ] Keine `console.log` Debug-Ausgaben vergessen? (`grep -r "console.log" js/`)
- [ ] Keine offenen `TODO`s im neuen Code?
- [ ] Dispose/Cleanup für neue Objekte vorhanden?
- [ ] Config-Werte statt Magic Numbers?
- [ ] Bestehende Tests noch lauffähig?

Führe `npm run test:core` aus.

---

## 5. Git-Commit & Push

```bash
git add -A && git commit -m "feat: [Feature-Name] – [Kurzbeschreibung]" -m "- Datei1.js: Was hinzugefügt (Warum)" -m "- Datei2.js: Was geändert (Warum)"
```

```bash
git push
```

---

## 6. Dokumentation aktualisieren

- Falls eine Phase in `docs/Umsetzungsplan.md` betroffen ist → auf `[x]` setzen + `Erledigt: DD.MM.YYYY`
- Falls ein `docs/Feature_[Name].md` existiert → als erledigt markieren oder löschen
- Aktualisiere `Stand:`-Datum im Umsetzungsplan

---

## 7. Abschluss

Zeige dem User:

- Was wurde umgesetzt (Zusammenfassung)
- Welche Dateien geändert/erstellt
- Nächste Schritte / Vorschläge
