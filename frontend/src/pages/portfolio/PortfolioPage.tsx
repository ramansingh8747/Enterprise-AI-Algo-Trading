import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import PortfolioAllocation from "@/components/dashboard/PortfolioAllocation";
import { HoldingsTable } from "@/components/dashboard/HoldingsTable";
import { PositionsTable } from "@/components/dashboard/PositionsTable";
import { PositionMonitor } from "@/components/dashboard/PositionMonitor";
import { PositionRiskSummaryComp } from "@/components/dashboard/PositionRiskSummary";
import { TopPositions } from "@/components/dashboard/TopPositions";
import { RiskAlerts } from "@/components/dashboard/RiskAlerts";
import { PositionDetailPanel } from "@/components/dashboard/PositionDetailPanel";
import { RiskHealthOverview } from "@/components/dashboard/RiskHealthOverview";
import { PositionRiskDetail } from "@/components/dashboard/PositionRiskDetail";
import { RiskExposureChart } from "@/components/dashboard/RiskExposureChart";
import { AdvancedRiskAnalytics } from "@/components/dashboard/AdvancedRiskAnalytics";
import { PortfolioPerformanceIntelligence } from "@/components/dashboard/PortfolioPerformanceIntelligence";
import { PortfolioPerformanceQuality } from "@/components/dashboard/PortfolioPerformanceQuality";
import { PortfolioPerformanceAttribution } from "@/components/dashboard/PortfolioPerformanceAttribution";
import { PortfolioDrawdownRecovery } from "@/components/dashboard/PortfolioDrawdownRecovery";
import { PortfolioComplianceControlCenter } from "@/components/dashboard/PortfolioComplianceControlCenter";
import { PortfolioOperationalReadinessDashboard } from "@/components/dashboard/PortfolioOperationalReadinessDashboard";
import { PortfolioExecutiveIntelligenceReportCenter } from "@/components/dashboard/PortfolioExecutiveIntelligenceReportCenter";
import { PortfolioAuditExplainabilityCenter } from "@/components/dashboard/PortfolioAuditExplainabilityCenter";
import { PortfolioGovernanceReviewCenter } from "@/components/dashboard/PortfolioGovernanceReviewCenter";
import { PortfolioDecisionActionCenter } from "@/components/dashboard/PortfolioDecisionActionCenter";
import { PortfolioCorrelationDependencyMap } from "@/components/dashboard/PortfolioCorrelationDependencyMap";
import { PortfolioIntelligenceTimeline } from "@/components/dashboard/PortfolioIntelligenceTimeline";
import { PortfolioInsightDrilldown } from "@/components/dashboard/PortfolioInsightDrilldown";
import { PortfolioCommandCenterUnified } from "@/components/dashboard/PortfolioCommandCenterUnified";
import { PortfolioHealthScorecard } from "@/components/dashboard/PortfolioHealthScorecard";
import { initialEquities } from "@/data/marketData";
import { ExecutivePortfolioCommandCenter } from "@/components/dashboard/ExecutivePortfolioCommandCenter";
import { PortfolioMonitoringEarlyWarning } from "@/components/dashboard/PortfolioMonitoringEarlyWarning";
import { PortfolioStrategyAllocation } from "@/components/dashboard/PortfolioStrategyAllocation";
import { PortfolioRiskBudget } from "@/components/dashboard/PortfolioRiskBudget";
import { PortfolioStressTest } from "@/components/dashboard/PortfolioStressTest";
import { OrderForm, OrderSide, PaperOrder } from "@/components/dashboard/OrderForm";
import { getMonitoredPositions, getPositionRiskSummary } from "@/services/paperTrading/positionMonitorService";
import { MonitoredPosition } from "@/types/positionMonitor";
import { calculateRiskIntelligence } from "@/services/paperTrading/riskPositionIntelligenceService";
import { brokerDataApi } from "@/services/api/brokerDataApi";
import { brokerOrdersApi } from "@/services/api/brokerOrdersApi";
import { TradingPositionResponse } from "@/types/brokerOrder";
import { paperPortfolioApi } from "@/services/api/paperPortfolioApi";
import { paperOrdersApi } from "@/services/api/paperOrdersApi";
import { marketApi } from "@/services/api/marketApi";
import { BrokerHolding, BrokerPosition } from "@/types/brokerData";
import { PaperHolding, PaperPortfolio, PaperPosition, PaperPortfolioSummary } from "@/types/paperPortfolio";
import { calculatePortfolioAnalytics } from "@/services/paperTrading/portfolioAnalyticsService";
import { PositionFilter, PositionSort } from "@/types/portfolioAnalytics";
import { PortfolioValuation } from "@/types/portfolioValuation";
import { getMarketSessionStatus } from "@/utils/marketTiming";

