describe("env", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function mockExpoConstants(extra: Record<string, unknown>) {
    jest.doMock("expo-constants", () => ({
      __esModule: true,
      default: { expoConfig: { extra } },
    }));
  }

  it("throws a readable error when API_BASE_URL is missing", () => {
    mockExpoConstants({});

    expect(() => require("./env")).toThrow(/API_BASE_URL/);
  });

  it("throws a readable error when API_BASE_URL is invalid", () => {
    mockExpoConstants({ API_BASE_URL: "not-a-url" });

    expect(() => require("./env")).toThrow(/API_BASE_URL/);
  });

  it("exposes a valid API_BASE_URL", () => {
    mockExpoConstants({ API_BASE_URL: "https://api.example.com/api/v1" });

    const { env } = require("./env");
    expect(env.API_BASE_URL).toBe("https://api.example.com/api/v1");
  });
});
