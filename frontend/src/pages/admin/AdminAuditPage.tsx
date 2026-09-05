import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Paper, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { adminAuditApi, AuditEventItem, AuditSummary } from '@/services/api/adminAuditApi';
import { useWebSocketContext } from '@/context/WebSocketProvider';

const pageSize = 25;

const outcomeColor = (outcome: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
  if (['SUCCESS', 'PASS', 'ALLOWED'].includes(outcome)) return 'success';
  if (['ERROR', 'FAILED'].includes(outcome)) return 'error';
  if (['BLOCKED', 'DENIED', 'FAIL'].includes(outcome)) return 'warning';
  if (outcome === 'INFO') return 'info';
  return 'default';
};

const AdminAuditPage: React.FC = () => {
  const { state, subscribe } = useWebSocketContext();
  const [items, setItems] = useState<AuditEventItem[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [outcome, setOutcome] = useState('');
  const [sinceHours, setSinceHours] = useState('24');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditEventItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [result, summaryResult] = await Promise.all([
        adminAuditApi.list({ page, page_size: pageSize, action: action || undefined, outcome: outcome || undefined, search: search || undefined, since_hours: Number(sinceHours) }),
        adminAuditApi.summary(Number(sinceHours)),
      ]);
      setItems(result.items);
      setTotal(result.total);
      setSummary(summaryResult);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to load audit events.');
    } finally {
      setLoading(false);
    }
  }, [action, outcome, page, search, sinceHours]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const unsubscribe = subscribe('admin:events', (event: any) => {
      if (event?.event_type === 'audit.event') void load();
    });
    return () => unsubscribe();
  }, [subscribe, load]);

  const reset = () => { setAction(''); setOutcome(''); setSearch(''); setPage(1); };
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4">Audit</Typography>
          <Typography color="text.secondary">Durable administrative and trading-safety audit trail</Typography>
        </Box>
        <Chip label={`Realtime: ${state}`} color={state === 'CONNECTED' ? 'success' : 'warning'} />
      </Box>

      {summary && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          {[['Events', summary.total], ['Success', summary.successes], ['Blocked', summary.blocked], ['Failures', summary.failures]].map(([label, value]) => (
            <Paper sx={{ p: 2 }} key={String(label)}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h5">{value}</Typography></Paper>
          ))}
        </Box>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr 1fr 1fr' }, gap: 2, alignItems: 'center' }}>
          <TextField fullWidth size="small" label="Search action / user / resource" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <FormControl fullWidth size="small"><InputLabel>Outcome</InputLabel><Select value={outcome} label="Outcome" onChange={(e) => { setOutcome(e.target.value); setPage(1); }}><MenuItem value="">All</MenuItem><MenuItem value="SUCCESS">SUCCESS</MenuItem><MenuItem value="BLOCKED">BLOCKED</MenuItem><MenuItem value="ERROR">ERROR</MenuItem><MenuItem value="INFO">INFO</MenuItem></Select></FormControl>
          <TextField fullWidth size="small" label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
          <FormControl fullWidth size="small"><InputLabel>Window</InputLabel><Select value={sinceHours} label="Window" onChange={(e) => { setSinceHours(e.target.value); setPage(1); }}><MenuItem value="1">1 hour</MenuItem><MenuItem value="24">24 hours</MenuItem><MenuItem value="168">7 days</MenuItem><MenuItem value="720">30 days</MenuItem></Select></FormControl>
          <Button fullWidth variant="outlined" onClick={reset}>Clear</Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>Time</TableCell><TableCell>Action</TableCell><TableCell>User</TableCell><TableCell>Broker</TableCell><TableCell>Outcome</TableCell><TableCell>Resource</TableCell><TableCell>Details</TableCell></TableRow></TableHead>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell></TableRow>}
            {!loading && items.length === 0 && <TableRow><TableCell colSpan={7} align="center">No audit events found for the selected filters.</TableCell></TableRow>}
            {!loading && items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>{new Date(item.occurred_at).toLocaleString()}</TableCell>
                <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{item.action}</Typography></TableCell>
                <TableCell>{item.user_name || item.username || item.user_id || 'SYSTEM'}</TableCell>
                <TableCell>{item.broker_name || item.broker_id || '—'}</TableCell>
                <TableCell><Chip size="small" label={item.outcome} color={outcomeColor(item.outcome)} /></TableCell>
                <TableCell>{item.resource_type ? `${item.resource_type}${item.resource_id ? `:${item.resource_id}` : ''}` : '—'}</TableCell>
                <TableCell><Button size="small" onClick={() => setSelected(item)}>View</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Typography variant="body2" color="text.secondary">Page {page} of {pages} · {total} events</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}><Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button></Box>
      </Box>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle>Audit Event Details</DialogTitle>
        <DialogContent dividers>
          {selected && <Box sx={{ display: 'grid', gap: 1 }}>
            <Typography><strong>Action:</strong> {selected.action}</Typography>
            <Typography><strong>Outcome:</strong> {selected.outcome}</Typography>
            <Typography><strong>Time:</strong> {new Date(selected.occurred_at).toLocaleString()}</Typography>
            <Typography><strong>User:</strong> {selected.user_name || selected.username || selected.user_id || 'SYSTEM'}</Typography>
            <Typography><strong>Broker:</strong> {selected.broker_name || selected.broker_id || '—'}</Typography>
            <Typography><strong>Resource:</strong> {selected.resource_type || '—'} {selected.resource_id || ''}</Typography>
            <Paper variant="outlined" sx={{ p: 2, mt: 1, maxHeight: 360, overflow: 'auto' }}><pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(selected.details, null, 2)}</pre></Paper>
          </Box>}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminAuditPage;
