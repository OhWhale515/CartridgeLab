"""
CartridgeLab - Crypto Breakout Blitz
Arcade-style breakout rush for crypto's fast expansion phases.

Theme:
- Neon sprint through volatility
- Score points by catching explosive range breaks
- Lose the run when the ATR shield cracks
"""
import backtrader as bt


class CryptoBreakoutBlitz(bt.Strategy):
    """
    Game theme: high-speed arcade breakout.

    Logic:
    - Round start: detect bull or bear control with EMA structure.
    - Combo meter: require ADX confirmation to avoid dead rounds.
    - Power dash: enter on a fresh Donchian-style range break.
    - Shield break: exit with an ATR trailing stop or a regime flip.
    """

    params = (
        ('fast_ema', 15),
        ('slow_ema', 40),
        ('breakout_period', 18),
        ('adx_period', 14),
        ('adx_floor', 24),
        ('atr_period', 14),
        ('trail_atr_mult', 2.8),
    )

    def __init__(self):
        self.fast = bt.indicators.EMA(self.data.close, period=self.p.fast_ema)
        self.slow = bt.indicators.EMA(self.data.close, period=self.p.slow_ema)
        self.adx = bt.indicators.ADX(self.data, period=self.p.adx_period)
        self.highest = bt.indicators.Highest(self.data.high(-1), period=self.p.breakout_period)
        self.lowest = bt.indicators.Lowest(self.data.low(-1), period=self.p.breakout_period)
        self.atr = bt.indicators.ATR(self.data, period=self.p.atr_period)
        self.order = None
        self.extreme_price = None
        self.stop_price = None

    def notify_order(self, order):
        if order.status in [order.Completed]:
            if self.position.size > 0:
                self.extreme_price = order.executed.price
                self.stop_price = order.executed.price - (self.atr[0] * self.p.trail_atr_mult)
            elif self.position.size < 0:
                self.extreme_price = order.executed.price
                self.stop_price = order.executed.price + (self.atr[0] * self.p.trail_atr_mult)
            else:
                self.extreme_price = None
                self.stop_price = None

        if order.status in [order.Completed, order.Cancelled, order.Rejected]:
            self.order = None

    def next(self):
        if self.order:
            return

        bullish_regime = self.fast[0] > self.slow[0]
        bearish_regime = self.fast[0] < self.slow[0]
        trend_strength = self.adx[0] > self.p.adx_floor

        if not self.position:
            if bullish_regime and trend_strength and self.data.close[0] > self.highest[0]:
                self.order = self.buy()
            elif bearish_regime and trend_strength and self.data.close[0] < self.lowest[0]:
                self.order = self.sell()
            return

        if self.position.size > 0:
            if self.extreme_price is None or self.data.close[0] > self.extreme_price:
                self.extreme_price = self.data.close[0]
            trailing_stop = self.extreme_price - (self.atr[0] * self.p.trail_atr_mult)
            if self.stop_price is None or trailing_stop > self.stop_price:
                self.stop_price = trailing_stop
            if self.data.close[0] < self.stop_price or bearish_regime:
                self.order = self.close()
            return

        if self.extreme_price is None or self.data.close[0] < self.extreme_price:
            self.extreme_price = self.data.close[0]
        trailing_stop = self.extreme_price + (self.atr[0] * self.p.trail_atr_mult)
        if self.stop_price is None or trailing_stop < self.stop_price:
            self.stop_price = trailing_stop
        if self.data.close[0] > self.stop_price or bullish_regime:
            self.order = self.close()
