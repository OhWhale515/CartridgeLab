"""
Execution simulation helpers.

This is the first reusable layer for fill assumptions that can later become a
standalone custom fill engine independent of Backtrader's broker.
"""
from __future__ import annotations


VALID_FILL_POLICIES = {'bar_close', 'next_open', 'strict_limit', 'aggressive'}


def normalize_execution_config(execution_config: dict | None = None) -> dict:
    """Normalize incoming execution assumptions into one engine-friendly config."""
    config = execution_config or {}
    spread_bps = _non_negative_bps(config.get('spread_bps', 2.0))
    slippage_bps = _non_negative_bps(config.get('slippage_bps', 1.0))
    commission_bps = _non_negative_bps(config.get('commission_bps', 10.0))
    fill_policy = _normalize_fill_policy(config.get('fill_policy', 'bar_close'))
    effective_execution_bps = round(slippage_bps + (spread_bps / 2), 4)
    return {
        'spread_bps': round(spread_bps, 4),
        'slippage_bps': round(slippage_bps, 4),
        'commission_bps': round(commission_bps, 4),
        'effective_execution_bps': effective_execution_bps,
        'fill_model': fill_policy,
    }


def build_fill_stress_summary(order_lifecycle: list, execution_assumptions: dict | None = None) -> dict:
    """Estimate how much of the run is exposed to execution frictions."""
    assumptions = execution_assumptions or {}
    lifecycle = list(order_lifecycle or [])
    completed = [
        row for row in lifecycle
        if str(row.get('final_status') or '').lower() in {'completed', 'partial'}
    ]
    expected_friction_bps = float(assumptions.get('effective_execution_bps') or 0.0)
    impacted_count = sum(
        1 for row in completed
        if abs(float(row.get('fill_gap_bps') or 0.0)) >= 0.01
    )
    modeled_cost = round((expected_friction_bps / 10000) * len(completed), 6)
    return {
        'fill_model': assumptions.get('fill_model', 'bar_close'),
        'expected_friction_bps': round(expected_friction_bps, 4),
        'completed_orders': len(completed),
        'impacted_orders': impacted_count,
        'impact_rate': round((impacted_count / len(completed)) * 100, 2) if completed else 0.0,
        'modeled_cost_ratio': modeled_cost,
    }


def _normalize_fill_policy(value) -> str:
    policy = str(value or 'bar_close').strip().lower()
    return policy if policy in VALID_FILL_POLICIES else 'bar_close'


def _non_negative_bps(value) -> float:
    try:
        return max(float(value or 0.0), 0.0)
    except Exception:
        return 0.0
