---
description: Build erstellen, Version hochzählen, Changelog generieren und Release auf GitHub pushen.
---

## 1. Pre-Release Check

- Führe `npm run test:core` aus – alle Tests müssen bestehen.
- Führe `npm audit` aus – keine kritischen Sicherheitslücken erlaubt.
- Prüfe `git status` – keine uncommitteten Änderungen erlaubt.
- Lies `docs/Umsetzungsplan.md` und zeige dem User welche Phasen seit dem letzten Release erledigt wurden.

---

## 2. Version bestimmen

Lies die aktuelle Version aus `package.json`. Frage den User:

```text
📦 RELEASE VORBEREITUNG
═══════════════════════
Aktuelle Version: X.Y.Z
Erledigte Phasen seit letztem Release: [Liste]

Welche neue Version?
  1. Patch (X.Y.Z+1) – nur Bugfixes
  2. Minor (X.Y+1.0) – neue Features, abwärtskompatibel
  3. Major (X+1.0.0) – Breaking Changes
```

---

## 3. Changelog generieren

Erstelle/aktualisiere `CHANGELOG.md`:

```markdown
## [X.Y.Z] – DD.MM.YYYY

### Neu
- [Features aus erledigten Phasen]

### Behoben
- [Fixes aus erledigten Phasen]

### Geändert
- [Refactorings, Performance-Verbesserungen]
```

Nutze `git log --oneline [letzter-tag]..HEAD` als Quelle.

---

## 4. Version hochzählen

Aktualisiere die Versionsnummer in `package.json`.

---

## 5. Release-Commit & Tag

```bash
git add -A && git commit -m "release: v[X.Y.Z]" -m "[Zusammenfassung der wichtigsten Änderungen]"
git tag -a v[X.Y.Z] -m "Release v[X.Y.Z] – [Kurzbeschreibung]"
git push && git push --tags
```

---

## 6. Build erstellen

```bash
npm run build
```

---

## 7. Abschluss

Zeige dem User:

- Release-Version
- Changelog-Zusammenfassung
- GitHub-Link zum Tag
