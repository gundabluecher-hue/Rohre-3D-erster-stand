# Testergebnisse vom 2026-03-02

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

- FPS-Mittel: 59.65
- Draw Calls (Mittel): 30.72
- Bot-Winrate: 62.5%
- Stuck-Events: 0
- Runden erfasst: 16
- Performance-Samples: 50

### Kennzahlen je Szenario

| Szenario | Runden | FPS-Mittel | Draw Calls (Mittel) | Bot-Winrate | Stuck | Avg Survival |
|---|---:|---:|---:|---:|---:|---:|
| V1 (standard) | 4 | 58.73 | 14.64 | 25.0% | 0 | 14.63s |
| V2 (maze) | 4 | 60.00 | 72.00 | 100.0% | 0 | 25.95s |
| V3 (complex) | 4 | 60.00 | 27.36 | 100.0% | 0 | 21.92s |
| V4 (standard) | 4 | 60.00 | 26.57 | 25.0% | 0 | 24.45s |

### Kurzbewertung

- Bot-Winrate/Stuck basieren auf dem reproduzierbaren Bot-Validierungslauf; FPS/DrawCalls wurden je Szenario separat unter gleichen Matrix-Parametern erfasst.
- JSON-Report: `data/performance_ki_baseline_report.json`

---

## Phase 14.7 - Abschluss-Benchmark (Delta gegen 14.0)

- Baseline (14.0): FPS 59.54, Draw Calls 28.49, Stuck-Events 0.
- Aktuell (14.7): FPS 59.65, Draw Calls 30.72, Stuck-Events 0.
- Delta: FPS +0.11 (+0.18%), Draw Calls +2.23 (+7.83%), Stuck-Events 0.
- Gate-Check: FPS-Gate >= 56.56 PASS, Draw-Calls-Gate <= 31.34 PASS, Stuck-Events <= 0 PASS.