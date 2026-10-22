import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, setToken, setUnauthorizedHandler } from './api';

type User = { id: number; username: string; full_name: string | null };

type AuthState = {
  ready: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
const TOKEN_KEY = 'auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  async function logout() {
    setToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }

  useEffect(() => {
    setUnauthorizedHandler(logout);
    (async () => {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      if (saved) {
        setToken(saved);
        try {
          setUser(await api<User>('/auth/me'));
        } catch {
          setToken(null);
        }
      }
      setReady(true);
    })();
  }, []);

  async function login(username: string, password: string) {
    const res = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(res.token);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setUser(res.user);
  }

  return (
    <AuthContext.Provider value={{ ready, user, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
