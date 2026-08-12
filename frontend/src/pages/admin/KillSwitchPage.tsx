import React from 'react';
import KillSwitchStatus from '@/components/admin/KillSwitchStatus';

export const KillSwitchPage: React.FC = () => {
  return (
    <div style={{ padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto 1.5rem auto' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
          Admin Risk Operations
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.25rem' }}>
          Emergency controls and platform risk administration.
        </p>
      </div>

      <KillSwitchStatus />
    </div>
  );
};

export default KillSwitchPage;
