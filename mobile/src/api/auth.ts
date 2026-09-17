import { apiClient } from "./client";

export interface UserMe {
  id: string;
  status: "pending_profile" | "active" | "suspended" | "shadow_hidden" | "deactivated" | "deleted";
  has_dob: boolean;
  needs_consent: boolean;
  consents: {
    id: string;
    consent_type: "terms" | "privacy" | "location" | "marketing";
    version: string;
    granted_at: string;
    withdrawn_at: string | null;
  }[];
}

export interface VerifyOtpResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  is_new_user: boolean;
  user_status: UserMe["status"];
  user_id: string;
}

export async function requestOtp(phone: string): Promise<void> {
  await apiClient.post("/auth/otp/request", { phone });
}

export async function verifyOtp(
  phone: string,
  code: string,
  deviceId: string
): Promise<VerifyOtpResponse> {
  const resp = await apiClient.post<VerifyOtpResponse>("/auth/otp/verify", {
    phone,
    code,
    device_id: deviceId,
  });
  return resp.data;
}

export async function refreshTokens(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string }> {
  const resp = await apiClient.post<{ access_token: string; refresh_token: string }>(
    "/auth/refresh",
    {
      refresh_token: refreshToken,
    }
  );
  return resp.data;
}

export async function logout(refreshToken?: string): Promise<void> {
  await apiClient.post("/auth/logout", { refresh_token: refreshToken ?? null });
}

export async function getMe(): Promise<UserMe> {
  const resp = await apiClient.get<UserMe>("/users/me");
  return resp.data;
}

export async function setDob(dob: string): Promise<void> {
  await apiClient.post("/users/me/dob", { dob });
}

export async function grantConsent(
  consentType: "terms" | "privacy" | "location" | "marketing",
  version: string
): Promise<void> {
  await apiClient.post("/users/me/consents", {
    consent_type: consentType,
    version,
  });
}

export async function withdrawConsent(consentType: string): Promise<void> {
  await apiClient.delete(`/users/me/consents/${consentType}`);
}
