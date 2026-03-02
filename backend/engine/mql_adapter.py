"""
CartridgeLab — MQL4/5 Adapter
Extracts indicator signatures from MQL4/5 EA files and generates an approximate Backtrader strategy.
v1 scope: pattern detection and skeleton generation only.
Full MQL runtime execution is v2 (requires MetaTrader 5 Python API integration).
"""
import re
import backtrader as bt
from typing import Type


MQL_INDICATOR_MAP = {
    'iMA': 'SMA',
    'iEMA': 'EMA',
    'iRSI': 'RSI',
    'iMACD': 'MACD',
    'iBands': 'BollingerBands',
    'iATR': 'ATR',
    'iStochastic': 'Stochastic',
}


def mql_to_strategy(content: str) -> Type[bt.Strategy]:
    """
    Parse MQL4/5 content, detect indicators, and generate an approximate Backtrader strategy.
    Marked as 'approximation' — logic extraction is pattern-based, not semantic.
    """
    detected = _detect_indicators(content)
    periods = _extract_mql_periods(content)

    fast = periods.get('fast', 9)
    slow = periods.get('slow', 21)

    if 'iMA' in detected or 'iEMA' in detected:
        return _build_mql_ma_strategy(fast, slow, detected)
    elif 'iRSI' in detected:
        return _build_mql_rsi_strategy(periods.get('rsi', 14))
    else:
        return _build_mql_ma_strategy(fast, slow, detected)


def _detect_indicators(content: str) -> list:
    found = []
    for mql_fn in MQL_INDICATOR_MAP:
        if mql_fn in content:
            found.append(mql_fn)
    return found


def _extract_mql_periods(content: str) -> dict:
    periods = {}
    # iMA(symbol, timeframe, PERIOD, shift, method, price)
    ma_matches = re.findall(r'iMA\([^,]+,[^,]+,\s*(\d+)', content)
    if len(ma_matches) >= 2:
        vals = sorted([int(x) for x in ma_matches[:2]])
        periods['fast'] = vals[0]
        periods['slow'] = vals[1]
    elif len(ma_matches) == 1:
        periods['fast'] = int(ma_matches[0])

    rsi_match = re.search(r'iRSI\([^,]+,[^,]+,\s*(\d+)', content)
    if rsi_match:
        periods['rsi'] = int(rsi_match.group(1))

    return periods


def _build_mql_ma_strategy(fast: int, slow: int, detected: list) -> Type[bt.Strategy]:
    ma_cls = bt.indicators.EMA if 'iEMA' in detected else bt.indicators.SMA

    class MQLApproximateStrategy(bt.Strategy):
        """
        Approximate translation of MQL4/5 EA.
        Logic: MA crossover skeleton — extracted from iMA() calls.
        Marked as approximation: OrderSend logic may not be fully replicated.
        """
        params = (('fast', fast), ('slow', slow),)

        def __init__(self):
            fast_ma = ma_cls(self.data.close, period=self.p.fast)
            slow_ma = ma_cls(self.data.close, period=self.p.slow)
            self.crossover = bt.indicators.CrossOver(fast_ma, slow_ma)

        def next(self):
            if self.crossover > 0 and not self.position:
                self.buy()
            elif self.crossover < 0 and self.position:
                self.sell()

    MQLApproximateStrategy.__name__ = f'MQL_MA_{fast}_{slow}_Approx'
    return MQLApproximateStrategy


def _build_mql_rsi_strategy(period: int) -> Type[bt.Strategy]:
    class MQLRSIApprox(bt.Strategy):
        params = (('period', period), ('ob', 70), ('os', 30),)

        def __init__(self):
            self.rsi = bt.indicators.RSI(self.data.close, period=self.p.period)

        def next(self):
            if self.rsi < self.p.os and not self.position:
                self.buy()
            elif self.rsi > self.p.ob and self.position:
                self.sell()

    return MQLRSIApprox
