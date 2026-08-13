import React from 'react';
import './LoadingState.css';

interface LoadingStateProps {
  message?: string;
}

/**
 * Generic loading state component.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
}) => {
  return (
    <div className="loading-state">
      <div className="spinner"></div>
      <p>{message}</p>
    </div>
  );
};
