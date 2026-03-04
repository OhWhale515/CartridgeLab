import * as THREE from 'three';

/* ────────────────────────────────────────────────────────────────────
   Strategy Autopsy — Game Over Screen
   When a strategy fails (Sharpe < 0.5 or MaxDD > 25%),
   an atmospheric "GAME OVER" overlay appears showing:
   - Cause of death
   - The 3 worst trades
   - What-if analysis
   Inspired by Jim Simons: every failure is a signal to decode.
   ──────────────────────────────────────────────────────────────────── */

export function shouldShowAutopsy(results) {
    if (!results) {
        return false;
    }

    const sharpe = Number(results.sharpe ?? 1);
    const maxDD = Math.abs(Number(results.max_drawdown ?? 0));

    return sharpe < 0.5 || maxDD > 25;
}

export function generateAutopsyData(results) {
    if (!results) {
        return null;
    }

    const trades = results.trades || [];
    const equityCurve = results.equity_curve || [];

    /* ── find the 3 worst trades by PnL ── */
    const sortedTrades = [...trades]
        .map((t, i) => ({ ...t, index: i }))
        .sort((a, b) => Number(a.pnl ?? 0) - Number(b.pnl ?? 0));
    const worstTrades = sortedTrades.slice(0, 3);

    /* ── find the death point (max drawdown trough) ── */
    let peak = -Infinity;
    let maxDD = 0;
    let deathIndex = 0;
    let deathDate = '';

    equityCurve.forEach(([timestamp, value], index) => {
        if (value > peak) {
            peak = value;
        }
        const dd = ((peak - value) / peak) * 100;
        if (dd > maxDD) {
            maxDD = dd;
            deathIndex = index;
            deathDate = timestamp;
        }
    });

    /* ── determine cause of death ── */
    let causeOfDeath = 'Insufficient edge — strategy failed to generate alpha.';
    const totalPnL = trades.reduce((sum, t) => sum + Number(t.pnl ?? 0), 0);

    if (maxDD > 40) {
        causeOfDeath = `Catastrophic drawdown of ${maxDD.toFixed(1)}% — no risk management detected.`;
    } else if (maxDD > 25) {
        causeOfDeath = `Severe drawdown of ${maxDD.toFixed(1)}% — position sizing too aggressive.`;
    } else if (worstTrades[0] && Math.abs(Number(worstTrades[0].pnl)) > Math.abs(totalPnL)) {
        causeOfDeath = 'A single catastrophic trade wiped out all gains — consider stop-losses.';
    } else if (trades.length < 5) {
        causeOfDeath = 'Insufficient trade count — strategy may be over-fitted to specific conditions.';
    }

    /* ── calculate what-if (remove worst trade) ── */
    const worstPnL = worstTrades.length > 0 ? Number(worstTrades[0].pnl ?? 0) : 0;
    const adjustedReturn = totalPnL - worstPnL;

    return {
        causeOfDeath,
        deathDate,
        deathIndex,
        maxDrawdown: maxDD,
        worstTrades: worstTrades.map((t) => ({
            pnl: Number(t.pnl ?? 0).toFixed(2),
            index: t.index,
        })),
        totalPnL: totalPnL.toFixed(2),
        whatIfPnL: adjustedReturn.toFixed(2),
        sharpe: Number(results.sharpe ?? 0).toFixed(2),
        tradeCount: trades.length,
    };
}

export function showAutopsyOverlay(autopsyData) {
    removeAutopsyOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'autopsy-overlay';
    overlay.className = 'autopsy-overlay';

    const worstTradesHTML = autopsyData.worstTrades.map((t, i) => `
        <div class="autopsy-trade">
            <span class="autopsy-trade-rank">#${i + 1}</span>
            <span class="autopsy-trade-pnl">${Number(t.pnl) >= 0 ? '+' : ''}$${t.pnl}</span>
        </div>
    `).join('');

    overlay.innerHTML = `
        <div class="autopsy-card">
            <div class="autopsy-glitch-title" data-text="GAME OVER">GAME OVER</div>
            <div class="autopsy-subtitle">STRATEGY AUTOPSY REPORT</div>

            <div class="autopsy-section">
                <div class="autopsy-section-title">⚠ CAUSE OF DEATH</div>
                <div class="autopsy-cause">${autopsyData.causeOfDeath}</div>
            </div>

            <div class="autopsy-section">
                <div class="autopsy-section-title">💀 FATAL TRADES</div>
                <div class="autopsy-trades">${worstTradesHTML}</div>
            </div>

            <div class="autopsy-stats">
                <div class="autopsy-stat">
                    <span class="autopsy-stat-label">SHARPE</span>
                    <span class="autopsy-stat-value negative">${autopsyData.sharpe}</span>
                </div>
                <div class="autopsy-stat">
                    <span class="autopsy-stat-label">MAX DD</span>
                    <span class="autopsy-stat-value negative">${autopsyData.maxDrawdown.toFixed(1)}%</span>
                </div>
                <div class="autopsy-stat">
                    <span class="autopsy-stat-label">TOTAL P&L</span>
                    <span class="autopsy-stat-value negative">$${autopsyData.totalPnL}</span>
                </div>
                <div class="autopsy-stat">
                    <span class="autopsy-stat-label">WHAT IF</span>
                    <span class="autopsy-stat-value ${Number(autopsyData.whatIfPnL) >= 0 ? 'positive' : 'negative'}">$${autopsyData.whatIfPnL}</span>
                </div>
            </div>

            <div class="autopsy-footer">
                <div class="autopsy-hint">Every failed model at Renaissance was dissected to find the missing signal.</div>
                <button id="autopsy-retry" class="autopsy-retry" type="button">↻ INSERT NEW CARTRIDGE</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    /* fade in */
    requestAnimationFrame(() => {
        overlay.classList.add('is-visible');
    });

    /* retry button */
    const retryBtn = overlay.querySelector('#autopsy-retry');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            removeAutopsyOverlay();
        });
    }
}

export function removeAutopsyOverlay() {
    const existing = document.getElementById('autopsy-overlay');
    if (existing) {
        existing.classList.remove('is-visible');
        setTimeout(() => existing.remove(), 400);
    }
}
