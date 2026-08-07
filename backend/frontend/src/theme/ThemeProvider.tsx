import { createContext, ReactNode } from 'react';
import { theme } from './theme';

export const ThemeContext = createContext(theme);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};
