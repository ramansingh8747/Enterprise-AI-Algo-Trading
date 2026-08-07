import { ReactNode, ComponentType } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ErrorBoundary } from '@/components/feedback';

type ProviderProps = { children: ReactNode };
type ProviderComponent = ComponentType<ProviderProps>;

const compose = (providers: ProviderComponent[]) => {
  return ({ children }: ProviderProps) => {
    return providers.reduceRight(
      (acc, Provider) => <Provider>{acc}</Provider>,
      <>{children}</>
    );
  };
};

const providers: ProviderComponent[] = [BrowserRouter, ThemeProvider, ErrorBoundary];
const ComposedProviders = compose(providers);

export const AppProviders = ({ children }: ProviderProps) => {
  return <ComposedProviders>{children}</ComposedProviders>;
};
