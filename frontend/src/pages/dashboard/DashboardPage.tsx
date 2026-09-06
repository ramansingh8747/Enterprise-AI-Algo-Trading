import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { AccountSummary } from '@/components/dashboard/AccountSummary';
import { TradingIntelligence } from '@/components/dashboard/TradingIntelligence';
import { SmartAlerts } from '@/components/dashboard/SmartAlerts';
import { ActivityCenter } from '@/components/dashboard/ActivityCenter';
import { getAlerts } from '@/services/paperTrading/alertService';
import { Alert } from '@/types/alerts';
import { ActiveBrokerCard } from '@/components/dashboard/ActiveBrokerCard';
import { BrokerSelector } from '@/components/dashboard/BrokerSelector';
import { BrokerType, BrokerConnection } from '@/types/brokerConnection';
import { MarketOverview } from '@/components/dashboard/MarketOverview';
import MarketTicker from '@/components/dashboard/MarketTicker';
import { PositionMonitor } from '@/components/dashboard/PositionMonitor';
import { PositionRiskSummaryComp } from '@/components/dashboard/PositionRiskSummary';
import { TopPositions } from '@/components/dashboard/TopPositions';
import { RiskAlerts } from '@/components/dashboard/RiskAlerts';
import { RiskPanel } from '@/components/dashboard/RiskPanel';
import { RiskLimitsCard } from '@/components/dashboard/RiskLimitsCard';
import { getMonitoredPositions, getPositionRiskSummary } from '@/services/paperTrading/positionMonitorService';
import { getDefaultRiskLimits } from '@/services/paperTrading/riskManagementService';
import { Watchlist } from '@/components/dashboard/Watchlist';
import { QuickActions } from '@/components/dashboard/QuickActions';
import QuickNavigation from '@/components/dashboard/QuickNavigation';
import { ProfileCard } from '@/components/dashboard/ProfileCard';
import { HoldingsTable } from '@/components/dashboard/HoldingsTable';
import { PositionsTable } from '@/components/dashboard/PositionsTable';
import { OrdersTable } from '@/components/dashboard/OrdersTable';
import { QuotesWidget } from '@/components/dashboard/QuotesWidget';
import { OrderForm, OrderSide, PaperOrder } from '@/components/dashboard/OrderForm';
import { RecentPaperOrders } from '@/components/dashboard/RecentPaperOrders';
import { TradingJournalTable } from '@/components/dashboard/TradingJournalTable';
import { getJournalEntries } from '@/services/paperTrading/tradingJournalService';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { StrategySignals } from '@/components/dashboard/StrategySignals';
import { SignalSummary } from '@/components/dashboard/SignalSummary';
import { TradingSignal } from '@/types/signal';
import { createTradingSignal } from '@/services/signals/signalService';
import { initialEquities } from '@/data/marketData';
import { 
  calculateTradingStatistics, 
  calculatePerformanceHistory, 
} from '@/services/paperTrading/paperAnalyticsService';
import { getMarketSessionStatus } from '@/utils/marketTiming';
import { brokerDataApi } from '@/services/api/brokerDataApi';
import { brokersApi, BrokerResponse } from '@/services/api/brokersApi';
import { paperPortfolioApi } from '@/services/api/paperPortfolioApi';
import { paperOrdersApi } from '@/services/api/paperOrdersApi';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { BrokerProfile, BrokerHolding, BrokerPosition, BrokerOrder, BrokerQuote } from '@/types/brokerData';
import { PaperHolding, PaperPosition } from '@/types/paperPortfolio';
import { PortfolioValuation } from '@/types/portfolioValuation';

