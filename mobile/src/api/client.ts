import axios, { AxiosError, InternalAxiosRequestConfig, isAxiosError } from "axios";

import { env } from "../lib/env";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "../lib/tokens";

export interface ApiError {
  code: string;
  message: string;
  details: Record<string, unknown>;
  status: number | null;
}

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

function isErrorEnvelope(data: unknown): data is ErrorEnvelope {
  if (typeof data !== "object" || data === null || !("error" in data)) {
    return false;
  }
  const candidate = (data as { error?: unknown }).error;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "code" in candidate &&
    "message" in candidate
  );
}

export function normalizeError(error: unknown): ApiError {
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status ?? null;
    const data = axiosError.response?.data;

    if (isErrorEnvelope(data)) {
      return {
        code: data.error.code,
        message: data.error.message,
        details: data.error.details ?? {},
        status,
      };
    }

    return {
      code: status === null ? "NETWORK_ERROR" : "UNKNOWN_ERROR",
      message: axiosError.message,
      details: {},
      status,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: error instanceof Error ? error.message : String(error),
    details: {},
    status: null,
  };
}

function generateRequestId(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type TokenRefreshedListener = (accessToken: string, refreshToken: string) => void;
type AuthFailureListener = () => void;

let tokenRefreshedListeners: TokenRefreshedListener[] = [];
let authFailureListeners: AuthFailureListener[] = [];

export function onTokenRefreshed(listener: TokenRefreshedListener): () => void {
  tokenRefreshedListeners.push(listener);
  return () => {
    tokenRefreshedListeners = tokenRefreshedListeners.filter((l) => l !== listener);
  };
}

export function onAuthFailure(listener: AuthFailureListener): () => void {
  authFailureListeners.push(listener);
  return () => {
    authFailureListeners = authFailureListeners.filter((l) => l !== listener);
  };
}

let isRefreshing = false;
let failedQueue: {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// eslint-disable-next-line import/no-named-as-default-member
export const apiClient = axios.create({
  baseURL: env.API_BASE_URL,
});

apiClient.interceptors.request.use(async (config) => {
  config.headers.set("X-Request-ID", generateRequestId());
  if (!config.headers.get("Authorization")) {
    const token = await getAccessToken();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!error.response || error.response.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    const url = originalRequest.url ?? "";
    if (
      url.includes("/auth/otp/request") ||
      url.includes("/auth/otp/verify") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/logout")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.set("Authorization", `Bearer ${token}`);
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    isRefreshing = true;

    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await axios.post<{ access_token: string; refresh_token: string }>(
        `${env.API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": generateRequestId(),
          },
        }
      );

      const { access_token, refresh_token } = response.data;
      await setAccessToken(access_token);
      await setRefreshToken(refresh_token);

      tokenRefreshedListeners.forEach((fn) => fn(access_token, refresh_token));
      processQueue(null, access_token);

      originalRequest.headers.set("Authorization", `Bearer ${access_token}`);
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      await clearTokens();
      authFailureListeners.forEach((fn) => fn());
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
