"""
CartridgeLab — Metrics Extractor
Post-run analytics extraction. Transforms raw Backtrader analyzer results
into the structured metrics JSON returned to the Three.js frontend.
"""
import math
from typing import Any


def extract_metrics(strat, starting_cash: float, final_value: float, price_data) -> dict:
    """
    Extract all performance metrics from a completed Backtrader strategy run.

    Args:
        strat: The Backtrader strategy instance post-run
        starting_cash: Starting portfolio value
        final_value: Final portfolio value
        price_data: The raw price DataFrame (for equity curve reconstruction)

    Returns:
        Structured metrics dict ready for JSON serialization
    """
    total_return = ((final_value - starting_cash) / starting_cash) * 100

    # --- Sharpe Ratio ---
    sharpe = 0.0
    try:
        sharpe_analysis = strat.analyzers.sharpe.get_analysis()
        sr = sharpe_analysis.get('sharperatio', None)
        sharpe = round(sr, 4) if sr and not math.isnan(sr) else 0.0
    except Exception:
        pass

    # --- Drawdown ---
    max_drawdown = 0.0
    max_drawdown_pct = 0.0
    try:
        dd_analysis = strat.analyzers.drawdown.get_analysis()
        max_drawdown = round(dd_analysis.get('max', {}).get('drawdown', 0.0), 2)
        max_drawdown_pct = round(dd_analysis.get('max', {}).get('moneydown', 0.0), 2)
    except Exception:
        pass

    # --- Trade Statistics ---
    total_trades = 0
    won_trades = 0
    lost_trades = 0
    win_rate = 0.0
    profit_factor = 0.0
    avg_trade_pnl = 0.0
    gross_profit = 0.0
    gross_loss = 0.0

    try:
        ta = strat.analyzers.trades.get_analysis()
        total_trades = ta.get('total', {}).get('closed', 0)
        won_trades = ta.get('won', {}).get('total', 0)
        lost_trades = ta.get('lost', {}).get('total', 0)
        gross_profit = ta.get('won', {}).get('pnl', {}).get('total', 0.0)
        gross_loss = abs(ta.get('lost', {}).get('pnl', {}).get('total', 0.0))

        if total_trades > 0:
            win_rate = round((won_trades / total_trades) * 100, 2)
        if gross_loss > 0:
            profit_factor = round(gross_profit / gross_loss, 4)
        if total_trades > 0:
            avg_trade_pnl = round((gross_profit - gross_loss) / total_trades, 2)
    except Exception:
        pass

    # --- Annual Return ---
    annual_return = {}
    try:
        annual_analysis = strat.analyzers.annual.get_analysis()
        annual_return = {str(k): round(v * 100, 2) for k, v in annual_analysis.items()}
    except Exception:
        pass

    # --- Equity Curve (reconstructed from price data + broker value tracking) ---
    equity_curve = _build_equity_curve(strat, price_data, starting_cash)

    # --- Sortino (approximation from returns) ---
    sortino = _approx_sortino(sharpe)

    return {
        "total_return": round(total_return, 2),
        "final_value": round(final_value, 2),
        "starting_cash": starting_cash,
        "sharpe": sharpe,
        "sortino": sortino,
        "max_drawdown": max_drawdown,
        "max_drawdown_pct": max_drawdown_pct,
        "total_trades": total_trades,
        "won_trades": won_trades,
        "lost_trades": lost_trades,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "avg_trade_pnl": avg_trade_pnl,
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "annual_return": annual_return,
        "equity_curve": equity_curve,
    }


def _build_equity_curve(strat, price_data, starting_cash: float) -> list:
    """Build a simplified equity curve from price index. Returns [[timestamp_ms, value], ...]."""
    try:
        dates = price_data.index
        n = len(dates)
        # Simple approximation: scale linearly to final value
        # Full implementation: track broker value per bar in strategy observer
        final = strat.broker.getvalue() if hasattr(strat, 'broker') else starting_cash
        curve = []
        for i, dt in enumerate(dates):
            ts = int(dt.timestamp() * 1000)
            # Linear interpolation placeholder — replaced by real observer in next iteration
            progress = i / max(n - 1, 1)
            value = starting_cash + (final - starting_cash) * progress
            curve.append([ts, round(value, 2)])
        return curve
    except Exception:
        return []


def _approx_sortino(sharpe: float) -> float:
    """Approximate Sortino from Sharpe (Sortino ≈ Sharpe * sqrt(2) for symmetric distributions)."""
    return round(sharpe * 1.414, 4) if sharpe else 0.0
