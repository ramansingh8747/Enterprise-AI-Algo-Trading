import React, { useMemo, useState, useEffect } from "react";
import { validatePaperOrderRisk } from "@/services/paperTrading/riskManagementService";
import { getDefaultRiskLimits } from "@/services/paperTrading/riskManagementService";
import { brokerOrdersApi } from "@/services/api/brokerOrdersApi";
import { BrokerOrderCreateRequest, BrokerOrderResponse } from "@/types/brokerOrder";

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT";
export type ProductType = "CNC" | "MIS";
export type ExecutionMode = "PAPER" | "LIVE";

export interface PaperOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  price: number;
  status: "PENDING" | "EXECUTED" | "CANCELLED" | "PAPER_EXECUTED";
  timestamp: string;
  mode: "PAPER";
  createdAt?: string;
  productType?: ProductType | string;
  stopLoss?: number;
  targetPrice?: number;
}

export interface OrderFormProps {
  initialSymbol?: string;
  initialSide?: OrderSide;
  initialPrice?: number;
  paperBalance?: number;
  existingHoldingQty?: number;
  selectedBrokerId?: string;
  selectedBrokerName?: string;
  hasActiveSession?: boolean;
  onClose: () => void;
  onOrderCreated?: (order: PaperOrder) => void;
  onPaperOrderCreated?: (order: PaperOrder) => void;
  onLiveOrderCreated?: (order: BrokerOrderResponse) => void;
  // Risk context
  currentExposure?: number;
  dailyPnl?: number;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  initialSymbol = "",
  initialSide = "BUY",
  initialPrice = 0,
  paperBalance = 0,
  existingHoldingQty = 0,
  selectedBrokerId = "",
  selectedBrokerName = "Selected Broker",
  hasActiveSession = false,
  currentExposure = 0,
  dailyPnl = 0,
  onClose,
  onOrderCreated,
  onPaperOrderCreated,
  onLiveOrderCreated,
}) => {
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("PAPER");

  const [symbol, setSymbol] = useState(initialSymbol);
  const [side, setSide] = useState<OrderSide>(initialSide);
  const [quantity, setQuantity] = useState<number>(1);
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [price, setPrice] = useState<string>(initialPrice > 0 ? String(initialPrice) : "");
  const [productType, setProductType] = useState<ProductType>("CNC");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [stopLoss, _setStopLoss] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [targetPrice, _setTargetPrice] = useState<string>("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLiveConfirmModal, setShowLiveConfirmModal] = useState(false);
  const [liveSuccessOrder, setLiveSuccessOrder] = useState<BrokerOrderResponse | null>(null);

  // Keydown Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showLiveConfirmModal) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, showLiveConfirmModal]);

  const isLimitOrder = orderType === "LIMIT";

  const numericPrice = useMemo(() => {
    if (isLimitOrder) {
      return Number(price) || 0;
    }
    return initialPrice > 0 ? initialPrice : Number(price) || 1000;
  }, [isLimitOrder, price, initialPrice]);

  const estimatedValue = useMemo(() => {
    return (quantity || 0) * (numericPrice || 0);
  }, [quantity, numericPrice]);

  const [riskValidation, setRiskValidation] = useState(validatePaperOrderRisk(
    initialSide, 1, numericPrice, 0, 0, paperBalance, currentExposure, dailyPnl, getDefaultRiskLimits()
  ));

  useEffect(() => {
    if (executionMode === "PAPER") {
      const val = validatePaperOrderRisk(
        side,
        quantity,
        numericPrice,
        Number(stopLoss) || 0,
        Number(targetPrice) || 0,
        paperBalance,
        currentExposure,
        dailyPnl,
        getDefaultRiskLimits()
      );
      setRiskValidation(val);
    } else {
      // In live mode, basic client validation
      setRiskValidation({
        allowed: quantity > 0 && symbol.trim().length > 0 && (!isLimitOrder || Number(price) > 0),
        errors: quantity <= 0 ? ["Quantity must be greater than zero."] : [],
        warnings: [],
        riskRewardRatio: 0,
        orderValue: estimatedValue,
        stopLossRisk: 0,
      });
    }
  }, [executionMode, side, quantity, numericPrice, stopLoss, targetPrice, paperBalance, currentExposure, dailyPnl, symbol, isLimitOrder, price, estimatedValue]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (quantity <= 0) {
      setError("Please enter a valid positive quantity.");
      return;
    }

    if (!symbol.trim()) {
      setError("Please enter a trading symbol e.g. INFY.");
      return;
    }

    if (executionMode === "PAPER") {
      if (!riskValidation.allowed) {
        setError(riskValidation.errors.join(' '));
        return;
      }
      executePaperOrder();
    } else {
      // Live mode session validation check
      if (!selectedBrokerId) {
        setError("No broker selected. Please select a broker in Brokers page.");
        return;
      }

      if (!hasActiveSession) {
        setError("No active broker session found. Please connect your broker session in Brokers page first.");
        return;
      }

      setError("");
      setShowLiveConfirmModal(true);
    }
  };

  const executePaperOrder = async () => {
    setLoading(true);
    setError("");

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));

      const paperOrder: PaperOrder = {
        id: `PAPER-${Date.now()}`,
        symbol: symbol.trim().toUpperCase() || "NIFTY50",
        side,
        orderType,
        quantity,
        price: numericPrice,
        status: "EXECUTED",
        timestamp: new Date().toISOString(),
        mode: "PAPER",
        createdAt: new Date().toISOString(),
        productType,
        stopLoss: Number(stopLoss) || undefined,
        targetPrice: Number(targetPrice) || undefined,
      };

      onOrderCreated?.(paperOrder);
      onPaperOrderCreated?.(paperOrder);
      onClose();
    } catch {
      setError("Unable to create paper order.");
    } finally {
      setLoading(false);
    }
  };

  const executeLiveOrder = async () => {
    if (!selectedBrokerId) return;

    setLoading(true);
    setError("");

    const payload: BrokerOrderCreateRequest = {
      symbol: symbol.trim().toUpperCase(),
      exchange: "NSE",
      quantity: String(quantity),
      side: side,
      order_type: orderType,
      product: productType,
      variety: "regular",
      price: isLimitOrder && price ? String(price) : null,
      trigger_price: stopLoss ? String(stopLoss) : null,
    };

    try {
      const res = await brokerOrdersApi.createOrder(selectedBrokerId, payload);
      setLiveSuccessOrder(res);
      onLiveOrderCreated?.(res);
    } catch (err: any) {
      if (err.status === 401) {
        setError("Authentication required. Please log in again.");
      } else if (err.status === 403) {
        setError("Access denied. Admin privileges required for broker order execution.");
      } else if (err.status === 404) {
        setError("Broker or active session not found. Please connect session.");
      } else if (err.status === 422) {
        setError(err.message || "Invalid order parameters.");
      } else {
        setError(err.message || "Failed to place live broker order.");
      }
    } finally {
      setLoading(false);
      setShowLiveConfirmModal(false);
    }
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-form-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(6px)',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '92vh',
          overflowY: 'auto',
          borderRadius: '1rem',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          background: '#0f172a',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.15rem',
        }}
      >
        {/* Header & Mode Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 id="order-form-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
              {executionMode === "LIVE" ? "Place Live Broker Order" : "Place Paper Order"}
            </h2>
            <span style={{ fontSize: '0.75rem', color: executionMode === "LIVE" ? '#38bdf8' : '#94a3b8' }}>
              {executionMode === "LIVE" ? `LIVE BROKER: ${selectedBrokerName}` : "VIRTUAL TRADING SANDBOX"}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close order form"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Mode Selector Tabs (PAPER / LIVE BROKER) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.35rem',
          background: '#1e293b',
          padding: '0.25rem',
          borderRadius: '0.5rem',
          border: '1px solid #334155',
        }}>
          <button
            type="button"
            onClick={() => { setExecutionMode("PAPER"); setError(""); setLiveSuccessOrder(null); }}
            style={{
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: executionMode === "PAPER" ? '#f59e0b' : 'transparent',
              color: executionMode === "PAPER" ? '#000000' : '#94a3b8',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            ● Paper Trading Mode
          </button>

          <button
            type="button"
            onClick={() => { setExecutionMode("LIVE"); setError(""); setLiveSuccessOrder(null); }}
            style={{
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: executionMode === "LIVE" ? '#0284c7' : 'transparent',
              color: executionMode === "LIVE" ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            ⚡ Live Broker Execution
          </button>
        </div>

        {/* Mode Notice Banner */}
        {executionMode === "PAPER" ? (
          <div style={{
            padding: '0.6rem 0.85rem',
            borderRadius: '0.5rem',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            fontSize: '0.75rem',
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>●</span>
            <span><strong>PAPER TRADING ONLY:</strong> Simulated execution in local sandbox. No real money at risk.</span>
          </div>
        ) : (
          <div style={{
            padding: '0.6rem 0.85rem',
            borderRadius: '0.5rem',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            fontSize: '0.75rem',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>⚡</span>
            <span><strong>LIVE BROKER ORDER:</strong> Orders will be submitted via live API to backend provider.</span>
          </div>
        )}

        {/* Live Success Banner */}
        {liveSuccessOrder && (
          <div style={{
            padding: '0.85rem',
            background: 'rgba(74, 222, 128, 0.15)',
            border: '1px solid #4ade80',
            borderRadius: '0.5rem',
            color: '#4ade80',
            fontSize: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}>
            <div style={{ fontWeight: 800 }}>✓ Live Order Placed Successfully!</div>
            <div>Order ID: <code style={{ color: '#ffffff' }}>{liveSuccessOrder.order_id}</code></div>
            <div>Status: <strong>{liveSuccessOrder.status}</strong> | Symbol: {liveSuccessOrder.symbol}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* BUY / SELL Switcher */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setSide("BUY")}
              style={{
                padding: '0.75rem',
                borderRadius: '0.5rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                background: side === "BUY" ? 'linear-gradient(135deg, #059669 0%, #16a34a 100%)' : '#1e293b',
                color: '#ffffff',
                boxShadow: side === "BUY" ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
              }}
            >
              BUY
            </button>
            <button
              type="button"
              onClick={() => setSide("SELL")}
              style={{
                padding: '0.75rem',
                borderRadius: '0.5rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                background: side === "SELL" ? 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)' : '#1e293b',
                color: '#ffffff',
                boxShadow: side === "SELL" ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none',
              }}
            >
              SELL
            </button>
          </div>

          {/* Symbol Input */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
              Trading Symbol
            </label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. RELIANCE, TCS, INFY"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: '0.5rem',
                border: '1px solid #334155',
                background: '#1e293b',
                padding: '0.65rem 0.85rem',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Order Type & Product */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
                Order Type
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as OrderType)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '0.5rem',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  padding: '0.65rem 0.85rem',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                <option value="MARKET">MARKET</option>
                <option value="LIMIT">LIMIT</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
                Product Type
              </label>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value as ProductType)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '0.5rem',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  padding: '0.65rem 0.85rem',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                <option value="CNC">CNC (Delivery)</option>
                <option value="MIS">MIS (Intraday)</option>
              </select>
            </div>
          </div>

          {/* Quantity & Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
                Quantity ({side === "SELL" && existingHoldingQty > 0 ? `Max: ${existingHoldingQty}` : 'Shares'})
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                placeholder="Quantity"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '0.5rem',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  padding: '0.65rem 0.85rem',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
                {isLimitOrder ? 'Limit Price (₹)' : 'Estimated Price (₹)'}
              </label>
              <input
                type="number"
                step="0.05"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Price"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '0.5rem',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  padding: '0.65rem 0.85rem',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Order Preview Box */}
          <div style={{
            background: '#08111f',
            border: '1px solid #1e293b',
            borderRadius: '0.5rem',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            fontSize: '0.8rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
              <span>Estimated Order Value:</span>
              <strong style={{ color: '#38bdf8', fontSize: '0.95rem' }}>
                ₹{estimatedValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </strong>
            </div>

            {executionMode === "PAPER" ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>{side === "BUY" ? "Available Paper Margin:" : "Available Paper Holding:"}</span>
                <strong style={{ color: side === "BUY" ? "#4ade80" : "#cbd5e1" }}>
                  {side === "BUY"
                    ? `₹${paperBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                    : `${existingHoldingQty} shares`}
                </strong>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>Target Broker Account:</span>
                <strong style={{ color: '#38bdf8' }}>{selectedBrokerName}</strong>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              borderRadius: '0.5rem',
              color: '#fca5a5',
              fontSize: '0.8rem',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submission Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.85rem',
              borderRadius: '0.5rem',
              fontWeight: 800,
              color: '#ffffff',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: side === "BUY"
                ? 'linear-gradient(135deg, #059669 0%, #16a34a 100%)'
                : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
              opacity: loading ? 0.5 : 1,
              boxShadow: side === "BUY" ? '0 4px 12px rgba(16, 185, 129, 0.3)' : '0 4px 12px rgba(239, 68, 68, 0.3)',
            }}
          >
            {loading
              ? "Processing Order..."
              : executionMode === "LIVE"
              ? `Review Live ${side} Order`
              : `Confirm Paper ${side} Order`}
          </button>
        </form>

        {/* Live Order Confirmation Modal */}
        {showLiveConfirmModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}>
            <div style={{
              background: '#0f172a',
              border: '1px solid #38bdf8',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              maxWidth: '440px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}>
              <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1.1rem' }}>
                Confirm Live Broker Order
              </h3>

              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div><strong>Broker:</strong> {selectedBrokerName}</div>
                <div><strong>Symbol:</strong> {symbol.trim().toUpperCase()}</div>
                <div><strong>Exchange:</strong> NSE</div>
                <div><strong>Side:</strong> <span style={{ color: side === "BUY" ? '#4ade80' : '#fca5a5', fontWeight: 700 }}>{side}</span></div>
                <div><strong>Quantity:</strong> {quantity}</div>
                <div><strong>Order Type:</strong> {orderType}</div>
                <div><strong>Product:</strong> {productType}</div>
                {isLimitOrder && <div><strong>Limit Price:</strong> ₹{price}</div>}
              </div>

              <div style={{
                padding: '0.65rem',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                color: '#fca5a5',
              }}>
                ⚠️ This is a real order request. Confirming will dispatch this order to your broker via backend API.
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowLiveConfirmModal(false)}
                  disabled={loading}
                  style={{
                    padding: '0.55rem 1rem',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    borderRadius: '0.375rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeLiveOrder}
                  disabled={loading}
                  style={{
                    padding: '0.55rem 1.25rem',
                    background: side === "BUY" ? '#059669' : '#dc2626',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '0.375rem',
                    fontWeight: 800,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Submitting...' : `Confirm & Submit ${side}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderForm;
