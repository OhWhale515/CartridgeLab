# Tasks — CartridgeLab

This document tracks active tasks, sprint planning, and work in progress.

---

## Current Sprint

**Sprint**: Sprint 1 — Foundation
**Date Range**: 2026-03-02 → 2026-03-16
**Goal**: Working end-to-end loop — drop `.py` cartridge → backtest runs → 3D equity terrain renders.

---

## Active Tasks

### High Priority

#### Backend: Flask API Server
**Status**: ⚪ Not Started
**Description**: `backend/app.py` — `POST /api/run`, `GET /api/cartridges`, `GET /api/health`. Flask-CORS for Vite dev server.
**Acceptance Criteria**:
- [ ] `GET /api/health` returns `{"status": "ok"}`
- [ ] `POST /api/run` accepts file upload + ticker/start/end/cash params
- [ ] Returns JSON with `sharpe`, `max_drawdown`, `total_return`, `equity_curve`, `trades`
**Estimated Effort**: Medium (2-3 days)

---

#### Backend: Cerebro Runner
**Status**: ⚪ Not Started
**Description**: `backend/engine/cerebro_runner.py` — fresh `bt.Cerebro()` per run, yfinance data feed, 5 analyzers, returns structured results dict with equity curve time series.
**Acceptance Criteria**:
- [ ] Stateless — new Cerebro per call
- [ ] Adds: SharpeRatio, DrawDown, TradeAnalyzer, Returns, AnnualReturn
- [ ] Returns `equity_curve` as time series (for Three.js terrain vertices)
- [ ] Returns `trades` list with entry/exit/P&L (for 3D markers)
**Estimated Effort**: Medium (2-3 days)

---

#### Backend: Strategy Loader
**Status**: ⚪ Not Started
**Description**: `backend/engine/strategy_loader.py` — detects file type, routes to correct loader/adapter, always falls back to demo strategy on failure.
**Acceptance Criteria**:
- [ ] `.py` → validates `bt.Strategy` subclass, confirms `next()` exists
- [ ] `.pine` → routes to PineScript adapter
- [ ] `.mq4/.mq5` → routes to MQL adapter
- [ ] Graceful fallback to SMA demo strategy on any error
**Estimated Effort**: Medium (2-3 days)

---

#### Frontend: Three.js Scene Setup
**Status**: ⚪ Not Started
**Description**: `frontend/src/main.js` — WebGLRenderer, PerspectiveCamera, damped OrbitControls, lighting rig (neon cyan/purple palette).
**Acceptance Criteria**:
**Description**: Regex extraction from PineScript v5 — `ta.sma`, `ta.ema`, `ta.rsi`, `ta.macd`, `ta.bb`, `strategy.entry`, `strategy.close` → generates Backtrader strategy class dynamically.
**Estimated Effort**: Large (3-4 days)

#### Frontend: 3D Equity Terrain (ChartWorld)
**Status**: ⚪ Not Started
**Description**: `PlaneGeometry` vertex height = equity value. Green peaks, red valleys. Animated camera fly-through on reveal. Trade markers (buy=green spike, sell=red spike).
**Estimated Effort**: Large (3-4 days)

#### Frontend: HUD Meters
**Status**: ⚪ Not Started
**Description**: Sharpe speedometer, drawdown gauge, win rate fill bar, return odometer. Achievement badge system.
**Estimated Effort**: Medium (2-3 days)

#### Frontend: Retro Menu Screen
**Status**: ⚪ Not Started
**Description**: CRT start screen, blinking cursor, cartridge library as game titles.
**Estimated Effort**: Small (1-2 days)

---

### Low Priority / Nice to Have

- [ ] MQL adapter — pattern detection skeleton — Medium
- [ ] Sound FX system (Web Audio API) — Small
- [ ] CRT scanline shader + bloom post-processing — Small
- [ ] WebSocket streaming for real-time equity curve during run
- [ ] Multi-cartridge comparison (side-by-side 3D terrains)
- [ ] Strategy achievement leaderboard (local storage)
- [ ] Polygon.io premium data feed adapter

---

## Backlog (Ready for Development)

- [ ] `backend/engine/metrics_extractor.py` — Sortino, Calmar, Kelly, monthly heatmap — Medium
- [ ] `backend/data/data_provider.py` — CSV upload + yfinance caching — Small
- [ ] `cartridges/sma_cross.py` — Tutorial cartridge — Small
- [ ] `cartridges/rsi_reversal.py` — RSI reversal with ATR sizing — Small
- [ ] `cartridges/bollinger_breakout.py` — Bollinger squeeze breakout — Small

---

## Technical Debt

### Critical
- [ ] Strategy `exec()` sandbox — namespace restriction audit required before multi-user

### Important
- [ ] PineScript adapter needs unit tests per `ta.*` pattern
- [ ] Full exception coverage in `cerebro_runner.py`

---

## Completed This Sprint

- [x] Project architecture designed — 2026-03-02
- [x] 5 ADRs written (decisions.md) — 2026-03-02
- [x] All 4 doc files created (decisions, memory, tasks, llms.txt) — 2026-03-02
- [x] README written — 2026-03-02
- [x] Full project scaffold created — 2026-03-02
- [x] Initial git commit — 2026-03-02

---

**Last Updated**: 2026-03-02
**Next Planning Session**: 2026-03-16

---

## Status Correction (2026-03-02)

The task statuses above describe the original scaffold plan and are now partially outdated.

### Implemented or Partially Implemented

- Backend: Flask API Server -> Implemented baseline routes in `backend/app.py`
- Backend: Cerebro Runner -> Implemented baseline runner in `backend/engine/cerebro_runner.py`
- Backend: Strategy Loader -> Implemented baseline loader and adapters in `backend/engine/strategy_loader.py`
- Frontend: Three.js Scene Setup -> `frontend/src/main.js` exists and now has the missing dependent modules
- **[Completed]** Full local smoke test with installed dependencies
- **[Completed]** Higher-fidelity 3D console, GSAP cartridge animation, and dynamic file type colors implemented

### Still Open

- Polished terrain rendering (Chartworld)
- Stronger metrics depth, sandbox hardening, and adapter test coverage
