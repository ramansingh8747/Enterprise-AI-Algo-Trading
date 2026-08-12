import React, { useState, useEffect } from 'react';
import { strategyApi } from '@/services/api/strategyApi';
import { StrategyDefinition } from '@/types/strategy';
import { StrategyInstanceList } from '@/components/strategy/StrategyInstanceList';

export default function StrategyPage() {
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStrategies() {
      try {
        setLoading(true);
        const data = await strategyApi.listDefinitions();
        setStrategies(data);
      } catch (err) {
        setError('Failed to load strategies');
      } finally {
        setLoading(false);
      }
    }
    loadStrategies();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1>Strategies</h1>
      <ul>
        {strategies.map((s) => (
          <li key={s.id}>
            <button onClick={() => setSelectedStrategyId(s.id)}>{s.name}</button>
          </li>
        ))}
      </ul>
      {selectedStrategyId && <StrategyInstanceList strategyDefinitionId={selectedStrategyId} />}
    </div>
  );
}
