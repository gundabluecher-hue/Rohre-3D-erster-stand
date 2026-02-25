---
description: Toten Code finden, unbenutzte Dateien entfernen, Dokumentation aufräumen, Abhängigkeiten prüfen.
---

## 1. Ungenutzten Code finden

Scanne das Projekt nach:

```bash
# Unbenutzte Exporte finden
npx -y ts-unused-exports tsconfig.json 2>$null || echo "Manuell prüfen"
```

Zusätzlich manuell prüfen:

- Funktionen die nirgends importiert/aufgerufen werden
- Auskommentierter Code (> 5 Zeilen)
- TODO/FIXME/HACK Kommentare sammeln

---

## 2. Unbenutzte Dateien finden

```bash
# Dateien die nirgends importiert werden
git ls-files "js/**/*.js" | Sort-Object
```

Vergleiche mit den tatsächlichen Imports im Projekt. Zeige:

```text
🧹 CLEANUP-BERICHT
═══════════════════
Unbenutzte Dateien: [Liste oder "keine"]
Toter Code: [X Stellen in Y Dateien]
TODO/FIXME: [X offene Kommentare]
Auskommentierter Code: [X Blöcke]
```

---

## 3. Dokumentation aufräumen

Prüfe `docs/`:

- Veraltete Pläne die archiviert werden können → `docs/archive/`
- Widersprüche zwischen Dokumenten
- Fehlende Aktualisierungen im Umsetzungsplan

---

## 4. Abhängigkeiten & Sicherheit prüfen

```bash
npm outdated
npm audit
```

Zeige veraltete Pakete und **behebe Sicherheitslücken** falls möglich (`npm audit fix`).

---

## 5. Aufräumen durchführen

Frage den User was gelöscht/archiviert werden soll. Dann:

- Toten Code entfernen
- Unbenutzte Dateien löschen
- Veraltete Docs archivieren

```bash
git add -A && git commit -m "chore: Cleanup – toter Code und veraltete Dateien entfernt" -m "- [Was entfernt wurde und warum]"
git push
```
