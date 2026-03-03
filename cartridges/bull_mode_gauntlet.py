"""
CartridgeLab - Bull Mode Gauntlet
Long-only trend game built to press advantage during persistent equity uptrends.
"""
import backtrader as bt


class BullModeGauntlet(bt.Strategy):
    """
    Game theme: survive the gauntlet by only fighting with the dominant trend.

    Logic:
    - Only engage when the medium trend is bullish.
    - Enter when price breaks to a fresh short-term high inside that trend.
    - Size defensively with one position at a time.
    - Exit on an ATR trail break or a regime flip.
    """

    params = (
        ('fast_ema', 21),
        ('slow_ema', 55),
        ('breakout_period', 10),
        ('atr_period', 14),
        ('trail_atr_mult', 2.4),
    )

    def __init__(self):
        self.fast = bt.indicators.EMA(self.data.close, period=self.p.fast_ema)
        self.slow = bt.indicators.EMA(self.data.close, period=self.p.slow_ema)
        self.highest = bt.indicators.Highest(self.data.high(-1), period=self.p.breakout_period)
        self.atr = bt.indicators.ATR(self.data, period=self.p.atr_period)
        self.order = None
        self.highest_close = None
        self.stop_price = None

    def notify_order(self, order):
        if order.status in [order.Completed]:
            if order.isbuy():
                self.highest_close = order.executed.price
                self.stop_price = order.executed.price - (self.atr[0] * self.p.trail_atr_mult)
            else:
                self.highest_close = None
                self.stop_price = None

        if order.status in [order.Completed, order.Cancelled, order.Rejected]:
            self.order = None

    def next(self):
        if self.order:
            return

        bullish_regime = self.fast[0] > self.slow[0]

        if not self.position:
            breakout = self.data.close[0] > self.highest[0]
            if bullish_regime and breakout:
                self.order = self.buy()
            return

        if self.highest_close is None or self.data.close[0] > self.highest_close:
            self.highest_close = self.data.close[0]

        trailing_stop = self.highest_close - (self.atr[0] * self.p.trail_atr_mult)
        if self.stop_price is None or trailing_stop > self.stop_price:
            self.stop_price = trailing_stop

        if self.data.close[0] < self.stop_price or not bullish_regime:
            self.order = self.close()
