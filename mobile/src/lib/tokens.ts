import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "proxi_access_token";
const REFRESH_TOKEN_KEY = "proxi_refresh_token";
const DEVICE_ID_KEY = "proxi_device_id";

export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {}),
  ]);
}

function generateRandomUUID(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function getDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }
    const newId = generateRandomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, newId);
    return newId;
  } catch {
    return "fallback-device-id";
  }
}
