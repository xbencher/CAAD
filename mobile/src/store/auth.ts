import { create } from "zustand";

import { getMe, logout as apiLogout, UserMe } from "../api/auth";
import { onAuthFailure, onTokenRefreshed } from "../api/client";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "../lib/tokens";

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: UserMe | null;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string, user?: UserMe) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: UserMe | null) => void;
  fetchUser: () => Promise<UserMe | null>;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Listen for background token refreshes from apiClient interceptor
  onTokenRefreshed((newAccess, newRefresh) => {
    set({
      accessToken: newAccess,
      refreshToken: newRefresh,
      isAuthenticated: true,
    });
  });

  // Listen for refresh failures (session revoked/expired)
  onAuthFailure(() => {
    set({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      user: null,
      isLoading: false,
    });
  });

  return {
    isAuthenticated: false,
    accessToken: null,
    refreshToken: null,
    user: null,
    isLoading: true,

    login: async (accessToken: string, refreshToken: string, user?: UserMe) => {
      await setAccessToken(accessToken);
      await setRefreshToken(refreshToken);
      set({
        isAuthenticated: true,
        accessToken,
        refreshToken,
        user: user ?? null,
        isLoading: false,
      });
      if (!user) {
        await get().fetchUser();
      }
    },

    logout: async () => {
      const { refreshToken } = get();
      try {
        await apiLogout(refreshToken ?? undefined);
      } catch {
        // Ignore logout request errors
      }
      await clearTokens();
      set({
        isAuthenticated: false,
        accessToken: null,
        refreshToken: null,
        user: null,
        isLoading: false,
      });
    },

    setUser: (user: UserMe | null) => {
      set({ user });
    },

    fetchUser: async () => {
      try {
        const user = await getMe();
        set({ user });
        return user;
      } catch {
        return null;
      }
    },

    initAuth: async () => {
      set({ isLoading: true });
      const [accessToken, refreshToken] = await Promise.all([
        getAccessToken(),
        getRefreshToken(),
      ]);

      if (!accessToken && !refreshToken) {
        set({
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          user: null,
          isLoading: false,
        });
        return;
      }

      set({
        accessToken,
        refreshToken,
        isAuthenticated: true,
      });

      try {
        const user = await getMe();
        set({ user, isLoading: false });
      } catch {
        // If initial getMe fails (e.g. invalid/expired and refresh failed), authFailure will trigger
        set({ isLoading: false });
      }
    },
  };
});
