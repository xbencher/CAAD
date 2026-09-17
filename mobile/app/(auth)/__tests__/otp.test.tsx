import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { http, HttpResponse } from "msw";
import React from "react";

import { server } from "../../../src/test/msw/server";
import OtpScreen from "../otp";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: mockBack,
  }),
  useLocalSearchParams: () => ({
    phone: "+919876543210",
  }),
}));

const OTP_VERIFY_URL = "http://localhost:8000/api/v1/auth/otp/verify";
const OTP_REQUEST_URL = "http://localhost:8000/api/v1/auth/otp/request";

describe("OtpScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("auto-submits when 6 digits are typed and logs in on success", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(OTP_VERIFY_URL, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          access_token: "access-token-123",
          refresh_token: "refresh-token-123",
          token_type: "bearer",
          is_new_user: true,
          user_status: "pending_profile",
          user_id: "00000000-0000-0000-0000-000000000001",
        });
      }),
      http.get("http://localhost:8000/api/v1/users/me", () => {
        return HttpResponse.json({
          id: "00000000-0000-0000-0000-000000000001",
          status: "pending_profile",
          has_dob: false,
          needs_consent: true,
          consents: [],
        });
      })
    );

    const { getByTestId } = await render(<OtpScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId("otp-input"), "123456");
    });

    await waitFor(() => {
      expect(capturedBody).toMatchObject({
        phone: "+919876543210",
        code: "123456",
      });
    });
  });

  it("shows error when wrong OTP is entered", async () => {
    server.use(
      http.post(OTP_VERIFY_URL, () => {
        return HttpResponse.json(
          {
            error: {
              code: "OTP_INVALID",
              message: "Invalid OTP.",
              details: {},
            },
          },
          { status: 400 }
        );
      })
    );

    const { getByTestId } = await render(<OtpScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId("otp-input"), "000000");
    });

    await waitFor(() => {
      expect(getByTestId("otp-error-text")).toHaveTextContent("Invalid OTP.");
    });
  });

  it("shows locked error when max attempts reached (BR-23)", async () => {
    server.use(
      http.post(OTP_VERIFY_URL, () => {
        return HttpResponse.json(
          {
            error: {
              code: "OTP_LOCKED",
              message: "Too many incorrect attempts. Request a new OTP.",
              details: {},
            },
          },
          { status: 429 }
        );
      })
    );

    const { getByTestId } = await render(<OtpScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId("otp-input"), "999999");
    });

    await waitFor(() => {
      expect(getByTestId("otp-error-text")).toHaveTextContent(
        "Too many incorrect attempts. Please request a new code."
      );
    });
  });

  it("shows countdown and enables resend after 60s", async () => {
    jest.useFakeTimers();

    const { getByTestId, queryByTestId } = await render(<OtpScreen />);
    expect(getByTestId("countdown-text")).toHaveTextContent("Resend code in 60s");

    // Fast-forward 60 seconds
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });

    expect(queryByTestId("resend-otp-button")).toBeTruthy();

    let resendCalled = false;
    server.use(
      http.post(OTP_REQUEST_URL, () => {
        resendCalled = true;
        return new HttpResponse(null, { status: 202 });
      })
    );

    // Switch back to real timers before network call + waitFor
    jest.useRealTimers();

    await act(async () => {
      fireEvent.press(getByTestId("resend-otp-button"));
    });

    await waitFor(() => {
      expect(resendCalled).toBe(true);
    });
  });
});
