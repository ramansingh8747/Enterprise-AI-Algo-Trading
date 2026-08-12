import React from 'react';

interface AccountSummaryProps {
  portfolioValue?: number;
  availableBalance?: number;
  todayPnL?: number;
  totalPnL?: number;
  isPaperMode?: boolean;
}

export const AccountSummary: React.FC<AccountSummaryProps> = ({
  portfolioValue = 1285400,
  availableBalance = 245000,
  todayPnL = 14250.5,
  totalPnL = 185600,
  isPaperMode = false,
}) => {
  const isTodayPositive = todayPnL >= 0;
  const isTotalPositive = totalPnL >= 0;

  const cards = [
    {
      title: isPaperMode ? 'Paper Available Balance' : 'Available Balance',
      value: `₹${availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subtitle: isPaperMode ? 'Paper Trading Margin' : 'Free Margin',
      color: '#38bdf8',
    },
    {
      title: isPaperMode ? 'Paper Portfolio Value' : 'Portfolio Value',
      value: `₹${portfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subtitle: isPaperMode ? 'Paper Asset Holdings' : 'Total Invested Assets',
      color: '#818cf8',
    },
    {
      title: "Today's P&L",
      value: `${isTodayPositive ? '+' : ''}₹${todayPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subtitle: `${isTodayPositive ? '+' : ''}${isTodayPositive ? '1.12%' : '-0.85%'} Today`,
      color: isTodayPositive ? '#4ade80' : '#f87171',
    },
    {
      title: 'Total P&L',
      value: `${isTotalPositive ? '+' : ''}₹${totalPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subtitle: `${isTotalPositive ? '+' : ''}${isTotalPositive ? '16.8%' : '-5.2%'} Overall`,
      color: isTotalPositive ? '#4ade80' : '#f87171',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {isPaperMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#facc15',
            background: 'rgba(250, 204, 21, 0.15)',
            border: '1px solid rgba(250, 204, 21, 0.3)',
            padding: '0.2rem 0.6rem',
            borderRadius: '1rem',
          }}>
            PAPER ACCOUNT — Virtual Trading Sandbox
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {cards.map((c, i) => (
          <div
            key={i}
            style={{
              background: '#1e293b',
              borderRadius: '0.75rem',
              border: '1px solid #334155',
              padding: '1.25rem',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)',
            }}
          >
            <span style={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 500, display: 'block' }}>
              {c.title}
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: c.color, margin: '0.35rem 0' }}>
              {c.value}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {c.subtitle}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
