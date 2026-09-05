import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { adminReconciliationApi, ReconciliationMetric, ReconciliationSummary } from '@/services/api/adminReconciliationApi';
import { useWebSocketContext } from '@/context/WebSocketProvider';

const statusColor = (status: ReconciliationMetric['status']) => {
  if (status === 'MATCHED') return 'success';
  if (status === 'MISMATCH') return 'error';
  if (status === 'UNAVAILABLE') return 'warning';
  return 'error';
};

const MetricCard = ({ title, metric }: { title: string; metric: ReconciliationMetric }) => (
  <Paper sx={{ p: 2, minWidth: 220, flex: 1 }}>
    <Typography variant="overline" color="text.secondary">{title}</Typography>
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
      <Chip size="small" label={metric.status} color={statusColor(metric.status)} />
      <Typography variant="body2">{metric.difference_count} difference(s)</Typography>
    </Box>
    <Typography variant="body2">Internal: {metric.internal_count}</Typography>
    <Typography variant="body2">Broker: {metric.external_count}</Typography>
  </Paper>
);

const AdminReconciliationPage: React.FC = () => {
  const [data, setData] = useState<ReconciliationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { state, subscribe } = useWebSocketContext();

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setData(await adminReconciliationApi.reconcile());
    } catch (err: any) {
      setError(err?.message || 'Unable to run reconciliation.');
    } finally {
      setLoading(false);
    }
  }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      await load();
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const unsubscribe = subscribe('admin:events', (event: any) => {
      if (event?.event_type === 'reconciliation.completed') void load();
    });
    return () => unsubscribe();
  }, [load, subscribe]);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4">Admin Reconciliation</Typography>
          <Typography variant="body2" color="text.secondary">
            Read-only comparison of internal trading ledger state against connected broker state.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip label={`WebSocket: ${state}`} size="small" color={state === 'CONNECTED' ? 'success' : 'default'} />
          <Button variant="contained" onClick={() => void runNow()} disabled={loading || running}>
            {running ? <CircularProgress size={20} /> : 'Run Reconciliation'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Retry</Button>} sx={{ mb: 2 }}>{error}</Alert>}

      {loading && !data ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}><CircularProgress /><Typography sx={{ mt: 2 }}>Checking connected broker accounts...</Typography></Box>
      ) : data ? (
        <>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="h6">Overall</Typography>
                <Chip label={data.overall_status} color={statusColor(data.overall_status)} />
              </Box>
              <Typography variant="body2" color="text.secondary">Checked: {new Date(data.checked_at).toLocaleString()}</Typography>
            </Box>
          </Paper>

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3 }}>
            <MetricCard title="Cash" metric={data.cash} />
            <MetricCard title="Positions" metric={data.positions} />
            <MetricCard title="Orders" metric={data.orders} />
          </Box>

          {data.cash.status === 'UNAVAILABLE' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Broker cash comparison is currently unavailable because the existing BrokerInterface does not expose an account balance/cash method. No cash value is fabricated.
            </Alert>
          )}

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Broker</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Session</TableCell>
                  <TableCell>Overall</TableCell>
                  <TableCell>Orders</TableCell>
                  <TableCell>Positions</TableCell>
                  <TableCell>Checked</TableCell>
                  <TableCell>Discrepancy</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.accounts.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center">No active broker sessions available for reconciliation.</TableCell></TableRow>
                ) : data.accounts.map((account) => (
                  <TableRow key={`${account.user_id}-${account.broker_id}`} hover>
                    <TableCell>{account.broker_name}</TableCell>
                    <TableCell>{account.broker_type}</TableCell>
                    <TableCell><Chip size="small" label={account.session_status} /></TableCell>
                    <TableCell><Chip size="small" label={account.overall_status} color={statusColor(account.overall_status)} /></TableCell>
                    <TableCell>{account.orders.status} ({account.orders.difference_count})</TableCell>
                    <TableCell>{account.positions.status} ({account.positions.difference_count})</TableCell>
                    <TableCell>{new Date(account.checked_at).toLocaleTimeString()}</TableCell>
                    <TableCell>
                      {account.error ? account.error : [...account.orders.details, ...account.positions.details].length === 0 ? 'None' : (
                        <Box component="ul" sx={{ m: 0, pl: 2, maxWidth: 480 }}>
                          {[...account.orders.details, ...account.positions.details].slice(0, 3).map((detail, index) => (
                            <li key={index}><Typography variant="caption">{JSON.stringify(detail)}</Typography></li>
                          ))}
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : null}
    </Box>
  );
};

export default AdminReconciliationPage;
