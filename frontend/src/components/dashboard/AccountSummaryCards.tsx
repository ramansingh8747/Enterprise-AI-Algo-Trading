import React from 'react';

interface AccountSummaryCardsProps {
  portfolioValue?: number;
  availableBalance?: number;
  todayPnL?: number;
  totalPnL?: number;
}

export const AccountSummaryCards: React.FC<AccountSummaryCardsProps> = ({
  portfolioValue = 1285400,
  availableBalance = 245000,
  todayPnL = 14250.5,
  totalPnL = 185600,
}) => {
  const isTodayPositive = todayPnL >= 0;
  const isTotalPositive = totalPnL >= 0;

  const cards = [
    {
      title: 'Available Margin',
      value: `₹${availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subtitle: 'Free Cash Available',
      color: '#38bdf8',
    },
    {
      title: 'Portfolio Value',
      value: `₹${portfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subtitle: 'Invested Assets',
      color: '#818cf8',
    },
    {
      title: "Today's P&L",
      value: `${isTodayPositive ? '+' : ''}₹${todayPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subtitle: `${isTodayPositive ? '+1.12%' : '-0.85%'} Today`,
      color: isTodayPositive ? '#4ade80' : '#f87171',
    },
    {
      title: 'Total P&L',
      value: `${isTotalPositive ? '+' : ''}₹${totalPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subtitle: `${isTotalPositive ? '+16.8%' : '-5.2%'} Overall`,
      color: isTotalPositive ? '#4ade80' : '#f87171',
    },
  ];

  return (
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
  );
};
