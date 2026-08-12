import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { AppLayout, DashboardLayout } from '@/components/layouts';
import { ProtectedRoute } from './ProtectedRoute';

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const OrdersPage = lazy(() => import('@/pages/orders/OrdersPage'));
const PortfolioPage = lazy(() => import('@/pages/portfolio/PortfolioPage'));
const WatchlistPage = lazy(() => import('@/pages/watchlist/WatchlistPage'));
const StrategyPage = lazy(() => import('@/pages/strategy/StrategyPage'));
const JournalPage = lazy(() => import('@/pages/journal/TradingJournalPage'));
const BrokersPage = lazy(() => import('@/pages/brokers/BrokersPage'));
const KillSwitchPage = lazy(() => import('@/pages/admin/KillSwitchPage'));
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const UnauthorizedPage = lazy(() => import('@/pages/errors/Unauthorized'));
const HomePage = lazy(() => import('@/pages/home/HomePage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const NotFoundPage = lazy(() => import('@/pages/errors/NotFound'));

export const routes: RouteObject[] = [
  {
    path: ROUTES.HOME,
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
    ],
  },
  {
    path: ROUTES.LOGIN,
    element: <LoginPage />,
  },
  {
    path: ROUTES.REGISTER,
    element: <RegisterPage />,
  },
  {
    path: ROUTES.UNAUTHORIZED,
    element: <UnauthorizedPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: ROUTES.DASHBOARD, element: <DashboardPage /> },
          { path: ROUTES.ORDERS, element: <OrdersPage /> },
          { path: ROUTES.PORTFOLIO, element: <PortfolioPage /> },
          { path: ROUTES.WATCHLIST, element: <WatchlistPage /> },
          { path: ROUTES.STRATEGY, element: <StrategyPage /> },
          { path: ROUTES.JOURNAL, element: <JournalPage /> },
          { path: ROUTES.BROKERS, element: <BrokersPage /> },
          {
            element: <ProtectedRoute allowedRoles={['ADMIN']} />,
            children: [
              { path: ROUTES.ADMIN_DASHBOARD, element: <AdminDashboardPage /> },
              { path: ROUTES.KILL_SWITCH, element: <KillSwitchPage /> },
            ]
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];
