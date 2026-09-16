import axios, { AxiosError } from "axios";

import { env } from "../lib/env";

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
  if (axios.isAxiosError(error)) {
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

export const apiClient = axios.create({
  baseURL: env.API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  config.headers.set("X-Request-ID", generateRequestId());
  return config;
});
