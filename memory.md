# Project Memory — CartridgeLab

This document maintains a running history of what has been built, major changes, and important context for AI agents and developers.

---

## Current State

**Version**: 0.1.0
**Last Updated**: 2026-03-02
**Status**: Active Development — Initial Scaffold

### What's Working

- Project architecture fully designed (see `implementation_plan.md` in brain artifacts)
- 5 founding Architecture Decision Records written (`decisions.md`)
- Full directory structure scaffolded
- Sample cartridge strategies designed

### Known Issues

- Backend Flask + Backtrader engine not yet implemented
- Frontend Three.js scene not yet built
- PineScript and MQL adapters not yet coded
- Git remote not yet configured

### In Progress

- Full project scaffold + initial commit (Sprint 1, Day 1)

---

## Implementation History

### 2026-03-02 — Project Conception & Architecture Design

**What was built**: Full architectural blueprint for CartridgeLab. Complete research phase covering all founding domains.

**Why**: User requested a revolutionary backtesting platform that treats strategy files as gaming cartridges, fusing Jim Simons' quantitative rigor with Nintendo's lateral-thinking game design philosophy.

**Key changes**:
- Defined the Console-Cartridge paradigm (ADR-001)
- Selected Backtrader as execution engine (ADR-002)
- Selected Three.js + Vite as visualization layer (ADR-003)
- Defined strategy file support scope: Python (full), PineScript (adapter), MQL (skeleton) (ADR-004)
- Selected yfinance as default data provider (ADR-005)

**Files created**:
- `decisions.md` — 5 founding ADRs
- `memory.md` — This file
- `tasks.md` — Sprint 1 breakdown
- `llms.txt` — AI agent file map
- `README.md` — Setup and usage guide
- `backend/` — Flask + Backtrader scaffold
- `frontend/` — Three.js + Vite scaffold
- `cartridges/` — 5 sample strategy files

**Notes**: The name "CartridgeLab" reflects the dual nature: cartridge = gaming/strategy-file metaphor; lab = scientific rigor of quantitative research. Project lives at `E:\Sterling Storage\CartridgeLab`.

---

## Design DNA — Founding Inspirations

### Jim Simons / Renaissance Technologies
- **Principle**: Signal over noise, always. Every metric must be statistically meaningful.
- **Application**: Sharpe, Sortino, Calmar, Kelly, regime detection — not just raw returns.
- **Principle**: Continuous refinement. No model is final.
- **Application**: The cartridge metaphor explicitly encourages re-insertion and iteration.

### Gunpei Yokoi / Nintendo R&D1 — Lateral Thinking with Withered Technology
- **Principle**: Use mature, proven technology in creative new ways.
- **Application**: Three.js, Flask, Backtrader — proven tools. The lateral thinking is treating a strategy file as a gaming cartridge.

### Shigeru Miyamoto — "If It Isn't Fun, It Goes"
- **Principle**: Core mechanics must feel satisfying before any feature is added.
- **Application**: The cartridge insert animation + sound must feel satisfying before analytics.

### Yoshio Sakamoto — Atmospheric Depth
- **Principle**: Worlds that reward exploration and discovery.
- **Application**: The 3D equity terrain is a world to fly through — drawdown valleys, peak profits, trade markers tell a visual story.

---

## Architecture

### Current (v0.1.0)

Two-layer system:
1. **Backend**: Python Flask REST API + Backtrader engine. `Cerebro` is the console. Strategy files dynamically loaded and run. Results serialized to JSON.
2. **Frontend**: Three.js WebGL scene (Vite SPA). 3D console model accepts file drag-drop. Backtest results rendered as 3D equity terrain. HUD: Sharpe, drawdown, win rate.

Communication: REST (`POST /api/run`). Future: WebSocket for streaming progress.

---

## Major Milestones

- **2026-03-02**: Project conceived and architected — initial commit

---

## Dependencies

**Backend (Python)**: `backtrader`, `flask`, `flask-cors`, `yfinance`, `pandas`, `numpy`

**Frontend (Node.js)**: `three`, `gsap`, `vite`

---

## Future Considerations

- Strategy `exec()` sandbox needs hardening for multi-user scenarios
- PineScript adapter regex needs comprehensive test coverage
- Flask dev server needs Gunicorn + process pool for any production use
- Monitor `yfinance` for Yahoo Finance API changes
- Large equity curve datasets (10+ years daily) may need LOD for Three.js terrain

---

## 2026-03-02 Implementation Update

This section supersedes the earlier "initial scaffold" status where it conflicts with the current codebase.

### Implemented Since Scaffold

- Backend API routes now exist for `GET /api/health`, `GET /api/cartridges`, `GET /api/cartridge-file/<filename>`, and `POST /api/run`
- Backend strategy loading works for `.py`, `.pine`, `.mq4`, and `.mq5` files, with demo fallback behavior
- Backtest responses now include analyzer-backed metrics, a real equity-curve time series, and a closed-trade log
- Frontend now includes the missing baseline modules required by `main.js`: console, cartridge input, HUD, menu, chart world, and sound hooks

### Current Blockers

- Full smoke testing is still pending because package installation is failing in the current sandbox environment
- The frontend is functionally bootable in structure but still only at baseline visual fidelity
- The strategy execution model still needs sandbox hardening before handling untrusted inputs

---

## Resume Checkpoint

Use this section as the canonical restart point for the next session.

### What Was Completed

- Added dual local/deployment support:
  - `backend/bootstrap.py` loads `backend/.vendor` when present
  - `backend/install_local_deps.ps1` supports `-Mode core` and `-Mode full`
  - root `.npmrc` and `frontend/.npmrc` pin npm cache writes to `E:`
  - `api/index.py` and `api/requirements.txt` support a Vercel-style Python entrypoint
  - root `package.json` builds the frontend via `npm --prefix frontend run build`
- Added missing frontend baseline modules and confirmed the frontend build succeeds
- Added backend route support for:
  - `/api/health`
  - `/api/cartridges`
  - `/api/cartridge-file/<filename>`
  - `/api/run`
- Confirmed backend smoke tests for route import, health check, and sample cartridge file fetch

### What We Were Actively Fixing

- The real `POST /api/run` backtest path
- The Python cartridge sandbox was widened just enough to support:
  - `import backtrader as bt`
  - class definitions
  - execution inside a temporary module namespace
- The latest runtime issue moved from routing/loader failures into Backtrader execution itself

### Exact Next Step

- Re-run the direct backtest smoke test that was interrupted immediately after adding:
  - `cerebro.addobserver(bt.observers.Broker)` in `backend/engine/cerebro_runner.py`
- Then:
  - if `run_backtest()` succeeds, start local dev servers and run a Playwright browser test
  - if it still fails, continue debugging from the new traceback rather than restarting discovery
