import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';

const AdminDashboardPage: React.FC = () => {
  return (
    <div style={{ padding: '2rem', color: '#f8fafc' }}>
      <h1>Admin Console</h1>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <Link to={ROUTES.KILL_SWITCH} style={{ 
          padding: '1rem 2rem', 
          background: '#ef4444', 
          color: 'white', 
          borderRadius: '8px',
          textDecoration: 'none'
        }}>
          Kill Switch Management
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
