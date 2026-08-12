import { MarketIndex, Equity } from "@/types/market";

export const initialIndices: MarketIndex[] = [
  { symbol: "NIFTY50", name: "NIFTY 50", value: 24350.10, change: 145.20, changePercent: 0.60 },
  { symbol: "BANKNIFTY", name: "BANK NIFTY", value: 52180.45, change: -85.30, changePercent: -0.16 },
  { symbol: "SENSEX", name: "SENSEX", value: 79890.70, change: 420.15, changePercent: 0.53 },
];

export const initialEquities: Equity[] = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd", exchange: "NSE", price: 2980.50, change: 36.80, changePercent: 1.25 },
  { symbol: "TCS", name: "Tata Consultancy Services", exchange: "NSE", price: 3840.20, change: -17.30, changePercent: -0.45 },
  { symbol: "INFY", name: "Infosys Limited", exchange: "NSE", price: 1650.00, change: 13.40, changePercent: 0.82 },
  { symbol: "HDFCBANK", name: "HDFC Bank Limited", exchange: "NSE", price: 1625.75, change: 17.65, changePercent: 1.10 },
  { symbol: "ICICIBANK", name: "ICICI Bank Limited", exchange: "NSE", price: 1195.30, change: 9.40, changePercent: 0.79 },
  { symbol: "SBIN", name: "State Bank of India", exchange: "NSE", price: 845.60, change: -4.20, changePercent: -0.49 },
  { symbol: "ITC", name: "ITC Limited", exchange: "NSE", price: 492.15, change: 6.85, changePercent: 1.41 },
  { symbol: "LT", name: "Larsen & Toubro Ltd", exchange: "NSE", price: 3680.00, change: -22.50, changePercent: -0.61 },
];
