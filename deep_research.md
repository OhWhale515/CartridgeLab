# CartridgeLab — Deep Research Report

This document contains extensively researched context for every founding figure, philosophy, technology, and quantitative concept referenced in the CartridgeLab project. It serves as the canonical knowledge base for reasoning about what to build next and *why*.

---

## Part I: The Founding Figures

### 1. Jim Simons & Renaissance Technologies

**Who**: James Harris Simons (1938–2024) was an American mathematician, hedge fund manager, and philanthropist. He founded Renaissance Technologies in 1982 and ran the **Medallion Fund**, which averaged **66% annual returns** before fees from 1988 to 2018 — the greatest track record in financial history.

**Core Philosophy — Signal Over Noise**:
- Simons hired **no traditional Wall Street traders**. His team consisted entirely of mathematicians, physicists, statisticians, and signal processing engineers — many recruited directly from IBM's speech recognition lab.
- The key insight: financial markets contain **non-random patterns** that are statistically exploitable, but only if you remove all human emotional bias and let the math speak.
- Renaissance uses **statistical arbitrage** — finding tiny, temporary mispricings between related instruments and exploiting them at massive scale (hundreds of thousands of trades per day).
- The **Kelly Criterion** is central to their position sizing: allocate capital proportionally to your edge, never more. Fractional Kelly (betting a fraction of what Kelly suggests) reduces volatility while preserving the growth-maximization principle.

**How This Applies to CartridgeLab**:

| Simons Principle | CartridgeLab Implementation |
|---|---|
| Signal over noise | Deep metrics (Sharpe, Sortino, Calmar, Kelly) — not just raw PnL |
| Continuous refinement | The cartridge re-insertion loop drives iteration |
| Statistical rigor | Every backtest run produces 5+ analyzer outputs |
| Automated execution | `Cerebro.run()` is fully deterministic and repeatable |
| Talent diversity | Support for `.py`, `.pine`, `.mq4` — meet traders where they are |

---

### 2. Gunpei Yokoi — Lateral Thinking with Withered Technology

**Who**: Gunpei Yokoi (1941–1997) was a legendary hardware designer at Nintendo. He created the Game & Watch, Game Boy, and the iconic D-pad. He led Nintendo's R&D1 division.

**Core Philosophy — 枯れた技術の水平思考 (Kareta Gijutsu no Suihei Shikō)**:
- **"Withered technology"** doesn't mean obsolete — it means **mature, reliable, and cheap**. Technology that has "weathered" the test of time.
- **"Lateral thinking"** means finding **creative new applications** for those mature technologies rather than chasing the bleeding edge.
- The **Game Boy** is the quintessential example: Yokoi deliberately chose a monochrome LCD screen when color was available. Why? Monochrome was **cheaper**, consumed **far less power** (enabling 30+ hours of battery life vs. 3–5 hours for the color Sega Game Gear), and was **nearly indestructible**. The result? Game Boy sold 118 million units.

**How This Applies to CartridgeLab**:

| Yokoi Principle | CartridgeLab Implementation |
|---|---|
| Use withered technology | Three.js (mature WebGL), Flask (stable Python web), Backtrader (proven engine) |
| Innovate in application | The lateral leap: treating a `.py` strategy file as a *game cartridge* |
| Gameplay > raw power | The **experience** of inserting + running matters more than GPU-melting visuals |
| Cost-effective + accessible | Runs in any modern browser, zero API keys for basic use |

---

### 3. Shigeru Miyamoto — "If It Isn't Fun, It Goes"

**Who**: Shigeru Miyamoto (b. 1952) is the creator of Super Mario, The Legend of Zelda, and Donkey Kong. He led Nintendo's EAD (Entertainment Analysis & Development) division.

**Core Philosophy — Tegotae (手応え)**:
- **Tegotae** is the Japanese concept of "satisfying response" — the feeling of pressing a button and receiving a precise, gratifying reaction. Miyamoto obsesses over this in every game: how does Mario's jump *feel*? How does Link's sword swing *land*?
- **Iterative prototyping**: Miyamoto is famous for "upending the tea table" — completely scrapping a design if it doesn't feel right, even late in development. Former Nintendo president Satoru Iwata called it "knocking down the house of cards."
- **Core mechanic first**: Before adding any features, the core action must be inherently enjoyable. In Super Mario 64, the team spent months perfecting Mario's movement before building a single level.

**How This Applies to CartridgeLab**:

| Miyamoto Principle | CartridgeLab Implementation |
|---|---|
| Tegotae | The cartridge insert animation + click sound must feel *physically satisfying* |
| Core mechanic first | Drop file → hear click → see results must be rewarding *before* adding analytics |
| Iterative prototyping | GSAP timeline tuning, rebuild console geometry until it feels right |
| Fun > completeness | Ship a polished core loop rather than a complete-but-sterile dashboard |

---

### 4. Yoshio Sakamoto — Atmospheric Depth & Environmental Storytelling

**Who**: Yoshio Sakamoto (b. 1959) is the co-creator and most frequent director of the Metroid series: Super Metroid, Metroid Fusion, Metroid Dread, and Metroid: Zero Mission.

**Core Philosophy — Tell the Story Through the World**:
- Super Metroid tells its entire story through **action, atmosphere, and ambient music** with almost no text. The player discovers narrative through *exploration*, not exposition.
- Sakamoto cultivates a "darkish, tense and serious" atmosphere — every pixel of the environment communicates mood, danger, and discovery.
- The E.M.M.I. encounters in Metroid Dread were designed to evoke "unsettling" feelings — the environment itself is the antagonist.

