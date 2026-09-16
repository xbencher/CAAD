import { AxiosError } from "axios";

import { normalizeError } from "./client";

describe("normalizeError", () => {
  it("normalizes a backend error envelope", () => {
    const error = new AxiosError(
      "Request failed with status code 409",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        status: 409,
        data: {
          error: {
            code: "ALREADY_EXISTS",
            message: "This request already exists.",
            details: { field: "recipient_id" },
          },
        },
      } as never,
    );

    expect(normalizeError(error)).toEqual({
      code: "ALREADY_EXISTS",
      message: "This request already exists.",
      details: { field: "recipient_id" },
      status: 409,
    });
  });

  it("normalizes a network error with no response", () => {
    const error = new AxiosError("Network Error", "ERR_NETWORK");

    expect(normalizeError(error)).toEqual({
      code: "NETWORK_ERROR",
      message: "Network Error",
      details: {},
      status: null,
    });
  });

  it("normalizes a non-axios error", () => {
    expect(normalizeError(new Error("boom"))).toEqual({
      code: "UNKNOWN_ERROR",
      message: "boom",
      details: {},
      status: null,
    });
  });
});
