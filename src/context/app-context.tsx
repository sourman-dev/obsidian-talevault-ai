import { createContext, useContext, type ReactNode } from 'react';
import type { App } from 'obsidian';
import type { MianixSettings } from '../types';

interface AppContextValue {
  app: App;
  settings: MianixSettings;
  saveSettings: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
  children: ReactNode;
  value: AppContextValue;
}

export function AppProvider({ children, value }: AppProviderProps) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

export function useVault() {
  const { app } = useApp();
  return app.vault;
}

export function useSettings() {
  const { settings, saveSettings } = useApp();
  return { settings, saveSettings };
}
