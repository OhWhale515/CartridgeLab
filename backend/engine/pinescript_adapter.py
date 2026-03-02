"""
CartridgeLab — PineScript Adapter
Translates PineScript v5 strategy patterns into a Backtrader Strategy class.
Uses regex extraction — covers the most common ta.* indicator calls and strategy.entry/close signals.
This is lateral thinking in action: use pattern recognition to bridge two completely different languages.
"""
import re
import backtrader as bt
from typing import Type


# Supported indicator patterns and their Backtrader equivalents
INDICATOR_PATTERNS = {
    r'ta\.sma\(([^,]+),\s*(\d+)\)': ('SMA', 'close', None),
    r'ta\.ema\(([^,]+),\s*(\d+)\)': ('EMA', 'close', None),
    r'ta\.rsi\(([^,]+),\s*(\d+)\)': ('RSI', 'close', None),
    r'ta\.macd\(([^)]+)\)': ('MACD', 'close', None),
    r'ta\.bb\(([^,]+),\s*(\d+)\)': ('BollingerBands', 'close', None),
    r'ta\.atr\((\d+)\)': ('ATR', None, None),
}


def pinescript_to_strategy(content: str) -> Type[bt.Strategy]:
    """
    Parse PineScript content and generate an equivalent Backtrader Strategy.

    Detection priority:
    1. EMA crossover signals
    2. SMA crossover signals
    3. RSI overbought/oversold
    4. Bollinger Band breakout
    5. MACD cross
    6. Default fallback: SMA(9/21) cross
    """
    content_lower = content.lower()

    # Detect fast/slow periods for MA strategies
    fast_period = _extract_period(content, ['fast', 'short', 'f_'], default=9)
    slow_period = _extract_period(content, ['slow', 'long', 's_'], default=21)
    rsi_period = _extract_period(content, ['rsi'], default=14)
    rsi_ob = _extract_threshold(content, ['overbought', 'ob'], default=70)
    rsi_os = _extract_threshold(content, ['oversold', 'os'], default=30)

    # EMA cross strategy
    if 'ta.ema' in content_lower or 'ema(' in content_lower:
        return _build_ma_cross_strategy('EMA', fast_period, slow_period, rsi_period, rsi_ob, rsi_os)

    # SMA cross strategy
    if 'ta.sma' in content_lower or 'sma(' in content_lower:
        return _build_ma_cross_strategy('SMA', fast_period, slow_period, rsi_period, rsi_ob, rsi_os)

    # RSI-only strategy
    if 'ta.rsi' in content_lower or 'rsi(' in content_lower:
        return _build_rsi_strategy(rsi_period, rsi_ob, rsi_os)

    # Bollinger Bands
    if 'ta.bb' in content_lower or 'bollinger' in content_lower:
        return _build_bb_strategy(slow_period)

    # Default: SMA crossover
    return _build_ma_cross_strategy('SMA', 9, 21, 14, 70, 30)


def _build_ma_cross_strategy(ma_type: str, fast: int, slow: int,
                              rsi_period: int, rsi_ob: int, rsi_os: int) -> Type[bt.Strategy]:
    ma_cls = bt.indicators.EMA if ma_type == 'EMA' else bt.indicators.SMA

    class PineScriptMACross(bt.Strategy):
        params = (
            ('fast', fast), ('slow', slow),
            ('rsi_period', rsi_period), ('rsi_ob', rsi_ob), ('rsi_os', rsi_os),
        )

        def __init__(self):
            ma_fast = ma_cls(self.data.close, period=self.p.fast)
            ma_slow = ma_cls(self.data.close, period=self.p.slow)
            self.crossover = bt.indicators.CrossOver(ma_fast, ma_slow)
            self.rsi = bt.indicators.RSI(self.data.close, period=self.p.rsi_period)

        def next(self):
            if self.crossover > 0 and self.rsi < self.p.rsi_ob and not self.position:
                self.buy()
            elif (self.crossover < 0 or self.rsi > self.p.rsi_ob) and self.position:
                self.sell()

    PineScriptMACross.__name__ = f'Pine{ma_type}Cross_{fast}_{slow}'
    return PineScriptMACross


def _build_rsi_strategy(period: int, ob: int, os: int) -> Type[bt.Strategy]:
    class PineScriptRSI(bt.Strategy):
        params = (('period', period), ('ob', ob), ('os', os),)

        def __init__(self):
            self.rsi = bt.indicators.RSI(self.data.close, period=self.p.period)

        def next(self):
            if self.rsi < self.p.os and not self.position:
                self.buy()
            elif self.rsi > self.p.ob and self.position:
                self.sell()

    return PineScriptRSI


def _build_bb_strategy(period: int) -> Type[bt.Strategy]:
    class PineScriptBollinger(bt.Strategy):
        params = (('period', period), ('devfactor', 2.0),)

        def __init__(self):
            self.bb = bt.indicators.BollingerBands(
                self.data.close, period=self.p.period, devfactor=self.p.devfactor
            )

        def next(self):
            if self.data.close[0] > self.bb.lines.top[0] and not self.position:
                self.buy()
            elif self.data.close[0] < self.bb.lines.mid[0] and self.position:
                self.sell()

    return PineScriptBollinger


def _extract_period(content: str, keywords: list, default: int) -> int:
    for kw in keywords:
        match = re.search(rf'{kw}[_\s]*(?:period|length|len)?\s*[=:]\s*(\d+)', content, re.IGNORECASE)
        if match:
            return int(match.group(1))
    # Try to find any number near keyword
    for kw in keywords:
        match = re.search(rf'{kw}.*?(\d+)', content, re.IGNORECASE)
        if match:
            val = int(match.group(1))
            if 2 <= val <= 500:
                return val
    return default


def _extract_threshold(content: str, keywords: list, default: int) -> int:
    for kw in keywords:
        match = re.search(rf'{kw}\s*[=:]\s*(\d+)', content, re.IGNORECASE)
        if match:
            val = int(match.group(1))
            if 0 <= val <= 100:
                return val
    return default
