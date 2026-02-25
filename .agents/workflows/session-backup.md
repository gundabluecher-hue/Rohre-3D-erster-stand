---
description: Vor jeder Aenderungssession den aktuellen Stand sichern
---

## Vor einer Session: Stand sichern

1. Git-Commit erstellen (sichert alles im Repo):

```bash
git add -A && git commit -m "WIP: [Thema/Kontext]" -m "Bisherige Änderungen: [kurze Auflistung was geändert wurde und warum]"
```

1. Backup wichtiger JS-Dateien erstellen:

```bash
powershell -File backup.ps1
```

1. Optional – Push auf GitHub (empfohlen für zusätzliche Sicherheit):

```bash
git push
```

## Schnelle Alternative: Git Stash

Falls du nur kurz etwas testen willst ohne einen Commit zu machen:

```bash
# Änderungen zwischenspeichern (ohne Commit)
git stash push -m "WIP: [Beschreibung]"

# Später wiederherstellen
git stash pop
```

## Nach einer Session: Aenderungen pruefen

1. Aenderungen ansehen:

```bash
git diff --stat HEAD~1
```

1. Wenn etwas schiefgelaufen ist, eine Datei wiederherstellen:

```bash
git checkout -- js/modules/DATEINAME.js
```

## Regeln fuer PowerShell-Befehle

- **Kein** Here-String (`@"..."@`) direkt als run_command-Argument — haengt sich auf
- Stattdessen: Skript als `.ps1`-Datei schreiben, dann `powershell -File skript.ps1` aufrufen
- Befehle mit `;` verketten vermeiden — lieber einzeln ausfuehren
