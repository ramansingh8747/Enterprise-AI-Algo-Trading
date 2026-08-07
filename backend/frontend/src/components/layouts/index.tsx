import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

export const AppLayout = ({ children }: { children?: ReactNode }) => (
  <div className="app-layout">
    <main>{children || <Outlet />}</main>
  </div>
);

export const DashboardLayout = ({ children }: { children?: ReactNode }) => (
  <div className="dashboard-layout" style={{ display: 'flex' }}>
    <aside style={{ width: '250px' }}>Sidebar</aside>
    <div className="main-content" style={{ flex: 1 }}>
      <header>Navbar</header>
      <main>{children || <Outlet />}</main>
    </div>
  </div>
);
