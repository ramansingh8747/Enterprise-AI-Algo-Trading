import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { AppLayout, DashboardLayout } from '@/components/layouts';

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const HomePage = lazy(() => import('@/pages/home/HomePage'));
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
    path: ROUTES.DASHBOARD,
    element: <DashboardLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];
