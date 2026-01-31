/**
 * App Lock Context
 * Gates all tabs behind a 4-digit access code.
 * Each code maps to a separate user with isolated local storage.
 */
import React, { createContext, useContext, ReactNode } from 'react';

interface AppLockContextType {
  activeUser: string;
}

const AppLockContext = createContext<AppLockContextType>({ activeUser: '' });

export function AppLockProvider({ activeUser, children }: { activeUser: string; children: ReactNode }) {
  return (
    <AppLockContext.Provider value={{ activeUser }}>
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  return useContext(AppLockContext);
}