export default function DashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [brokerId, setBrokerId] = useState<string>('c2ce3afe-4468-49fc-9278-880111831207');

  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [holdings, setHoldings] = useState<BrokerHolding[]>([]);
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [orders, setOrders] = useState<BrokerOrder[]>([]);
  const [quotes, setQuotes] = useState<BrokerQuote[]>([]);

  // Server-managed PAPER trading state
  const [selectedPaperPortfolioId, setSelectedPaperPortfolioId] = useState<string | null>(null);
  const [paperPositions, setPaperPositions] = useState<PaperPosition[]>([]);
  const [paperValuation, setPaperValuation] = useState<PortfolioValuation | null>(null);
  const [paperOrders, setPaperOrders] = useState<PaperOrder[]>([]);
  const [paperStateLoading, setPaperStateLoading] = useState<boolean>(false);
  const [paperStateError, setPaperStateError] = useState<string | null>(null);

  const [, setSignalTrade] = useState<{ signal: TradingSignal; side: "BUY" | "SELL"; } | null>(null);

  // Notification Toast & Alert state
  const [notification, setNotification] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [alerts, setAlerts] = useState<Alert[]>(() => getAlerts());

  // Paper Order Modal state
  const [isOrderFormOpen, setIsOrderFormOpen] = useState<boolean>(false);
  const [orderFormSide, setOrderFormSide] = useState<OrderSide>('BUY');
  const [targetSymbol, setTargetSymbol] = useState<string>('');
  const [targetPrice, setTargetPrice] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();


  const fetchPaperState = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setPaperStateLoading(true);
    }
    setPaperStateError(null);
    try {
      const [portfolios, allPositions, orders] = await Promise.all([
        paperPortfolioApi.listPortfolios().catch(() => []),
        paperPortfolioApi.getAllPositions(true).catch(() => []),
        paperOrdersApi.listOrders().catch(() => []),
      ]);
      const portfolio = portfolios[0];
      setSelectedPaperPortfolioId(portfolio?.id ?? null);
      setPaperOrders(orders.map((order) => ({
        id: order.id,
        order_id: order.order_id,
        symbol: order.symbol,
        side: order.side,
        orderType: "MARKET",
        quantity: Number(order.quantity),
        price: Number(order.price),
        status: "PAPER_EXECUTED",
        timestamp: order.executed_at,
        mode: "PAPER",
        createdAt: order.executed_at,
        broker_id: order.broker_id,
        paper_portfolio_id: order.paper_portfolio_id,
      })));
      setPaperPositions(allPositions);
      if (portfolio) {
        const valuation = await paperPortfolioApi.getValuation(portfolio.id, brokerId).catch(() => null);
        setPaperValuation(valuation);
      }
    } catch (err: any) {
      if (!isBackground) {
        setPaperStateError(err.message || "Failed to load server-managed paper trading state.");
      }
    } finally {
      if (!isBackground) {
        setPaperStateLoading(false);
      }
    }
  }, [brokerId]);

  const [registeredBrokers, setRegisteredBrokers] = useState<BrokerResponse[]>([]);
  const [selectedBrokerType, setSelectedBrokerType] = useState<BrokerType>(() => {
    return (localStorage.getItem("dashboard_selected_broker_type") as BrokerType) || "dhan";
  });

  useEffect(() => {
    brokersApi.listBrokers()
      .then((items) => {
        setRegisteredBrokers(items);
        const dhan = items.find((b) => b.broker_type.toLowerCase() === 'dhan' && b.is_active);
        if (dhan) {
          setBrokerId(dhan.id);
        }
      })
      .catch(() => {});
  }, []);

  const dhanBroker = registeredBrokers.find((b) => b.broker_type.toLowerCase() === 'dhan');
  const zerodhaBroker = registeredBrokers.find((b) => b.broker_type.toLowerCase().includes('zerodha'));
  const angelBroker = registeredBrokers.find((b) => b.broker_type.toLowerCase().includes('angel'));

  const isDhanConnected = dhanBroker ? dhanBroker.is_active : true;
  const isZerodhaConnected = Boolean(zerodhaBroker && zerodhaBroker.is_active);
  const isAngelConnected = Boolean(angelBroker && angelBroker.is_active);

  const brokerConnections: Record<BrokerType, BrokerConnection> = useMemo(() => ({
    dhan: {
      brokerType: "dhan",
      brokerName: dhanBroker?.broker_name || "Dhan (HQ)",
      status: isDhanConnected ? "connected" : "disconnected",
      accountId: dhanBroker?.client_id || "1113530322",
      clientName: dhanBroker?.broker_name || "DhanHQ API",
    },
    zerodha: {
      brokerType: "zerodha",
      brokerName: zerodhaBroker?.broker_name || "Zerodha (Kite)",
      status: isZerodhaConnected ? "connected" : "disconnected",
      accountId: zerodhaBroker?.client_id || undefined,
      clientName: zerodhaBroker?.broker_name,
    },
    angelone: {
      brokerType: "angelone",
      brokerName: angelBroker?.broker_name || "Angel One (SmartAPI)",
      status: isAngelConnected ? "connected" : "disconnected",
      accountId: angelBroker?.client_id || undefined,
      clientName: angelBroker?.broker_name,
    },
  }), [dhanBroker, zerodhaBroker, angelBroker, isDhanConnected, isZerodhaConnected, isAngelConnected]);

  const activeBrokerConnection = brokerConnections[selectedBrokerType];

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const targetBroker = registeredBrokers.find(b => b.broker_type.toLowerCase().includes(selectedBrokerType))
      ?? registeredBrokers.find(b => b.broker_type.toLowerCase() === 'dhan')
      ?? registeredBrokers[0];
    const targetBrokerId = targetBroker?.id || (selectedBrokerType === 'dhan' ? brokerId : 'c2ce3afe-4468-49fc-9278-880111831207');

    try {
      const [profData, holdData, posData, ordData, quoteData] = await Promise.all([
        brokerDataApi.getProfile(targetBrokerId).catch(() => null),
        brokerDataApi.getHoldings(targetBrokerId).catch(() => []),
        brokerDataApi.getPositions(targetBrokerId).catch(() => []),
        brokerDataApi.getOrders(targetBrokerId).catch(() => []),
        brokerDataApi.getQuotes(targetBrokerId, ['RELIANCE', 'TCS', 'INFY']).catch(() => []),
      ]);

      setProfile(profData);
      setHoldings(holdData);
      setPositions(posData);
      setOrders(ordData);
      setQuotes(quoteData);
    } catch (err: any) {
      setError(err.message || 'Failed to load broker data dashboard.');
    } finally {
      setLoading(false);
    }
  }, [selectedBrokerType, registeredBrokers, brokerId]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => {
      const session = getMarketSessionStatus();
      if (session.isOpen || session.canExit) {
        fetchDashboardData();
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Real-time Auto-Sync: Refresh Paper Trading state in the background during active market hours
  useEffect(() => {
    fetchPaperState(false);
    const interval = setInterval(() => {
      const session = getMarketSessionStatus();
      if (session.isOpen || session.canExit) {
        fetchPaperState(true);
      }
    }, 2500);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const session = getMarketSessionStatus();
        if (session.isOpen || session.canExit) {
          fetchPaperState(true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchPaperState]);

  const handleOpenOrderForm = (side: OrderSide, symbol: string = '', price: number = 0) => {
    setOrderFormSide(side);
    setTargetSymbol(symbol);
    setTargetPrice(price);
    setIsOrderFormOpen(true);
  };

  const handleSignalTrade = (signal: TradingSignal, side: "BUY" | "SELL") => {
    setSignalTrade({ signal, side });
    handleOpenOrderForm(side, signal.symbol, signal.entryPrice);
  };

  const handlePaperOrderCreated = (paperOrder: PaperOrder) => {
    setPaperOrders((prev) => [paperOrder, ...prev.filter((order) => order.id !== paperOrder.id)]);
    fetchPaperState();
    setNotification(`Paper ${paperOrder.side} order persisted and executed for ${paperOrder.symbol}`);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleResetPaperAccount = () => {
    setConfirmReset(true);
  };

  const executeResetPaperAccount = async () => {
    if (!selectedPaperPortfolioId) return;
    try {
      await paperPortfolioApi.resetPortfolio(selectedPaperPortfolioId);
      await fetchPaperState();
      setConfirmReset(false);
      setNotification("Paper portfolio reset successfully on the server.");
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification(err.message || "Failed to reset paper portfolio.");
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const paperHoldings: PaperHolding[] = useMemo(() => paperPositions.map((pos) => {
    const quantity = Number(pos.quantity) || 0;
    const averagePrice = Number(pos.average_price) || 0;
    const eqMatch = initialEquities.find(e => e.symbol.toUpperCase() === pos.symbol.toUpperCase());
    const currentPrice = (eqMatch ? eqMatch.price : 0) || Number(pos.last_price) || averagePrice;
    const investedValue = Number(pos.cost_basis) || quantity * averagePrice;
    const currentValue = quantity > 0 ? (quantity * currentPrice) : 0;
    const pnl = quantity > 0 ? (currentValue - investedValue) : (Number(pos.realized_pnl) || 0);
    return {
      symbol: pos.symbol,
      quantity,
      averagePrice,
      currentPrice,
      investedValue,
      currentValue,
      pnl,
      pnlPercent: investedValue > 0 ? (pnl / investedValue) * 100 : 0,
    };
  }), [paperPositions]);

  const paperBalance = Number(paperValuation?.cash_balance ?? (paperPositions.length > 0 ? (1000000 - paperHoldings.reduce((sum, h) => sum + h.investedValue, 0)) : 1000000));
  const paperInvestedValue = paperHoldings.reduce((sum, holding) => sum + holding.investedValue, 0);
  const paperHoldingsValue = paperHoldings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalUnrealizedPnl = paperHoldings.reduce((sum, holding) => sum + holding.pnl, 0);
  const totalRealizedPnl = paperPositions.reduce((sum, pos) => sum + (Number(pos.realized_pnl) || 0), 0);
  const calculatedTotalPnl = totalRealizedPnl + totalUnrealizedPnl;
  const paperPortfolioValue = Number(paperValuation?.equity ?? (paperBalance + paperHoldingsValue));
  const paperTotalPnl = Number(paperValuation?.total_pnl) || calculatedTotalPnl;

  const paperSummary = {
    paperBalance,
    investedValue: paperInvestedValue,
    portfolioValue: paperPortfolioValue,
    totalPnl: paperTotalPnl,
    realizedPnl: totalRealizedPnl,
    unrealizedPnl: totalUnrealizedPnl,
  };

  const monitoredPositions = useMemo(() => getMonitoredPositions(paperHoldings, paperSummary.portfolioValue), [paperHoldings, paperSummary.portfolioValue]);
  const positionSummary = useMemo(() => getPositionRiskSummary(monitoredPositions, paperSummary.portfolioValue), [monitoredPositions, paperSummary.portfolioValue]);
  const paperStats = useMemo(() => calculateTradingStatistics(paperOrders), [paperOrders]);
  const perfHistory = useMemo(() => calculatePerformanceHistory(paperSummary.portfolioValue, paperSummary.totalPnl), [paperSummary.portfolioValue, paperSummary.totalPnl]);

  // Existing holding quantity for selected symbol (for SELL validation)
  const existingHolding = paperHoldings.find((h) => h.symbol.toUpperCase() === targetSymbol.toUpperCase());
  const existingHoldingQty = existingHolding ? existingHolding.quantity : 0;

  return (
    <div style={{ color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>

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

      {/* Main Content Area */}
      <div style={{ maxWidth: '1480px', margin: '0 auto', padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Executive Command Hero Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.6) 100%)',
          borderRadius: '1rem',
          border: '1px solid rgba(148, 163, 184, 0.14)',
          padding: '1.5rem 1.75rem',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          backdropFilter: 'blur(8px)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}, Quantitative Trader
              </h1>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                padding: '0.2rem 0.6rem',
                borderRadius: '1rem',
              }}>
                PRO TERMINAL
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
              Simulated quant paper trading execution sandbox • Real money trading safely gated
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleOpenOrderForm('BUY', 'RELIANCE', 2850)}
              style={{
                padding: '0.55rem 1.15rem',
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              + Place Paper Order
            </button>

            <button
              onClick={handleResetPaperAccount}
              style={{
                padding: '0.55rem 1.05rem',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '0.5rem',
                color: '#fca5a5',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              ↻ Reset Account
            </button>
          </div>
        </div>

        {/* Live Market Indices Ticker */}
        <MarketTicker />

        {/* Quick Navigation Hub */}
        <QuickNavigation />

        {/* BROKER DATA Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#38bdf8', letterSpacing: '-0.01em' }}>
                BROKER DATA
              </h2>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', background: 'rgba(148, 163, 184, 0.12)', border: '1px solid rgba(148, 163, 184, 0.2)', padding: '0.2rem 0.65rem', borderRadius: '1rem' }}>
                READ-ONLY BROKER SESSION
              </span>
            </div>

            <button
              onClick={() => {
                fetchDashboardData();
                setNotification("Broker data updated.");
                setTimeout(() => setNotification(null), 3000);
              }}
              style={{
                padding: '0.45rem 1rem',
                background: '#0284c7',
                border: 'none',
                borderRadius: '0.45rem',
                color: '#ffffff',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              ↻ Refresh Broker Data
            </button>
          </div>

          <ActiveBrokerCard connection={activeBrokerConnection} />

          <BrokerSelector
            connections={brokerConnections}
            selectedBrokerType={selectedBrokerType}
            onSelectBroker={(type) => {
              setSelectedBrokerType(type);
              localStorage.setItem("dashboard_selected_broker_type", type);
              const label = type === 'dhan' ? 'Dhan (HQ)' : type === 'zerodha' ? 'Zerodha (Kite)' : 'Angel One (SmartAPI)';
              setNotification(`Switched active broker to ${label}`);
              setTimeout(() => setNotification(null), 3000);
            }}
          />

          <ProfileCard profile={profile} loading={loading} />
        </div>

...
        {/* 2. Account Summary (Paper Trading Mode Connected) */}
        <AccountSummary
          isPaperMode={true}
          availableBalance={paperSummary.paperBalance}
          portfolioValue={paperSummary.portfolioValue}
          todayPnL={paperSummary.totalPnl}
          totalPnL={paperSummary.totalPnl}
        />

        {/* 2B. Trading Intelligence & Decision Support */}
        <TradingIntelligence
          paperBalance={paperSummary.paperBalance}
          portfolioValue={paperSummary.portfolioValue}
          investedValue={paperSummary.investedValue}
          totalPnl={paperSummary.totalPnl}
          holdings={paperHoldings}
          signals={initialEquities.map(createTradingSignal)}
        />

        {/* 2C. Smart Alerts & Activity Timeline */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.5rem' }}>
          <SmartAlerts alerts={alerts} onRefresh={() => setAlerts(getAlerts())} />
          <ActivityCenter orders={paperOrders} />
        </div>

        {/* 3. Market Overview */}
        <MarketOverview />

        {/* Strategy & Signals Section */}
        <div style={{ background: '#1e293b', borderRadius: '0.75rem', border: '1px solid #334155', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>Strategy & Signals</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Quantitative strategy signals for paper trading execution. No automated real broker execution without explicit human activation.
          </p>
          <div className="space-y-6">
            <SignalSummary signals={initialEquities.map(createTradingSignal)} />
            <StrategySignals 
                signals={initialEquities.map(createTradingSignal)} 
                onTrade={handleSignalTrade}
            />
          </div>
        </div>

        {/* Risk & Position Monitor Section */}
        <div style={{ background: '#1e293b', borderRadius: '0.75rem', border: '1px solid #334155', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1.5rem' }}>Risk Management & Position Monitor</h2>
          <div className="space-y-6">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <RiskPanel 
                metrics={{
                  paperBalance: paperSummary.paperBalance,
                  portfolioValue: paperSummary.portfolioValue,
                  totalExposure: paperSummary.investedValue,
                  exposurePercent: (paperSummary.investedValue / (paperSummary.paperBalance || 1)) * 100,
                  dailyPnl: paperSummary.totalPnl,
                  dailyLossLimit: getDefaultRiskLimits().maxDailyLoss,
                  remainingDailyLoss: getDefaultRiskLimits().maxDailyLoss + paperSummary.totalPnl
                }}
                limits={getDefaultRiskLimits()}
              />
              <RiskLimitsCard limits={getDefaultRiskLimits()} />
            </div>
            <PositionRiskSummaryComp summary={positionSummary} />
            <PositionMonitor positions={monitoredPositions} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TopPositions gainer={positionSummary.largestGainer} loser={positionSummary.largestLoser} />
              <RiskAlerts positions={monitoredPositions} />
            </div>
          </div>
        </div>

        {/* Analytics Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          <PerformanceChart data={perfHistory} />
        </div>

        {paperStateError && (
          <div style={{ padding: '0.85rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '0.5rem', color: '#fca5a5' }}>
            {paperStateError} <button onClick={() => fetchPaperState(false)} style={{ marginLeft: '0.75rem' }}>Retry</button>
          </div>
        )}
        {paperStateLoading && (
          <div style={{ padding: '0.65rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>Loading persisted PAPER account state…</div>
        )}

        {error && (
          <div style={{
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: '0.5rem',
            color: '#fca5a5',
          }}>
            {error}
          </div>
        )}

        {/* 4. Watchlist + Paper Holdings */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem' }}>
          <Watchlist onTrade={(equity, side) => handleOpenOrderForm(side, equity.symbol, equity.price)} />
          <HoldingsTable
            holdings={holdings.length > 0 ? holdings : paperHoldings.map(h => ({
              symbol: h.symbol,
              quantity: String(h.quantity),
              average_price: String(h.averagePrice),
            }))}
            loading={loading}
          />
        </div>

        {/* Live Quotes Widget */}
        <QuotesWidget
          quotes={quotes}
          loading={loading}
          onRefresh={() => brokerDataApi.getQuotes(brokerId, ['RELIANCE', 'TCS', 'INFY']).then(setQuotes).catch(() => {})}
        />

        {/* 5. Net Positions */}
        <PositionsTable
          positions={positions.length > 0 ? positions : paperPositions.map(p => ({
            symbol: p.symbol,
            side: 'buy' as const,
            quantity: String(p.quantity),
            avg_price: String(p.average_price),
          }))}
          loading={loading}
        />

        {/* Recent Paper Orders Component */}
        <RecentPaperOrders orders={paperOrders.slice(0, 5)} />

        {/* Recent Trades Journal */}
        <div style={{ background: '#1e293b', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ color: '#38bdf8', fontWeight: 700 }}>Recent Trades</h3>
            <button onClick={() => navigate(ROUTES.JOURNAL)} style={{ color: '#38bdf8', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View Trading Journal →</button>
          </div>
          <TradingJournalTable entries={getJournalEntries().slice(0, 5)} />
        </div>

        {/* 7. Quick Actions */}
        <QuickActions onNavigateTab={setActiveTab} onOpenOrderForm={handleOpenOrderForm} />
      </div>

      {/* Order Form Modal (Paper Mode Default, Live Broker Gated) */}
      {isOrderFormOpen && (
        <OrderForm
          initialSymbol={targetSymbol}
          initialSide={orderFormSide}
          initialPrice={targetPrice}
          paperBalance={paperBalance}
          existingHoldingQty={existingHoldingQty}
          selectedBrokerId={brokerId}
          selectedBrokerName={selectedBrokerType === 'zerodha' ? 'Zerodha (Kite)' : 'Angel One (SmartAPI)'}
          hasActiveSession={activeBrokerConnection.status === 'connected'}
          currentExposure={paperSummary.investedValue}
          dailyPnl={paperSummary.totalPnl}
          onClose={() => {
            setIsOrderFormOpen(false);
            setSignalTrade(null);
          }}
          onPaperOrderCreated={(order) => {
            handlePaperOrderCreated(order);
            setIsOrderFormOpen(false);
            setSignalTrade(null);
          }}
          onLiveOrderCreated={(liveOrder) => {
            fetchDashboardData();
            setNotification(`Live order submitted: ${liveOrder.order_id}`);
            setTimeout(() => setNotification(null), 4000);
          }}
        />
      )}
    </div>
  );
}
