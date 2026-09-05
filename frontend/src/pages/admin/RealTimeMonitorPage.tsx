import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useWebSocketContext } from '@/context/WebSocketProvider';
import { adminAuditApi, AuditEventItem } from '@/services/api/adminAuditApi';
import { adminOverviewApi, AdminOverviewResponse } from '@/services/api/adminOverviewApi';
import { adminSystemHealthApi, AdminSystemHealthResponse } from '@/services/api/adminSystemHealthApi';

const MAX_EVENTS = 100;

type EventCategory = 'AUDIT' | 'ORDERS' | 'POSITIONS' | 'PORTFOLIO' | 'RECONCILIATION' | 'RISK' | 'LIVE_GATE' | 'STRATEGY' | 'SYSTEM';

type UnifiedEvent = {
  event_id: string;
  event_type: string;
  timestamp: string;
  user_id?: string | null;
  broker_id?: string | null;
  strategy_id?: string | null;
  strategy_instance_id?: string | null;
  symbol?: string | null;
  execution_mode?: string | null;
  payload: Record<string, unknown>;
  category: EventCategory;
  source: 'REALTIME' | 'AUDIT_HISTORY';
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
  AUDIT: 'Audit',
  ORDERS: 'Orders',
  POSITIONS: 'Positions',
  PORTFOLIO: 'Portfolio',
  RECONCILIATION: 'Reconciliation',
  RISK: 'Risk',
  LIVE_GATE: 'LIVE Gate',
  STRATEGY: 'Strategy',
  SYSTEM: 'System',
};

const categoryForEvent = (eventType: string, payload: Record<string, unknown> = {}): EventCategory => {
  const value = `${eventType} ${String(payload.action ?? '')}`.toLowerCase();
  if (value.includes('audit')) return 'AUDIT';
  if (value.includes('order') || value.includes('execution')) return 'ORDERS';
  if (value.includes('position')) return 'POSITIONS';
  if (value.includes('portfolio') || value.includes('valuation') || value.includes('pnl')) return 'PORTFOLIO';
  if (value.includes('reconciliation')) return 'RECONCILIATION';
  if (value.includes('risk') || value.includes('kill_switch')) return 'RISK';
  if (value.includes('live_gate') || value.includes('live_readiness') || value.includes('pre_live') || value.includes('live_activation')) return 'LIVE_GATE';
  if (value.includes('strategy') || value.includes('signal') || value.includes('instance')) return 'STRATEGY';
  return 'SYSTEM';
};

const fromAudit = (item: AuditEventItem): UnifiedEvent => ({
  event_id: item.id,
  event_type: 'audit.event',
  timestamp: item.occurred_at,
  user_id: item.user_id,
  broker_id: item.broker_id,
  payload: {
    action: item.action,
    outcome: item.outcome,
    user_name: item.user_name,
    username: item.username,
    broker_name: item.broker_name,
    resource_type: item.resource_type,
    resource_id: item.resource_id,
    details: item.details,
  },
  category: categoryForEvent(item.action, item.details),
  source: 'AUDIT_HISTORY',
});

const outcomeColor = (payload: Record<string, unknown>): 'success' | 'error' | 'warning' | 'info' | 'default' => {
  const outcome = String(payload.outcome ?? '').toUpperCase();
  if (['SUCCESS', 'PASS', 'ALLOWED', 'FILLED'].includes(outcome)) return 'success';
  if (['ERROR', 'FAILED', 'REJECTED'].includes(outcome)) return 'error';
  if (['BLOCKED', 'DENIED', 'FAIL'].includes(outcome)) return 'warning';
  return 'info';
};

