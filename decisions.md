# Architecture Decision Records — CartridgeLab

This document captures important architectural and technical decisions, the context in which they were made, and their consequences.

Format based on [Michael Nygard's ADR template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

---

## Active Decisions

---

### ADR-001: Console-Cartridge Interaction Paradigm

**Date**: 2026-03-02

**Status**: Accepted

**Context**

Traditional backtesting platforms present a sterile, form-based UX: enter ticker, date range, hit run, receive a static chart. User engagement is minimal. We need a paradigm that makes strategy interrogation feel alive and rewarding — something that makes traders *want* to iterate. Jim Simons ran Medallion by obsessively refining signals; we need a UX that drives that same refine-and-retry loop. Gunpei Yokoi's lateral thinking principle gives us the answer: use the language of a known metaphor (gaming cartridges) and apply it to an entirely new domain (strategy files).

**Decision**

We will model the entire system on 1990s-2000s gaming console mechanics. The Backtrader engine is the console. User strategy files (`.py`, `.pine`, `.mq4`) are the cartridges. Inserting a file into the drag-drop zone triggers a 3D cartridge animation and initiates the backtest. Results are rendered as an explorable 3D terrain, not a flat chart.

**Consequences**

**Positive**:
- Creates a uniquely memorable and differentiated UX
- The reward loop (insert → discover → refine → reinsert) mirrors both game design best practices and quant research workflows
- Metaphor is universally understood — zero onboarding required
- Encourages iterative strategy refinement (Simons' continuous refinement principle)

**Negative**:
- Higher frontend complexity than a standard dashboard
- 3D rendering adds GPU load — not ideal for low-end browsers
- The metaphor may feel gimmicky to die-hard quants if not executed with sufficient depth

**Alternatives Considered**

- **Standard dashboard (Streamlit/Grafana)**: Fast to build but zero differentiation and no engagement loop
- **Terminal-only CLI**: Purist quant approach but alienates non-technical traders
- **2D drag-drop web app**: Better than forms but misses the visceral interaction

---

### ADR-002: Backtrader as the Core Execution Engine

**Date**: 2026-03-02

**Status**: Accepted

**Context**

We need a Python backtesting engine that: (1) supports multiple data feeds, (2) has rich analyzer APIs (Sharpe, DrawDown, TradeAnalyzer), (3) can dynamically load strategy classes at runtime, and (4) is battle-tested. Zipline is deprecated. `backtesting.py` is simpler but lacks analyzer depth. Backtrader's `Cerebro` architecture maps perfectly to the console metaphor — `cerebro.run()` is literally "press play."

**Decision**

We will use Backtrader as the sole backtesting execution engine. `Cerebro` is instantiated fresh per cartridge run. Strategies are dynamically loaded via `exec()` in a controlled namespace. Analyzers (`SharpeRatio`, `DrawDown`, `TradeAnalyzer`, `Returns`, `AnnualReturn`) are added programmatically before each run.

**Consequences**

**Positive**:
- Cerebro's lifecycle (add data → add strategy → run → extract results) is clean and predictable
- Rich built-in analyzers cover all Renaissance-style metrics we need
- Dynamic strategy loading enables the cartridge metaphor

**Negative**:
- Backtrader development has slowed; some edge cases require workarounds
- `exec()` for strategy loading requires careful sandboxing

**Alternatives Considered**

- **Zipline**: Deprecated by Quantopian
- **backtesting.py**: Insufficient analyzer depth
- **VectorBT**: Requires vectorized approach — incompatible with OOP cartridge loading

---

### ADR-003: Three.js for 3D Visualization (Withered Technology Principle)

**Date**: 2026-03-02

**Status**: Accepted

**Context**

Following Gunpei Yokoi's "Lateral Thinking with Withered Technology" — Three.js is a mature, well-documented, widely understood WebGL library. It is not bleeding edge but it is reliable, lightweight, and allows us to build exactly what we need. Our innovation is in the *creative application*, not the technology choice.

**Decision**

We will use Three.js (r160+) with Vite as the build tool. Post-processing via `EffectComposer` for CRT scanline + bloom effects. GSAP for animation tweening. No heavy game engine frameworks.

**Consequences**

**Positive**:
- Minimal bundle size vs game engine alternatives
- Runs in any modern browser without plugins
- Vite provides fast HMR dev experience

**Negative**:
- Manual scene management (no entity-component system)
- Advanced shadows require careful setup

**Alternatives Considered**

- **Babylon.js**: More features but heavier
- **Unity WebGL**: Massive overkill for a data viz tool

---

### ADR-004: Strategy File Support Scope (v1)

**Date**: 2026-03-02

**Status**: Accepted

**Decision**

- **Python `.py`**: Full native execution via `exec()`. Must subclass `bt.Strategy`.
- **PineScript `.pine`**: Best-effort regex extraction of `ta.sma`, `ta.ema`, `ta.rsi`, `ta.macd`, `ta.bb`, `strategy.entry`, `strategy.close`. Generates equivalent Backtrader strategy.
- **MQL4/5 `.mq4/.mq5`**: Indicator signature scanning only. Generates approximate skeleton. Full MQL execution is v2.

**Consequences**

**Positive**: Ships without MetaTrader dependency. PineScript covers 80% of common patterns.

**Negative**: MQL strategies will be approximations — marked clearly in UI.

---

### ADR-005: yfinance as Default Data Provider

**Date**: 2026-03-02

**Status**: Accepted

**Decision**

Use `yfinance` as the default provider. CSV upload supported as fallback for custom data.

**Consequences**

**Positive**: Zero API key required — instant onboarding. Covers equities, ETFs, crypto, forex.

**Negative**: Unofficial API — occasional data gaps. Rate limited for parallel runs.

**Alternatives Considered**: Polygon.io (requires paid key), Alpha Vantage (aggressively rate-limited).

---

## Superseded Decisions

*None yet.*
