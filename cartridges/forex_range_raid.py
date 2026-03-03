"""
CartridgeLab - Forex Range Raid
Tactical arena fighter for major FX pairs that frequently oscillate.

Theme:
- Trap overextended opponents at the edges of the arena
- Counterattack when momentum is exhausted
- Cash out when price snaps back to center
"""
import backtrader as bt


class ForexRangeRaid(bt.Strategy):
    """
    Game theme: tactical counter-puncher.

    Logic:
    - Arena wall: wait for price to stretch outside Bollinger Bands.
    - Stun confirm: use short RSI to spot exhaustion.
    - Counter hit: fade the move back toward the middle band.
    - Reset round: exit at reversion target or ATR stop.
    """

    params = (
        ('bb_period', 20),
        ('bb_devfactor', 2.0),
        ('rsi_period', 7),
        ('rsi_low', 28),
        ('rsi_high', 72),
        ('atr_period', 14),
        ('stop_atr_mult', 1.8),
    )

    def __init__(self):
        self.bb = bt.indicators.BollingerBands(
            self.data.close,
            period=self.p.bb_period,
            devfactor=self.p.bb_devfactor
        )
        self.rsi = bt.indicators.RSI(self.data.close, period=self.p.rsi_period, safediv=True)
        self.atr = bt.indicators.ATR(self.data, period=self.p.atr_period)
        self.order = None
        self.stop_price = None

    def notify_order(self, order):
        if order.status in [order.Completed]:
            if self.position.size > 0:
                self.stop_price = order.executed.price - (self.atr[0] * self.p.stop_atr_mult)
            elif self.position.size < 0:
                self.stop_price = order.executed.price + (self.atr[0] * self.p.stop_atr_mult)
            else:
                self.stop_price = None

        if order.status in [order.Completed, order.Cancelled, order.Rejected]:
            self.order = None

    def next(self):
        if self.order:
            return

        close = self.data.close[0]
        mid = self.bb.lines.mid[0]
        top = self.bb.lines.top[0]
        bot = self.bb.lines.bot[0]

        if not self.position:
            if close < bot and self.rsi[0] < self.p.rsi_low:
                self.order = self.buy()
            elif close > top and self.rsi[0] > self.p.rsi_high:
                self.order = self.sell()
            return

        if self.position.size > 0:
            if close >= mid or close < self.stop_price:
                self.order = self.close()
            return

        if close <= mid or close > self.stop_price:
            self.order = self.close()
