import { determineRoute, RouteGuardState } from "./RouteGuard";

describe("RouteGuard determineRoute (table-driven)", () => {
  const baseUser = {
    id: "user-123",
    status: "active" as const,
    has_dob: true,
    needs_consent: false,
    consents: [],
  };

  const cases: {
    name: string;
    state: RouteGuardState;
    expected: string;
  }[] = [
    {
      name: "unauthenticated -> welcome",
      state: { isAuthenticated: false, user: null },
      expected: "/(auth)/welcome",
    },
    {
      name: "authenticated but user is null -> welcome",
      state: { isAuthenticated: true, user: null },
      expected: "/(auth)/welcome",
    },
    {
      name: "suspended status -> blocked",
      state: {
        isAuthenticated: true,
        user: { ...baseUser, status: "suspended" },
      },
      expected: "/(auth)/blocked",
    },
    {
      name: "deleted status -> blocked",
      state: {
        isAuthenticated: true,
        user: { ...baseUser, status: "deleted" },
      },
      expected: "/(auth)/blocked",
    },
    {
      name: "pending_profile with no DOB -> dob screen",
      state: {
        isAuthenticated: true,
        user: { ...baseUser, status: "pending_profile", has_dob: false, needs_consent: true },
      },
      expected: "/(onboarding)/dob",
    },
    {
      name: "pending_profile with DOB set but needs consent -> consent screen",
      state: {
        isAuthenticated: true,
        user: { ...baseUser, status: "pending_profile", has_dob: true, needs_consent: true },
      },
      expected: "/(onboarding)/consent",
    },
    {
      name: "pending_profile with DOB and consents complete -> profile screen",
      state: {
        isAuthenticated: true,
        user: { ...baseUser, status: "pending_profile", has_dob: true, needs_consent: false },
      },
      expected: "/(onboarding)/profile",
    },
    {
      name: "active status -> app tabs",
      state: {
        isAuthenticated: true,
        user: { ...baseUser, status: "active" },
      },
      expected: "/(app)/tabs",
    },
  ];

  cases.forEach(({ name, state, expected }) => {
    it(name, () => {
      expect(determineRoute(state)).toBe(expected);
    });
  });
});
