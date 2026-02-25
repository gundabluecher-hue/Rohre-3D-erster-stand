---
description: Geführter Rollback auf einen früheren Git-Stand mit automatischer Umsetzungsplan-Anpassung
---

1. **Aktuelle Situation erfassen**: Zeige die letzten 10 Commits:

```bash
git log -n 10 --oneline --decorate
```

1. **User fragen**: Frage den User auf welchen Commit zurückgesetzt werden soll. Zeige die Optionen nummeriert an:

```text
🔙 ROLLBACK – Auf welchen Stand zurücksetzen?
═══════════════════════════════════════════════
1. abc1234 fix: Phase 3 – Worker-Stabilität (vor 2 Stunden)
2. def5678 WIP: Stand vor Phase 3 (vor 3 Stunden)
3. ghi9012 fix: Phase 2 – Gameplay-Mechanik (gestern)
...
```

1. **Uncommittete Änderungen sichern** (falls vorhanden):

```bash
git stash push -m "Rollback-Sicherung vor Reset"
```

1. **Reset durchführen**: Setze auf den gewählten Commit zurück:

```bash
git reset --hard <COMMIT-HASH>
```

1. **Umsetzungsplan anpassen**: Lies `docs/Umsetzungsplan.md` und setze alle Phasen, die NACH dem gewählten Commit erledigt wurden, zurück auf `[ ]`. Entferne deren `Erledigt:`-Datum.

2. **Bestätigung**: Zeige dem User:
   - Den aktuellen HEAD-Commit
   - Die aktualisierten Phasen im Umsetzungsplan
   - Hinweis: `git stash list` zeigt gesicherte Änderungen

3. **Optional – Force Push** (nur wenn bereits gepusht wurde):

```bash
git push --force-with-lease
```

> ⚠️ **Warnung**: Force-Push überschreibt die Remote-History. Nur verwenden wenn du der einzige Entwickler bist.
