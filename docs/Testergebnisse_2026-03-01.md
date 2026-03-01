# Testergebnisse vom 2026-03-01

## Phase 6 - Baseline Performance + KI-Stabilitaet

### Baseline-Setup

- Kommando: `npm run benchmark:baseline`
- Matrix: 4 Szenarien aus `data/bot_validation_report.json`
- Runden pro Szenario (Bot-Stabilitaet): 4
- FPS/Draw Sampling je Szenario: 8000 ms (Intervall 250 ms)
- Seed-Modus: none
- Repro-Hinweis: No explicit RNG seed hook available; reproducibility is driven by fixed matrix and runner parameters.

### Baseline-Matrix

| ID | Mode | Map | Bots | Planar | Portale | Runden |
|---|---|---|---:|:---:|---:|---:|
| V1 | 1p | standard | 1 | nein | 0 | 4 |
| V2 | 1p | maze | 3 | nein | 0 | 4 |
| V3 | 1p | complex | 3 | ja | 4 | 4 |
| V4 | 2p | standard | 2 | ja | 6 | 4 |

### Kennzahlen (Gesamt)

- FPS-Mittel: 54.29
- Draw Calls (Mittel): 26.87
- Bot-Winrate: 93.8%
- Stuck-Events: 0
- Runden erfasst: 16
- Performance-Samples: 39

### Kennzahlen je Szenario

| Szenario | Runden | FPS-Mittel | Draw Calls (Mittel) | Bot-Winrate | Stuck | Avg Survival |
|---|---:|---:|---:|---:|---:|---:|
| V1 (standard) | 4 | 33.08 | 20.14 | 75.0% | 0 | 23.62s |
| V2 (maze) | 4 | 57.37 | 21.69 | 100.0% | 0 | 21.53s |
| V3 (complex) | 4 | 60.00 | 33.00 | 100.0% | 0 | 27.17s |
| V4 (standard) | 4 | 60.00 | 32.80 | 100.0% | 0 | 40.27s |

### Kurzbewertung

- Bot-Winrate/Stuck basieren auf dem reproduzierbaren Bot-Validierungslauf; FPS/DrawCalls wurden je Szenario separat unter gleichen Matrix-Parametern erfasst.
- JSON-Report: `data/performance_ki_baseline_report.json`

## Phase 7 - Abschluss, Cleanup, Architektur-Doku finalisieren

### Gate-Status

- Build: PASS (`npm run build`)
- Gemappte Tests: PASS (`npm run test:core` = 20/20, `npm run test:physics` = 10 passed, 10 skipped)
- Doku-Gates: PASS (`npm run docs:sync`, `npm run docs:check`; jeweils 0 Findings)

### Kurzbewertung

- Phase 7 schliesst ohne Funktionsausbau ab: Dead-Code/Altpfad-Cleanup in der KI-Anbindung, Architekturkontext finalisiert, Planstatus komplett auf erledigt gesetzt.
