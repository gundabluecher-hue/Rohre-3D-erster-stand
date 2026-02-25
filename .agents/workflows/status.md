---
description: Schnellübersicht über Projekt-Status, Umsetzungsplan und letzte Commits
---

1. **Umsetzungsplan lesen**: Lies `docs/Umsetzungsplan.md` und zeige die Statusübersicht:

```text
📋 STATUSÜBERSICHT UMSETZUNGSPLAN
═══════════════════════════════════
✅ Phase 1: [Name] – erledigt (DD.MM.YYYY)
✅ Phase 2: [Name] – erledigt (DD.MM.YYYY)
🔧 Phase 3: [Name] – NÄCHSTE PHASE ← aktuell
⬚  Phase 4: [Name] – offen
...
```

1. **Letzte Git-Commits anzeigen**:

```bash
git log -n 5 --oneline --decorate
```

1. **Offene Änderungen prüfen**:

```bash
git status --short
```

1. **Branches anzeigen**:

```bash
git branch -a
```

1. **Zusammenfassung ausgeben**: Fasse den aktuellen Stand in 2-3 Sätzen zusammen:
   - Welche Phase ist als nächstes dran?
   - Gibt es uncommittete Änderungen?
   - Gibt es offene Branches?
