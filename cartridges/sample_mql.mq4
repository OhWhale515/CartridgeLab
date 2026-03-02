//+------------------------------------------------------------------+
//|  CartridgeLab Sample MQL4 Cartridge                              |
//|  MA Crossover EA stub — tests the CartridgeLab MQL adapter       |
//|  NOTE: This is an approximation skeleton. CartridgeLab extracts  |
//|  iMA() signals and maps them to Backtrader indicators.           |
//+------------------------------------------------------------------+
#property copyright "CartridgeLab"
#property version   "1.00"
#property strict

// Input parameters
extern int FastMA_Period = 9;
extern int SlowMA_Period = 21;
extern double LotSize    = 0.1;
extern int    Slippage   = 3;

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit() {
   Print("CartridgeLab MQL Sample EA initialized");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert tick function                                              |
//+------------------------------------------------------------------+
void OnTick() {
   double fastMA = iMA(NULL, 0, FastMA_Period, 0, MODE_EMA, PRICE_CLOSE, 0);
   double slowMA = iMA(NULL, 0, SlowMA_Period, 0, MODE_EMA, PRICE_CLOSE, 0);
   double prevFastMA = iMA(NULL, 0, FastMA_Period, 0, MODE_EMA, PRICE_CLOSE, 1);
   double prevSlowMA = iMA(NULL, 0, SlowMA_Period, 0, MODE_EMA, PRICE_CLOSE, 1);

   // Golden cross: fast crosses above slow
   if (prevFastMA < prevSlowMA && fastMA > slowMA) {
      if (OrdersTotal() == 0) {
         OrderSend(Symbol(), OP_BUY, LotSize, Ask, Slippage, 0, 0, "CartridgeLab Buy", 0, 0, clrGreen);
      }
   }

   // Death cross: fast crosses below slow
   if (prevFastMA > prevSlowMA && fastMA < slowMA) {
      for (int i = OrdersTotal() - 1; i >= 0; i--) {
         if (OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
            if (OrderType() == OP_BUY) {
               OrderClose(OrderTicket(), OrderLots(), Bid, Slippage, clrRed);
            }
         }
      }
   }
}
