import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { RouteObject } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { AppLayout, DashboardLayout } from '@/components/layouts';
import { ProtectedRoute } from './ProtectedRoute';

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const OrdersPage = lazy(() => import('@/pages/orders/OrdersPage'));
const PortfolioPage = lazy(() => import('@/pages/portfolio/PortfolioPage'));
const WatchlistPage = lazy(() => import('@/pages/watchlist/WatchlistPage'));
const StrategyPage = lazy(() => import('@/pages/strategy/StrategyPage'));
const StrategyManagementPage = lazy(() => import('@/pages/strategy/StrategyManagementPage'));
const StrategyCreatePage = lazy(() => import('@/pages/strategy/StrategyCreatePage'));
const StrategyImportPage = lazy(() => import('@/pages/strategy/StrategyImportPage'));
const StrategyDetailsPage = lazy(() => import('@/pages/strategy/StrategyDetailsPage'));
const StrategyEditPage = lazy(() => import('@/pages/strategy/StrategyEditPage'));
const JournalPage = lazy(() => import('@/pages/journal/TradingJournalPage'));
const BrokersPage = lazy(() => import('@/pages/brokers/BrokersPage'));
const FrozenStrategyPaperTradingDashboard = lazy(() => import('@/pages/paper/FrozenStrategyPaperTradingDashboard'));
const KillSwitchPage = lazy(() => import('@/pages/admin/KillSwitchPage'));
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const RealTimeMonitorPage = lazy(() => import('@/pages/admin/RealTimeMonitorPage'));
const LiveReadinessPage = lazy(() => import('@/pages/admin/LiveReadinessPage'));
const PreLiveOperationalPage = lazy(() => import('@/pages/admin/PreLiveOperationalPage'));
const AdminLiveGatePage = lazy(() => import('@/pages/admin/AdminLiveGatePage'));
const AdminAuditPage = lazy(() => import('@/pages/admin/AdminAuditPage'));
const UserManagementPage = lazy(() => import('@/pages/admin/UserManagementPage'));
const AdminBrokersPage = lazy(() => import('@/pages/admin/AdminBrokersPage'));
const AdminStrategiesPage = lazy(() => import('@/pages/admin/AdminStrategiesPage'));
const AdminRiskPage = lazy(() => import('@/pages/admin/AdminRiskPage'));
const AdminOrdersPage = lazy(() => import('@/pages/admin/AdminOrdersPage'));
const AdminPositionsPage = lazy(() => import('@/pages/admin/AdminPositionsPage'));
const AdminPortfolioPage = lazy(() => import('@/pages/admin/AdminPortfolioPage'));

const AdminReconciliationPage = lazy(() => import('@/pages/admin/AdminReconciliationPage'));
const UnauthorizedPage = lazy(() => import('@/pages/errors/Unauthorized'));
const HomePage = lazy(() => import('@/pages/home/HomePage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const AdminLoginPage = lazy(() => import('@/pages/auth/AdminLoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const AdminRegisterPage = lazy(() => import('@/pages/auth/AdminRegisterPage'));
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
    path: ROUTES.ADMIN_LOGIN,
    element: <AdminLoginPage />,
  },
  {
    path: ROUTES.REGISTER,
    element: <RegisterPage />,
  },
  {
    path: ROUTES.ADMIN_REGISTER,
    element: <AdminRegisterPage />,
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
          { path: ROUTES.WATCHLIST, element: <WatchlistPage /> },
          { path: ROUTES.ORDERS, element: <OrdersPage /> },
          { path: ROUTES.PORTFOLIO, element: <PortfolioPage /> },
          { path: '/strategy', element: <Navigate to="/strategies" replace /> },
          { path: ROUTES.STRATEGY, element: <StrategyManagementPage /> },
          { path: '/strategies/new', element: <StrategyCreatePage /> },
          { path: '/strategies/import', element: <StrategyImportPage /> },
          { path: '/strategies/:id/edit', element: <StrategyEditPage /> },
          { path: '/strategies/:id', element: <StrategyDetailsPage /> },
          { path: ROUTES.JOURNAL, element: <JournalPage /> },
          { path: ROUTES.BROKERS, element: <BrokersPage /> },
          { path: ROUTES.FROZEN_PAPER_TRADING, element: <FrozenStrategyPaperTradingDashboard /> },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['ADMIN']} />,
        children: [
          { path: ROUTES.ADMIN_DASHBOARD, element: <AdminDashboardPage /> },
          { path: ROUTES.ADMIN_USERS, element: <UserManagementPage /> },
          { path: ROUTES.ADMIN_STRATEGIES, element: <AdminStrategiesPage /> },
          { path: ROUTES.ADMIN_BROKERS, element: <AdminBrokersPage /> },
          { path: ROUTES.ADMIN_RISK, element: <AdminRiskPage /> },
          { path: ROUTES.ADMIN_ORDERS, element: <AdminOrdersPage /> },
          { path: ROUTES.ADMIN_POSITIONS, element: <AdminPositionsPage /> },
          { path: ROUTES.ADMIN_PORTFOLIO, element: <AdminPortfolioPage /> },
          { path: ROUTES.ADMIN_REALTIME_MONITOR, element: <RealTimeMonitorPage /> },
          { path: ROUTES.ADMIN_LIVE_READINESS, element: <LiveReadinessPage /> },
          { path: ROUTES.ADMIN_PRE_LIVE_OPERATIONAL, element: <PreLiveOperationalPage /> },
          { path: ROUTES.ADMIN_LIVE_GATE, element: <AdminLiveGatePage /> },
          { path: ROUTES.ADMIN_AUDIT, element: <AdminAuditPage /> },
          { path: ROUTES.ADMIN_RECONCILIATION, element: <AdminReconciliationPage /> },
          { path: ROUTES.KILL_SWITCH, element: <KillSwitchPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];
