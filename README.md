# CartridgeLab 🎮📈

> *"If it isn't fun, it goes." — Shigeru Miyamoto*

**CartridgeLab** is a trading strategy backtesting platform where **your strategy file IS the cartridge** and **the engine IS the console**.

---

## Quick Start

### 1. Backend (Console Engine)
```bash
cd backend
pip install -r requirements.txt
python app.py
# → http://localhost:5000
```

### 2. Frontend (Console UI)
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 3. Insert a Cartridge
Open the browser. Drag any file from `cartridges/` onto the 3D console slot.

| Cartridge | Strategy | Level |
|-----------|----------|-------|
| `sma_cross.py` | 50/200 SMA Cross | ⭐ Tutorial |
| `rsi_reversal.py` | RSI Mean-Reversion | ⭐⭐ Intermediate |
| `bollinger_breakout.py` | Bollinger Squeeze | ⭐⭐⭐ Advanced |
| `trend_quest.py` | Macro breakout baseline | Demo Boss Run |
| `crypto_breakout_blitz.py` | Crypto arcade breakout | Asset Demo |
| `forex_range_raid.py` | Forex arena counter-fighter | Asset Demo |
| `metals_momentum_guard.py` | Metals heavyweight boss fight | Asset Demo |
| `stock_pullback_story.py` | Stock campaign mode | Asset Demo |
| `sample_pine.pine` | EMA+RSI PineScript | 🔷 PineScript |
| `sample_mql.mq4` | MA Cross MQL | 🔶 MQL Skeleton |

---

## Write Your Own Cartridge

```python
import backtrader as bt

class MyStrategy(bt.Strategy):
    params = (('fast', 10), ('slow', 30),)

    def __init__(self):
        self.fast_ma = bt.indicators.SMA(self.data.close, period=self.p.fast)
        self.slow_ma = bt.indicators.SMA(self.data.close, period=self.p.slow)
        self.crossover = bt.indicators.CrossOver(self.fast_ma, self.slow_ma)

    def next(self):
        if self.crossover > 0 and not self.position:
            self.buy()
        elif self.crossover < 0 and self.position:
            self.sell()
```
Save as `.py`, drop into the console. Done.

---

## API

### `POST /api/run`
| Field | Type | Description |
|-------|------|-------------|
| `file` | File | `.py` / `.pine` / `.mq4` |
| `ticker` | string | e.g. `SPY`, `AAPL`, `BTC-USD` |
| `start` | string | `YYYY-MM-DD` |
| `end` | string | `YYYY-MM-DD` |
| `cash` | number | Starting capital (default: 100000) |

**Response**: `sharpe`, `max_drawdown`, `total_return`, `win_rate`, `equity_curve`, `trades`

Also available:
- `GET /api/cartridges` returns the sample cartridge catalog
- `GET /api/cartridge-file/<filename>` returns a sample cartridge file for preset runs
- `GET /api/health` returns a basic health payload

### `GET /api/cartridges` — List sample cartridges
### `GET /api/health` — Health check

---

## Design DNA

| Influence | Principle | How It Shapes CartridgeLab |
|-----------|-----------|---------------------------|
| **Jim Simons** | Signal over noise; continuous refinement | Rich stats (Sharpe, Sortino, Calmar); cartridge loop drives iteration |
| **Gunpei Yokoi** | Lateral thinking with withered technology | Proven tools (Three.js, Flask, Backtrader) in a radical new paradigm |
| **Shigeru Miyamoto** | "If it isn't fun, it goes" | Every interaction has a satisfying reward loop |
| **Yoshio Sakamoto** | Worlds that reward exploration | Equity terrain is a world to fly through, not just a chart |

---

## Strategy Support

| Format | Support | Notes |
|--------|---------|-------|
| Python `.py` | ✅ Full | Must subclass `bt.Strategy` |
| PineScript `.pine` | 🔷 Adapter | Common `ta.*` patterns |
| MQL4/5 | 🔶 Skeleton | Approximate — v2 for full support |

---

*CartridgeLab — Where strategies become games.*
---

## Local And Vercel Modes

Standard local mode:
- Backend: `pip install -r backend/requirements.txt`
- Frontend: `cd frontend && npm install && npm run dev`

Self-contained local mode:
- Run `backend/install_local_deps.ps1 -Mode core` for a minimal local vendor overlay
- Run `backend/install_local_deps.ps1 -Mode full` to vendor the full Python dependency set into `backend/.vendor`
- `backend/app.py` auto-loads `backend/.vendor` when present

Vercel mode:
- `api/index.py` is the Python serverless entrypoint
- `api/requirements.txt` provides the backend runtime dependencies for deployment
- The repo root `package.json` can build the frontend with `npm run build`
