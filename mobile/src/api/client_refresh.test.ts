import { http, HttpResponse } from "msw";

import { __resetStore, setItemAsync } from "../../__mocks__/expo-secure-store";
import { getAccessToken, getRefreshToken } from "../lib/tokens";
import { server } from "../test/msw/server";
import { apiClient, onAuthFailure } from "./client";

const BASE = "http://localhost:8000/api/v1";

describe("apiClient 401 single-flight token refresh interceptor", () => {
  beforeEach(() => {
    __resetStore();
    jest.clearAllMocks();
  });

  it("handles concurrent 401s by triggering a single refresh and retrying both requests", async () => {
    // Initial tokens in secure store
    await setItemAsync("proxi_access_token", "expired-access-token");
    await setItemAsync("proxi_refresh_token", "valid-refresh-token");

    let refreshCount = 0;
    let endpointACallCount = 0;
    let endpointBCallCount = 0;

    server.use(
      // Refresh endpoint
      http.post(`${BASE}/auth/refresh`, async ({ request }) => {
        refreshCount++;
        const body = (await request.json()) as { refresh_token: string };
        expect(body.refresh_token).toBe("valid-refresh-token");
        return HttpResponse.json({
          access_token: "new-access-token",
          refresh_token: "new-rotated-refresh-token",
        });
      }),

      // Protected endpoint A
      http.get(`${BASE}/users/endpoint-a`, ({ request }) => {
        endpointACallCount++;
        const auth = request.headers.get("Authorization");
        if (auth === "Bearer expired-access-token") {
          return new HttpResponse(null, { status: 401 });
        }
        if (auth === "Bearer new-access-token") {
          return HttpResponse.json({ data: "from-a" });
        }
        return new HttpResponse(null, { status: 403 });
      }),

      // Protected endpoint B
      http.get(`${BASE}/users/endpoint-b`, ({ request }) => {
        endpointBCallCount++;
        const auth = request.headers.get("Authorization");
        if (auth === "Bearer expired-access-token") {
          return new HttpResponse(null, { status: 401 });
        }
        if (auth === "Bearer new-access-token") {
          return HttpResponse.json({ data: "from-b" });
        }
        return new HttpResponse(null, { status: 403 });
      })
    );

    // Fire 2 concurrent requests that will both receive 401 with the expired token
    const [resA, resB] = await Promise.all([
      apiClient.get("/users/endpoint-a"),
      apiClient.get("/users/endpoint-b"),
    ]);

    // Both succeeded after retry
    expect(resA.data).toEqual({ data: "from-a" });
    expect(resB.data).toEqual({ data: "from-b" });

    // Exactly 1 refresh call was made
    expect(refreshCount).toBe(1);

    // Initial 401 call + retry call for each endpoint
    expect(endpointACallCount).toBe(2);
    expect(endpointBCallCount).toBe(2);

    // Tokens were updated in SecureStore
    expect(await getAccessToken()).toBe("new-access-token");
    expect(await getRefreshToken()).toBe("new-rotated-refresh-token");
  });

  it("clears tokens and notifies auth failure when refresh fails", async () => {
    await setItemAsync("proxi_access_token", "expired-access-token");
    await setItemAsync("proxi_refresh_token", "revoked-refresh-token");

    const authFailureHandler = jest.fn();
    const unsub = onAuthFailure(authFailureHandler);

    server.use(
      http.post(`${BASE}/auth/refresh`, () => {
        return HttpResponse.json(
          { error: { code: "TOKEN_REVOKED", message: "Revoked.", details: {} } },
          { status: 401 }
        );
      }),
      http.get(`${BASE}/users/endpoint-fail`, () => {
        return new HttpResponse(null, { status: 401 });
      })
    );

    await expect(apiClient.get("/users/endpoint-fail")).rejects.toThrow();

    expect(authFailureHandler).toHaveBeenCalled();
    expect(await getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();

    unsub();
  });
});
