'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { GqlError, getToken, gql, setToken } from './gql';
import { USER_FIELDS } from './fragments';
import { clearOffline, isOffline, saveUser, savedUser } from './offline';
import type { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  aiReady: boolean;
  signIn: (token: string) => Promise<User | null>;
  signOut: () => void;
  refresh: () => Promise<User | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [aiReady, setAiReady] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await gql<{ me: User | null; aiReady: boolean }>(`{ me { ${USER_FIELDS} } aiReady }`);
      setUser(data.me);
      setAiReady(data.aiReady);
      if (data.me) void saveUser(data.me);
      else setToken(null);
      return data.me;
    } catch (e) {
      // Without internet, carry on as the account last seen on this device
      // so saved readings can still be opened.
      if (isOffline() || (e instanceof GqlError && e.code === 'NETWORK')) {
        const saved = (await savedUser()) ?? null;
        setUser(saved);
        return saved;
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (token: string) => {
      setToken(token);
      return refresh();
    },
    [refresh],
  );

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    void clearOffline();
  }, []);

  return <AuthContext.Provider value={{ user, loading, aiReady, signIn, signOut, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
