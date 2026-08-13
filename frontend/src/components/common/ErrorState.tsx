import React from 'react';
import './ErrorState.css';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/**
 * Generic error state component.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div className="error-state">
      <div className="error-icon">⚠️</div>
      <h2>Error</h2>
      <p>{message}</p>
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
};
