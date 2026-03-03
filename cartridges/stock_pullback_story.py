"""
CartridgeLab - Stock Pullback Story
Campaign-mode cartridge for long equity trends.

Theme:
- Climb through chapters of a steady bull run
- Buy controlled dips instead of chasing spikes
- Exit when the story arc gets overheated or breaks down
"""
import backtrader as bt


class StockPullbackStory(bt.Strategy):
    """
    Game theme: campaign progression through an uptrend.

    Logic:
    - Chapter select: only trade when the fast EMA is above the slow EMA.
    - Side quest: wait for a short-term RSI dip inside the uptrend.
    - Main mission: enter while price is still above structural support.
    - End scene: exit on overbought momentum, trend loss, or an ATR trailing stop.
    """

    params = (
        ('fast_ema', 20),
        ('slow_ema', 50),
        ('rsi_period', 5),
        ('pullback_rsi', 35),
        ('exit_rsi', 75),
        ('atr_period', 14),
        ('trail_atr_mult', 2.5),
    )

    def __init__(self):
        self.fast = bt.indicators.EMA(self.data.close, period=self.p.fast_ema)
        self.slow = bt.indicators.EMA(self.data.close, period=self.p.slow_ema)
        self.rsi = bt.indicators.RSI(self.data.close, period=self.p.rsi_period, safediv=True)
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
            pullback_ready = self.rsi[0] < self.p.pullback_rsi
            structure_holding = self.data.close[0] > self.slow[0]
            if bullish_regime and pullback_ready and structure_holding:
                self.order = self.buy()
            return

        if self.highest_close is None or self.data.close[0] > self.highest_close:
            self.highest_close = self.data.close[0]

        trailing_stop = self.highest_close - (self.atr[0] * self.p.trail_atr_mult)
        if self.stop_price is None or trailing_stop > self.stop_price:
            self.stop_price = trailing_stop

        trend_failed = not bullish_regime
        move_overheated = self.rsi[0] > self.p.exit_rsi
        stop_hit = self.data.close[0] < self.stop_price

        if trend_failed or move_overheated or stop_hit:
            self.order = self.close()
