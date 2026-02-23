---
description: Vor jeder Aenderungssession den aktuellen Stand sichern
---

## Vor einer Session: Stand sichern

// turbo

1. Git-Commit erstellen (sichert alles im Repo):

```
git add -A && git commit -m "WIP: Stand vor [Thema]"
```

// turbo
2. Backup wichtiger JS-Dateien erstellen:

```
powershell -File backup.ps1
```

## Nach einer Session: Aenderungen pruefen

// turbo
3. Aenderungen ansehen:

```
git diff --stat HEAD~1
```

// turbo
4. Wenn etwas schiefgelaufen ist, eine Datei wiederherstellen:

```
git checkout -- js/modules/DATEINAME.js
```

## Regeln fuer PowerShell-Befehle

- **Kein** Here-String (`@"..."@`) direkt als run_command-Argument — haengt sich auf
- Stattdessen: Skript als `.ps1`-Datei schreiben, dann `powershell -File skript.ps1` aufrufen
- Befehle mit `;` verketten vermeiden — lieber einzeln ausfuehren
