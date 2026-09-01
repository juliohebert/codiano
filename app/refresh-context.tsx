import { createContext, useContext, useState } from 'react';

type RefreshContextValue = {
  token: number;
  bump: () => void;
};

const RefreshContext = createContext<RefreshContextValue>({ token: 0, bump: () => {} });

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState(0);
  const bump = () => setToken((n) => n + 1);
  return <RefreshContext.Provider value={{ token, bump }}>{children}</RefreshContext.Provider>;
}

export function useRefreshToken() {
  return useContext(RefreshContext);
}
