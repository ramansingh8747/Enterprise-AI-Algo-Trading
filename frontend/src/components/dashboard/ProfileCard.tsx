import React from 'react';
import { BrokerProfile } from '@/types/brokerData';

interface ProfileCardProps {
  profile: BrokerProfile | null;
  loading: boolean;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ profile, loading }) => {
  if (loading) {
    return (
      <div style={{ padding: '1.5rem', background: '#1e293b', borderRadius: '0.75rem', color: '#94a3b8' }}>
        Loading Account Profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: '1.5rem', background: '#1e293b', borderRadius: '0.75rem', color: '#f87171' }}>
        Profile unavailable. Connect a broker session to view account information.
      </div>
    );
  }

  return (
    <div style={{
      padding: '1.5rem',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      borderRadius: '0.75rem',
      border: '1px solid #334155',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)',
      color: '#f8fafc',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#38bdf8' }}>Broker Account Profile</h3>
        <span style={{
          padding: '0.25rem 0.75rem',
          background: '#0284c7',
          color: '#ffffff',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          {profile.account_type}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'block' }}>Account ID</span>
          <strong style={{ fontSize: '1.125rem', color: '#f1f5f9' }}>{profile.account_id}</strong>
        </div>

        <div>
          <span style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'block' }}>Currency</span>
          <strong style={{ fontSize: '1.125rem', color: '#f1f5f9' }}>{profile.currency || 'INR'}</strong>
        </div>

        <div>
          <span style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'block' }}>Status</span>
          <span style={{ color: '#4ade80', fontWeight: 600 }}>Active Connected</span>
        </div>
      </div>
    </div>
  );
};
