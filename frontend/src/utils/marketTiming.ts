/**
 * Market Timing Guard for Indian Equity Markets (NSE / BSE).
 * Standard Market Hours: Monday - Friday, 09:15 AM - 03:15 PM IST.
 */

export interface MarketSessionStatus {
  isOpen: boolean;
  canExit: boolean;
  isWeekend: boolean;
  statusText: string;
  istTimeString: string;
  sessionRange: string;
}

export function getMarketSessionStatus(): MarketSessionStatus {
  const now = new Date();
  
  // Format accurately to Indian Standard Time (IST)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  
  const parts = formatter.formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value || '';
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const totalMinutes = hour * 60 + minute;

  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const openMinutes = 9 * 60 + 15;   // 09:15 AM IST
  const cutoffMinutes = 15 * 60 + 15; // 03:15 PM IST (Cutoff for fresh orders)
  const closeMinutes = 15 * 60 + 30;  // 03:30 PM IST (Market Closes)

  const istTimeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} IST`;
  const sessionRange = '09:15 AM - 03:15 PM IST (Mon-Fri)';

  if (isWeekend) {
    return {
      isOpen: false,
      canExit: false,
      isWeekend: true,
      statusText: `Market Closed (Weekend: ${weekday})`,
      istTimeString,
      sessionRange,
    };
  }

  if (totalMinutes < openMinutes) {
    return {
      isOpen: false,
      canExit: false,
      isWeekend: false,
      statusText: `Market Closed (Opens @ 09:15 AM IST)`,
      istTimeString,
      sessionRange,
    };
  }

  if (totalMinutes > closeMinutes) {
    return {
      isOpen: false,
      canExit: false,
      isWeekend: false,
      statusText: `Market Closed for the Day (Closed @ 03:30 PM IST)`,
      istTimeString,
      sessionRange,
    };
  }

  if (totalMinutes > cutoffMinutes) {
    return {
      isOpen: false,
      canExit: true,
      isWeekend: false,
      statusText: `Intraday Cutoff Reached (Exit-only till 03:30 PM IST)`,
      istTimeString,
      sessionRange,
    };
  }

  return {
    isOpen: true,
    canExit: true,
    isWeekend: false,
    statusText: `Market is LIVE (09:15 AM - 03:15 PM IST)`,
    istTimeString,
    sessionRange,
  };
}
