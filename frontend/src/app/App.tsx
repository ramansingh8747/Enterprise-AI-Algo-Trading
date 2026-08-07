import { Suspense } from 'react';
import { useRoutes } from 'react-router-dom';
import { routes } from '@/router';
import { Spinner } from '@/components/common/Spinner';

export default function App() {
  const content = useRoutes(routes);
  return <Suspense fallback={<Spinner />}>{content}</Suspense>;
}
