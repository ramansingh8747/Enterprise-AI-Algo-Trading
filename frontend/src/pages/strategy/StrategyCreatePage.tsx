import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StrategyCreateForm } from '@/components/strategy/StrategyCreateForm';
import '../styles/StrategyCreate.css';

/**
 * Strategy Creation Page
 */
export default function StrategyCreatePage() {
  const navigate = useNavigate();

  const handleSuccess = (id: string) => {
    // Navigate to strategy details after creation
    navigate(`/strategies/${id}`);
  };

  const handleCancel = () => {
    navigate('/strategies');
  };

  return (
    <div className="strategy-create-page">
      <StrategyCreateForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
}
