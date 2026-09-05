import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import '@/pages/admin/AdminControlCenter.css';

const navItems = [
  { label: 'Overview',   icon: '⌂', to: ROUTES.ADMIN_DASHBOARD },
  { label: 'Users',      icon: '♟', to: ROUTES.ADMIN_USERS },
  { label: 'Strategies', icon: '◎', to: ROUTES.ADMIN_STRATEGIES },
  { label: 'Brokers',    icon: '▣', to: ROUTES.ADMIN_BROKERS },
  { label: 'Risk',       icon: '◐', to: ROUTES.ADMIN_RISK },
  { label: 'Orders',     icon: '▤', to: ROUTES.ADMIN_ORDERS },
  { label: 'Positions',  icon: '⌖', to: ROUTES.ADMIN_POSITIONS },
  { label: 'Portfolio',  icon: '◫', to: ROUTES.ADMIN_PORTFOLIO },
  { label: 'Reconcile',  icon: '⇄', to: ROUTES.ADMIN_RECONCILIATION },
  { label: 'LIVE Gate',  icon: '●', to: ROUTES.ADMIN_LIVE_GATE },
  { label: 'Audit',      icon: '▥', to: ROUTES.ADMIN_AUDIT },
];

interface AdminSidebarProps {
  activeLabel: string;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeLabel }) => {
  let user: any = null;
  let logout = () => {};
  try {
    const auth = useAuth();
    user = auth.user;
    logout = auth.logout;
  } catch {
    // Safe fallback if rendered without AuthProvider in unit tests
  }
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  const initials = (user?.full_name || user?.username || 'A')[0].toUpperCase();
  const displayName = user?.full_name || user?.username || 'Admin';
  const displayRole = (user?.role as string)?.replace('UserRole.', '') || 'ADMIN';

  return (
    <aside className="admin-control-center__sidebar" aria-label="Admin Control Center navigation">
      <div className="admin-control-center__brand">ADMIN CONTROL CENTER</div>
      <nav className="admin-control-center__nav">
        {navItems.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className={`admin-control-center__nav-item ${item.label === activeLabel ? 'is-active' : ''}`}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="admin-control-center__safety">
        <span className="admin-control-center__dot admin-control-center__dot--warning" />
        <div>
          <strong>PAPER MODE</strong>
          <small>LIVE trading remains server-side disabled.</small>
        </div>
      </div>

      <div className="admin-control-center__user-footer">
        <div className="admin-control-center__user-info">
          <span className="admin-control-center__user-avatar">{initials}</span>
          <div>
            <strong>{displayName}</strong>
            <small>{displayRole}</small>
          </div>
        </div>
        <button
          id="admin-logout-btn"
          type="button"
          className="admin-control-center__logout-btn"
          onClick={handleLogout}
          title="Logout"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
