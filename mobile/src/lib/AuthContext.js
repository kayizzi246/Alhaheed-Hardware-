import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  api, saveSession, loadSession, clearSession, setUnauthorizedHandler,
} from './api';
import { connectSocket, disconnectSocket } from './socket';

const AuthContext = createContext(null);

/** Holds the signed-in user, the JWT and the socket connection. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(async () => {
    disconnectSocket();
    await clearSession();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      disconnectSocket();
      setUser(null);
    });
    (async () => {
      const { token, user: stored } = await loadSession();
      if (token && stored) {
        setUser(stored);
        connectSocket();
        // Refresh the profile in the background; a stale token just signs out.
        api('/api/auth/me').then((r) => setUser(r.user)).catch(() => {});
      }
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (token, nextUser) => {
    await saveSession(token, nextUser);
    setUser(nextUser);
    connectSocket();
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signOut, refresh: () => api('/api/auth/me').then((r) => setUser(r.user)) }),
    [user, ready, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
