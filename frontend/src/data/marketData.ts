import { MarketIndex, Equity } from "@/types/market";

export const initialIndices: MarketIndex[] = [
  {
    symbol: 'NIFTY50',
    name: 'NIFTY 50',
    value: 24347.85,
    change: -18.15,
    changePercent: -0.07,
  },
  {
    symbol: 'BANKNIFTY',
    name: 'BANK NIFTY',
    value: 57640.55,
    change: 149.50,
    changePercent: 0.26,
  },
  {
    symbol: 'SENSEX',
    name: 'SENSEX',
    value: 77808.52,
    change: -200.73,
    changePercent: -0.26,
  },
];

export const initialEquities: Equity[] = [
  // --- 1. CORE 10 PRODUCTION EQUITIES ---
  { symbol: "HDFCBANK", name: "1. Multi-Timeframe Trend Following", exchange: "NSE", price: 729.00, change: 2.00, changePercent: 0.28 },
  { symbol: "ICICIBANK", name: "2. Statistical Arbitrage & Pairs Trading", exchange: "NSE", price: 1415.30, change: 8.50, changePercent: 0.60 },
  { symbol: "RELIANCE", name: "3. Volatility Squeeze Breakout", exchange: "NSE", price: 1316.00, change: 6.00, changePercent: 0.46 },
  { symbol: "TCS", name: "4. Institutional VWAP Pullback Strategy", exchange: "NSE", price: 2313.20, change: -47.80, changePercent: -2.02 },
  { symbol: "INFY", name: "5. Multi-Timeframe Momentum", exchange: "NSE", price: 1139.90, change: -29.30, changePercent: -2.51 },
  { symbol: "NIFTY", name: "6. Delta-Neutral Options Theta Decay", exchange: "NSE", price: 24287.65, change: -78.50, changePercent: -0.32 },
  { symbol: "TATAMOTORS", name: "7. Opening Range Breakout", exchange: "NSE", price: 985.40, change: 1.20, changePercent: 0.12 },
  { symbol: "SBIN", name: "8. RSI Divergence + BB Reversal", exchange: "NSE", price: 1061.20, change: 4.80, changePercent: 0.45 },
  { symbol: "LT", name: "9. Multi-Factor Smart Beta Ranking", exchange: "NSE", price: 4086.70, change: 56.70, changePercent: 1.41 },
  { symbol: "BHARTIARTL", name: "10. AI Predictive Ensemble Classifier", exchange: "NSE", price: 1969.30, change: -12.40, changePercent: -0.63 },

  // --- 2. BANKING & FINANCIAL SERVICES ---
  { symbol: "KOTAKBANK", name: "Kotak Bank Supertrend Momentum Rider", exchange: "NSE", price: 1812.40, change: 11.20, changePercent: 0.62 },
  { symbol: "AXISBANK", name: "Axis Bank EMA Ribbon Breakout System", exchange: "NSE", price: 1184.60, change: 7.40, changePercent: 0.63 },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Donchian High-Beta Breakout", exchange: "NSE", price: 6890.00, change: 42.50, changePercent: 0.62 },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv RSI Overbought-Oversold Swings", exchange: "NSE", price: 1624.80, change: -8.30, changePercent: -0.51 },

  // --- 3. IT & TECHNOLOGY ---
  { symbol: "WIPRO", name: "Wipro VWAP Mean Rebound System", exchange: "NSE", price: 492.30, change: -3.80, changePercent: -0.77 },
  { symbol: "HCLTECH", name: "HCL Tech MACD Zero-Lag Momentum", exchange: "NSE", price: 1618.50, change: 14.20, changePercent: 0.89 },
  { symbol: "TECHM", name: "Tech Mahindra Keltner Squeeze Breakout", exchange: "NSE", price: 1390.20, change: 8.90, changePercent: 0.64 },
  { symbol: "LTIM", name: "LTIMindtree Parabolic SAR Trend Acceleration", exchange: "NSE", price: 5430.00, change: -22.10, changePercent: -0.41 },

  // --- 4. AUTOMOBILE SECTOR ---
  { symbol: "MARUTI", name: "Maruti Suzuki Opening Range Breakout (ORB 15m)", exchange: "NSE", price: 12450.00, change: 110.00, changePercent: 0.89 },
  { symbol: "M&M", name: "Mahindra & Mahindra Trend Following Surfer", exchange: "NSE", price: 3390.40, change: 28.60, changePercent: 0.85 },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto Hull Moving Average Directional", exchange: "NSE", price: 11663.00, change: 145.00, changePercent: 1.26 },
  { symbol: "EICHERMOT", name: "Eicher Motors Bollinger Squeeze Breakout", exchange: "NSE", price: 4895.00, change: -18.40, changePercent: -0.37 },

  // --- 5. METALS & MINING ---
  { symbol: "TATASTEEL", name: "Tata Steel Commodity Momentum Surge", exchange: "NSE", price: 186.20, change: 1.40, changePercent: 0.76 },
  { symbol: "JSWSTEEL", name: "JSW Steel Donchian Trend Channel", exchange: "NSE", price: 1277.80, change: 9.30, changePercent: 0.73 },
  { symbol: "HINDALCO", name: "Hindalco Aluminum Volume Delta Trend", exchange: "NSE", price: 1049.90, change: 14.10, changePercent: 1.36 },
  { symbol: "COALINDIA", name: "Coal India High-Yield Value Pullback", exchange: "NSE", price: 408.45, change: 2.15, changePercent: 0.53 },

  // --- 6. ENERGY, OIL & GAS ---
  { symbol: "ONGC", name: "ONGC Crude-Linked Trend Follower", exchange: "NSE", price: 238.49, change: 1.80, changePercent: 0.76 },
  { symbol: "POWERGRID", name: "Power Grid Low-Vol Steady State Channel", exchange: "NSE", price: 266.15, change: 0.90, changePercent: 0.34 },
  { symbol: "NTPC", name: "NTPC Energy Momentum Crossover", exchange: "NSE", price: 382.40, change: 3.10, changePercent: 0.82 },
  { symbol: "BPCL", name: "BPCL Refiner Margin Pullback", exchange: "NSE", price: 312.60, change: -1.90, changePercent: -0.60 },
  { symbol: "ADANIENT", name: "Adani Enterprises Volatility Surge Breakout", exchange: "NSE", price: 2940.00, change: 35.00, changePercent: 1.20 },
  { symbol: "ADANIPORTS", name: "Adani Ports Shipping Momentum Wave", exchange: "NSE", price: 1691.00, change: 18.50, changePercent: 1.11 },

  // --- 7. FMCG & CONSUMER ---
  { symbol: "ITC", name: "ITC Defensive Mean Reversion & Squeeze", exchange: "NSE", price: 472.10, change: 0.85, changePercent: 0.18 },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever (HUL) Institutional VWAP Rebound", exchange: "NSE", price: 2480.00, change: -11.00, changePercent: -0.44 },
  { symbol: "NESTLEIND", name: "Nestle India Steady State Trend Surfer", exchange: "NSE", price: 2310.00, change: 4.50, changePercent: 0.20 },
  { symbol: "TITAN", name: "Titan Consumption Breakout Momentum", exchange: "NSE", price: 5068.50, change: 62.00, changePercent: 1.24 },
  { symbol: "ASIANPAINT", name: "Asian Paints Mean Reversion Pullback", exchange: "NSE", price: 2687.50, change: -14.00, changePercent: -0.52 },

  // --- 8. PHARMA & HEALTHCARE ---
  { symbol: "SUNPHARMA", name: "Sun Pharma US Generic Trend Surfer", exchange: "NSE", price: 1740.00, change: 12.00, changePercent: 0.69 },
  { symbol: "DRREDDY", name: "Dr. Reddy's Laboratories Donchian Breakout", exchange: "NSE", price: 6510.00, change: 45.00, changePercent: 0.70 },
  { symbol: "CIPLA", name: "Cipla Respiratory Momentum Crossover", exchange: "NSE", price: 1431.50, change: 8.50, changePercent: 0.60 },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals Healthcare Expansion Breakout", exchange: "NSE", price: 6820.00, change: 52.00, changePercent: 0.77 },

  // --- 9. INFRASTRUCTURE & CEMENT ---
  { symbol: "ULTRACEMCO", name: "UltraTech Cement Capex Cycle Momentum", exchange: "NSE", price: 11681.00, change: 95.00, changePercent: 0.82 },

  // --- 10. PRECIOUS METALS & COMMODITIES (GOLD & SILVER) ---
  { symbol: "GOLDBEES", name: "25. Gold / Silver Bullion Ratio Trend Surfer (Gold ETF)", exchange: "NSE", price: 81.45, change: 0.65, changePercent: 0.80 },
  { symbol: "SILVERBEES", name: "Nippon India Silver ETF Bullion Rider", exchange: "NSE", price: 96.80, change: 1.10, changePercent: 1.15 },
];

