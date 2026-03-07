# Testergebnisse vom 2026-03-07

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

- FPS-Mittel: 59.49
- Draw Calls (Mittel): 32.08
- Bot-Winrate: 82.4%
- Stuck-Events: 0
- Runden erfasst: 17
- Performance-Samples: 39

### Kennzahlen je Szenario

| Szenario | Runden | FPS-Mittel | Draw Calls (Mittel) | Bot-Winrate | Stuck | Avg Survival |
|---|---:|---:|---:|---:|---:|---:|
| V1 (standard) | 5 | 58.35 | 16.25 | 60.0% | 0 | 30.82s |
| V2 (maze) | 4 | 60.00 | 33.00 | 100.0% | 0 | 29.63s |
| V3 (complex) | 4 | 60.00 | 82.80 | 100.0% | 0 | 31.62s |
| V4 (standard) | 4 | 60.00 | 25.36 | 75.0% | 0 | 45.25s |

### Kurzbewertung

- Bot-Winrate/Stuck basieren auf dem reproduzierbaren Bot-Validierungslauf; FPS/DrawCalls wurden je Szenario separat unter gleichen Matrix-Parametern erfasst.
- JSON-Report: `data/performance_ki_baseline_report.json`
