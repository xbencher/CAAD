import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import { http, HttpResponse } from "msw";
import React from "react";

import { server } from "../src/test/msw/server";
import HealthScreen from "./health";

const HEALTH_URL = "http://localhost:8000/api/v1/health";

let queryClient: QueryClient;

async function renderHealthScreen() {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return await render(
    <QueryClientProvider client={queryClient}>
      <HealthScreen />
    </QueryClientProvider>,
  );
}

describe("HealthScreen", () => {
  afterEach(() => {
    queryClient?.clear();
  });
  it('shows "ok" when the backend responds with 200', async () => {
    server.use(http.get(HEALTH_URL, () => HttpResponse.json({ status: "ok" })));

    await renderHealthScreen();

    await waitFor(() => expect(screen.getByTestId("health-status")).toHaveTextContent("ok"));
  });

  it("shows an error state when the backend responds with 500", async () => {
    server.use(
      http.get(HEALTH_URL, () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "boom", details: {} } },
          { status: 500 },
        ),
      ),
    );

    await renderHealthScreen();

    await waitFor(() =>
      expect(screen.getByTestId("health-status")).toHaveTextContent(/error: boom/),
    );
  });
});
