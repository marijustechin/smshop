'use client';

import * as React from 'react';
import { ApiError, apiRequest } from '@/shared/api/client';
import * as authApi from '../api/auth-api';
import type { AuthUser } from '@/entities/user';
import type { AuthStatus } from './types';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string, turnstileToken?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  /** Establishes in-memory auth state from the httpOnly refresh cookie. */
  bootstrap: () => Promise<void>;
  /** Coordinated single-flight access-token refresh; returns null if unauthenticated. */
  refreshAccessToken: () => Promise<string | null>;
  /** Authenticated request with one automatic refresh-and-retry on 401. */
  authedRequest: <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/**
 * Holds the access token in memory only (a ref, never persisted) and the user in
 * state. The refresh token stays in the backend's httpOnly cookie and is never
 * read by JavaScript. A single in-flight refresh promise coordinates concurrent
 * callers so refresh-token rotation is never raced.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthStatus>('unknown');
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const tokenRef = React.useRef<string | null>(null);
  const refreshInFlight = React.useRef<Promise<string | null> | null>(null);
  const bootstrapInFlight = React.useRef<Promise<void> | null>(null);

  const clear = React.useCallback(() => {
    tokenRef.current = null;
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const refreshAccessToken = React.useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }
    const promise = (async () => {
      try {
        const { accessToken } = await authApi.refresh();
        tokenRef.current = accessToken;
        return accessToken;
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthenticated) {
          clear();
          return null;
        }
        throw error;
      } finally {
        refreshInFlight.current = null;
      }
    })();
    refreshInFlight.current = promise;
    return promise;
  }, [clear]);

  const bootstrap = React.useCallback(async (): Promise<void> => {
    if (bootstrapInFlight.current) {
      return bootstrapInFlight.current;
    }
    const promise = (async () => {
      setStatus('unknown');
      let accessToken: string | null;
      try {
        accessToken = await refreshAccessToken();
      } catch {
        // Transient/infrastructure failure: the session is *unproven*, not
        // invalid. Keep any existing state and expose a recoverable error rather
        // than claiming the user is logged out.
        setStatus('error');
        return;
      }
      if (!accessToken) {
        // refreshAccessToken already confirmed unauthenticated (401) and cleared.
        return;
      }
      try {
        const me = await authApi.fetchMe(accessToken);
        setUser(me);
        setStatus('authenticated');
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthenticated) {
          clear();
          return;
        }
        // Access token obtained but /me failed transiently: recoverable.
        setStatus('error');
      }
    })();
    bootstrapInFlight.current = promise;
    try {
      await promise;
    } finally {
      bootstrapInFlight.current = null;
    }
  }, [refreshAccessToken, clear]);

  React.useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = React.useCallback(
    async (email: string, password: string, turnstileToken?: string | null) => {
      const result = await authApi.login(email, password, turnstileToken);
      tokenRef.current = result.accessToken;
      setUser(result.user);
      setStatus('authenticated');
    },
    [],
  );

  const logout = React.useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Logout is safe even if the backend session is already gone.
    } finally {
      clear();
    }
  }, [clear]);

  const authedRequest = React.useCallback(
    async <T,>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> => {
      const run = (token: string | null) =>
        apiRequest<T>(path, { ...options, accessToken: token ?? undefined });
      try {
        return await run(tokenRef.current);
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthenticated) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            throw error;
          }
          return run(refreshed);
        }
        throw error;
      }
    },
    [refreshAccessToken],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, user, login, logout, bootstrap, refreshAccessToken, authedRequest }),
    [status, user, login, logout, bootstrap, refreshAccessToken, authedRequest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
