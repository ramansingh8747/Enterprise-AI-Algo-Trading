import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { strategyApi, StrategyDefinition } from '@/services/api/strategyApi';
import { useAuth } from '@/context/AuthContext';
import { StrategyListCard } from '@/components/strategy/StrategyListCard';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import '../styles/StrategyManagement.css';

/**
 * Strategy Management Page
 *
 * Displays the user's strategy definitions with:
 * - Create, View, Edit, Delete actions
 * - Status and metadata display
 * - Instance count and status
 */
export default function StrategyManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  /**
   * Load all strategy definitions for the current user
   */
  const loadStrategies = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await strategyApi.listDefinitions();
      setStrategies(data);
    } catch (err: any) {
      const message = err.message || 'Failed to load strategies';
      setError(message);
      console.error('Failed to load strategies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  /**
   * Handle delete strategy with confirmation
   */
  const handleDeleteStrategy = React.useCallback(
    async (strategyId: string) => {
      setDeleting(strategyId);
      try {
        await strategyApi.deleteDefinition(strategyId);
        setStrategies((prev) => prev.filter((s) => s.id !== strategyId));
        setDeleteConfirm(null);
      } catch (err: any) {
        setError(err.message || 'Failed to delete strategy');
      } finally {
        setDeleting(null);
      }
    },
    []
  );

  if (loading) {
    return <LoadingState message="Loading strategies..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={loadStrategies}
      />
    );
  }

  return (
    <div className="strategy-management">
      <div className="strategy-management-header">
        <div className="strategy-management-title">
          <h1>Strategy Management</h1>
          <p className="strategy-management-subtitle">
            Create and manage your trading strategies
          </p>
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => navigate('/strategies/new')}
        >
          + Create Strategy
        </button>
      </div>

      {strategies.length === 0 ? (
        <EmptyState
          title="No Strategies Yet"
          message="Create your first strategy to get started"
          actionLabel="Create Strategy"
          onAction={() => navigate('/strategies/new')}
        />
      ) : (
        <div className="strategy-grid">
          {strategies.map((strategy) => (
            <StrategyListCard
              key={strategy.id}
              strategy={strategy}
              onView={() => navigate(`/strategies/${strategy.id}`)}
              onEdit={() => navigate(`/strategies/${strategy.id}/edit`)}
              onDelete={() => setDeleteConfirm(strategy.id)}
              onDeleteConfirm={handleDeleteStrategy}
              deleteConfirm={deleteConfirm}
              deleting={deleting}
            />
          ))}
        </div>
      )}
    </div>
  );
}
