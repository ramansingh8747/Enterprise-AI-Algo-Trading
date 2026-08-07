import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

/**
 * AppLayout — root shell layout.
 * Wraps public / unauthenticated pages.
 */
export const AppLayout = ({ children }: { children?: ReactNode }) => (
  <div className="app-layout">
    <main>{children || <Outlet />}</main>
  </div>
);