**How This Applies to CartridgeLab**:

| Sakamoto Principle | CartridgeLab Implementation |
|---|---|
| Environmental storytelling | The 3D equity terrain *is* the story: green peaks = profit, red valleys = drawdown |
| Mood through atmosphere | CRT scanline shader, fog, neon glow — the console room sets a tone |
| Discovery through exploration | Camera fly-through reveals the terrain; trade markers are discovered in context |
| Every detail communicates | LED pulse = system health, slot glow = insertion state, fog density = risk |

---

## Part II: Technology Deep Dives

### 5. Backtrader — Cerebro Architecture

- `Cerebro` is the **orchestrator**: add data → add strategy → add analyzers → `run()` → extract results.
- Fresh `Cerebro` per run ensures **statelessness** — critical for the cartridge metaphor (each cartridge gets a clean console boot).
- **Analyzers** (SharpeRatio, DrawDown, TradeAnalyzer, Returns, AnnualReturn) attach to the strategy and collect data during execution or generate summaries post-run.
- Dynamic strategy loading via `exec()` in a controlled namespace is powerful but requires **sandbox hardening** (restricting imports, blocking filesystem access, timeouts).

### 6. PineScript → Python Adapter Strategy

- The `pine-ta` library specifically replicates Pine Script v5 indicator calculations in Python using pandas/NumPy.
- Key translation patterns:
  - `ta.sma(close, 10)` → `df['close'].rolling(10).mean()`
  - `ta.ema(close, 10)` → `df['close'].ewm(span=10).mean()`
  - `ta.rsi(close, 14)` → Custom RSI using `diff()`, `clip()`, and `ewm()`
  - `close[1]` → `df['close'].shift(1)` (series indexing)
  - `nz()` → `pandas.fillna()`
- **Validation is critical**: outputs must be compared against real Pine Script results on the same data.

### 7. Three.js Equity Terrain (ChartWorld)

- `PlaneGeometry(width, height, widthSegments, heightSegments)` creates a vertex grid.
- Each vertex's Z-coordinate is displaced by the corresponding equity value (scaled to scene proportions).
- After modifying positions: `geometry.attributes.position.needsUpdate = true`.
- **Color mapping**: Per-vertex coloring via `geometry.attributes.color` — green for gains, red for losses, interpolated.
- **Trade markers**: `SphereGeometry` or `ConeGeometry` meshes positioned at (time, equity_value) coordinates — green cones for buys, red for sells.
- **Camera fly-through**: GSAP tween the camera position along a curve that follows the terrain's ridge line.

### 8. Quantitative Metrics Suite

| Metric | Formula / Meaning | Quality Threshold |
|---|---|---|
| **Sharpe Ratio** | (Return − Risk-Free Rate) / Std Dev of Returns | > 1.0 good, > 1.5 excellent, > 2.0 outstanding |
| **Sortino Ratio** | Excess Return / Downside Deviation | Higher = better downside protection |
| **Calmar Ratio** | CAGR / Max Drawdown | Higher = more return per unit of worst-case loss |
| **Kelly Criterion** | f* = (bp − q) / b | Optimal fraction of capital per trade |
| **Max Drawdown** | Largest peak-to-trough decline | < 10% = "Iron Stomach" achievement |
| **Win Rate** | Winning trades / Total trades | Context-dependent (high Sharpe can have low win rate) |
| **Profit Factor** | Gross Profit / Gross Loss | > 1.5 indicates edge |

---

## Part III: Systematic Reasoning — What to Build Next

Having internalized the research above, here are the priorities reasoned from first principles:

### Reasoning Chain

1. **Miyamoto says**: the core loop must feel satisfying *first*. Our insert animation exists but the GSAP drop needs verification in the browser. The cartridge color system is wired but wasn't confirmed visually. **→ Polish the core feel.**

2. **Sakamoto says**: the 3D terrain is the "world" — without it, there's no environmental story. Currently `chartworld.js` exists but renders only a basic terrain. **→ Build the immersive equity terrain with vertex displacement, per-vertex coloring, and trade markers.**

3. **Simons says**: metrics must be statistically meaningful, not just vanity numbers. Our HUD shows basic metrics but doesn't include Sortino, Calmar, or Kelly. **→ Deepen the metrics pipeline in `metrics_extractor.py`.**

4. **Yokoi says**: don't reach for new technology — deepen what we have. Three.js + GSAP + Backtrader are our "withered technology." The innovation is in application. **→ Use CRT shaders, bloom post-processing, and animated camera fly-throughs to elevate the existing stack.**

5. **The PineScript adapter** covers ~80% of common strategies according to ADR-004. This is a force multiplier for user reach. **→ Harden the regex adapter and add unit tests.**

### Proposed Sprint 2 Priorities (Ordered)

1. **ChartWorld 3D Terrain** — PlaneGeometry vertex displacement, green/red coloring, trade markers, camera fly-through
2. **CRT Post-Processing** — EffectComposer with UnrealBloomPass + custom scanline shader
3. **Metrics Depth** — Add Sortino, Calmar, Kelly, Profit Factor to `metrics_extractor.py` and HUD
4. **PineScript Adapter Hardening** — Unit tests for each `ta.*` pattern, edge case coverage
5. **Sandbox Hardening** — Restrict `exec()` namespace, add timeout, block dangerous imports
