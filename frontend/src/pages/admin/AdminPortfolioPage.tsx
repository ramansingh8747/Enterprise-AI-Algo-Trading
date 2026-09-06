import React, { useCallback, useEffect, useState } from 'react';
import { adminPortfoliosApi, AdminPortfolioFilters, AdminPortfolioItem } from '@/services/api/adminPortfoliosApi';
import { useWebSocketContext } from '@/context/WebSocketProvider';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { getMarketSessionStatus } from '@/utils/marketTiming';
import './AdminDashboardPage.css';
import './AdminPortfolioPage.css';

const money = (v?: string | null) => v == null ? '—' : new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(v));
const date = (v?: string | null) => v ? new Date(v).toLocaleString() : '—';

const AdminPortfolioPage: React.FC = () => {
  const { state: websocketState, subscribe } = useWebSocketContext();
  const [items,setItems]=useState<AdminPortfolioItem[]>([]); const [selected,setSelected]=useState<AdminPortfolioItem|null>(null);
  const [filters,setFilters]=useState<AdminPortfolioFilters>({page_size:25}); const [draftSearch,setDraftSearch]=useState('');
  const [page,setPage]=useState(1); const [pages,setPages]=useState(0); const [total,setTotal]=useState(0); const [summary,setSummary]=useState<any>({});
  const [loading,setLoading]=useState(true); const [refreshing,setRefreshing]=useState(false); const [error,setError]=useState<string|null>(null);

  const load=useCallback(async(nextPage=page,background=false,nextFilters=filters)=>{
    background?setRefreshing(true):setLoading(true); setError(null);
    try { const result=await adminPortfoliosApi.list({...nextFilters,page:nextPage}); setItems(result.items);setPage(result.page);setPages(result.pages);setTotal(result.total);setSummary(result.summary); }
    catch(err:any){setError(err?.message||'Unable to load admin portfolio data.');if(!background)setItems([]);}
    finally{setLoading(false);setRefreshing(false);}
  },[filters,page]);
  useEffect(()=>{void load(1,false,filters);},[load,filters]);
  useEffect(()=>{const i=window.setInterval(()=>{const session=getMarketSessionStatus();if(session.isOpen||session.canExit){void load(page,true,filters);}},15000);return()=>window.clearInterval(i)},[load,page,filters]);
  useEffect(()=>{const unsub=subscribe('admin:events',(event)=>{if(event.event_type==='portfolio.valuation.updated'||event.event_type==='position.updated'||event.event_type==='execution.created')void load(page,true,filters)});return()=>unsub()},[subscribe,load,page,filters]);
  const apply=()=>{const next={...filters,search:draftSearch.trim()||undefined,page:1};setFilters(next);setPage(1);void load(1,false,next)};
  const clear=()=>{const next={page_size:25};setDraftSearch('');setFilters(next);setPage(1);void load(1,false,next)};

  const handleDelete = async (item: AdminPortfolioItem) => {
    if (!window.confirm(`Delete paper portfolio for "${item.strategy_name || item.user_name}"?`)) return;
    try {
      await adminPortfoliosApi.delete(item.portfolio_ref);
      void load(page, false);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handlePurgeTests = async () => {
    if (!window.confirm('Delete all old sample broker accounts (TestBroker, Zerodha) from the portfolio table?')) return;
    try {
      const res = await adminPortfoliosApi.purgeTests();
      alert(res.message || 'Sample broker portfolios cleaned up.');
      void load(1, false);
    } catch (err: any) {
      alert(`Cleanup failed: ${err.message}`);
    }
  };

  return <div className="admin-control-center">
    <AdminSidebar activeLabel="Portfolio" />
    <main className="admin-control-center__content"><header className="admin-control-center__header"><div><p className="admin-control-center__eyebrow">ADMIN CONTROL CENTER</p><h1>Portfolio</h1><p className="admin-control-center__subtitle">Persisted PAPER portfolios and application-owned LIVE accounts with valuation and P&amp;L.</p></div><div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}><button type="button" onClick={()=>void load(page,true)} disabled={refreshing} className="admin-control-center__refresh">{refreshing?'Refreshing…':'Refresh'}</button><button type="button" onClick={handlePurgeTests} style={{ padding: '0.45rem 0.85rem', background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>Clean Sample Portfolios</button></div></header>
      {error&&<div className="admin-control-center__alert" role="alert"><strong>Portfolio unavailable.</strong><span>{error}</span><button type="button" onClick={()=>void load(page,false)}>Retry</button></div>}
      <section className="admin-portfolio__summary"><article><span>Accounts</span><strong>{summary.total_accounts??0}</strong><small>{summary.paper_accounts??0} PAPER · {summary.live_accounts??0} LIVE</small></article><article><span>Total Equity</span><strong>{money(summary.total_equity)}</strong><small>Persisted account view</small></article><article><span>Invested Value</span><strong>{money(summary.total_invested_value)}</strong><small>Current market value</small></article><article><span>Cash Balance</span><strong>{money(summary.total_cash_balance)}</strong><small>Persisted PAPER cash; LIVE cash unavailable</small></article><article><span>Total P&amp;L</span><strong className={Number(summary.total_pnl??0)>=0?'admin-portfolio__profit':'admin-portfolio__loss'}>{money(summary.total_pnl)}</strong><small>Realized + unrealized</small></article></section>
      <section className="admin-control-center__panel"><div className="admin-control-center__panel-header"><div><h2>Portfolio Accounts</h2><p>PostgreSQL is the source of truth. LIVE cash is not fabricated where no persisted broker cash snapshot exists.</p></div><span className={`admin-portfolio__ws ${websocketState==='CONNECTED'?'is-good':''}`}>● {websocketState}</span></div>
        <div className="admin-portfolio__filters"><label>Search<input value={draftSearch} onChange={e=>setDraftSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')apply()}} placeholder="Portfolio / symbol / user / broker / strategy"/></label><label>Mode<select value={filters.execution_mode??''} onChange={e=>{const next={...filters,execution_mode:e.target.value||undefined,page:1};setFilters(next);setPage(1)}}><option value="">All</option><option value="PAPER">PAPER</option><option value="LIVE">LIVE</option></select></label><div className="admin-portfolio__filter-actions"><button type="button" onClick={apply}>Apply</button><button type="button" onClick={clear}>Clear</button></div></div>
        {loading?<div className="admin-control-center__loading">Loading persisted portfolios…</div>:items.length===0?<div className="admin-control-center__empty">No portfolio accounts match the selected filters.</div>:<div className="admin-portfolio__table-wrap"><table className="admin-portfolio__table"><thead><tr><th>User</th><th>Mode</th><th>Broker</th><th>Strategy</th><th>Cash</th><th>Invested</th><th>Market Value</th><th>Realized P&amp;L</th><th>Unrealized P&amp;L</th><th>Equity</th><th>Positions</th><th>Updated</th><th/></tr></thead><tbody>{items.map(item=><tr key={`${item.source}:${item.portfolio_ref}`}><td><strong>{item.user_name}</strong><small>{item.user_role}</small></td><td><span className={`admin-portfolio__mode ${item.execution_mode==='LIVE'?'is-live':'is-paper'}`}>{item.execution_mode}</span></td><td>{item.broker_name||'—'}</td><td>{item.strategy_name||'Manual / Default'}</td><td>{money(item.cash_balance)}</td><td>{money(item.invested_value)}</td><td>{money(item.market_value)}</td><td className={Number(item.realized_pnl)>=0?'admin-portfolio__profit':'admin-portfolio__loss'}>{money(item.realized_pnl)}</td><td className={Number(item.unrealized_pnl)>=0?'admin-portfolio__profit':'admin-portfolio__loss'}>{money(item.unrealized_pnl)}</td><td>{money(item.equity)}</td><td>{item.position_count}</td><td>{date(item.updated_at)}</td><td><div style={{ display: "flex", gap: "0.35rem" }}><button className="admin-portfolio__details" type="button" onClick={()=>setSelected(item)}>View</button>{item.source === "PAPER_PORTFOLIO" && <button type="button" style={{ padding: "0.25rem 0.5rem", background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ef4444", color: "#fca5a5", borderRadius: "0.25rem", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }} onClick={()=>handleDelete(item)}>Delete</button>}</div></td></tr>)}</tbody></table></div>}
        <div className="admin-positions__pagination"><span>Showing {items.length?((page-1)*25)+1:0}–{Math.min(page*25,total)} of {total}</span><div><button type="button" disabled={page<=1||loading} onClick={()=>void load(page-1,false)}>Previous</button><button type="button" disabled={page>=pages||loading} onClick={()=>void load(page+1,false)}>Next</button></div></div>
      </section>
    </main>
    {selected&&<div className="admin-portfolio__modal-backdrop" onClick={()=>setSelected(null)}><section className="admin-portfolio__modal" role="dialog" aria-modal="true" aria-labelledby="portfolio-details-title" onClick={e=>e.stopPropagation()}><div className="admin-control-center__panel-header"><div><p className="admin-control-center__eyebrow">PORTFOLIO DETAILS</p><h2 id="portfolio-details-title">{selected.user_name} · {selected.execution_mode}</h2></div><button type="button" onClick={()=>setSelected(null)}>×</button></div><div className="admin-portfolio__detail-grid"><div><span>Source</span><strong>{selected.source}</strong></div><div><span>User</span><strong>{selected.user_name}</strong></div><div><span>Broker</span><strong>{selected.broker_name||'—'}</strong></div><div><span>Strategy</span><strong>{selected.strategy_name||'Manual / Default'}</strong></div><div><span>Cash</span><strong>{money(selected.cash_balance)}</strong></div><div><span>Invested Value</span><strong>{money(selected.invested_value)}</strong></div><div><span>Market Value</span><strong>{money(selected.market_value)}</strong></div><div><span>Equity</span><strong>{money(selected.equity)}</strong></div><div><span>Realized P&amp;L</span><strong>{money(selected.realized_pnl)}</strong></div><div><span>Unrealized P&amp;L</span><strong>{money(selected.unrealized_pnl)}</strong></div><div><span>Positions</span><strong>{selected.position_count}</strong></div><div><span>Valuation</span><strong>{date(selected.valuation_at)}</strong></div></div><p>LIVE cash is shown as unavailable because the current application-owned database model does not persist a broker cash snapshot. No frontend placeholder value is used.</p></section></div>}
  </div>;
};
export default AdminPortfolioPage;
