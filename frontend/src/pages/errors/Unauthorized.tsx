import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';

const Unauthorized: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#0f172a',
      color: '#ef4444',
      gap: '1rem'
    }}>
      <h1 style={{ fontSize: '3rem' }}>403 - Access Denied</h1>
      <p style={{ color: '#94a3b8' }}>You do not have permission to access this page.</p>
      <Link to={ROUTES.DASHBOARD} style={{ color: '#38bdf8', textDecoration: 'none' }}>
        Return to Dashboard
      </Link>
    </div>
  );
};

export default Unauthorized;
