# Tasks — CartridgeLab

This document tracks active tasks, sprint planning, and work in progress.

---

## Sprint 1 — Foundation ✅ (Complete)

**Date Range**: 2026-03-02 → 2026-03-04
**Goal**: Working end-to-end loop — drop `.py` cartridge → backtest runs → results render.

### Completed

- [x] Project architecture designed — 5 founding ADRs — 2026-03-02
- [x] Full scaffold + initial commit — 2026-03-02
- [x] Backend: Flask API (`/api/health`, `/api/cartridges`, `/api/run`) — 2026-03-03
- [x] Backend: Cerebro Runner + Strategy Loader + Adapters — 2026-03-03
- [x] Frontend: Three.js scene bootstrap, Vite HMR — 2026-03-03
- [x] Frontend: High-fidelity 3D console (SNES/PS1 hybrid chassis) — 2026-03-04
- [x] Frontend: GSAP cartridge insertion animations — 2026-03-04
- [x] Frontend: Dynamic file-type color theming (`.py`=gold, `.pine`=green, `.mq4`=blue) — 2026-03-04
- [x] Frontend: Splash screen CSS overflow fix — 2026-03-04
- [x] Deep research dive on founding figures & technologies — 2026-03-04
- [x] All documents updated, committed, pushed — 2026-03-04

---

## Sprint 2 — Immersion & Depth (Active)

**Date Range**: 2026-03-04 → 2026-03-18
**Goal**: Equity terrain tells a visual story. Metrics have Renaissance-grade depth. The experience is atmospheric.

### High Priority

#### ChartWorld: 3D Equity Terrain
**Status**: ⚪ Not Started
**Description**: `frontend/src/chartworld.js` — `PlaneGeometry` vertex displacement from equity curve data. Per-vertex coloring (green peaks = profit, red valleys = drawdown). Buy/sell trade markers. Animated GSAP camera fly-through on result reveal.
**Acceptance Criteria**:
- [ ] Terrain mesh renders from real backtest equity curve data
- [ ] Green-to-red vertex coloring based on gain/loss gradient
- [ ] Trade markers (buy=green cone, sell=red cone) at correct positions
- [ ] Camera fly-through animation on backtest completion
**Estimated Effort**: Large (3-4 days)

---

#### CRT Post-Processing
**Status**: ⚪ Not Started
**Description**: Three.js `EffectComposer` pipeline — `UnrealBloomPass` for neon glow, custom GLSL scanline shader, optional chromatic aberration. Sakamoto-inspired atmospheric depth.
**Acceptance Criteria**:
- [ ] Bloom post-processing applied to scene
- [ ] Scanline overlay via shader (not CSS)
- [ ] Scene feels "atmospheric" with CRT console mood
**Estimated Effort**: Medium (2 days)

---

#### Metrics Depth: Sortino, Calmar, Kelly
**Status**: ⚪ Not Started
**Description**: `backend/engine/metrics_extractor.py` — Add Sortino Ratio, Calmar Ratio, Kelly Criterion, Profit Factor. Feed to HUD. Inspired by Jim Simons' signal-over-noise principle.
**Acceptance Criteria**:
- [ ] Sortino, Calmar, Kelly, Profit Factor computed after each backtest
- [ ] Values displayed in HUD metrics panel
- [ ] Achievement badges: "Sharpe Ace" (>1.5), "Iron Stomach" (DD<10%), "Trade Machine" (>500 trades)
**Estimated Effort**: Medium (2-3 days)

---

### Medium Priority

#### PineScript Adapter Hardening
**Status**: ⚪ Not Started
**Description**: Unit tests for each `ta.*` regex pattern in `pinescript_adapter.py`. Edge case coverage. Output validation against known Pine Script results.
**Acceptance Criteria**:
- [ ] Unit tests for `ta.sma`, `ta.ema`, `ta.rsi`, `ta.macd`, `ta.bb`
- [ ] Unit tests for `strategy.entry`, `strategy.close`
- [ ] Edge case: nested indicators, multiple timeframes
**Estimated Effort**: Medium (2-3 days)

---

#### Sandbox Hardening
**Status**: ⚪ Not Started
**Description**: Restrict the `exec()` namespace in `strategy_loader.py`. Block dangerous imports (os, sys, subprocess, shutil). Add execution timeout. Namespace isolation per run.
**Acceptance Criteria**:
- [ ] Whitelist of allowed imports enforced
- [ ] Execution timeout (30s default)
- [ ] No filesystem access from user strategies
- [ ] Error messages are informative but non-leaking
**Estimated Effort**: Medium (2 days)

---

### Low Priority / Nice to Have

- [ ] Sound FX system (Web Audio API) — boot chime, cartridge click, result fanfare
- [ ] WebSocket streaming for real-time equity curve during run
- [ ] Multi-cartridge comparison (side-by-side 3D terrains)
- [ ] Strategy achievement leaderboard (local storage)
- [ ] Polygon.io premium data feed adapter
- [ ] MQL adapter depth — full indicator coverage

---

## Technical Debt

### Critical
- [ ] Strategy `exec()` sandbox — namespace restriction audit required before multi-user

### Important
- [ ] PineScript adapter needs unit tests per `ta.*` pattern
- [ ] Full exception coverage in `cerebro_runner.py`
- [ ] HUD deeply nested metrics formatting

---

## Reference Documents

- `decisions.md` — 5 founding Architecture Decision Records
- `memory.md` — Project history, resume checkpoints, architecture overview
- `llms.txt` — AI agent file map and quick-start guide
- `deep_research.md` — Extensive research on founding figures, technologies, and quantitative concepts

---

**Last Updated**: 2026-03-04
**Next Planning Session**: 2026-03-18
