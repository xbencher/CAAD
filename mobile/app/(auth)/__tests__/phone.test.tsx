import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { http, HttpResponse } from "msw";
import React from "react";

import { server } from "../../../src/test/msw/server";
import PhoneScreen from "../phone";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

const OTP_REQUEST_URL = "http://localhost:8000/api/v1/auth/otp/request";

describe("PhoneScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows error when submitting empty phone", async () => {
    const { getByTestId } = await render(<PhoneScreen />);
    await act(async () => {
      fireEvent.press(getByTestId("send-otp-button"));
    });

    await waitFor(() => {
      expect(getByTestId("phone-error-text")).toHaveTextContent("Phone number is required.");
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows error when phone does not start with 6-9", async () => {
    const { getByTestId } = await render(<PhoneScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId("phone-input"), "5555555555");
    });
    await act(async () => {
      fireEvent.press(getByTestId("send-otp-button"));
    });

    await waitFor(() => {
      expect(getByTestId("phone-error-text")).toHaveTextContent(
        "Mobile number must start with 6, 7, 8, or 9."
      );
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows error when phone is less than 10 digits", async () => {
    const { getByTestId } = await render(<PhoneScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId("phone-input"), "98765");
    });
    await act(async () => {
      fireEvent.press(getByTestId("send-otp-button"));
    });

    await waitFor(() => {
      expect(getByTestId("phone-error-text")).toHaveTextContent(
        "Mobile number must be exactly 10 digits."
      );
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("requests OTP and navigates to OTP screen for valid Indian phone", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(OTP_REQUEST_URL, async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 202 });
      })
    );

    const { getByTestId } = await render(<PhoneScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId("phone-input"), "9876543210");
    });
    await act(async () => {
      fireEvent.press(getByTestId("send-otp-button"));
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/(auth)/otp",
        params: { phone: "+919876543210" },
      });
    });

    expect(capturedBody).toEqual({ phone: "+919876543210" });
  });

  it("shows error message when backend returns 429 rate limit", async () => {
    server.use(
      http.post(OTP_REQUEST_URL, () => {
        return HttpResponse.json(
          {
            error: {
              code: "RATE_LIMITED",
              message: "Too many requests.",
              details: {},
            },
          },
          { status: 429 }
        );
      })
    );

    const { getByTestId } = await render(<PhoneScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId("phone-input"), "9876543210");
    });
    await act(async () => {
      fireEvent.press(getByTestId("send-otp-button"));
    });

    await waitFor(() => {
      expect(getByTestId("phone-error-text")).toHaveTextContent(
        "Too many requests. Please wait a few minutes before trying again."
      );
    });
  });
});
