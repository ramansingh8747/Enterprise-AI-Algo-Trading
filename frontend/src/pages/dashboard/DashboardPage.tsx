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
import { brokerDataApi } from '@/services/api/brokerDataApi';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { BrokerProfile, BrokerHolding, BrokerPosition, BrokerOrder, BrokerQuote } from '@/types/brokerData';
import { PaperHolding } from '@/types/paperPortfolio';
import {
  INITIAL_PAPER_BALANCE,
  applyBuyOrder,
  applySellOrder,
  calculateAccountSummary,
} from '@/services/paperTrading/paperPortfolioService';

const PAPER_ORDERS_KEY = "algo_trading_paper_orders";
const PAPER_HOLDINGS_KEY = "algo_trading_paper_holdings";
const PAPER_BALANCE_KEY = "algo_trading_paper_balance";

export default function DashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [brokerId, setBrokerId] = useState<string>('c2ce3afe-4468-49fc-9278-880111831207');

  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [holdings, setHoldings] = useState<BrokerHolding[]>([]);
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [orders, setOrders] = useState<BrokerOrder[]>([]);
  const [quotes, setQuotes] = useState<BrokerQuote[]>([]);

  // Paper Trading State
  const [paperBalance, setPaperBalance] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(PAPER_BALANCE_KEY);
      return stored ? Number(stored) : INITIAL_PAPER_BALANCE;
    } catch {
      return INITIAL_PAPER_BALANCE;
    }
  });

  const [paperHoldings, setPaperHoldings] = useState<PaperHolding[]>(() => {
    try {
      const stored = localStorage.getItem(PAPER_HOLDINGS_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [paperOrders, setPaperOrders] = useState<PaperOrder[]>(() => {
    try {
      const stored = localStorage.getItem(PAPER_ORDERS_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

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

  // Persist Paper Trading State to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PAPER_BALANCE_KEY, String(paperBalance));
      localStorage.setItem(PAPER_HOLDINGS_KEY, JSON.stringify(paperHoldings));
      localStorage.setItem(PAPER_ORDERS_KEY, JSON.stringify(paperOrders));
    } catch (_err) {
      // Ignored localStorage access error
    }
  }, [paperBalance, paperHoldings, paperOrders]);

  const [selectedBrokerType, setSelectedBrokerType] = useState<BrokerType>('zerodha');

  const [brokerConnections] = useState<Record<BrokerType, BrokerConnection>>(() => {
    try {
      const stored = localStorage.getItem("algo_trading_broker_connection");
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          zerodha: parsed.zerodha || { brokerType: "zerodha", brokerName: "Zerodha (Kite)", status: "disconnected" },
          angelone: parsed.angelone || { brokerType: "angelone", brokerName: "Angel One (SmartAPI)", status: "disconnected" },
        };
      }
    } catch (_err) {
      // Ignored localStorage access error
    }
    return {
      zerodha: { brokerType: "zerodha", brokerName: "Zerodha (Kite)", status: "disconnected" },
      angelone: { brokerType: "angelone", brokerName: "Angel One (SmartAPI)", status: "disconnected" },
    };
  });

  const activeBrokerConnection = brokerConnections[selectedBrokerType];

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const isZerodha = selectedBrokerType === 'zerodha';
    const targetBrokerId = isZerodha ? 'c2ce3afe-4468-49fc-9278-880111831207' : 'angel-one-demo-id';

    try {
      const [profData, holdData, posData, ordData, quoteData] = await Promise.all([
        brokerDataApi.getProfile(targetBrokerId).catch(() => null),
        brokerDataApi.getHoldings(targetBrokerId).catch(() => []),
        brokerDataApi.getPositions(targetBrokerId).catch(() => []),
        brokerDataApi.getOrders(targetBrokerId).catch(() => []),
        brokerDataApi.getQuotes(targetBrokerId, ['RELIANCE', 'TCS', 'INFY']).catch(() => []),
      ]);

      if (profData) {
        setProfile(profData);
      } else {
        setProfile({
          account_id: isZerodha ? 'ZR-DEMO-994' : 'AO-DEMO-882',
          account_type: 'EQUITY',
          currency: 'INR',
        });
      }

      setHoldings(holdData);
      setPositions(posData);
      setOrders(ordData);
      setQuotes(quoteData);
    } catch (err: any) {
      setError(err.message || 'Failed to load broker data dashboard.');
    } finally {
      setLoading(false);
    }
  }, [selectedBrokerType]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

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
    setPaperOrders((prev) => [paperOrder, ...prev]);

    if (paperOrder.side === 'BUY') {
      const { newHoldings, tradeValue } = applyBuyOrder(paperHoldings, paperOrder);
      setPaperHoldings(newHoldings);
      setPaperBalance((prev) => Math.max(0, prev - tradeValue));
    } else {
      const { newHoldings, tradeValue } = applySellOrder(paperHoldings, paperOrder);
      setPaperHoldings(newHoldings);
      setPaperBalance((prev) => prev + tradeValue);
    }

    // Trigger Notification Toast
    setNotification(`Paper ${paperOrder.side} order executed for ${paperOrder.symbol}`);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleCancelPaperOrder = (orderId: string) => {
    setPaperOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: 'CANCELLED',
            }
          : order
      )
    );
  };

  const handleResetPaperAccount = () => {
    setConfirmReset(true);
  };

  const executeResetPaperAccount = () => {
    setPaperBalance(INITIAL_PAPER_BALANCE);
    setPaperHoldings([]);
    setPaperOrders([]);
    setConfirmReset(false);
    setNotification("Paper account reset successfully. Balance restored to ₹10,00,000.");
    setTimeout(() => setNotification(null), 4000);
  };

  // Calculate paper account summary
  const paperSummary = calculateAccountSummary(paperBalance, paperHoldings);
  
  const monitoredPositions = useMemo(() => getMonitoredPositions(paperHoldings, paperSummary.portfolioValue), [paperHoldings, paperSummary.portfolioValue]);
  const positionSummary = useMemo(() => getPositionRiskSummary(monitoredPositions, paperSummary.portfolioValue), [monitoredPositions, paperSummary.portfolioValue]);

  // Analytics
  const paperStats = useMemo(() => calculateTradingStatistics(paperOrders), [paperOrders]);
  const perfHistory = useMemo(() => calculatePerformanceHistory(paperSummary.portfolioValue, paperSummary.totalPnl), [paperSummary]);

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
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Paper Trading Reset Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc' }}>
              {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}, Trader
            </h1>
            <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
                Paper trading dashboard • Real trading disabled
            </p>
          </div>

          <button
            onClick={handleResetPaperAccount}
            style={{
              padding: '0.45rem 0.9rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.375rem',
              color: '#fca5a5',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            ↻ Reset Paper Account
          </button>
        </div>

        {/* Live Market Indices Ticker */}
        <MarketTicker />

        {/* Quick Navigation Hub */}
        <QuickNavigation />

        {/* BROKER DATA Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
                BROKER DATA
              </h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', background: 'rgba(148, 163, 184, 0.15)', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
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
                padding: '0.45rem 0.9rem',
                background: '#0284c7',
                border: 'none',
                borderRadius: '0.375rem',
                color: '#ffffff',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
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
              setNotification(`Switched active broker to ${type === 'zerodha' ? 'Zerodha (Kite)' : 'Angel One (SmartAPI)'}`);
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <SmartAlerts alerts={alerts} onRefresh={() => setAlerts(getAlerts())} />
          <ActivityCenter orders={paperOrders} />
        </div>

        {/* Risk Management Section */}
        <div style={{ background: '#1e293b', borderRadius: '0.75rem', border: '1px solid #334155', padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', color: '#38bdf8', fontWeight: 700 }}>
            Risk Management
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem' }}>
            <RiskPanel 
              metrics={{
                paperBalance: paperSummary.paperBalance,
                portfolioValue: paperSummary.portfolioValue,
                totalExposure: paperSummary.investedValue,
                exposurePercent: (paperSummary.investedValue / paperSummary.paperBalance) * 100,
                dailyPnl: paperSummary.totalPnl,
                dailyLossLimit: getDefaultRiskLimits().maxDailyLoss,
                remainingDailyLoss: getDefaultRiskLimits().maxDailyLoss + paperSummary.totalPnl
              }}
              limits={getDefaultRiskLimits()}
            />
            <RiskLimitsCard limits={getDefaultRiskLimits()} />
          </div>
        </div>

        {/* 3. Market Overview */}
        <MarketOverview />
...

        {/* Strategy & Signals Section */}
        <div style={{ background: '#1e293b', borderRadius: '0.75rem', border: '1px solid #334155', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>Strategy & Signals</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Mock strategy signals for paper trading only. Not financial advice. No automated or real trading is enabled.
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1.5rem' }}>Risk & Position Monitor</h2>
          <div className="space-y-6">
            <PositionRiskSummaryComp summary={positionSummary} />
            <PositionMonitor positions={monitoredPositions} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TopPositions gainer={positionSummary.largestGainer} loser={positionSummary.largestLoser} />
              <RiskAlerts positions={monitoredPositions} />
            </div>
          </div>
        </div>

        {/* Paper Portfolio Summary Card */}
        <div style={{
          background: '#1e293b',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          padding: '1.25rem',
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', color: '#38bdf8', fontWeight: 700 }}>
            Paper Portfolio Summary
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Invested Value</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                ₹{paperSummary.investedValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Portfolio Value</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#818cf8' }}>
                ₹{paperSummary.portfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total P&L</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 700, color: paperSummary.totalPnl >= 0 ? '#4ade80' : '#f87171' }}>
                {paperSummary.totalPnl >= 0 ? '+' : ''}₹{paperSummary.totalPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Win Rate</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                {paperStats.winRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Analytics Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          <PerformanceChart data={perfHistory} />
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100" style={{background: '#1e293b', border: '1px solid #334155'}}>
             <h3 className="text-lg font-semibold text-gray-800" style={{color: '#f8fafc'}}>Trading Statistics</h3>
             <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem'}}>
               <div style={{background: '#0f172a', padding: '1rem', borderRadius: '0.5rem'}}>
                 <span style={{color: '#94a3b8'}}>Total Orders</span>
                 <p style={{fontSize: '1.5rem', fontWeight: 700}}>{paperStats.totalOrders}</p>
               </div>
               <div style={{background: '#0f172a', padding: '1rem', borderRadius: '0.5rem'}}>
                 <span style={{color: '#94a3b8'}}>Win Rate</span>
                 <p style={{fontSize: '1.5rem', fontWeight: 700, color: '#4ade80'}}>{paperStats.winRate.toFixed(1)}%</p>
               </div>
               <div style={{background: '#0f172a', padding: '1rem', borderRadius: '0.5rem'}}>
                 <span style={{color: '#94a3b8'}}>Buy Orders</span>
                 <p style={{fontSize: '1.5rem', fontWeight: 700}}>{paperStats.buyOrders}</p>
               </div>
               <div style={{background: '#0f172a', padding: '1rem', borderRadius: '0.5rem'}}>
                 <span style={{color: '#94a3b8'}}>Sell Orders</span>
                 <p style={{fontSize: '1.5rem', fontWeight: 700}}>{paperStats.sellOrders}</p>
               </div>
             </div>
          </div>
        </div>

        {/* Broker ID Connector Bar */}
        <div style={{
          background: '#1e293b',
          borderRadius: '0.5rem',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          border: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#94a3b8' }}>Connected Broker:</span>
            <input
              type="text"
              value={brokerId}
              onChange={(e) => setBrokerId(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
                color: '#f8fafc',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                width: '300px',
              }}
              placeholder="Enter Broker UUID"
            />
          </div>

          <button
            onClick={fetchDashboardData}
            disabled={loading}
            style={{
              padding: '0.45rem 1rem',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.375rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {loading ? 'Refreshing Data...' : 'Sync Broker Data'}
          </button>
        </div>

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

        {/* 4. Watchlist + Portfolio / Profile */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
          <Watchlist onTrade={(equity, side) => handleOpenOrderForm(side, equity.symbol, equity.price)} />
          <HoldingsTable holdings={holdings} loading={loading} />
          <ProfileCard profile={profile} loading={loading} />
        </div>

        {/* Live Quotes Widget */}
        <QuotesWidget
          quotes={quotes}
          loading={loading}
          onRefresh={() => brokerDataApi.getQuotes(brokerId, ['RELIANCE', 'TCS', 'INFY']).then(setQuotes).catch(() => {})}
        />

        {/* 5. Net Positions */}
        <PositionsTable positions={positions} loading={loading} />

        {/* Recent Paper Orders Component */}
        <RecentPaperOrders orders={paperOrders.slice(0, 5)} onCancel={handleCancelPaperOrder} />

        {/* Recent Trades Journal */}
        <div style={{ background: '#1e293b', padding: '1.25rem', borderRadius: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ color: '#38bdf8', fontWeight: 700 }}>Recent Trades</h3>
            <button onClick={() => navigate(ROUTES.JOURNAL)} style={{ color: '#38bdf8', fontSize: '0.875rem' }}>View Trading Journal</button>
          </div>
          <TradingJournalTable entries={getJournalEntries().slice(0, 5)} />
        </div>

        {/* 6. Recent Broker Orders */}
        <OrdersTable orders={orders} loading={loading} />

        {/* 7. Quick Actions */}
        <QuickActions onNavigateTab={setActiveTab} onOpenOrderForm={handleOpenOrderForm} />
      </div>

      {/* Paper Order Form Modal */}
      {isOrderFormOpen && (
        <OrderForm
          initialSymbol={targetSymbol}
          initialSide={orderFormSide}
          initialPrice={targetPrice}
          paperBalance={paperBalance}
          existingHoldingQty={existingHoldingQty}
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
        />
      )}
    </div>
  );
}
