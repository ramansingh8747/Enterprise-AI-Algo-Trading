import React from 'react';
import { StrategyDefinition } from '@/types/strategy';
import '../styles/StrategyCard.css';

interface StrategyListCardProps {
  strategy: StrategyDefinition;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteConfirm?: (id: string) => Promise<void>;
  deleteConfirm?: string | null;
  deleting?: string | null;
}

/**
 * Card component for displaying a strategy definition in the list.
 * Shows name, type, status, timestamps, and action buttons.
 */
export const StrategyListCard: React.FC<StrategyListCardProps> = ({
  strategy,
  onView,
  onEdit,
  onDelete,
  onDeleteConfirm,
  deleteConfirm,
  deleting,
}) => {
  const isConfirming = deleteConfirm === strategy.id;
  const isDeleting = deleting === strategy.id;

  return (
    <div className="strategy-card">
      <div className="strategy-card-header">
        <h3 className="strategy-card-title">{strategy.name}</h3>
        <span className={`strategy-status ${strategy.is_active ? 'active' : 'inactive'}`}>
          {strategy.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="strategy-card-body">
        <div className="strategy-card-info">
          <label>Type:</label>
          <span className="strategy-type">{strategy.strategy_type}</span>
        </div>
        <div className="strategy-card-info">
          <label>Created:</label>
          <span>{new Date(strategy.created_at).toLocaleDateString()}</span>
        </div>
        <div className="strategy-card-info">
          <label>Updated:</label>
          <span>{new Date(strategy.updated_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="strategy-card-actions">
        <button className="btn btn-sm btn-info" onClick={onView}>
          View
        </button>
        <button className="btn btn-sm btn-secondary" onClick={onEdit}>
          Edit
        </button>
        {isConfirming ? (
          <>
            <button
              className="btn btn-sm btn-danger"
              disabled={isDeleting}
              onClick={() => {
                if (onDeleteConfirm) {
                  onDeleteConfirm(strategy.id);
                }
              }}
            >
              {isDeleting ? 'Deleting...' : 'Confirm'}
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => onDelete()}
              disabled={isDeleting}
            >
              Cancel
            </button>
          </>
        ) : (
          <button className="btn btn-sm btn-danger-outline" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
};
