---
description: Measure baseline, optimize bottlenecks, and verify impact.
---

## 0. Context

- Read `docs/Umsetzungsplan.md` and recent commits.
- Confirm slow scenario (FPS/load/latency).

## 1. Baseline

- Run relevant tests/benchmarks.
- Capture metrics: FPS, frame time, draw calls, memory.

## 2. Bottlenecks

- Identify top 3 issues (CPU/GPU/alloc/GC).
- Estimate impact per issue.

## 3. Optimize

- Implement smallest high-impact change first.
- Keep logic behavior unchanged unless requested.

## 4. Verify

- Re-run baseline scenario.
- Report before/after deltas.

## 5. Documentation freshness

- Run `npm run docs:sync`.
- Sync any changed performance claims in docs with explicit date.
- Run `npm run docs:check` (must pass).

## Report

Use standard output format from `.agents/rules/reporting_format.md`.




