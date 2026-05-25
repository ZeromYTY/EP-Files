import { createContext, useContext } from 'react';

export const ThemeModeContext = createContext(null);

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) throw new Error('useThemeMode must be used within AppThemeProvider');
  return context;
}
