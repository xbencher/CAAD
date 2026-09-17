import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { http, HttpResponse } from "msw";
import React from "react";

import { server } from "../../src/test/msw/server";
import { useAuthStore } from "../../src/store/auth";
import DobScreen from "./dob";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    back: jest.fn(),
  }),
}));

const DOB_URL = "http://localhost:8000/api/v1/users/me/dob";
const USERS_ME_URL = "http://localhost:8000/api/v1/users/me";
const LOGOUT_URL = "http://localhost:8000/api/v1/auth/logout";

describe("DobScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      user: null,
      isLoading: false,
    });
  });

  it("shows error for incomplete date", async () => {
    const { getByTestId } = await render(<DobScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId("dob-day-input"), "15");
    });
    await act(async () => {
      fireEvent.press(getByTestId("dob-submit-button"));
    });

    await waitFor(() => {
      expect(getByTestId("dob-error-text")).toHaveTextContent(
        "Please enter your complete date of birth."
      );
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows error for invalid month", async () => {
    const { getByTestId } = await render(<DobScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId("dob-day-input"), "15");
    });
    await act(async () => {
      fireEvent.changeText(getByTestId("dob-month-input"), "13");
    });
    await act(async () => {
      fireEvent.changeText(getByTestId("dob-year-input"), "2000");
    });
    await act(async () => {
      fireEvent.press(getByTestId("dob-submit-button"));
    });

    await waitFor(() => {
      expect(getByTestId("dob-error-text")).toHaveTextContent("Invalid month.");
    });
  });

  it("submits valid 18+ DOB and navigates to consent screen", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(DOB_URL, async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(USERS_ME_URL, () => {
        return HttpResponse.json({
          id: "00000000-0000-0000-0000-000000000001",
          status: "pending_profile",
          has_dob: true,
          needs_consent: true,
          consents: [],
        });
      })
    );

    const { getByTestId } = await render(<DobScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId("dob-day-input"), "15");
    });
    await act(async () => {
      fireEvent.changeText(getByTestId("dob-month-input"), "08");
    });
    await act(async () => {
      fireEvent.changeText(getByTestId("dob-year-input"), "2000");
    });
    await act(async () => {
      fireEvent.press(getByTestId("dob-submit-button"));
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(onboarding)/consent");
    });

    expect(capturedBody).toEqual({ dob: "2000-08-15" });
  });

  it("handles BR-01 under-18 rejection by showing blocking modal and exiting to welcome", async () => {
    server.use(
      http.post(DOB_URL, () => {
        return HttpResponse.json(
          {
            error: {
              code: "AGE_RESTRICTED",
              message: "You must be 18 or older to use Proxi.",
              details: {},
            },
          },
          { status: 403 }
        );
      }),
      http.post(LOGOUT_URL, () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    const { getByTestId } = await render(<DobScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId("dob-day-input"), "10");
    });
    await act(async () => {
      fireEvent.changeText(getByTestId("dob-month-input"), "05");
    });
    await act(async () => {
      fireEvent.changeText(getByTestId("dob-year-input"), "2015");
    });
    await act(async () => {
      fireEvent.press(getByTestId("dob-submit-button"));
    });

    await waitFor(() => {
      expect(getByTestId("dob-blocked-modal")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("dob-blocked-dismiss-button"));
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(auth)/welcome");
    });
  });
});