const RealTimeMonitorPage: React.FC = () => {
  const { state, subscribe } = useWebSocketContext();
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [health, setHealth] = useState<AdminSystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('ALL');
  const [selected, setSelected] = useState<UnifiedEvent | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [audit, overviewResult, healthResult] = await Promise.all([
        adminAuditApi.list({ page: 1, page_size: MAX_EVENTS, since_hours: 24 }),
        adminOverviewApi.get(),
        adminSystemHealthApi.get(),
      ]);
      setEvents(audit.items.map(fromAudit));
      setOverview(overviewResult);
      setHealth(healthResult);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to load the admin operations snapshot.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    const unsubscribe = subscribe('admin:events', (event: any) => {
      const payload = (event?.payload && typeof event.payload === 'object') ? event.payload : {};
      const next: UnifiedEvent = {
        event_id: String(event.event_id),
        event_type: String(event.event_type),
        timestamp: String(event.timestamp),
        user_id: event.user_id ?? null,
        broker_id: event.broker_id ?? null,
        strategy_id: event.strategy_id ?? null,
        strategy_instance_id: event.strategy_instance_id ?? null,
        symbol: event.symbol ?? null,
        execution_mode: event.execution_mode ?? null,
        payload,
        category: categoryForEvent(String(event.event_type), payload),
        source: 'REALTIME',
      };
      setEvents((previous) => {
        const deduped = [next, ...previous.filter((item) => item.event_id !== next.event_id)];
        return deduped.slice(0, MAX_EVENTS);
      });
    });
    return () => unsubscribe();
  }, [subscribe]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((event) => {
      const categoryMatch = category === 'ALL' || event.category === category;
      const modeMatch = mode === 'ALL' || String(event.execution_mode ?? '').toUpperCase() === mode;
      const searchMatch = !term || `${event.event_type} ${event.symbol ?? ''} ${event.user_id ?? ''} ${JSON.stringify(event.payload)}`.toLowerCase().includes(term);
      return categoryMatch && modeMatch && searchMatch;
    });
  }, [category, events, mode, search]);

  const statusChip = (status: string) => (
    <Chip size="small" label={status} color={status === 'UP' || status === 'CONNECTED' ? 'success' : status === 'DEGRADED' || status === 'CONNECTING' || status === 'RECONNECTING' ? 'warning' : 'error'} />
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4">Real-Time Operations</Typography>
          <Typography color="text.secondary">Unified operational stream for orders, positions, portfolio, reconciliation, risk, LIVE Gate and audit events.</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip label={`WebSocket: ${state}`} color={state === 'CONNECTED' ? 'success' : state === 'CONNECTING' || state === 'RECONNECTING' ? 'warning' : 'error'} />
          <Button variant="outlined" onClick={() => void loadSnapshot()} disabled={loading}>Refresh</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => void loadSnapshot()}>Retry</Button>}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <Card><CardContent><Typography variant="caption" color="text.secondary">SYSTEM</Typography><Typography variant="h6">{health ? statusChip(health.overall_status) : loading ? <CircularProgress size={20} /> : '—'}</Typography></CardContent></Card>
        <Card><CardContent><Typography variant="caption" color="text.secondary">OPEN ORDERS</Typography><Typography variant="h5">{overview?.metrics.open_orders ?? '—'}</Typography></CardContent></Card>
        <Card><CardContent><Typography variant="caption" color="text.secondary">RUNNING STRATEGIES</Typography><Typography variant="h5">{overview?.metrics.running_strategies ?? '—'}</Typography></CardContent></Card>
        <Card><CardContent><Typography variant="caption" color="text.secondary">LIVE EXECUTION</Typography><Typography variant="h6">{overview ? (overview.live_trading_enabled ? <Chip label="ENABLED" color="error" size="small" /> : <Chip label="OFF" color="success" size="small" />) : '—'}</Typography></CardContent></Card>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
        <Paper sx={{ p: 2, height: '100%' }}><Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Infrastructure</Typography>{health?.components.map((component) => <Box key={component.name} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}><Typography variant="body2">{component.name}</Typography>{statusChip(component.status)}</Box>)}</Paper>
        <Paper sx={{ p: 2, height: '100%' }}><Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Trading Safety</Typography><Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}><Typography variant="body2">Kill Switch</Typography>{overview ? <Chip size="small" label={overview.metrics.kill_switch_active ? 'ACTIVE' : 'INACTIVE'} color={overview.metrics.kill_switch_active ? 'error' : 'success'} /> : '—'}</Box><Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}><Typography variant="body2">LIVE Trading</Typography><Chip size="small" label={overview?.live_trading_enabled ? 'ON' : 'OFF'} color={overview?.live_trading_enabled ? 'error' : 'success'} /></Box><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">Scheduler</Typography><Chip size="small" label={overview?.strategy_scheduler_enabled ? 'ON' : 'OFF'} color={overview?.strategy_scheduler_enabled ? 'warning' : 'success'} /></Box></Paper>
        <Paper sx={{ p: 2, height: '100%' }}><Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Connected Brokers</Typography>{health?.brokers.length ? health.brokers.map((broker) => <Box key={broker.broker_id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}><Typography variant="body2">{broker.broker_name}</Typography>{statusChip(broker.status)}</Box>) : <Typography color="text.secondary">No broker health records available.</Typography>}</Paper>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 2fr auto' }, gap: 2, alignItems: 'center' }}>
          <FormControl size="small"><InputLabel>Category</InputLabel><Select value={category} label="Category" onChange={(e) => setCategory(e.target.value)}><MenuItem value="ALL">All</MenuItem>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
          <FormControl size="small"><InputLabel>Mode</InputLabel><Select value={mode} label="Mode" onChange={(e) => setMode(e.target.value)}><MenuItem value="ALL">All</MenuItem><MenuItem value="PAPER">PAPER</MenuItem><MenuItem value="LIVE">LIVE</MenuItem></Select></FormControl>
          <TextField size="small" label="Search event / symbol / user / details" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="outlined" onClick={() => { setCategory('ALL'); setMode('ALL'); setSearch(''); }}>Clear</Button>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>Time</TableCell><TableCell>Category</TableCell><TableCell>Event</TableCell><TableCell>Mode</TableCell><TableCell>Symbol</TableCell><TableCell>Source</TableCell><TableCell>Result</TableCell><TableCell>Details</TableCell></TableRow></TableHead>
          <TableBody>
            {loading && events.length === 0 && <TableRow><TableCell colSpan={8} align="center"><CircularProgress size={24} /></TableCell></TableRow>}
            {!loading && filteredEvents.length === 0 && <TableRow><TableCell colSpan={8} align="center"><Typography sx={{ py: 3 }} color="text.secondary">No operational events match the selected filters.</Typography></TableCell></TableRow>}
            {filteredEvents.map((event) => (
              <TableRow key={event.event_id} hover>
                <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                <TableCell><Chip size="small" label={CATEGORY_LABELS[event.category]} /></TableCell>
                <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{event.event_type}</Typography></TableCell>
                <TableCell>{event.execution_mode || '—'}</TableCell>
                <TableCell>{event.symbol || '—'}</TableCell>
                <TableCell><Chip size="small" label={event.source === 'REALTIME' ? 'LIVE' : 'HISTORY'} color={event.source === 'REALTIME' ? 'success' : 'default'} /></TableCell>
                <TableCell>{event.payload.outcome ? <Chip size="small" label={String(event.payload.outcome)} color={outcomeColor(event.payload)} /> : '—'}</TableCell>
                <TableCell><Button size="small" onClick={() => setSelected(event)}>View</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Showing up to {MAX_EVENTS} recent events. New WebSocket events are inserted live without a page refresh.</Typography>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle>Operational Event Details</DialogTitle>
        <DialogContent dividers>
          {selected && <Box sx={{ display: 'grid', gap: 1 }}>
            <Typography><strong>Event:</strong> {selected.event_type}</Typography>
            <Typography><strong>Category:</strong> {CATEGORY_LABELS[selected.category]}</Typography>
            <Typography><strong>Time:</strong> {new Date(selected.timestamp).toLocaleString()}</Typography>
            <Typography><strong>Source:</strong> {selected.source}</Typography>
            <Typography><strong>User:</strong> {selected.user_id || 'SYSTEM'}</Typography>
            <Typography><strong>Broker:</strong> {selected.broker_id || '—'}</Typography>
            <Typography><strong>Strategy:</strong> {selected.strategy_instance_id || selected.strategy_id || '—'}</Typography>
            <Typography><strong>Mode:</strong> {selected.execution_mode || '—'}</Typography>
            <Paper variant="outlined" sx={{ p: 2, mt: 1, maxHeight: 420, overflow: 'auto' }}><pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(selected.payload, null, 2)}</pre></Paper>
          </Box>}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

export default RealTimeMonitorPage;
