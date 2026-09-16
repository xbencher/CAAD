// expo-constants has no native module to read `app.config.ts` from outside
// an actual Expo runtime, so `Constants.expoConfig` is `null` under Jest.
// This manual mock (auto-applied by Jest for node_modules packages) stands
// in for a real build's injected config. Tests for env.ts itself override
// this per-test with `jest.doMock` to exercise the missing/invalid cases.
export default {
  expoConfig: {
    extra: {
      API_BASE_URL: "http://localhost:8000/api/v1",
    },
  },
};