function formatDecimalString(value: string | undefined | null, decimals: number = 2): string {
  if (!value) return "0.00";
  const num = Number(value);
  if (isNaN(num)) return value;
  return num.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const PortfolioPage: React.FC = () => {
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [brokerId, setBrokerId] = useState<string>("c2ce3afe-4468-49fc-9278-880111831207");
  const [holdings, setHoldings] = useState<BrokerHolding[]>([]);
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [applicationPositions, setApplicationPositions] = useState<TradingPositionResponse[]>([]);
  const [loadingApplicationPositions, setLoadingApplicationPositions] = useState<boolean>(false);
  const [liveValuation, setLiveValuation] = useState<PortfolioValuation | null>(null);
  const [paperValuation, setPaperValuation] = useState<PortfolioValuation | null>(null);
  const [, setValuationError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);

  // Server-managed Paper Portfolio state
  const [paperPortfolios, setPaperPortfolios] = useState<PaperPortfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [serverPositions, setServerPositions] = useState<PaperPosition[]>([]);
  const [serverSummary, setServerSummary] = useState<PaperPortfolioSummary | null>(null);
  const [loadingServerPortfolios, setLoadingServerPortfolios] = useState<boolean>(false);
  const [serverPortfolioError, setServerPortfolioError] = useState<string | null>(null);
  const activeRequestId = useRef<number>(0);

  // Search, Filter, Sort state for position table
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filter, setFilter] = useState<PositionFilter>('ALL');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sort, setSort] = useState<PositionSort>('VALUE');
  const [selectedHolding, setSelectedHolding] = useState<PaperHolding | null>(null);
  const [selectedRiskPosition, setSelectedRiskPosition] = useState<MonitoredPosition | null>(null);

  // Trade Modal State
  const [tradeRequest, setTradeRequest] = useState<{
    symbol: string;
    side: OrderSide;
    price: number;
  } | null>(null);

  const [notification, setNotification] = useState<string | null>(null);
  const [exitingSymbol, setExitingSymbol] = useState<string | null>(null);

  const handleInstantFullExit = async (symbol: string, quantity: number, price: number) => {
    if (quantity <= 0) return;
    setExitingSymbol(symbol);
    try {
      await paperOrdersApi.createOrder({
        symbol: symbol,
        side: 'SELL',
        order_type: 'MARKET',
        quantity: String(quantity),
        price: String(price > 0 ? price : 100),
        order_source: 'AUTO_PILOT',
      });
      setNotification(`✓ Successfully exited full position: ${quantity} shares of ${symbol} sold.`);
      const portId = selectedPortfolioId || "ALL_CONSOLIDATED";
      await fetchServerPortfolioData(portId, false);
      await fetchPortfolio();
    } catch (err: any) {
      setNotification(err.message || `Failed to exit position for ${symbol}.`);
    } finally {
      setExitingSymbol(null);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const [portfolioModeFilter, setPortfolioModeFilter] = useState<'ALL' | '15MIN_SCALPER' | 'FULL_DAY'>(() => {
    try {
      const saved = localStorage.getItem('active_session_mode');
      if (saved === '15MIN_SCALPER') return '15MIN_SCALPER';
      if (saved === 'FULL_DAY') return 'FULL_DAY';
    } catch {}
    return 'ALL';
  });

  const isScalperSym = useCallback((sym: string) => {
    const s = (sym || "").toUpperCase();
    return s.includes("NIFTY") || s.includes("BANKNIFTY");
  }, []);

  const displayedServerPositions = useMemo(() => {
    const active = serverPositions.filter(p => Number(p.quantity) > 0);
    if (portfolioModeFilter === '15MIN_SCALPER') {
      return active.filter(p => isScalperSym(p.symbol));
    }
    if (portfolioModeFilter === 'FULL_DAY') {
      return active.filter(p => !isScalperSym(p.symbol));
    }
    return active;
  }, [serverPositions, portfolioModeFilter, isScalperSym]);


  const paperPortfoliosRef = useRef<PaperPortfolio[]>([]);
  paperPortfoliosRef.current = paperPortfolios;

  // Fetch Server-managed Portfolio Details, Positions, Summary (with Race Protection)
  const fetchServerPortfolioData = useCallback(async (portfolioId: string, background: boolean = false) => {
    const requestId = ++activeRequestId.current;
    if (!background) {
      setLoadingServerPortfolios(true);
    }
    setServerPortfolioError(null);

    try {
      const isConsolidated = !portfolioId || portfolioId === "ALL_CONSOLIDATED";
      const targetValId = (!isConsolidated && portfolioId) ? portfolioId : (paperPortfoliosRef.current[0]?.id || "");
      const [posList, summaryData, paperValue, liveValue] = await Promise.all([
        isConsolidated
          ? paperPortfolioApi.getAllPositions(true).catch(() => [])
          : paperPortfolioApi.getPositions(portfolioId, true).catch(() => []),
        isConsolidated
          ? paperPortfolioApi.getAllSummary().catch(() => null)
          : paperPortfolioApi.getSummary(portfolioId).catch(() => null),
        targetValId
          ? paperPortfolioApi.getValuation(targetValId, brokerId).catch(() => null)
          : Promise.resolve(null),
        brokerOrdersApi.getPortfolioValuation(brokerId).catch(() => null),
      ]);

      // Always update positions if data is returned or request matches
      if (requestId === activeRequestId.current || (Array.isArray(posList) && posList.length > 0)) {
        setServerPositions(posList);
        if (summaryData) setServerSummary(summaryData);
        if (paperValue) setPaperValuation(paperValue);
        if (liveValue) setLiveValuation(liveValue);
      }
    } catch (err: any) {
      if (requestId === activeRequestId.current) {
        setServerPortfolioError(err.message || "Failed to load paper portfolio details.");
      }
    } finally {
      if (!background || requestId === activeRequestId.current) {
        setLoadingServerPortfolios(false);
      }
    }
  }, [brokerId]);

  // Fetch Server-managed Paper Portfolios
  const fetchServerPortfolios = useCallback(async () => {
    try {
      const list = await paperPortfolioApi.listPortfolios();
      const safeList = Array.isArray(list) ? list : [];
      setPaperPortfolios(safeList);
      if (!selectedPortfolioId) {
        setSelectedPortfolioId("ALL_CONSOLIDATED");
      }
    } catch (err: any) {
      setPaperPortfolios([]);
      setServerPortfolioError(err.message || "Failed to load backend paper portfolios.");
    }
  }, [selectedPortfolioId]);

  useEffect(() => {
    fetchServerPortfolios();
  }, [fetchServerPortfolios]);

  // Live Market Tick Feed State for Real-Time Open Position Valuation (MTM)
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  const activeSymbolsKey = useMemo(() => {
    return Array.from(new Set(serverPositions.filter(p => Number(p.quantity) > 0).map(p => p.symbol.toUpperCase()))).sort().join(',');
  }, [serverPositions]);

  // Real-time Live Market Price Ticks for Open Positions
  useEffect(() => {
    if (!activeSymbolsKey) return;
    const activeSymbols = activeSymbolsKey.split(',');

    let isMounted = true;
    const updateLivePrices = async () => {
      const updates: Record<string, number> = {};
      await Promise.all(
        activeSymbols.map(async (sym) => {
          try {
            const cleanSym = sym.replace(/\s+/g, '').replace(/[-_]/g, '');
            const res = await marketApi.getLiveCandles(cleanSym, '5m', '1d');
            if (res && res.regularMarketPrice > 0) {
              updates[sym] = res.regularMarketPrice;
            } else if (res && res.candles && res.candles.length > 0) {
              updates[sym] = res.candles[res.candles.length - 1].close;
            }
          } catch (_err) {
            // Keep previous live tick on transient fetch failure
          }
        })
      );
      if (isMounted && Object.keys(updates).length > 0) {
        setLivePrices(prev => ({ ...prev, ...updates }));
      }
    };

    updateLivePrices();
    const interval = setInterval(() => {
      const session = getMarketSessionStatus();
      if (session.isOpen || session.canExit) {
        updateLivePrices();
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeSymbolsKey]);

  // Real-time Auto-Sync: Refresh Portfolio & P&L in the background during active market hours
  useEffect(() => {
    const portId = selectedPortfolioId || "ALL_CONSOLIDATED";
    fetchServerPortfolioData(portId, false);

    const interval = setInterval(() => {
      const session = getMarketSessionStatus();
      if (session.isOpen || session.canExit) {
        fetchServerPortfolioData(portId, true);
      }
    }, 2500);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const session = getMarketSessionStatus();
        if (session.isOpen || session.canExit) {
          fetchServerPortfolioData(portId, true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [selectedPortfolioId, fetchServerPortfolioData]);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (selectedPortfolioId) {
        await fetchServerPortfolioData(selectedPortfolioId);
      }
      setLoadingApplicationPositions(true);
      setValuationError(null);
      const [holdData, posData, appPositionData, liveValue, paperValue] = await Promise.all([
        brokerDataApi.getHoldings(brokerId).catch(() => []),
        brokerDataApi.getPositions(brokerId).catch(() => []),
        brokerOrdersApi.getPositions(brokerId).catch(() => []),
        brokerOrdersApi.getPortfolioValuation(brokerId).catch(() => null),
        selectedPortfolioId
          ? paperPortfolioApi.getValuation(selectedPortfolioId, brokerId).catch(() => null)
          : Promise.resolve(null),
      ]);
      setHoldings(holdData);
      setPositions(posData);
      setApplicationPositions(appPositionData);
      setLiveValuation(liveValue);
      setPaperValuation(paperValue);
    } catch (err: any) {
      setError(err.message || "Failed to load portfolio.");
    } finally {
      setLoading(false);
      setLoadingApplicationPositions(false);
    }
  }, [brokerId, selectedPortfolioId, fetchServerPortfolioData]);

  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  const handleResetPaperAccount = () => {
    setConfirmReset(true);
  };

  const executeResetPaperAccount = async () => {
    if (!selectedPortfolioId) return;
    try {
      await paperPortfolioApi.resetPortfolio(selectedPortfolioId);
      await fetchServerPortfolioData(selectedPortfolioId);
      setConfirmReset(false);
      setNotification("Paper portfolio reset successfully on the server.");
    } catch (err: any) {
      setNotification(err.message || "Failed to reset paper portfolio.");
    }
    setTimeout(() => setNotification(null), 4000);
  };

  // Convert server positions to PaperHolding format for intelligence components
  const paperHoldings: PaperHolding[] = useMemo(() => {
    return displayedServerPositions.map(pos => {
      const qty = Number(pos.quantity) || 0;
      const avgPx = Number(pos.average_price) || 0;
      const symUpper = pos.symbol.toUpperCase();
      const eqMatch = initialEquities.find(e => e.symbol.toUpperCase() === symUpper);
      const livePx = livePrices[symUpper] || livePrices[pos.symbol];
      const rawPx = (livePx !== undefined && livePx > 0)
        ? livePx
        : (Number(pos.last_price) || (eqMatch ? eqMatch.price : 0) || avgPx);
      const isIndexOption = (symUpper.includes("NIFTY") || symUpper.includes("SENSEX") || symUpper.includes("BANK")) && avgPx < 1000 && rawPx > 5000;
      const entrySpot = avgPx > 0 ? (avgPx / 0.0055) : rawPx;
      const currPx = isIndexOption
        ? Math.max(5.0, Number((avgPx + (rawPx - entrySpot) * 0.50).toFixed(2)))
        : rawPx;
      const invested = Number(pos.cost_basis) || (qty * avgPx);
      const currVal = qty > 0 ? (qty * currPx) : 0;
      const unPnl = qty > 0 ? (currVal - invested) : (Number(pos.unrealized_pnl) || 0);
      const pnlPercent = invested > 0 ? (unPnl / invested) * 100 : 0;
      return {
        symbol: pos.symbol,
        quantity: qty,
        averagePrice: avgPx,
        currentPrice: currPx,
        investedValue: invested,
        currentValue: currVal,
        pnl: unPnl,
        pnlPercent: pnlPercent,
      };
    });
  }, [displayedServerPositions, livePrices]);

  const totalRealizedPnl = useMemo(() => {
    if (portfolioModeFilter === 'ALL') {
      return serverSummary?.total_realized_pnl !== undefined
        ? Number(serverSummary.total_realized_pnl)
        : serverPositions.reduce((sum, p) => sum + (Number(p.realized_pnl) || 0), 0);
    }
    return displayedServerPositions.reduce((sum, p) => sum + (Number(p.realized_pnl) || 0), 0);
  }, [portfolioModeFilter, serverSummary?.total_realized_pnl, serverPositions, displayedServerPositions]);

  const totalUnrealizedPnl = useMemo(() => paperHoldings.reduce((sum, h) => sum + h.pnl, 0), [paperHoldings]);
  const calculatedTotalPnl = useMemo(() => totalRealizedPnl + totalUnrealizedPnl, [totalRealizedPnl, totalUnrealizedPnl]);

  // Today's Intraday metrics (auto-resets at 00:00 IST)
  const todayRealizedPnl = useMemo(() => {
    if (portfolioModeFilter === 'ALL') {
      return Number(serverSummary?.today_realized_pnl ?? "0.00");
    }
    return displayedServerPositions.reduce((sum, p) => sum + (Number(p.realized_pnl) || 0), 0);
  }, [portfolioModeFilter, serverSummary?.today_realized_pnl, displayedServerPositions]);

  const todayUnrealizedPnl = totalUnrealizedPnl;
  const todayTotalPnl = useMemo(() => todayRealizedPnl + todayUnrealizedPnl, [todayRealizedPnl, todayUnrealizedPnl]);
  const todayTradesCount = serverSummary?.today_trades_count ?? 0;

  const rawCashBalance = Number(paperValuation?.cash_balance ?? 10000);
  const investedValue = useMemo(() => paperHoldings.reduce((sum, holding) => sum + holding.investedValue, 0), [paperHoldings]);
  const paperBalance = useMemo(() => {
    if (portfolioModeFilter === 'ALL') {
      return rawCashBalance;
    }
    return Math.max(0, 10000 - investedValue);
  }, [portfolioModeFilter, rawCashBalance, investedValue]);

  const currentTotalEquity = useMemo(() => paperBalance + paperHoldings.reduce((sum, holding) => sum + holding.currentValue, 0), [paperBalance, paperHoldings]);

  const modePaperEquity = useMemo(() => {
    if (portfolioModeFilter === 'ALL') {
      return paperValuation?.equity ?? currentTotalEquity.toFixed(2);
    }
    return currentTotalEquity.toFixed(2);
  }, [portfolioModeFilter, paperValuation?.equity, currentTotalEquity]);

  const modeMarketValue = useMemo(() => {
    if (portfolioModeFilter === 'ALL') {
      return paperValuation?.market_value ?? paperHoldings.reduce((sum, h) => sum + h.currentValue, 0).toFixed(2);
    }
    return paperHoldings.reduce((sum, h) => sum + h.currentValue, 0).toFixed(2);
  }, [portfolioModeFilter, paperValuation?.market_value, paperHoldings]);

  const modeUnrealizedPnl = useMemo(() => {
    if (portfolioModeFilter === 'ALL') {
      return paperValuation?.unrealized_pnl ?? totalUnrealizedPnl.toFixed(2);
    }
    return totalUnrealizedPnl.toFixed(2);
  }, [portfolioModeFilter, paperValuation?.unrealized_pnl, totalUnrealizedPnl]);

  const modeTotalPnl = useMemo(() => {
    if (portfolioModeFilter === 'ALL') {
      return paperValuation?.total_pnl ?? calculatedTotalPnl.toFixed(2);
    }
    return calculatedTotalPnl.toFixed(2);
  }, [portfolioModeFilter, paperValuation?.total_pnl, calculatedTotalPnl]);

  const paperSummary = {
    paperBalance,
    investedValue,
    portfolioValue: currentTotalEquity,
    totalPnl: calculatedTotalPnl,
    totalRealizedPnl,
    totalUnrealizedPnl,
    todayRealizedPnl,
    todayTotalPnl,
    todayTradesCount,
  };
  const analyticsSummary = useMemo(() => calculatePortfolioAnalytics(paperHoldings), [paperHoldings]);
  const monitoredPositions = useMemo(() => getMonitoredPositions(paperHoldings, paperSummary.portfolioValue), [paperHoldings, paperSummary.portfolioValue]);
  const positionSummary = useMemo(() => getPositionRiskSummary(monitoredPositions, paperSummary.portfolioValue), [monitoredPositions, paperSummary.portfolioValue]);
  const riskIntel = useMemo(() => calculateRiskIntelligence(monitoredPositions, paperSummary.portfolioValue), [monitoredPositions, paperSummary.portfolioValue]);

  // Filtered & Sorted Positions (reserved for future position table rendering)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const filteredHoldings = useMemo(() => {
    return paperHoldings.filter(h => {
      if (searchQuery.trim() && !h.symbol.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filter === 'GAINERS') return h.pnl > 0;
      if (filter === 'LOSERS') return h.pnl < 0;
      return true;
    }).sort((a, b) => {
      if (sort === 'SYMBOL') return a.symbol.localeCompare(b.symbol);
      if (sort === 'PNL') return b.pnl - a.pnl;
      return b.currentValue - a.currentValue;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperHoldings, searchQuery, filter]);

  const allocationItems = useMemo(() => {
    const totalVal = paperHoldings.reduce((sum, h) => sum + (h.currentValue || h.investedValue || 0), 0);
    if (totalVal <= 0) return [];
    return paperHoldings.map((h) => {
      const val = h.currentValue || h.investedValue || 0;
      return {
        symbol: h.symbol,
        value: val,
        percentage: (val / totalVal) * 100,
      };
    });
  }, [paperHoldings]);

  return (
    <div style={{ color: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '1.25rem',
          right: '1.25rem',
          zIndex: 100,
          background: '#064e3b',
          border: '1px solid #10b981',
          borderRadius: '0.5rem',
          padding: '0.85rem 1.25rem',
          color: '#a7f3d0',
          fontSize: '0.875rem',
          fontWeight: 600,
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}>
          <span>⚡ {notification}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', color: '#a7f3d0', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Paper Account Reset Confirmation Modal */}
      {confirmReset && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(2, 6, 23, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{
            background: '#111c2d',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '0.85rem',
            padding: '1.5rem',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          }}>
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⚠️</span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
              Reset Paper Account?
            </h3>
            <p style={{ margin: '0.5rem 0 1.25rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              This action will reset your simulated paper trading balance back to ₹10,00,000 and clear all paper orders and holdings.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.375rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#cbd5e1',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeResetPaperAccount}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.375rem',
                  background: 'rgba(239, 68, 68, 0.25)',
                  border: '1px solid rgba(248, 113, 113, 0.35)',
                  color: '#fca5a5',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Reset Account
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "clamp(0.5rem, 2vw, 1.5rem)", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 900, color: "#f8fafc" }}>
                Portfolio Intelligence
              </h1>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '0.2rem 0.65rem',
                borderRadius: '1rem',
              }}>
                PAPER PORTFOLIO — SERVER BACKED
              </span>
            </div>
            <p style={{ margin: "0.5rem 0 0 0", color: "#94a3b8", fontSize: "0.875rem" }}>
              Monitor server-managed paper portfolios, position holdings, realized and unrealized P&L.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Portfolio Switcher Dropdown */}
            <select
              aria-label="Select Paper Portfolio"
              value={selectedPortfolioId || "ALL_CONSOLIDATED"}
              onChange={(e) => setSelectedPortfolioId(e.target.value)}
              style={{
                padding: "0.45rem 0.75rem",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "0.375rem",
                color: "#f8fafc",
                fontSize: "0.8125rem",
                fontWeight: 600,
                outline: "none",
              }}
            >
              <option value="ALL_CONSOLIDATED">
                🌟 Consolidated Account (All Positions & P&L)
              </option>
              {paperPortfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.execution_mode})
                </option>
              ))}
            </select>

            <button
              onClick={fetchPortfolio}
              style={{
                padding: '0.45rem 0.9rem',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
                color: '#ffffff',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ↻ Refresh Portfolio
            </button>
            <button
              onClick={handleResetPaperAccount}
              style={{
                padding: "0.45rem 0.9rem",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "0.375rem",
                color: "#fca5a5",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ↻ Reset Paper Account
            </button>
          </div>
        </div>

        {/* Server Portfolio Summary Banner (Decimal-Safe) */}
        {serverPortfolioError && (
          <div style={{ padding: "1rem", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "0.5rem", color: "#fca5a5", fontSize: "0.875rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>⚠️ {serverPortfolioError}</span>
            <button onClick={fetchServerPortfolios} style={{ background: "#ef4444", border: "none", borderRadius: "0.25rem", color: "#fff", padding: "0.3rem 0.75rem", fontWeight: 700, cursor: "pointer", fontSize: "0.75rem" }}>
              Retry
            </button>
          </div>
        )}

        {/* 1-Click Dedicated Portfolio Mode Switcher */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginBottom: '0.5rem',
        }}>
          {/* Mode A: 15-20 Min Fast Scalper Portfolio */}
          <div
            onClick={() => setPortfolioModeFilter('15MIN_SCALPER')}
            style={{
              cursor: 'pointer',
              padding: '1rem 1.25rem',
              borderRadius: '0.75rem',
              border: portfolioModeFilter === '15MIN_SCALPER'
                ? '2px solid #ec4899'
                : '1px solid rgba(236, 72, 153, 0.25)',
              background: portfolioModeFilter === '15MIN_SCALPER'
                ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.22) 0%, rgba(15, 23, 42, 0.9) 100%)'
                : 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.4) 100%)',
              boxShadow: portfolioModeFilter === '15MIN_SCALPER'
                ? '0 0 20px rgba(236, 72, 153, 0.35)'
                : '0 4px 12px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '1.2rem' }}>⚡</span>
                <strong style={{ fontSize: '0.98rem', color: '#f472b6', fontWeight: 800 }}>
                  15-20 Min Scalper Portfolio
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1' }}>
                Index Options &amp; Fast Momentum Scalps ({serverPositions.filter(p => isScalperSym(p.symbol)).length} positions)
              </p>
            </div>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '0.25rem 0.6rem',
              borderRadius: '1rem',
              background: portfolioModeFilter === '15MIN_SCALPER' ? '#ec4899' : 'rgba(236, 72, 153, 0.15)',
              color: portfolioModeFilter === '15MIN_SCALPER' ? '#ffffff' : '#f472b6',
            }}>
              {portfolioModeFilter === '15MIN_SCALPER' ? '✓ ACTIVE' : 'Select'}
            </span>
          </div>

          {/* Mode B: Full-Day Multi-Regime Portfolio */}
          <div
            onClick={() => setPortfolioModeFilter('FULL_DAY')}
            style={{
              cursor: 'pointer',
              padding: '1rem 1.25rem',
              borderRadius: '0.75rem',
              border: portfolioModeFilter === 'FULL_DAY'
                ? '2px solid #10b981'
                : '1px solid rgba(16, 185, 129, 0.25)',
              background: portfolioModeFilter === 'FULL_DAY'
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(15, 23, 42, 0.9) 100%)'
                : 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.4) 100%)',
              boxShadow: portfolioModeFilter === 'FULL_DAY'
                ? '0 0 20px rgba(16, 185, 129, 0.35)'
                : '0 4px 12px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🌐</span>
                <strong style={{ fontSize: '0.98rem', color: '#4ade80', fontWeight: 800 }}>
                  Full-Day Multi-Regime Portfolio
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1' }}>
                All 132 Multi-Sector Stock Positions ({serverPositions.filter(p => !isScalperSym(p.symbol)).length} positions)
              </p>
            </div>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '0.25rem 0.6rem',
              borderRadius: '1rem',
              background: portfolioModeFilter === 'FULL_DAY' ? '#10b981' : 'rgba(16, 185, 129, 0.15)',
              color: portfolioModeFilter === 'FULL_DAY' ? '#ffffff' : '#4ade80',
            }}>
              {portfolioModeFilter === 'FULL_DAY' ? '✓ ACTIVE' : 'Select'}
            </span>
          </div>

          {/* Mode C: Consolidated All Portfolio */}
          <div
            onClick={() => setPortfolioModeFilter('ALL')}
            style={{
              cursor: 'pointer',
              padding: '1rem 1.25rem',
              borderRadius: '0.75rem',
              border: portfolioModeFilter === 'ALL'
                ? '2px solid #38bdf8'
                : '1px solid rgba(56, 189, 248, 0.25)',
              background: portfolioModeFilter === 'ALL'
                ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.22) 0%, rgba(15, 23, 42, 0.9) 100%)'
                : 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.4) 100%)',
              boxShadow: portfolioModeFilter === 'ALL'
                ? '0 0 20px rgba(56, 189, 248, 0.35)'
                : '0 4px 12px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📊</span>
                <strong style={{ fontSize: '0.98rem', color: '#38bdf8', fontWeight: 800 }}>
                  Consolidated All Portfolio
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1' }}>
                Unified Total Capital &amp; P&amp;L ({serverPositions.length} positions)
              </p>
            </div>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '0.25rem 0.6rem',
              borderRadius: '1rem',
              background: portfolioModeFilter === 'ALL' ? '#38bdf8' : 'rgba(56, 189, 248, 0.15)',
              color: portfolioModeFilter === 'ALL' ? '#ffffff' : '#38bdf8',
            }}>
              {portfolioModeFilter === 'ALL' ? '✓ ACTIVE' : 'Select'}
            </span>
          </div>
        </div>

        {/* Today's Intraday Performance Header & Cards (Auto-Resets Daily at 00:00 IST) */}
        <div style={{ background: "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "0.875rem", padding: "1.25rem", boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#f8fafc" }}>📅 Today's Performance (आज का रिजल्ट)</span>
              <span style={{ padding: "0.2rem 0.55rem", background: "rgba(56, 189, 248, 0.15)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "9999px", color: "#38bdf8", fontSize: "0.7rem", fontWeight: 700 }}>
                Auto-Resets Daily @ 00:00 IST
              </span>
            </div>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              Today's Session: {new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.85rem" }}>
            <div style={{ background: "#0f172a", border: "1px solid rgba(74, 222, 128, 0.4)", borderRadius: "0.65rem", padding: "1rem", boxShadow: "0 0 15px rgba(74, 222, 128, 0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 800 }}>Gross Winning Profit (ग्रॉस मुनाफा)</span>
                <span style={{ fontSize: "0.68rem", background: "rgba(74, 222, 128, 0.2)", color: "#4ade80", padding: "0.15rem 0.45rem", borderRadius: "0.25rem", fontWeight: 700 }}>
                  {paperHoldings.filter(h => h.quantity > 0 && h.pnl > 0).length} Stocks
                </span>
              </div>
              <p style={{ margin: "0.35rem 0 0 0", fontSize: "1.35rem", fontWeight: 800, color: "#4ade80" }}>
                +₹{paperHoldings
                  .filter(h => h.quantity > 0 && h.pnl > 0)
                  .reduce((acc, h) => acc + h.pnl, 0)
                  .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "0.65rem", padding: "1rem" }}>
              <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>Today's Realized P&L (क्लोज्ड)</span>
              <p style={{ margin: "0.35rem 0 0 0", fontSize: "1.35rem", fontWeight: 800, color: todayRealizedPnl >= 0 ? "#4ade80" : "#f87171" }}>
                {todayRealizedPnl >= 0 ? "+" : ""}₹{formatDecimalString(String(todayRealizedPnl))}
              </p>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "0.65rem", padding: "1rem" }}>
              <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>Today's Unrealized P&L (ओपन)</span>
              <p style={{ margin: "0.35rem 0 0 0", fontSize: "1.35rem", fontWeight: 800, color: todayUnrealizedPnl >= 0 ? "#4ade80" : "#f87171" }}>
                {todayUnrealizedPnl >= 0 ? "+" : ""}₹{formatDecimalString(String(todayUnrealizedPnl))}
              </p>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "0.65rem", padding: "1rem" }}>
              <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>Today's Total P&L (रियल + ओपन)</span>
              <p style={{ margin: "0.35rem 0 0 0", fontSize: "1.35rem", fontWeight: 800, color: todayTotalPnl >= 0 ? "#4ade80" : "#f87171" }}>
                {todayTotalPnl >= 0 ? "+" : ""}₹{formatDecimalString(String(todayTotalPnl))}
              </p>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "0.65rem", padding: "1rem" }}>
              <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>Today's Executed Trades</span>
              <p style={{ margin: "0.35rem 0 0 0", fontSize: "1.35rem", fontWeight: 800, color: "#38bdf8" }}>
                {portfolioModeFilter === '15MIN_SCALPER'
                  ? (displayedServerPositions.length > 0 ? todayTradesCount : 0)
                  : (portfolioModeFilter === 'FULL_DAY' ? todayTradesCount : todayTradesCount)} Trades
              </p>
            </div>
          </div>
        </div>

        {/* All-Time Cumulative Portfolio Section */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
          <div style={{ background: "#1e293b", border: "1px solid rgba(74, 222, 128, 0.4)", borderRadius: "0.75rem", padding: "1.25rem", boxShadow: "0 0 15px rgba(74, 222, 128, 0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "#4ade80", fontWeight: 700 }}>Gross Winning Alpha</span>
              <span style={{ fontSize: "0.68rem", background: "rgba(74, 222, 128, 0.2)", color: "#4ade80", padding: "0.15rem 0.45rem", borderRadius: "0.25rem", fontWeight: 700 }}>
                {paperHoldings.filter(h => h.quantity > 0 && h.pnl > 0).length} Winners
              </span>
            </div>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "1.5rem", fontWeight: 800, color: "#4ade80" }}>
              +₹{paperHoldings
                .filter(h => h.quantity > 0 && h.pnl > 0)
                .reduce((acc, h) => acc + h.pnl, 0)
                .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "0.75rem", padding: "1.25rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Total Realized P&L (All-Time)</span>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "1.5rem", fontWeight: 800, color: totalRealizedPnl >= 0 ? "#4ade80" : "#f87171" }}>
              {totalRealizedPnl >= 0 ? "+" : ""}₹{formatDecimalString(String(totalRealizedPnl))}
            </p>
          </div>

          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "0.75rem", padding: "1.25rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Total Unrealized P&L (All-Time)</span>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "1.5rem", fontWeight: 800, color: totalUnrealizedPnl >= 0 ? "#4ade80" : "#f87171" }}>
              {totalUnrealizedPnl >= 0 ? "+" : ""}₹{formatDecimalString(String(totalUnrealizedPnl))}
            </p>
          </div>

          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "0.75rem", padding: "1.25rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Total Portfolio P&L (All-Time)</span>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "1.5rem", fontWeight: 800, color: calculatedTotalPnl >= 0 ? "#4ade80" : "#f87171" }}>
              {calculatedTotalPnl >= 0 ? "+" : ""}₹{formatDecimalString(String(calculatedTotalPnl))}
            </p>
          </div>

          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "0.75rem", padding: "1.25rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Active Open Positions</span>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "1.5rem", fontWeight: 800, color: "#38bdf8" }}>
              {displayedServerPositions.filter(p => Number(p.quantity) > 0).length} Positions
            </p>
          </div>
        </section>

        {/* Server-Backed Paper Position Table (Top Priority Display) */}
        <section style={{
          background: "#1e293b",
          borderRadius: "0.75rem",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          padding: "1.25rem",
          color: "#f8fafc",
          boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.25)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#38bdf8" }}>
                Active Portfolio Positions ({displayedServerPositions.length})
              </h2>
              <span style={{ fontSize: "0.75rem", color: "#4ade80", background: "rgba(74, 222, 128, 0.15)", padding: "0.2rem 0.6rem", borderRadius: "1rem", fontWeight: 700 }}>
                {displayedServerPositions.filter(p => Number(p.quantity) > 0 && Number(p.unrealized_pnl) > 0).length} Profitable Stocks 🟢
              </span>
            </div>

            {/* Controls: Search, Filter, Sort */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search symbol..."
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  padding: '0.4rem 0.75rem',
                  color: '#f8fafc',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
              {(['ALL', 'GAINERS', 'LOSERS'] as PositionFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '0.25rem',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: filter === f ? '#0284c7' : '#0f172a',
                    border: '1px solid #334155',
                    color: filter === f ? '#ffffff' : '#94a3b8',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loadingServerPortfolios ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
              Loading server paper positions...
            </div>
          ) : displayedServerPositions.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b", border: "1px dashed #334155", borderRadius: "0.5rem" }}>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#94a3b8" }}>
                {portfolioModeFilter === '15MIN_SCALPER'
                  ? 'No 15-Minute Scalper positions active (NIFTY/BANKNIFTY).'
                  : portfolioModeFilter === 'FULL_DAY'
                  ? 'No Full-Day Multi-Regime positions active in portfolio.'
                  : 'No paper positions found in backend portfolio.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                    <th style={{ padding: "0.75rem" }}>Symbol</th>
                    <th style={{ padding: "0.75rem" }}>Quantity</th>
                    <th style={{ padding: "0.75rem" }}>Avg Buy Price</th>
                    <th style={{ padding: "0.75rem" }}>Live Price (LTP)</th>
                    <th style={{ padding: "0.75rem" }}>Invested Value</th>
                    <th style={{ padding: "0.75rem" }}>Current Value</th>
                    <th style={{ padding: "0.75rem" }}>Realized P&L</th>
                    <th style={{ padding: "0.75rem" }}>Unrealized P&L (MTM)</th>
                    <th style={{ padding: "0.75rem" }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {displayedServerPositions
                    .filter(pos => {
                      if (searchQuery && !pos.symbol.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                      const symUpper = pos.symbol.toUpperCase();
                      const eqMatch = initialEquities.find(e => e.symbol.toUpperCase() === symUpper);
                      const livePx = livePrices[symUpper] || livePrices[pos.symbol];
                      const avgPx = Number(pos.average_price) || 0;
                      const rawPx = (livePx !== undefined && livePx > 0)
                        ? livePx
                        : (Number(pos.last_price) || (eqMatch ? eqMatch.price : 0) || avgPx);
                      const isIndexOption = (symUpper.includes("NIFTY") || symUpper.includes("SENSEX") || symUpper.includes("BANK")) && avgPx < 1000 && rawPx > 5000;
                      const entrySpot = avgPx > 0 ? (avgPx / 0.0055) : rawPx;
                      const currPx = isIndexOption
                        ? Math.max(5.0, Number((avgPx + (rawPx - entrySpot) * 0.50).toFixed(2)))
                        : rawPx;
                      const qty = Number(pos.quantity) || 0;
                      const invested = Number(pos.cost_basis) || (qty * avgPx);
                      const currVal = qty > 0 ? (qty * currPx) : 0;
                      const unPnl = qty > 0 ? (currVal - invested) : (Number(pos.unrealized_pnl) || 0);

                      if (filter === 'GAINERS') return unPnl > 0;
                      if (filter === 'LOSERS') return unPnl < 0;
                      return true;
                    })
                    .map((pos) => {
                      const symUpper = pos.symbol.toUpperCase();
                      const eqMatch = initialEquities.find(e => e.symbol.toUpperCase() === symUpper);
                      const livePx = livePrices[symUpper] || livePrices[pos.symbol];
                      const hasLiveTick = livePx !== undefined && livePx > 0;
                      const avgPrice = Number(pos.average_price) || 0;
                      const rawPx = (livePx !== undefined && livePx > 0)
                        ? livePx
                        : (Number(pos.last_price) || (eqMatch ? eqMatch.price : 0) || avgPrice);
                      const isIndexOption = (symUpper.includes("NIFTY") || symUpper.includes("SENSEX") || symUpper.includes("BANK")) && avgPrice < 1000 && rawPx > 5000;
                      const entrySpot = avgPrice > 0 ? (avgPrice / 0.0055) : rawPx;
                      const currPx = isIndexOption
                        ? Math.max(5.0, Number((avgPrice + (rawPx - entrySpot) * 0.50).toFixed(2)))
                        : rawPx;
                      const qty = Number(pos.quantity) || 0;
                      const invested = Number(pos.cost_basis) || (qty * avgPrice);
                      const currVal = qty > 0 ? (qty * currPx) : 0;
                      const unPnl = qty > 0 ? (currVal - invested) : (Number(pos.unrealized_pnl) || 0);
                      const pnlPct = invested > 0 ? (unPnl / invested) * 100 : 0;
                      const realPnl = Number(pos.realized_pnl) || 0;
                      const isPositive = unPnl > 0;
                      const isNegative = unPnl < 0;
                      const color = isPositive ? "#4ade80" : isNegative ? "#f87171" : "#94a3b8";

                      return (
                        <tr
                          key={pos.id}
                          style={{
                            borderBottom: "1px solid #0f172a",
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ padding: "0.75rem", fontWeight: 800, color: "#f8fafc" }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span>{pos.symbol}</span>
                              {hasLiveTick && (
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} title="Live Market Feed Active" />
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "0.75rem", color: "#cbd5e1" }}>{formatDecimalString(pos.quantity, 4)}</td>
                          <td style={{ padding: "0.75rem", color: "#cbd5e1" }}>₹{formatDecimalString(pos.average_price)}</td>
                          <td style={{ padding: "0.75rem", color: hasLiveTick ? "#38bdf8" : "#cbd5e1", fontWeight: 700 }}>
                            ₹{currPx.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "0.75rem", color: "#cbd5e1" }}>₹{invested.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style={{ padding: "0.75rem", color: "#f8fafc", fontWeight: 700 }}>
                            ₹{currVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "0.75rem", color: realPnl >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                            {realPnl >= 0 ? "+" : ""}₹{formatDecimalString(pos.realized_pnl)}
                          </td>
                          <td style={{ padding: "0.75rem", fontWeight: 800, color }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{isPositive ? "+" : ""}₹{unPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                                ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "0.75rem" }}>
                            <button
                              disabled={exitingSymbol === pos.symbol}
                              onClick={() => handleInstantFullExit(pos.symbol, Number(pos.quantity), currPx)}
                              style={{
                                padding: '0.35rem 0.75rem',
                                background: 'rgba(239, 68, 68, 0.25)',
                                border: '1px solid #ef4444',
                                borderRadius: '0.375rem',
                                color: '#fca5a5',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                cursor: exitingSymbol === pos.symbol ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              {exitingSymbol === pos.symbol ? 'Closing...' : `Exit ALL (${Number(pos.quantity)})`}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-label="Application-owned portfolio valuation" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.85rem" }}>
          {[
            ["LIVE Equity", liveValuation?.equity ?? "0.00"],
            ["PAPER Equity", modePaperEquity],
            ["Market Value", modeMarketValue],
            ["Unrealized P&L", modeUnrealizedPnl],
            ["Total P&L", modeTotalPnl],
          ].map(([label, value]) => (
            <div key={label as string} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "0.65rem", padding: "1rem" }}>
              <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>{label}</span>
              <p style={{ margin: "0.35rem 0 0", fontSize: "1.25rem", fontWeight: 800, color: "#f8fafc" }}>₹{formatDecimalString(value as string)}</p>
            </div>
          ))}
        </section>

        {/* Portfolio Executive Intelligence Export & Report Center */}
        <PortfolioExecutiveIntelligenceReportCenter
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          paperBalance={paperBalance}
          portfolioValue={paperSummary.portfolioValue}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Operational Readiness & Executive Summary Dashboard */}
        <PortfolioOperationalReadinessDashboard
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          paperBalance={paperBalance}
          portfolioValue={paperSummary.portfolioValue}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Compliance Control Center */}
        <PortfolioComplianceControlCenter
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Audit Explainability Center */}
        <PortfolioAuditExplainabilityCenter
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Governance Review Center */}
        <PortfolioGovernanceReviewCenter
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Decision Action Center */}
        <PortfolioDecisionActionCenter
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Correlation Dependency Map */}
        <PortfolioCorrelationDependencyMap
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Intelligence Timeline */}
        <PortfolioIntelligenceTimeline
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Insight Drilldown */}
        <PortfolioInsightDrilldown
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Command Center Unified */}
        <PortfolioCommandCenterUnified
          paperBalance={paperBalance}
          portfolioValue={paperSummary.portfolioValue}
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Health Scorecard */}
        <PortfolioHealthScorecard
          paperBalance={paperBalance}
          portfolioValue={paperSummary.portfolioValue}
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Monitoring Early Warning */}
        <PortfolioMonitoringEarlyWarning
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
        />

        {/* Executive Portfolio Command Center */}
        <ExecutivePortfolioCommandCenter
          paperBalance={paperBalance}
          portfolioValue={paperSummary.portfolioValue}
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Performance Quality */}
        <PortfolioPerformanceQuality
          analytics={analyticsSummary}
          holdings={paperHoldings}
        />

        {/* Portfolio Performance Attribution */}
        <PortfolioPerformanceAttribution
          analytics={analyticsSummary}
          holdings={paperHoldings}
        />

        {/* Portfolio Drawdown Recovery */}
        <PortfolioDrawdownRecovery
          paperBalance={paperBalance}
          portfolioValue={paperSummary.portfolioValue}
          unrealizedPnl={analyticsSummary.unrealizedPnl}
          holdings={paperHoldings}
        />

        {/* Portfolio Performance Intelligence */}
        <PortfolioPerformanceIntelligence
          analytics={analyticsSummary}
          holdings={paperHoldings}
          onSelectHolding={(h) => setSelectedHolding(h)}
        />

        {/* Portfolio Strategy Allocation */}
        <PortfolioStrategyAllocation holdings={paperHoldings} portfolioValue={paperSummary.portfolioValue} />

        {/* Portfolio Allocation Visualizer */}
        <PortfolioAllocation items={allocationItems} />

        {/* Position Risk & Monitor */}
        <section style={{ background: "#1e293b", borderRadius: "0.75rem", border: "1px solid #334155", padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#38bdf8", marginBottom: "1.25rem" }}>
            Position Exposure & Risk Overview
          </h2>
          {paperHoldings.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b", border: "1px dashed #334155", borderRadius: "0.5rem" }}>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#94a3b8" }}>No active server paper positions.</p>
              <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.75rem" }}>Create a paper trade from Dashboard or Watchlist to start tracking positions.</p>
              <button onClick={() => navigate(ROUTES.WATCHLIST)} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#0284c7', border: 'none', borderRadius: '0.375rem', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                Explore Markets
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <PortfolioRiskBudget summary={riskIntel} positions={monitoredPositions} paperBalance={paperBalance} />
              <RiskHealthOverview summary={riskIntel} paperBalance={paperBalance} />
              <RiskExposureChart
                totalExposure={riskIntel.totalExposure}
                portfolioValue={paperSummary.portfolioValue}
                exposurePercent={riskIntel.exposurePercent}
              />
              <AdvancedRiskAnalytics
                positions={monitoredPositions}
                paperBalance={paperBalance}
                portfolioValue={paperSummary.portfolioValue}
              />
              <PortfolioStressTest positions={monitoredPositions} portfolioValue={paperSummary.portfolioValue} />
              <PositionRiskSummaryComp summary={positionSummary} />
              <PositionMonitor positions={monitoredPositions} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <TopPositions gainer={positionSummary.largestGainer} loser={positionSummary.largestLoser} />
                <RiskAlerts positions={monitoredPositions} onSelectPosition={(pos) => setSelectedRiskPosition(pos)} />
              </div>
            </div>
          )}
        </section>



        {/* Application-owned LIVE positions derived from persisted executions */}
        <section style={{ background: "#1e293b", borderRadius: "0.75rem", border: "1px solid #334155", padding: "1.25rem", color: "#f8fafc" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#38bdf8" }}>Application LIVE Positions</h2>
              <p style={{ margin: "0.35rem 0 0", color: "#94a3b8", fontSize: "0.8rem" }}>Derived from persisted broker executions, not local UI state.</p>
            </div>
            <button onClick={fetchPortfolio} disabled={loadingApplicationPositions} style={{ padding: "0.45rem 0.8rem", borderRadius: "0.35rem", border: "1px solid #475569", background: "#0f172a", color: "#cbd5e1", cursor: loadingApplicationPositions ? "not-allowed" : "pointer", fontWeight: 700 }}>
              {loadingApplicationPositions ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {applicationPositions.length === 0 ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748b", border: "1px dashed #334155", borderRadius: "0.5rem" }}>No application-owned LIVE positions are currently persisted.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead><tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}><th style={{ padding: "0.7rem", textAlign: "left" }}>Symbol</th><th style={{ padding: "0.7rem", textAlign: "right" }}>Quantity</th><th style={{ padding: "0.7rem", textAlign: "right" }}>Avg Price</th><th style={{ padding: "0.7rem", textAlign: "right" }}>Realized P&L</th><th style={{ padding: "0.7rem", textAlign: "left" }}>Last Execution</th></tr></thead>
                <tbody>{applicationPositions.map((position) => <tr key={position.id} style={{ borderBottom: "1px solid #0f172a" }}>
                  <td style={{ padding: "0.7rem", fontWeight: 800 }}>{position.symbol}</td>
                  <td style={{ padding: "0.7rem", textAlign: "right" }}>{formatDecimalString(position.quantity, 4)}</td>
                  <td style={{ padding: "0.7rem", textAlign: "right" }}>₹{formatDecimalString(position.average_price)}</td>
                  <td style={{ padding: "0.7rem", textAlign: "right", color: Number(position.realized_pnl) >= 0 ? "#4ade80" : "#f87171" }}>₹{formatDecimalString(position.realized_pnl)}</td>
                  <td style={{ padding: "0.7rem", color: "#94a3b8" }}>{position.last_execution_at ? new Date(position.last_execution_at).toLocaleString("en-IN") : "—"}</td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </section>

        {/* Real Broker Portfolio (Read-Only Session) */}
        <div>
          <h2 style={{ margin: "0 0 1rem 0", fontSize: "1.25rem", fontWeight: 800, color: "#f8fafc" }}>
            Real Broker Portfolio (Read-Only Session)
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))", gap: "1.5rem" }}>
            <HoldingsTable holdings={holdings} loading={loading} />
            <PositionsTable positions={positions} loading={loading} />
          </div>
        </div>
      </main>

      {/* Position Detail Modal */}
      <PositionDetailPanel
        holding={selectedHolding}
        onClose={() => setSelectedHolding(null)}
        onTrade={(sym, side, pr) => setTradeRequest({ symbol: sym, side, price: pr })}
        onViewStrategy={() => navigate(ROUTES.STRATEGY)}
      />

      {/* Position Risk Detail Modal */}
      <PositionRiskDetail
        position={selectedRiskPosition}
        onClose={() => setSelectedRiskPosition(null)}
        onNavigate={(route) => navigate(route)}
      />

      {/* Render OrderForm modal when tradeRequest is active */}
      {tradeRequest && (
        <OrderForm
          initialSymbol={tradeRequest.symbol}
          initialSide={tradeRequest.side}
          initialPrice={tradeRequest.price}
          paperBalance={paperBalance}
          existingHoldingQty={paperHoldings.find(h => h.symbol === tradeRequest.symbol)?.quantity || 0}
          onClose={() => setTradeRequest(null)}
          onPaperOrderCreated={(order: PaperOrder) => {
            setNotification(`Paper ${order.side} order placed for ${order.symbol} @ ₹${order.price}`);
            setTradeRequest(null);
            fetchPortfolio();
            setTimeout(() => setNotification(null), 4000);
          }}
        />
      )}
    </div>
  );
};

export default PortfolioPage;
