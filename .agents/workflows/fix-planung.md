---
description: Plant und fixxt die nächste anstehende Phase aus dem Umsetzungsplan und schlägt danach den Start der Folgephase vor.
---

## 0. Kontext-Aufbau (immer zuerst!)

Lies `docs/Umsetzungsplan.md` vollständig und erstelle eine **Statusübersicht** für den User:

```text
📋 STATUSÜBERSICHT UMSETZUNGSPLAN
═══════════════════════════════════
✅ Phase 1: [Name] – erledigt (DD.MM.YYYY)
✅ Phase 2: [Name] – erledigt (DD.MM.YYYY)
🔧 Phase 3: [Name] – NÄCHSTE PHASE ← aktuell
⬚  Phase 4: [Name] – offen
...
```

- Phasen mit `[x]` im Titel = erledigt (✅), zeige das Datum aus `Erledigt:` falls vorhanden
- Erste Phase mit `[ ]` im Titel = nächste Phase (🔧)
- Alle weiteren = offen (⬚)

Lies auch `git log -n 5 --oneline`, um zu sehen was zuletzt committed wurde.

---

## 1. Phasen-Identifikation

Basierend auf der Statusübersicht: Wähle die erste Phase mit `[ ]` im Titel.

Zeige dem User die **Details der Phase**:

- Alle Unterpunkte (erledigt vs. offen)
- Betroffene Dateien
- Review-Kriterien
- **Branch-Vorschlag**: `fix/[phasen-name]`

---

## 2. Detail-Planung

Erstelle einen `implementation_plan.md` für die aktuelle Phase. Berücksichtige dabei:

- Alle betroffenen Dateien.
- Die notwendigen Code-Änderungen.
- Die Risiko-Bewertung (Gering, Mittel, Hoch).

---

## 3. Umsetzung → `/code` Workflow

Führe den **`/code` Workflow** aus (Schritte 1-5), mit folgenden Anpassungen:

- **Scope** = die Unterpunkte der aktuellen Phase
- **Feature-Plan** = der `implementation_plan.md` aus Schritt 2
- **Commit-Prefix** = `fix:` statt `feat:`

---

## 4. Phase abschließen

Nach erfolgreichem `/code` Workflow:

- Setze den Phasen-Titel in `docs/Umsetzungsplan.md` auf `[x]`
- Setze alle Unterpunkte auf `[x]`
- Füge `Erledigt: DD.MM.YYYY` unter den Phasen-Titel
- Lösche den `implementation_plan.md`

---

## 5. Next Phase Prompt

Gib am Ende der Nachricht fettgedruckt aus: **`/fix-planung`**
