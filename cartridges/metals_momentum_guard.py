"""
CartridgeLab - Metals Momentum Guard
Heavy boss-fight cartridge built for gold and other metals.

Theme:
- Slow, weighty moves instead of frantic speed
- Wait for a guarded opening, then press momentum
- Hold position until the metal guardian loses force
"""
import backtrader as bt


class MetalsMomentumGuard(bt.Strategy):
    """
    Game theme: heavyweight momentum duel.

    Logic:
    - Boss phase: use MACD above/below zero to define macro momentum.
    - Guard drop: wait for price to retrace toward a fast EMA instead of chasing.
    - Heavy swing: re-enter with momentum once price reclaims the EMA.
    - Knockout check: exit with an ATR stop or on MACD momentum failure.
    """

    params = (
        ('trend_ema', 50),
        ('trigger_ema', 21),
        ('macd_fast', 12),
        ('macd_slow', 26),
        ('macd_signal', 9),
        ('atr_period', 14),
        ('trail_atr_mult', 2.6),
    )

    def __init__(self):
        self.trend = bt.indicators.EMA(self.data.close, period=self.p.trend_ema)
        self.trigger = bt.indicators.EMA(self.data.close, period=self.p.trigger_ema)
        self.macd = bt.indicators.MACD(
            self.data.close,
            period_me1=self.p.macd_fast,
            period_me2=self.p.macd_slow,
            period_signal=self.p.macd_signal
        )
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

        bullish_bias = self.data.close[0] > self.trend[0] and self.macd.macd[0] > 0
        bearish_bias = self.data.close[0] < self.trend[0] and self.macd.macd[0] < 0
        long_reclaim = self.data.close[-1] <= self.trigger[-1] and self.data.close[0] > self.trigger[0]
        short_reject = self.data.close[-1] >= self.trigger[-1] and self.data.close[0] < self.trigger[0]

        if not self.position:
            if bullish_bias and long_reclaim:
                self.order = self.buy()
            elif bearish_bias and short_reject:
                self.order = self.sell()
            return

        if self.position.size > 0:
            if self.extreme_price is None or self.data.close[0] > self.extreme_price:
                self.extreme_price = self.data.close[0]
            trailing_stop = self.extreme_price - (self.atr[0] * self.p.trail_atr_mult)
            if self.stop_price is None or trailing_stop > self.stop_price:
                self.stop_price = trailing_stop
            if self.data.close[0] < self.stop_price or self.macd.macd[0] < self.macd.signal[0]:
                self.order = self.close()
            return

        if self.extreme_price is None or self.data.close[0] < self.extreme_price:
            self.extreme_price = self.data.close[0]
        trailing_stop = self.extreme_price + (self.atr[0] * self.p.trail_atr_mult)
        if self.stop_price is None or trailing_stop < self.stop_price:
            self.stop_price = trailing_stop
        if self.data.close[0] > self.stop_price or self.macd.macd[0] > self.macd.signal[0]:
            self.order = self.close()
