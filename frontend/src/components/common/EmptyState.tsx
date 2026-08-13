import React from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Generic empty state component.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="empty-state">
      <div className="empty-icon">📭</div>
      <h2>{title}</h2>
      <p>{message}</p>
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};
